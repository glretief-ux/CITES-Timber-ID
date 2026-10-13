/* core.js - pure logic for the wood ID web app.
 * Runs in the browser (window.WoodCore) and in Node (module.exports) so it can be tested.
 * No DOM access here.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoodCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Same thresholds as src/quality.py (blur, flat areas, glare).
  var QUALITY = { minSharpness: 60.0, maxFlatFrac: 0.20, maxOverexposed: 0.08 };
  // Verdict thresholds on the pooled probability mass. Provisional until validated on held-out specimens.
  var VERDICT = { likely: 0.8, unknownMax: 0.2, lowTop1: 0.6 };

  function softmax(logits) {
    var max = -Infinity, i;
    for (i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
    var out = new Array(logits.length), sum = 0;
    for (i = 0; i < logits.length; i++) { out[i] = Math.exp(logits[i] - max); sum += out[i]; }
    for (i = 0; i < out.length; i++) out[i] /= sum;
    return out;
  }

  // Non-overlapping square patches, grid centred on the image, evenly subsampled if over the cap.
  function tilePatches(w, h, patchPx, maxPatches) {
    var s = Math.max(1, Math.min(patchPx, w, h));
    var nx = Math.floor(w / s), ny = Math.floor(h / s);
    var ox = Math.floor((w - nx * s) / 2), oy = Math.floor((h - ny * s) / 2);
    var tiles = [], i, j;
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) tiles.push({ x: ox + i * s, y: oy + j * s, s: s });
    if (tiles.length > maxPatches) {
      var sub = [];
      for (var k = 0; k < maxPatches; k++) sub.push(tiles[Math.floor(k * tiles.length / maxPatches)]);
      tiles = sub;
    }
    return tiles;
  }

  // RGBA bytes (size x size) -> Float32 CHW, normalised like torchvision (ImageNet mean/std).
  function toTensor(rgba, size, mean, std) {
    var n = size * size, out = new Float32Array(3 * n);
    for (var i = 0; i < n; i++) {
      out[i] = (rgba[4 * i] / 255 - mean[0]) / std[0];
      out[n + i] = (rgba[4 * i + 1] / 255 - mean[1]) / std[1];
      out[2 * n + i] = (rgba[4 * i + 2] / 255 - mean[2]) / std[2];
    }
    return out;
  }

  // Integer BT.601 grey, identical to Pillow's convert("L").
  function gray(rgba, size) {
    var n = size * size, g = new Uint8Array(n);
    for (var i = 0; i < n; i++) {
      g[i] = (rgba[4 * i] * 19595 + rgba[4 * i + 1] * 38470 + rgba[4 * i + 2] * 7471 + 32768) >> 16;
    }
    return g;
  }

  // Sharpness (variance of Laplacian), flat-block fraction, over-exposed fraction on a size x size RGBA patch.
  function qualityMetrics(rgba, size) {
    var g = gray(rgba, size), x, y;
    var sum = 0, sum2 = 0, cnt = 0;
    for (y = 1; y < size - 1; y++) {
      for (x = 1; x < size - 1; x++) {
        var c = g[y * size + x];
        var lap = -4 * c + g[(y - 1) * size + x] + g[(y + 1) * size + x] + g[y * size + x - 1] + g[y * size + x + 1];
        sum += lap; sum2 += lap * lap; cnt++;
      }
    }
    var mean = sum / cnt, sharpness = sum2 / cnt - mean * mean;

    var B = 8, nb = Math.floor(size / B), flat = 0;
    for (var by = 0; by < nb; by++) {
      for (var bx = 0; bx < nb; bx++) {
        var s = 0, s2 = 0;
        for (y = 0; y < B; y++) for (x = 0; x < B; x++) {
          var v = g[(by * B + y) * size + bx * B + x]; s += v; s2 += v * v;
        }
        var m = s / (B * B), sd = Math.sqrt(Math.max(0, s2 / (B * B) - m * m));
        if (sd < 2.0) flat++;
      }
    }
    var over = 0;
    for (var i = 0; i < g.length; i++) if (g[i] > 250) over++;
    return { sharpness: sharpness, flatFrac: flat / (nb * nb), overexposed: over / g.length };
  }

  function assessQuality(m) {
    var r = [];
    if (m.flatFrac > QUALITY.maxFlatFrac) r.push("flat_or_border");
    if (m.overexposed > QUALITY.maxOverexposed) r.push("overexposed");
    if (m.sharpness < QUALITY.minSharpness) r.push("blurry");
    return r;
  }

  function meanProbs(list) {
    var c = list[0].length, out = new Array(c).fill(0), i, j;
    for (i = 0; i < list.length; i++) for (j = 0; j < c; j++) out[j] += list[i][j];
    for (j = 0; j < c; j++) out[j] /= list.length;
    return out;
  }

  function rank(classes, probs, k) {
    return classes.map(function (c, i) { return { cls: c, p: probs[i] }; })
      .sort(function (a, b) { return b.p - a.p; }).slice(0, k);
  }

  function genusPool(classes, probs, info) {
    var m = {};
    classes.forEach(function (c, i) {
      var g = (info[c] && info[c].genus) || c.split("_")[0];
      m[g] = (m[g] || 0) + probs[i];
    });
    return Object.keys(m).map(function (g) { return { genus: g, p: m[g] }; })
      .sort(function (a, b) { return b.p - a.p; });
  }

  // Probability mass on classes that are CITES-listed / not listed / not in the scope table.
  function listedMass(classes, probs, info) {
    var r = { listed: 0, notListed: 0, unknown: 0 };
    classes.forEach(function (c, i) {
      var l = info[c] ? info[c].listed : null;
      if (l === true) r.listed += probs[i];
      else if (l === false) r.notListed += probs[i];
      else r.unknown += probs[i];
    });
    return r;
  }

  function verdict(mass, top1p) {
    if (mass.unknown > VERDICT.unknownMax) {
      return { level: "inconclusive", label: "Inconclusive", text: "Part of the answer falls on classes that are not in the CITES scope table. Check them on Species+." };
    }
    if (mass.listed >= VERDICT.likely) {
      return { level: "listed", label: "Likely CITES-listed", text: "Most of the model's weight is on CITES-listed taxa. Confirm before acting." };
    }
    if (mass.notListed >= VERDICT.likely) {
      return { level: "notlisted", label: "Likely not CITES-listed", text: "Most of the model's weight is on taxa that are not listed. Species not in the training set are not covered." };
    }
    return { level: "inconclusive", label: "Inconclusive", text: "The model splits its answer between listed and unlisted taxa. Send the sample to a wood anatomist." };
  }

  function pct(p) { return (100 * p).toFixed(1) + "%"; }

  function formatSummary(o) {
    var lines = [];
    lines.push("Wood ID result (investigative lead only, not forensic proof)");
    lines.push("Date: " + o.date);
    lines.push("Files: " + o.files.join(", "));
    lines.push("Model: " + o.model);
    lines.push("Patches analysed: " + o.patches + " (" + o.rejected + " flagged for quality)");
    lines.push("Verdict: " + o.verdict.label + " (listed " + pct(o.mass.listed) + ", not listed " + pct(o.mass.notListed) + ", unknown " + pct(o.mass.unknown) + ")");
    lines.push("Top candidates:");
    o.top.forEach(function (t) { lines.push("  " + pct(t.p) + "  " + t.cls.replace(/_/g, " ")); });
    return lines.join("\n");
  }

  return {
    QUALITY: QUALITY, VERDICT: VERDICT, softmax: softmax, tilePatches: tilePatches, toTensor: toTensor,
    gray: gray, qualityMetrics: qualityMetrics, assessQuality: assessQuality, meanProbs: meanProbs,
    rank: rank, genusPool: genusPool, listedMass: listedMass, verdict: verdict, pct: pct, formatSummary: formatSummary
  };
});

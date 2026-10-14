/* app.js - browser glue for the wood ID web app. Photos stay on the device. */
(function () {
  "use strict";
  var C = window.WoodCore;
  var ORT_CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
  var MAX_PER_IMAGE = 16, MAX_TOTAL = 48, BATCH = 8, QSIZE = 256;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    status: $("status"), file: $("file"), go: $("go"), patchPx: $("patchPx"), thumbs: $("thumbs"),
    progress: $("progress"), result: $("result"), model: $("modelinfo")
  };
  var state = { cfg: null, info: null, session: null, last: null };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function getJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(url + " -> HTTP " + r.status);
      return r.json();
    });
  }

  function setStatus(msg, kind) {
    els.status.textContent = msg;
    els.status.className = "status " + (kind || "");
  }

  function loadModel() {
    return Promise.all([getJSON("models/config.json"), getJSON("models/species_info.json")])
      .then(function (r) {
        state.cfg = r[0]; state.info = r[1];
        els.patchPx.value = state.cfg.patch_size_px;
        if (typeof ort === "undefined") throw new Error("onnxruntime-web could not be loaded (offline?)");
        ort.env.wasm.wasmPaths = ORT_CDN;
        return ort.InferenceSession.create("models/wood_id.onnx", { executionProviders: ["wasm"] });
      })
      .then(function (s) {
        state.session = s;
        els.model.textContent = "Model: " + state.cfg.arch + ", " + state.cfg.classes.length +
          " classes, built " + state.cfg.created;
        if (state.cfg.demo) setStatus("DEMO MODEL: " + (state.cfg.demo_note || "not a real result") + " Choose photos to try the flow.", "warn");
        else setStatus("Model ready. Choose one or more photos of the same sample.", "ok");
        els.go.disabled = els.file.files.length === 0;
      })
      .catch(function (e) {
        console.error(e);
        setStatus("No trained model is installed yet (" + e.message + "). Collect images, train, then run " +
          "export_onnx.py and build_web_assets.py. See README.", "warn");
        els.go.disabled = true;
      });
  }

  function drawTile(bmp, t, size, ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, t.x, t.y, t.s, t.s, 0, 0, size, size);
    return ctx.getImageData(0, 0, size, size).data;
  }

  function sleep() { return new Promise(function (r) { setTimeout(r, 0); }); }

  async function identify() {
    var files = Array.prototype.slice.call(els.file.files);
    if (!files.length || !state.session) return;
    els.go.disabled = true;
    els.result.textContent = "";
    var S = state.cfg.input_size, patchPx = parseInt(els.patchPx.value, 10) || state.cfg.patch_size_px;
    var c224 = document.createElement("canvas"); c224.width = c224.height = S;
    var c256 = document.createElement("canvas"); c256.width = c256.height = QSIZE;
    var x224 = c224.getContext("2d", { willReadFrequently: true });
    var x256 = c256.getContext("2d", { willReadFrequently: true });

    var tensors = [], flagged = 0, reasonCount = {}, total = 0, tooSmall = [];
    try {
      for (var f = 0; f < files.length; f++) {
        var bmp = await createImageBitmap(files[f]);
        var tiles = C.tilePatches(bmp.width, bmp.height, patchPx, Math.min(MAX_PER_IMAGE, MAX_TOTAL - total));
        if (Math.min(bmp.width, bmp.height) < patchPx) tooSmall.push(files[f].name + " (" + bmp.width + "x" + bmp.height + ")");
        for (var t = 0; t < tiles.length; t++) {
          els.progress.textContent = "Preparing patch " + (total + 1) + "...";
          var q = C.qualityMetrics(drawTile(bmp, tiles[t], QSIZE, x256), QSIZE);
          var why = C.assessQuality(q);
          if (why.length) { flagged++; why.forEach(function (w) { reasonCount[w] = (reasonCount[w] || 0) + 1; }); }
          // Blurry/flat patches are not used for the answer; if nothing else is left we fall back to all patches.
          tensors.push({ data: C.toTensor(drawTile(bmp, tiles[t], S, x224), S, state.cfg.mean, state.cfg.std), bad: why.length > 0 });
          total++;
          if (total % 4 === 0) await sleep();
        }
        bmp.close && bmp.close();
        if (total >= MAX_TOTAL) break;
      }
      var good = tensors.filter(function (x) { return !x.bad; });
      var used = good.length >= 1 ? good : tensors;
      var nC = state.cfg.classes.length, probs = [];
      for (var i = 0; i < used.length; i += BATCH) {
        var chunk = used.slice(i, i + BATCH), n = chunk.length;
        var buf = new Float32Array(n * 3 * S * S);
        chunk.forEach(function (x, k) { buf.set(x.data, k * 3 * S * S); });
        els.progress.textContent = "Analysing patches " + (i + 1) + "-" + (i + n) + " of " + used.length + "...";
        var out = await state.session.run({ input: new ort.Tensor("float32", buf, [n, 3, S, S]) });
        var logits = out[state.session.outputNames[0]].data;
        for (var k = 0; k < n; k++) probs.push(C.softmax(Array.prototype.slice.call(logits, k * nC, (k + 1) * nC)));
        await sleep();
      }
      els.progress.textContent = "";
      render(files, used.length, flagged, reasonCount, tooSmall, good.length === 0, probs);
    } catch (e) {
      console.error(e);
      els.progress.textContent = "";
      els.result.appendChild(el("div", "card warn", "Something went wrong: " + e.message));
    } finally {
      els.go.disabled = false;
    }
  }

  function bar(label, p, sub) {
    var row = el("div", "row");
    var head = el("div", "rowhead");
    head.appendChild(el("span", "name", label));
    head.appendChild(el("span", "pct", C.pct(p)));
    row.appendChild(head);
    var track = el("div", "track"), fill = el("div", "fill");
    fill.style.width = Math.max(0.5, 100 * p) + "%";
    track.appendChild(fill); row.appendChild(track);
    if (sub) row.appendChild(el("div", "sub", sub));
    return row;
  }

  function citesLine(i) {
    if (!i) return "No entry in the scope table. Check Species+.";
    if (i.listed === true) return "CITES Appendix " + i.appendix + (i.annotation ? ", annotation " + i.annotation : "") + " (" + i.basis + ").";
    if (i.listed === false) return "Not CITES-listed in this app's scope table (" + (i.check_status || "confirm on Species+") + ").";
    return "No entry in the scope table. Check Species+.";
  }

  function render(files, nPatches, flagged, reasonCount, tooSmall, usedAll, probs) {
    var cfg = state.cfg, info = state.info;
    var avg = C.meanProbs(probs);
    var top = C.rank(cfg.classes, avg, 5);
    var mass = C.listedMass(cfg.classes, avg, info);
    var v = C.verdict(mass, top[0].p);
    var res = els.result;

    if (cfg.demo) v = { level: "inconclusive", label: "DEMO MODEL - NOT A RESULT",
      text: (cfg.demo_note || "This model has not been tested.") + " Do not use this output to decide anything." };
    var card = el("div", "card verdict " + v.level);
    card.appendChild(el("div", "vlabel", v.label));
    card.appendChild(el("div", "vtext", v.text));
    card.appendChild(el("div", "vnums", "Listed " + C.pct(mass.listed) + " · not listed " + C.pct(mass.notListed) + (mass.unknown > 0.001 ? " · unknown " + C.pct(mass.unknown) : "")));
    res.appendChild(card);

    var warns = [];
    if (top[0].p < C.VERDICT.lowTop1) warns.push("Low confidence: the species may not be in the training set. Send the sample to a wood anatomist.");
    if (nPatches < 3) warns.push("Only " + nPatches + " patch(es) analysed. Add more photos of the same sample for a steadier answer.");
    if (flagged) warns.push(flagged + " patch(es) flagged for quality (" + Object.keys(reasonCount).map(function (k) { return reasonCount[k] + " " + k.replace(/_/g, " "); }).join(", ") + ")." + (usedAll ? " All patches were flagged, so they were used anyway: retake sharper, flatter photos." : " They were left out of the answer."));
    if (tooSmall.length) warns.push("Image smaller than the patch size: " + tooSmall.join(", ") + ". Use the same camera resolution as the training images.");
    if (warns.length) {
      var w = el("div", "card warn");
      warns.forEach(function (t) { w.appendChild(el("p", "", t)); });
      res.appendChild(w);
    }

    var cand = el("div", "card");
    cand.appendChild(el("h2", "", "Top candidates"));
    top.forEach(function (t) {
      var i = info[t.cls];
      var sub = citesLine(i) + (i && i.common_names ? " Also called: " + i.common_names + "." : "");
      cand.appendChild(bar(t.cls.replace(/_/g, " "), t.p, sub));
    });
    cand.appendChild(el("p", "fine", "Confidence is the model's own score, not a calibrated probability. Always confirm with wood anatomy or laboratory analysis."));
    res.appendChild(cand);

    var gp = C.genusPool(cfg.classes, avg, info).slice(0, 5);
    var gcard = el("div", "card");
    gcard.appendChild(el("h2", "", "By genus"));
    gcard.appendChild(el("p", "fine", "Several African listings cover a whole genus (Afzelia, Khaya, Pterocarpus, Dalbergia), so the genus is often what matters."));
    gp.forEach(function (g) { gcard.appendChild(bar(g.genus, g.p)); });
    res.appendChild(gcard);

    var summary = C.formatSummary({
      date: new Date().toISOString(), files: files.map(function (f) { return f.name; }),
      model: cfg.arch + ", " + cfg.classes.length + " classes, built " + cfg.created,
      patches: nPatches, rejected: flagged, verdict: v, mass: mass, top: top
    });
    var btn = el("button", "secondary", "Copy summary");
    btn.onclick = function () {
      navigator.clipboard.writeText(summary).then(function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy summary"; }, 1500); });
    };
    res.appendChild(btn);
  }

  els.file.addEventListener("change", function () {
    els.thumbs.textContent = "";
    Array.prototype.slice.call(els.file.files).slice(0, 12).forEach(function (f) {
      var img = el("img"); img.src = URL.createObjectURL(f); img.alt = f.name;
      img.onload = function () { URL.revokeObjectURL(img.src); };
      els.thumbs.appendChild(img);
    });
    els.go.disabled = !state.session || els.file.files.length === 0;
  });
  els.go.addEventListener("click", identify);
  els.go.disabled = true;
  loadModel();
})();

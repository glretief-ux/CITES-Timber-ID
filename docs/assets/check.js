/* Consignment check: timber + product form -> controlled or not, and which document. */
(function () {
  const { esc, chip, DOCS, loadTimber, $ } = TID;
  loadTimber().then(D => {
    const opts = new Map();
    const put = (label, t, sp) => { if (!opts.has(label.toLowerCase())) opts.set(label.toLowerCase(), { label, t, sp }); };
    D.taxa.forEach(t => t.species.forEach(s => put(s.name, t, s)));
    D.taxa.forEach(t => { put(t.scientific_name.split("(")[0].trim(), t); t.common_names.forEach(c => put(c + " (" + t.scientific_name.split("(")[0].trim() + ")", t)); });
    $("#txl").innerHTML = [...opts.values()].map(o => '<option value="' + esc(o.label) + '">').join("");
    $("#prods").innerHTML = D.products.map((p, i) => '<label><input type="radio" name="p" value="' + i + '"><span>' + esc(p.label) + "<small>" + esc(p.hs) + "</small></span></label>").join("");
    function run() {
      const o = opts.get($("#tx").value.trim().toLowerCase()), pi = (document.querySelector('input[name="p"]:checked') || {}).value;
      const V = $("#verdict");
      if (!o) { $("#txinfo").textContent = $("#tx").value.trim() ? "Not a listed timber name in this reference. Choose a name from the list, or look it up first." : "Use the name on the documents first, then repeat with the name you suspect."; V.innerHTML = '<div class="verdict"><div class="big">Pick a timber and a product form</div>The result appears here.</div>'; return; }
      const t = o.t; let codes = o.sp ? [o.sp.ann] : t.ann_codes, extra = "";
      if (o.sp && o.sp.name === "Dalbergia cochinchinensis") { codes = ["#4"]; extra = "Annotation #15 sends <i>Dalbergia cochinchinensis</i> to annotation #4: all parts and derivatives. "; }
      if (t.id === "dalbergia-spp") extra += "<i>Dalbergia</i> originating in and exported from Mexico follows annotation #6 (logs, sawn wood, veneer, plywood only). ";
      $("#txinfo").innerHTML = chip(o.sp ? o.sp.app : t.appendix) + " " + codes.map(c => '<span class="chip ann">' + (c === "none" ? "No annotation" : c) + "</span>").join(" ") + ' &nbsp;<a href="index.html#t/' + t.id + (o.sp ? "/" + encodeURIComponent(o.sp.name) : "") + '">Open profile and end-grain photos</a>';
      if (codes.length > 1) { V.innerHTML = '<div class="verdict P"><div class="big">Choose the exact species</div>This entry carries more than one annotation (' + esc(t.annotation) + "). Pick the species from the list.</div>"; return; }
      if (pi === undefined) { V.innerHTML = '<div class="verdict"><div class="big">Now pick the product form</div></div>'; return; }
      const code = codes[0], cv = D.coverage[code], s = cv.cells[+pi], p = D.products[+pi], app = o.sp ? o.sp.app : t.appendix;
      let h = '<div class="verdict ' + s + '"><div class="big">' + (s === "Y" ? "CITES documents required" : s === "N" ? "Not controlled by CITES in this form" : "Depends on the conditions below") + "</div>" +
        "<p><b class='sci'>" + esc(o.sp ? o.sp.name : t.scientific_name) + "</b>, " + esc(p.label.toLowerCase()) + " (" + esc(p.hs) + "). " + (code === "none" ? "No annotation" : "Annotation " + code) + ": " + esc(cv.note) + "</p>" + (extra ? "<p>" + extra + "</p>" : "");
      if (s !== "N") h += "<p><b>Ask for:</b> " + DOCS[app] + "</p>";
      if (app === "I") h += '<p><b>Appendix I:</b> commercial trade is prohibited. Expect only pre-Convention, scientific or other non-commercial movements, each with both permits.</p>';
      if (s === "N") h += "<p><b>Before you release:</b> confirm the goods really are in this form and not mis-described (squared logs declared as \"furniture parts\", sawn wood as \"transformed\"). National timber-legality and export-ban laws may still apply.</p>";
      h += "<p><b>Population covered:</b> " + esc(t.population_scope) + (o.sp && o.sp.note ? " " + esc(o.sp.note) : "") + "</p>";
      h += '<p class="small noprint"><a href="#permit">Check the permit</a> &nbsp;|&nbsp; <a href="field.html#sampling">Take samples</a> &nbsp;|&nbsp; <button class="btn ghost sm" onclick="print()">Print this result</button></p></div>';
      V.innerHTML = h;
    }
    $("#tx").addEventListener("input", run); $("#prods").addEventListener("change", run);
    const pre = D.byId[location.hash.slice(1)]; if (pre) { $("#tx").value = pre.species.length === 1 ? pre.species[0].name : pre.scientific_name.split("(")[0].trim(); run(); }
    const codes = Object.keys(D.coverage);
    $("#mx").innerHTML = "<thead><tr><th>Annotation</th>" + D.products.map(p => "<th>" + esc(p.label.split(/[:,]/)[0]) + "<br><span class='tiny'>" + esc(p.hs.replace("HS ", "")) + "</span></th>").join("") + "<th style='text-align:left'>Timbers</th></tr></thead><tbody>" +
      codes.map(c => { const who = D.taxa.filter(t => t.ann_codes.includes(c)); if (!who.length) return ""; return "<tr><td><b>" + (c === "none" ? "None" : c) + "</b></td>" + [...D.coverage[c].cells].map(x => '<td class="' + x + '">' + (x === "Y" ? "Yes" : x === "N" ? "No" : "Dep.") + "</td>").join("") +
        '<td class="small">' + who.map(t => '<a class="sci" href="index.html#t/' + t.id + '">' + esc(t.scientific_name.split(/[,(]/)[0].trim()) + "</a>").join(", ") + "</td></tr>"; }).join("") + "</tbody>";
  });
})();

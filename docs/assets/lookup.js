/* Lookup page: timber profiles + the full CITES plant and animal checklist. */
(function () {
  const { esc, fold, chip, DOCS, loadTimber, thumb, $, BASE } = TID;
  const out = $("#out"), q = $("#q"), sugg = $("#sugg");
  let DATA, INDEX = [], LISTED = new Set(), GENERA = new Map(), scope = "timber", active = -1, cur = [], LOOK = [];
  const spLink = n => "https://speciesplus.net/species#/taxon_concepts?taxonomy=cites_eu&taxon_concept_query=" + encodeURIComponent(n);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const PH = { timber: "Scientific, trade or common name, e.g. kosso, bubinga, Dalbergia latifolia", flora: "Any plant: scientific name, genus, family or common name, e.g. Aloe ferox, orchid", fauna: "Any animal: scientific name, genus, family or common name, e.g. Varanus, pangolin" };

  /* ---------------- timber index ---------------- */
  function expand(str) {
    const g = str.trim().split(/\s+/)[0], res = [];
    str.replace(/\(.*?\)/g, "").split(/,| and /).forEach(n => {
      n = n.trim(); if (!n) return;
      if (/^[A-Z]\.\s/.test(n)) n = g + " " + n.replace(/^[A-Z]\.\s*/, "");
      res.push(n);
    });
    return res;
  }
  function buildIndex() {
    const add = (label, ti, kind, extra) => { const key = fold(label); if (key) INDEX.push(Object.assign({ label, key, ti, kind }, extra)); };
    DATA.taxa.forEach((t, ti) => {
      expand(t.scientific_name).forEach(n => add(n, ti, "entry"));
      const syn = (t.scientific_name.match(/syn\.\s*([^)]+)/) || [])[1];
      if (syn) add(syn.trim(), ti, "syn", { acc: t.scientific_name.split("(")[0].trim() });
      t.species.forEach(s => { add(s.name, ti, "species", { sp: s.name }); LISTED.add(s.name.toLowerCase()); GENERA.set(s.name.split(" ")[0].toLowerCase(), ti); (s.trade || "").split(/,|\//).forEach(c => c.trim() && add(c.trim(), ti, "trade", { sp: s.name })); });
      t.synonyms.forEach(s => add(cap(s[0]), ti, "syn", { sp: cap(s[1]), acc: cap(s[1]) }));
      t.common_names.forEach(c => add(c, ti, "trade"));
      t.common.forEach(c => add(c[0], ti, "trade", { sp: c[2].replace(/ spp\.$/, ""), lang: c[1] }));
      (t.species_included || []).forEach(s => (s.trade || "").split(/,|\//).forEach(c => c.trim() && add(c.trim(), ti, "trade")));
    });
    DATA.taxa.forEach((t, ti) => t.lookalikes.forEach(l => {
      const m = l.match(/^([A-Z][a-z]+ [a-z-]+)/);
      if (m && !LISTED.has(m[1].toLowerCase())) {
        INDEX.push({ label: m[1], key: fold(m[1]), ti, kind: "look", full: l });
        const tr = (l.match(/\(([^)]+)\)/) || [])[1];
        if (tr) tr.split(/\/|,| - /).forEach(x => { x = x.trim(); if (x && x.length < 30 && !/not |listed|also|genus|asian|spruce/i.test(x)) INDEX.push({ label: x, key: fold(x), ti, kind: "look", full: l }); });
      }
    }));
    const seen = new Set();
    INDEX = INDEX.filter(e => { const k = e.key + "|" + e.ti + "|" + e.kind; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  function suggestTimber(v) {
    const n = fold(v); if (n.length < 2) return [];
    const res = [];
    for (const e of INDEX) {
      let s = 0;
      if (e.key === n) s = 100; else if (e.key.startsWith(n)) s = 80; else if (e.key.split(" ").some(w => w.startsWith(n))) s = 60; else if (n.length > 3 && e.key.includes(n)) s = 40;
      if (!s) continue;
      if (e.kind === "entry") s += 8; else if (e.kind === "species") s += 5; else if (e.kind === "look") s -= 3;
      res.push({ e, s });
    }
    res.sort((a, b) => b.s - a.s || a.e.label.length - b.e.label.length);
    const o = [], seen = new Set();
    for (const r of res) { const k = r.e.label.toLowerCase() + (r.e.kind === "look" ? "L" : r.e.ti); if (seen.has(k)) continue; seen.add(k); o.push(r); if (o.length >= 12) break; }
    return o;
  }
  const kindLabel = e => e.kind === "look" ? "look-alike, not listed" : e.kind === "syn" ? "old name of " + e.acc : e.kind === "trade" ? "trade name" + (e.sp ? ", " + e.sp : "") : "Appendix " + DATA.taxa[e.ti].appendix;

  /* ---------------- timber profile ---------------- */
  function deltaFor(t, name) { // CITESwoodID (DELTA) description page for one species of this entry
    const L = t.photo_links || []; if (!L.length) return null;
    const g = name.split(" ")[0];
    return L.find(l => expand(l.taxon).some(n => n.toLowerCase() === name.toLowerCase())) || L.find(l => new RegExp("^" + g + " spp", "i").test(l.taxon) || new RegExp("(^|, )" + g + " spp", "i").test(l.taxon)) || (L.length === 1 ? L[0] : null);
  }
  function deltaBlock(t, fsp) {
    const L = t.photo_links || [], hit = fsp && deltaFor(t, fsp.name);
    let h = '<div class="delta"><b>DELTA key (CITESwoodID)</b> ';
    if (hit) h += '<a class="btn sm" target="_blank" rel="noopener" href="' + esc(hit.url) + '">Open <span class="sci">' + esc(fsp.name) + "</span> on DELTA</a> ";
    else if (L.length === 1) h += '<a class="btn sm" target="_blank" rel="noopener" href="' + esc(L[0].url) + '">Open <span class="sci">' + esc(L[0].taxon) + "</span> on DELTA</a> ";
    if (L.length > 1) h += '<div class="pills" style="margin:8px 0 2px">' + L.map(l => '<a class="sci" target="_blank" rel="noopener" href="' + esc(l.url) + '">' + esc(l.taxon) + "</a>").join("") + "</div>";
    if (!L.length) h += '<span class="small">CITESwoodID has no description page for this timber. </span>';
    return h + '<a class="btn ghost sm" target="_blank" rel="noopener" href="' + DATA.delta.key + '">Interactive key</a> <a class="btn ghost sm" target="_blank" rel="noopener" href="' + DATA.delta.index + '">All DELTA descriptions</a>' +
      '<p class="tiny muted" style="margin:6px 0 0">Description, macroscopic images and identification key by the Th\u00fcnen Institute (Richter, Gembruch and Koch). Opens on delta-intkey.com.</p></div>';
  }
  function coverage(codes) {
    return codes.map(c => {
      const cv = DATA.coverage[c]; if (!cv) return "";
      return '<p class="small"><b>' + (c === "none" ? "No annotation" : "Annotation " + c) + ":</b> " + esc(cv.note) + '</p><div class="cov">' +
        DATA.products.map((p, i) => { const s = cv.cells[i]; return '<div class="' + s + '"><b>' + (s === "Y" ? "Controlled" : s === "N" ? "Not controlled" : "Depends") + "</b>" + esc(p.label) + '<br><span class="tiny muted">' + esc(p.hs) + "</span></div>"; }).join("") + "</div>";
    }).join("");
  }
  function gallery(t) {
    if (!t.photos.length) return '<div class="alert grey">' + (t.photo_links.length ? '<a class="btn" style="float:right;margin:0 0 6px 10px" target="_blank" rel="noopener" href="' + esc(t.photo_links[0].url) + '">See the 10x end-grain photo on DELTA</a>' : "") + 'No end-grain photograph that may legally be copied here has been found for this timber yet. ' + (t.photo_links.length ? "The published 10x photograph is one tap away on DELTA. " : "") +
      'If you hold a verified reference specimen, <a href="field.html#photos">add your own photo</a>.</div>';
    cur = t.photos;
    return '<div class="gallery">' + t.photos.map((p, i) =>
      '<button class="shot' + (p.listed === false ? " nl" : "") + '" data-i="' + i + '"><img loading="lazy" src="' + BASE + "photos/" + p.thumb + '" alt="End grain of ' + esc(p.species) + '">' +
      "<span><em>" + esc(p.species) + "</em>" + (p.listed === false ? '<br><b>Look-alike, not CITES-listed</b>' : "") + '<br><span class="muted">' + esc(p.optics || "") + "</span></span></button>").join("") + "</div>" +
      '<p class="tiny muted">Tap a photo to enlarge and zoom. Photos show the transverse (end-grain) surface. ' + esc([...new Set(t.photos.map(p => p.source + ", " + p.licence))].join("; ")) + '. <a href="about.html#credits">Full credits</a></p>';
  }
  function profile(ti, focus, note) {
    const t = DATA.taxa[ti], e = t.endgrain;
    const fsp = focus && t.species.find(s => s.name.toLowerCase() === focus.toLowerCase());
    const rows = [["Wood type", t.wood_type], ["Porosity", e.porosity], ["Pore size", e.pore_size], ["Pore frequency", e.pore_density], ["Pore arrangement", e.grouping],
      ["Pore contents", e.deposits || "none noted"], ["Axial parenchyma", (e.parenchyma || []).join(", ") || "not visible"], ["Rays", e.rays], ["Ripple marks (side face)", e.ripple_marks], ["Resin canals", e.resin_canals]]
      .filter(r => r[1]);
    const sl = t.species, big = sl.length > 12;
    const langs = { E: "English", S: "Spanish", F: "French" };
    const byLang = {}; t.common.forEach(c => (byLang[c[1]] = byLang[c[1]] || new Set()).add(c[0]));
    let h = '<article class="card" id="profile">';
    if (note) h += '<div class="alert blue">' + note + "</div>";
    h += '<div class="phead">' + thumb(t) + '<div style="flex:1;min-width:240px"><h2 class="sci">' + esc(t.scientific_name) + "</h2>" +
      '<div class="names">' + esc(t.common_names.join(", ")) + " &nbsp;|&nbsp; " + esc(t.family) + "</div>" +
      chip(t.appendix) + " " + t.ann_codes.map(c => '<span class="chip ann">' + (c === "none" ? "No annotation: all parts" : "Annotation " + c) + "</span>").join(" ") +
      ' <span class="chip ann">' + sl.length + " listed " + (sl.length === 1 ? "taxon" : "taxa") + "</span>" +
      '<div class="actions"><a class="btn sm" href="check.html#' + t.id + '">Check a consignment</a><button class="btn ghost sm" id="bprint">Print this sheet</button><button class="btn ghost sm" id="bcopy">Copy link</button>' +
      '<a class="btn ghost sm" target="_blank" rel="noopener" href="' + spLink((fsp || {}).name || t.scientific_name.split(/[,(]/)[0].replace("spp.", "").trim()) + '">Live listing on Species+</a></div></div></div>';
    if (fsp) h += '<div class="alert blue"><b class="sci">' + esc(fsp.name) + "</b> is covered by this entry: Appendix " + fsp.app + ", " + (fsp.ann === "none" ? "no annotation" : "annotation " + fsp.ann) +
      (fsp.note ? ". " + esc(fsp.note) : "") + (fsp.dist ? ". Native to " + esc(fsp.dist.replace(/,/g, ", ")) + "." : ".") + "</div>";
    h += '<div class="alert' + (t.appendix === "I" ? " red" : "") + '"><b>Population covered:</b> ' + esc(t.population_scope) + "</div>";
    h += '<div class="sect"><h3>What is controlled</h3>' + coverage(t.ann_codes) + (t.ann_codes.length > 1 ? '<p class="small">Listing text: ' + esc(t.annotation) + "</p>" : "") + "</div>";
    h += '<div class="sect"><h3>Documents the consignment needs</h3><p>' + DOCS[t.appendix] + '</p><p class="small"><a href="check.html#documents">How to check a permit</a></p></div>';
    h += '<div class="sect"><h3>End grain under the lens</h3>' + gallery(t) + deltaBlock(t, fsp) +
      '<div class="grid2" style="margin-top:12px"><div><p><b>What to look for.</b> ' + esc(t.key_diagnostic) + "</p>" +
      (e.special && e.special.length ? '<ul class="tight">' + e.special.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "") +
      '</div><figure style="margin:0"><img src="' + BASE + t.schematic + '" alt="Schematic drawing of the end grain" style="width:100%;max-width:340px;border:1px solid var(--line);border-radius:6px"><figcaption class="tiny muted">Schematic drawing built from the features below. Not a photograph.</figcaption></figure></div></div>';
    h += '<div class="sect grid2"><div><h3 style="margin-bottom:8px">Features at 10x</h3><table class="kv">' + rows.map(r => "<tr><th>" + r[0] + "</th><td>" + esc(r[1]) + "</td></tr>").join("") + "</table></div>" +
      '<div><h3 style="margin-bottom:8px">In the hand</h3><table class="kv"><tr><th>Heartwood</th><td>' + esc(t.heartwood) + "</td></tr><tr><th>Sapwood</th><td>" + esc(t.sapwood) + "</td></tr><tr><th>Density</th><td>" + esc(t.density) +
      "</td></tr><tr><th>Smell</th><td>" + esc(t.odour) + "</td></tr><tr><th>Native range</th><td>" + esc(t.range) + "</td></tr><tr><th>Listed since</th><td>" + esc(t.listed_since) + "</td></tr></table></div></div>";
    const mine = t.photos.find(p => p.listed !== false);
    LOOK = t.lookalikes.map(x => {
      const m = x.match(/^([A-Z][a-z]+)(?: (spp\.?|[a-z-]+))?/), r = { text: x };
      if (!m) return r;
      const nm = m[2] && !/^spp/.test(m[2]) ? m[1] + " " + m[2] : "";
      if (nm) { const e = INDEX.find(i => (i.kind === "species" || i.kind === "entry") && i.key === fold(nm)); if (e) { r.ti = e.ti; r.sp = nm; } else { const own = t.photos.find(p => p.listed === false && p.species === nm); if (own) r.photo = own; r.name = nm; } }
      else if (GENERA.has(m[1].toLowerCase())) r.ti = GENERA.get(m[1].toLowerCase());
      if (r.ti !== undefined) { const o = DATA.taxa[r.ti]; r.photo = o.photos.find(p => p.species === r.sp) || o.photos.find(p => p.listed !== false); r.o = o; }
      return r;
    });
    h += '<div class="sect"><h3>Look-alikes to rule out</h3><ul class="look">' + LOOK.map((r, i) => {
      const img = r.photo ? '<span class="lens sm ' + (r.o ? r.o.appendix : "") + '"><img loading="lazy" alt="" src="' + BASE + "photos/" + r.photo.thumb + '"></span>' : r.o ? '<span class="lens sm draw ' + r.o.appendix + '"><img loading="lazy" alt="" src="' + BASE + r.o.schematic + '"></span>' : '<span class="lens sm none"></span>';
      const label = r.o ? '<a href="#t/' + r.o.id + (r.sp ? "/" + encodeURIComponent(r.sp) : "") + '">' + esc(r.text) + "</a> " + chip(r.o.appendix) + ((d => d ? ' <a class="small" target="_blank" rel="noopener" href="' + esc(d.url) + '">DELTA key</a>' : "")(r.sp ? deltaFor(r.o, r.sp) : (r.o.photo_links || [])[0]))
        : esc(r.text) + ' <span class="chip nl">Not CITES-listed</span>' + ((k => k ? ' <a class="small" target="_blank" rel="noopener" href="' + DATA.delta.lookalikes[k] + '">DELTA key</a>' : "")(Object.keys(DATA.delta.lookalikes).sort((x, y) => y.length - x.length).find(k => r.text.indexOf(k) === 0))) + (r.name ? ' <a class="small" target="_blank" rel="noopener" href="https://www.wood-database.com/?s=' + encodeURIComponent(r.name) + '">photos on The Wood Database</a>' : "");
      return "<li>" + img + "<span>" + label + (r.photo && mine ? ' <button class="btn ghost sm cmpb" data-i="' + i + '">Compare end grain</button>' : "") + "</span></li>";
    }).join("") + '</ul><div id="cmp"></div><p><b>Beyond the hand lens:</b> ' + esc(t.lab_methods) + "</p></div>";
    const srow = s => "<tr" + (fsp && s === fsp ? ' style="background:var(--a3b)"' : "") + '><td><a class="sci" href="#t/' + t.id + "/" + encodeURIComponent(s.name) + '">' + esc(s.name) + "</a></td><td>" + s.app + "</td><td>" + esc(s.ann === "none" ? "none" : s.ann) + "</td><td>" + esc(s.trade || "") + "</td><td>" + esc((s.dist || "").replace(/,/g, ", ")) + "</td><td>" + ((d => d ? '<a target="_blank" rel="noopener" href="' + esc(d.url) + '">DELTA</a>' : "")(deltaFor(t, s.name))) + "</td></tr>";
    const stable = '<div class="scroll"><table><thead><tr><th>Listed taxon</th><th>App.</th><th>Annot.</th><th>Trade name</th><th>Native distribution</th><th>Key</th></tr></thead><tbody id="sprows">' + sl.map(srow).join("") + "</tbody></table></div>";
    h += '<div class="sect"><h3>Every listed species under this entry (' + sl.length + ")</h3>" +
      (big ? '<details class="more"' + (fsp ? " open" : "") + "><summary>Show all " + sl.length + ' names with native distribution</summary><div><input id="spf" placeholder="Filter this list" style="font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:6px;width:100%;max-width:320px;margin-bottom:8px">' + stable + "</div></details>" : stable) +
      '<p class="tiny muted">From the Species+ export of ' + esc(DATA.checklist.date) + ". Genus-wide listings cover every species of the genus within the stated populations, including names not shown here.</p></div>";
    if (t.synonyms.length || t.common.length) {
      h += '<div class="sect"><h3>Other names used on documents</h3>';
      Object.keys(langs).forEach(L => { if (byLang[L]) h += '<p class="small" style="margin-bottom:4px"><b>' + langs[L] + ':</b></p><div class="pills">' + [...byLang[L]].slice(0, 60).map(x => "<span>" + esc(x) + "</span>").join("") + "</div>"; });
      if (t.synonyms.length) h += '<details class="more"><summary>' + t.synonyms.length + ' old scientific names (synonyms)</summary><div class="small">' + t.synonyms.map(s => '<span class="sci">' + esc(cap(s[0])) + "</span> = " + '<span class="sci">' + esc(cap(s[1])) + "</span>").join("; ") + "</div></details>";
      h += "</div>";
    }
    h += '<div class="sect noprint"><h3>Published reference photographs and sources</h3><ul class="tight">' +
      t.photo_links.map(p => '<li><a target="_blank" rel="noopener" href="' + esc(p.url) + '"><span class="sci">' + esc(p.taxon) + "</span>: DELTA description, " + esc(p.source) + "</a></li>").join("") +
      t.references.map(r => '<li><a target="_blank" rel="noopener" href="' + esc(r.url) + '">' + esc(r.title) + "</a></li>").join("") + "</ul></div></article>";
    out.innerHTML = h;
    document.title = t.scientific_name.split("(")[0].trim() + " | CITES Timber ID";
    $("#bprint").onclick = () => { out.querySelectorAll("details").forEach(d => d.open = true); print(); };
    $("#bcopy").onclick = ev => { navigator.clipboard && navigator.clipboard.writeText(location.href); ev.target.textContent = "Link copied"; };
    const f = $("#spf"); if (f) f.oninput = () => { const v = f.value.toLowerCase(); $("#sprows").innerHTML = sl.filter(s => (s.name + " " + s.dist + " " + s.trade).toLowerCase().includes(v)).map(srow).join(""); };
    out.querySelectorAll(".shot").forEach(b => b.onclick = () => openLB(+b.dataset.i));
    out.querySelectorAll(".cmpb").forEach(b => b.onclick = () => {
      const r = LOOK[+b.dataset.i], fig = (p, title, note) => '<figure><a href="' + BASE + "photos/" + p.file + '" target="_blank"><img src="' + BASE + "photos/" + p.file + '" alt="End grain of ' + esc(p.species) + '"></a><figcaption><b>' + title + '</b><br><span class="sci">' + esc(p.species) + "</span>" + note + '<br><span class="tiny muted">' + esc(p.optics || "") + ". " + esc(p.source) + ", " + esc(p.licence) + "</span></figcaption></figure>";
      $("#cmp").innerHTML = '<div class="cmp">' + fig(mine, "This timber", "") + fig(r.photo, "Look-alike", r.o ? ", Appendix " + r.o.appendix : ", not CITES-listed") + '</div><p class="tiny muted">Tap a photo to open it full size. Magnification can differ between photos: compare the pattern of pores, pale tissue and rays, not their size.</p>';
      $("#cmp").scrollIntoView({ block: "nearest" });
    });
  }
  function showTimber(e) {
    if (e.kind === "look") {
      const tis = [...new Set(INDEX.filter(x => x.kind === "look" && x.key === e.key).map(x => x.ti))];
      out.innerHTML = '<article class="card"><h2><span class="sci">' + esc(e.label) + '</span> <span class="chip nl">Not found in the CITES timber listings</span></h2>' +
        '<div class="alert"><b>Known look-alike.</b> This name is often declared for, or confused with, the listed timbers below. If the wood in front of you does not match the declared name, treat it as possible mis-declaration and check the end grain.</div>' +
        '<div class="cards">' + tis.map(ti => card(DATA.taxa[ti])).join("") + '</div><p class="small muted" style="margin-top:12px">Listings change. Confirm on <a target="_blank" rel="noopener" href="' + spLink(e.label) + '">Species+</a>.</p></article>';
      history.replaceState(null, "", "#timber"); out.scrollIntoView({ block: "start" }); return;
    }
    const sp = e.sp || (e.kind === "species" ? e.label : "");
    history.replaceState(null, "", "#t/" + DATA.taxa[e.ti].id + (sp ? "/" + encodeURIComponent(sp) : ""));
    profile(e.ti, sp, e.kind === "syn" ? "<b class='sci'>" + esc(e.label) + "</b> is an old name. The accepted name is <b class='sci'>" + esc(e.acc) + "</b>." :
      e.kind === "trade" ? "<b>" + esc(e.label) + "</b> is a trade or common name used for this timber" + (e.sp ? " (<span class='sci'>" + esc(e.sp) + "</span>)" : "") + ". Trade names are not reliable: several woods share one name." : "");
    out.scrollIntoView({ block: "start" });
  }
  function lookupTimber(v) {
    const s = suggestTimber(v);
    if (s.length && s[0].s >= 60) return showTimber(s[0].e);
    const g = fold(v).split(" ")[0];
    if (GENERA.has(g)) { const ti = GENERA.get(g); history.replaceState(null, "", "#t/" + DATA.taxa[ti].id); profile(ti, "", "<b class='sci'>" + esc(v) + "</b> is not a name in the Species+ export, but the genus is listed. Check the population limits below and confirm the name on Species+."); return out.scrollIntoView(); }
    out.innerHTML = '<article class="card"><h2>No timber listing found for "' + esc(v) + '"</h2><p>The name is not among the ' + DATA.counts.species + ' listed tree taxa, their old names or trade names in this reference. That does not prove the wood is unlisted: the name may be misspelt, local, or deliberately wrong.</p>' +
      '<div class="actions"><button class="btn" id="tryflora">Search all CITES plants</button><a class="btn ghost" target="_blank" rel="noopener" href="' + spLink(v) + '">Search Species+</a><a class="btn ghost" href="key.html">Identify from the end grain</a></div></article>';
    $("#tryflora").onclick = () => { setScope("flora"); q.value = v; lookupWL("flora", v); };
  }

  /* ---------------- browse grid ---------------- */
  const card = t => '<a class="tcard" href="#t/' + t.id + '">' + thumb(t) + '<span><b class="sci">' + esc(t.scientific_name.split("(")[0].replace(/, /g, ", ")) + '</b><span class="cn">' + esc(t.common_names.slice(0, 3).join(", ")) + "</span>" + chip(t.appendix) + ' <span class="chip ann">' + esc(t.ann_codes.join(" ").replace("none", "all parts")) + "</span></span></a>";
  function grid() {
    const a = $("#fapp").value, r = $("#freg").value, w = $("#fwood").value, p = $("#fphoto").value;
    const list = DATA.taxa.filter(t => (!a || t.appendix === a) && (!r || (t.regions || []).includes(r)) && (!w || t.wood_type === w) && (!p || (p === "y") === (t.photos.length > 0)))
      .sort((x, y) => x.scientific_name.localeCompare(y.scientific_name));
    $("#cards").innerHTML = list.map(card).join("") || '<p class="muted">No entry matches these filters.</p>';
    $("#count").textContent = list.length + " of " + DATA.taxa.length + " entries";
  }

  /* ---------------- lightbox ---------------- */
  const lb = $("#lb"); let li = 0;
  function openLB(i) {
    li = (i + cur.length) % cur.length; const p = cur[li];
    lb.classList.add("on"); $("#lbstage").classList.remove("zoom");
    $("#lbimg").src = BASE + "photos/" + p.file; $("#lbimg").alt = "End grain of " + p.species;
    $("#lbcap").innerHTML = "<b class='sci'>" + esc(p.species) + "</b>" + (p.listed === false ? " (look-alike, not CITES-listed)" : "") + ". " + esc(p.surface || "") + ", " + esc(p.optics || "") + ".<br>" +
      esc(p.credit || p.source) + ". " + (p.licence_url ? '<a target="_blank" rel="noopener" href="' + p.licence_url + '">' + esc(p.licence) + "</a>" : esc(p.licence || "")) + ". Resized from the original." + " " + (li + 1) + " / " + cur.length;
  }
  $("#lbclose").onclick = () => lb.classList.remove("on");
  $("#lbprev").onclick = () => openLB(li - 1); $("#lbnext").onclick = () => openLB(li + 1);
  $("#lbzoom").onclick = $("#lbimg").onclick = () => $("#lbstage").classList.toggle("zoom");
  document.addEventListener("keydown", e => { if (!lb.classList.contains("on")) return; if (e.key === "Escape") lb.classList.remove("on"); if (e.key === "ArrowLeft") openLB(li - 1); if (e.key === "ArrowRight") openLB(li + 1); });

  /* ---------------- full checklist (plants, animals) ---------------- */
  const WL = { flora: {}, fauna: {} };
  function loadWL(kind) {
    const w = WL[kind]; if (w.p) return w.p;
    out.innerHTML = '<div class="card muted">Loading the full CITES ' + (kind === "flora" ? "plant" : "animal") + " checklist...</div>";
    return w.p = Promise.all([fetch(BASE + "checklist-" + kind + ".json").then(r => r.json()), fetch(BASE + "names-" + kind + ".json").then(r => r.json()).catch(() => ({ c: [], s: {} })), fetch(BASE + "wildlife.json").then(r => r.json()).catch(() => ({}))])
      .then(([d, n, g]) => {
        const S = d.S, m = () => new Map(), ix = { name: m(), genus: m(), fam: m(), ord: m(), cls: m() };
        const add = (mp, k, i) => { k = (k || "").toLowerCase(); if (!k) return; let a = mp.get(k); if (!a) mp.set(k, a = []); a.push(i); };
        d.T.forEach((t, i) => { const nm = t[0].toLowerCase(); add(ix.name, nm, i); add(ix.genus, nm.split(" ")[0], i); add(ix.fam, S[t[2]], i); add(ix.ord, S[t[3]], i); add(ix.cls, S[t[4]], i); });
        const cm = new Map(); n.c.forEach((e, i) => { const ks = new Set([fold(e[0])]); const mm = e[0].match(/^([^,]+),\s*(.+)$/); if (mm) ks.add(fold(mm[2] + " " + mm[1])); ks.forEach(k => { if (!k) return; let a = cm.get(k); if (!a) cm.set(k, a = []); a.push(i); }); });
        Object.assign(w, { d, n, ix, cm, ckeys: [...cm.keys()].sort(), groups: (g[kind] || []) });
        return w;
      }).catch(() => { w.p = null; out.innerHTML = '<div class="card">The checklist could not be loaded. Check the connection and try again.</div>'; throw 0; });
  }
  const tx = (w, i) => { const t = w.d.T[i], S = w.d.S; return { i, name: t[0], rank: ["species", "subspecies", "variety"][t[1]] || "species", fam: S[t[2]], ord: S[t[3]], cls: S[t[4]], app: t[5], party: S[t[6]], notes: t[8].map(x => w.d.N[x]), ann: t[9].map(x => w.d.A[x]), dist: w.d.D[t[10]] || "", grp: S[t[11]] }; };
  const chips = L => L.split("/").map(chip).join(" ");
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>Appendix $1:</b>").replace(/\n/g, "<br>");
  function suggestWL(kind, v) {
    const w = WL[kind]; if (!w.d) return [];
    const n = fold(v); if (n.length < 2) return [];
    const o = [], seen = new Set(), push = (label, small, go) => { if (seen.has(label) || o.length >= 12) return; seen.add(label); o.push({ label, small, go }); };
    for (const [mp, lab] of [[w.ix.cls, "class"], [w.ix.ord, "order"], [w.ix.fam, "family"], [w.ix.genus, "genus"]]) for (const k of mp.keys()) if (k.startsWith(n)) push(cap(k), lab + ", " + mp.get(k).length + " taxa", cap(k));
    const T = w.d.T; let lo = 0, hi = T.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (T[m][0].toLowerCase() < n) lo = m + 1; else hi = m; }
    for (let i = lo; i < T.length && T[i][0].toLowerCase().startsWith(n) && o.length < 9; i++) push(T[i][0], "Appendix " + T[i][5], T[i][0]);
    for (const k of w.ckeys) { if (o.length >= 12) break; if (k.startsWith(n) || (n.length > 3 && k.includes(" " + n))) { const c = w.n.c[w.cm.get(k)[0]]; push(c[0], "common name, " + c[2], c[0]); } }
    return o;
  }
  function taxonCard(kind, w, i, note) {
    const t = tx(w, i), iso = w.d.ISO || {};
    const g = w.groups.find(x => x.id === t.grp);
    const ti = kind === "flora" && DATA && GENERA.get(t.name.split(" ")[0].toLowerCase());
    let h = '<article class="card">' + (note ? '<div class="alert blue">' + note + "</div>" : "") + '<h2 class="sci">' + esc(t.name) + "</h2><p class='muted' style='margin:4px 0 10px'>" + esc([t.rank, t.fam, t.ord, t.cls].filter(Boolean).join(" | ")) + "</p>" + chips(t.app) +
      (t.party ? ' <span class="chip ann">Listed by ' + esc(t.party.split(",").map(c => iso[c] || c).join(", ")) + "</span>" : "") +
      '<div class="actions">' + (ti !== undefined && ti !== false ? '<a class="btn sm" href="#t/' + DATA.taxa[ti].id + "/" + encodeURIComponent(t.name) + '">Open the timber profile</a>' : "") + '<a class="btn ghost sm" target="_blank" rel="noopener" href="' + spLink(t.name) + '">Live listing on Species+</a></div>';
    if (t.notes.length) h += '<div class="sect"><h3>Listing notes</h3>' + t.notes.map(x => "<p>" + fmt(x) + "</p>").join("") + "</div>";
    h += '<div class="sect"><h3>What is controlled</h3>' + (t.ann.length ? t.ann.map(x => "<p>" + fmt(x) + "</p>").join("") : "<p>No annotation: every specimen, part and derivative is controlled" + (kind === "fauna" ? ", alive or dead" : "") + ".</p>") + "</div>";
    h += '<div class="sect"><h3>Documents the consignment needs</h3>' + t.app.split("/").map(a => "<p><b>Appendix " + a + ":</b> " + DOCS[a] + "</p>").join("") + "</div>";
    if (t.dist) h += '<div class="sect"><h3>Native distribution</h3><p>' + esc(t.dist.replace(/,/g, ", ")) + "</p></div>";
    if (g) h += '<div class="sect"><h3>' + esc(g.name) + ": what to check</h3><p>" + esc(g.summary || "") + "</p>" + (g.products ? "<p><b>Traded as:</b> " + esc(g.products.join(", ")) + "</p>" : "") + (g.checks ? '<ul class="tight">' + g.checks.map(c => "<li>" + esc(c) + "</li>").join("") + "</ul>" : "") + "</div>";
    return h + "</article>";
  }
  function listCard(kind, w, title, idxs, note) {
    const apps = {}; idxs.forEach(i => { const a = w.d.T[i][5]; apps[a] = (apps[a] || 0) + 1; });
    const lim = 400, rows = idxs.slice(0, lim).map(i => { const t = tx(w, i); return '<tr><td><a href="#' + kind + "/" + encodeURIComponent(t.name) + '" class="sci">' + esc(t.name) + "</a></td><td>" + chips(t.app) + "</td><td>" + esc(t.fam) + "</td><td>" + esc(t.dist.replace(/,/g, ", ").slice(0, 90)) + (t.dist.length > 90 ? "..." : "") + "</td></tr>"; }).join("");
    return '<article class="card">' + (note || "") + "<h2>" + title + '</h2><p class="muted">' + idxs.length.toLocaleString("en") + " listed taxa: " + Object.keys(apps).sort().map(a => apps[a] + " in Appendix " + a).join(", ") + '.</p><div class="scroll"><table><thead><tr><th>Taxon</th><th>Appendix</th><th>Family</th><th>Native distribution</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      (idxs.length > lim ? '<p class="small muted">Showing the first ' + lim + ". Type more of the name to narrow the list.</p>" : "") + "</article>";
  }
  function lookupWL(kind, v) {
    loadWL(kind).then(w => {
      history.replaceState(null, "", "#" + kind + (v ? "/" + encodeURIComponent(v) : ""));
      const what = kind === "flora" ? "plant" : "animal";
      if (!v) { out.innerHTML = '<div class="card"><h2>All CITES-listed ' + what + "s</h2><p>" + w.d.count.toLocaleString("en") + " listed taxa from the Species+ export of " + esc(w.d.meta.date) + ". Search by scientific name, genus, family, order, old name, or a common name in English, Spanish or French.</p>" +
        '<div class="pills">' + w.groups.map(g => '<a href="#' + kind + "/" + encodeURIComponent(g.names[0] || g.name) + '">' + esc(g.name) + "</a>").join("") + "</div>" + (kind === "flora" ? '<p class="small" style="margin-top:12px">Timber has full profiles with end-grain photos: switch to <a href="#timber">Timber</a>.</p>' : "") + "</div>"; return; }
      const n = v.trim().toLowerCase(), f = fold(v), ix = w.ix; let h = "";
      const grp = w.groups.find(g => g.names.concat(g.common, [g.name]).some(x => fold(x) === f));
      const gcard = grp ? '<div class="alert blue"><b>' + esc(grp.name) + ".</b> " + esc(grp.summary || "") + (grp.checks ? '<ul class="tight">' + grp.checks.map(c => "<li>" + esc(c) + "</li>").join("") + "</ul>" : "") + "</div>" : "";
      if (ix.name.has(n)) h = taxonCard(kind, w, ix.name.get(n)[0]);
      else if (w.n.s[n] && ix.name.has(w.n.s[n])) h = taxonCard(kind, w, ix.name.get(w.n.s[n])[0], "<b class='sci'>" + esc(cap(n)) + "</b> is an old name. The accepted name is <b class='sci'>" + esc(cap(w.n.s[n])) + "</b>.");
      else if (ix.genus.has(n)) h = listCard(kind, w, 'Genus <span class="sci">' + esc(cap(n)) + "</span>", ix.genus.get(n), gcard);
      else if (ix.fam.has(n)) h = listCard(kind, w, "Family " + esc(cap(n)), ix.fam.get(n), gcard);
      else if (ix.ord.has(n)) h = listCard(kind, w, "Order " + esc(cap(n)), ix.ord.get(n), gcard);
      else if (ix.cls.has(n)) h = listCard(kind, w, "Class " + esc(cap(n)), ix.cls.get(n), gcard);
      else {
        let hits = w.cm.get(f) || []; if (!hits.length) for (const k of w.ckeys) { if (k.startsWith(f) || k.includes(" " + f)) hits = hits.concat(w.cm.get(k)); if (hits.length > 60) break; }
        const targets = [...new Set(hits.map(i => w.n.c[i][2].split(" / ")[0].replace(/\s+spp?\.?$/i, "").trim()))];
        let idxs = []; targets.forEach(tg => { const k = tg.toLowerCase(); idxs = idxs.concat(ix.name.get(k) || ix.genus.get(k) || ix.fam.get(k) || ix.ord.get(k) || []); });
        idxs = [...new Set(idxs)];
        if (idxs.length === 1) h = taxonCard(kind, w, idxs[0], "<b>" + esc(v) + "</b> is a common name for this taxon. Common names are not reliable: check the scientific name on the documents.");
        else if (idxs.length) h = listCard(kind, w, 'Taxa called "' + esc(v) + '"', idxs, gcard);
        else if (grp) { let gi = []; grp.names.forEach(x => { const k = x.toLowerCase(); gi = gi.concat(ix.genus.get(k) || ix.fam.get(k) || ix.ord.get(k) || ix.name.get(k) || []); }); h = gi.length ? listCard(kind, w, esc(grp.name), [...new Set(gi)], gcard) : '<article class="card">' + gcard + "</article>"; }
        else {
          const pre = []; for (const [k, a] of ix.name) { if (k.startsWith(n) || k.includes(" " + n)) pre.push(a[0]); if (pre.length > 400) break; }
          h = pre.length ? listCard(kind, w, 'Names containing "' + esc(v) + '"', pre) :
            '<article class="card"><h2>No CITES-listed ' + what + ' found for "' + esc(v) + '"</h2><p>Not in the Species+ export of ' + esc(w.d.meta.date) + " under that scientific name, old name or common name. Check the spelling, try the genus alone, or search the live database.</p>" +
            '<div class="actions"><a class="btn ghost" target="_blank" rel="noopener" href="' + spLink(v) + '">Search Species+</a></div></article>';
        }
      }
      out.innerHTML = h;
    }).catch(() => {});
  }

  /* ---------------- search box wiring ---------------- */
  function setScope(s) {
    scope = s; document.querySelectorAll(".scope button").forEach(b => b.setAttribute("aria-selected", b.dataset.scope === s));
    q.placeholder = PH[s]; $("#browse").style.display = s === "timber" ? "" : "none"; $("#try").style.display = s === "timber" ? "" : "none";
    sugg.style.display = "none";
  }
  function showSugg() {
    const v = q.value; active = -1;
    const list = scope === "timber" ? suggestTimber(v).map(r => ({ label: r.e.label, small: kindLabel(r.e), e: r.e, it: r.e.kind !== "trade" })) : suggestWL(scope, v).map(r => Object.assign(r, { it: !/common|class|order|family/.test(r.small) }));
    if (!list.length) { sugg.style.display = "none"; return; }
    sugg.innerHTML = list.map((r, i) => '<div role="option" data-i="' + i + '"><span' + (r.it ? ' class="sci"' : "") + ">" + esc(r.label) + "</span><small>" + esc(r.small) + "</small></div>").join("");
    sugg.style.display = "block";
    sugg.querySelectorAll("div").forEach(d => d.onmousedown = ev => { ev.preventDefault(); pick(list[+d.dataset.i]); });
    sugg._list = list;
  }
  function pick(r) { sugg.style.display = "none"; q.value = r.label; if (scope === "timber") showTimber(r.e); else lookupWL(scope, r.go); }
  function go() { const v = q.value.trim(); sugg.style.display = "none"; if (!v) { if (scope !== "timber") lookupWL(scope, ""); return; } if (scope === "timber") lookupTimber(v); else lookupWL(scope, v); }
  q.addEventListener("input", showSugg);
  q.addEventListener("keydown", e => {
    const items = sugg.querySelectorAll("div");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { if (!items.length) return; e.preventDefault(); active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items.forEach((d, i) => d.setAttribute("aria-selected", i === active)); items[active].scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Enter") { e.preventDefault(); if (active >= 0 && sugg._list) pick(sugg._list[active]); else go(); }
    else if (e.key === "Escape") sugg.style.display = "none";
  });
  q.addEventListener("blur", () => setTimeout(() => sugg.style.display = "none", 150));
  $("#go").onclick = go;
  document.querySelectorAll(".scope button").forEach(b => b.onclick = () => { setScope(b.dataset.scope); q.value = ""; if (b.dataset.scope === "timber") { out.innerHTML = ""; history.replaceState(null, "", "#timber"); } else lookupWL(b.dataset.scope, ""); q.focus(); });
  document.querySelectorAll("#try button").forEach(b => b.onclick = () => { q.value = b.textContent; go(); });

  function route() {
    const h = decodeURIComponent(location.hash.slice(1)), p = h.split("/");
    if (p[0] === "t" && DATA.byId[p[1]]) { setScope("timber"); profile(DATA.taxa.indexOf(DATA.byId[p[1]]), p.slice(2).join("/")); out.scrollIntoView({ block: "start" }); }
    else if (p[0] === "flora" || p[0] === "fauna") { setScope(p[0]); const v = p.slice(1).join("/"); q.value = v; lookupWL(p[0], v); }
    else { setScope("timber"); if (h === "name" || h === "timber" || !h) out.innerHTML = ""; }
  }
  loadTimber().then(d => {
    DATA = d; buildIndex();
    $("#stat").innerHTML = "<b>" + d.counts.species + "</b> listed tree taxa in <b>" + d.counts.entries + "</b> identification entries, <b>" + d.counts.photos + "</b> end-grain photographs. " + esc(d.listing_basis);
    ["fapp", "freg", "fwood", "fphoto"].forEach(id => $("#" + id).onchange = grid); grid(); route();
    window.addEventListener("hashchange", route);
  }).catch(() => { out.innerHTML = '<div class="card">The data could not be loaded. Open this page through GitHub Pages or a local web server, not as a file.</div>'; });
})();

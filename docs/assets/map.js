/* Country map: pick a country, list every CITES-listed species native to it. */
(function () {
  const { esc, chip, loadTimber, $, BASE } = TID;
  const svg = $("#world"), sel = $("#csel"), res = $("#res");
  const RAMP = ["#dfe5e2", "#c5ddd6", "#93c2b6", "#5d9e90", "#2c7567", "#0a4a41"];
  const JOIN = new Set(["SAR", "Province of China", "Saint Eustatius and Saba"]);
  const split = s => { const o = []; (s || "").split(",").forEach(x => { x = x.trim(); if (!x) return; if (JOIN.has(x) && o.length) o[o.length - 1] += " " + x; else o.push(x); }); return o; };
  const DATA = {}; let W, scope = "timber", country = "", vb = [0, 0, 1000, 500];
  const WHAT = { timber: "timber taxa", flora: "plants", fauna: "animals" };

  function index(rows) { const by = new Map(); rows.forEach(r => split(r.dist).forEach(c => { let a = by.get(c); if (!a) by.set(c, a = []); a.push(r); })); return by; }
  function load(kind) {
    if (DATA[kind]) return DATA[kind];
    if (kind === "timber") return DATA[kind] = loadTimber().then(D => { const rows = []; D.taxa.forEach(t => t.species.forEach(s => rows.push({ name: s.name, app: s.app, ann: s.ann, dist: s.dist, extra: t.common_names.slice(0, 2).join(", "), href: "index.html#t/" + t.id + "/" + encodeURIComponent(s.name), fam: t.family }))); return { by: index(rows), date: D.checklist.date }; });
    return DATA[kind] = fetch(BASE + "checklist-" + kind + ".json").then(r => r.json()).then(d => { const S = d.S; const rows = d.T.map(t => ({ name: t[0], app: t[5], ann: "", dist: d.D[t[10]] || "", extra: S[t[2]], href: "index.html#" + kind + "/" + encodeURIComponent(t[0]), fam: S[t[3]] || S[t[4]] })); return { by: index(rows), date: d.meta.date }; });
  }
  function paint(by) {
    counts = {}; let max = 0;
    by.forEach((a, c) => { const id = W.names[c]; if (id) { counts[id] = (counts[id] || 0) + a.length; max = Math.max(max, counts[id]); } });
    const steps = max > 400 ? [1, 25, 100, 400, 1000] : max > 60 ? [1, 5, 20, 60, 150] : [1, 3, 8, 20, 50];
    const col = n => { let i = 0; steps.forEach((s, k) => { if (n >= s) i = k + 1; }); return RAMP[i]; };
    svg.querySelectorAll("[data-id]").forEach(el => el.setAttribute("fill", col(counts[el.dataset.id] || 0)));
    $("#legend").innerHTML = "Listed " + WHAT[scope] + " native to the country: " + ['<span><i style="background:' + RAMP[0] + '"></i>none</span>'].concat(steps.map((s, k) => '<span><i style="background:' + RAMP[k + 1] + '"></i>' + s + (k < 4 ? "–" + (steps[k + 1] - 1) : "+") + "</span>")).join("") + '<span class="muted">Dots are small states and islands.</span>';
  }
  function show() {
    svg.querySelectorAll(".on").forEach(e => e.classList.remove("on")); svg.querySelectorAll("text.sel").forEach(e => e.classList.remove("sel"));
    if (!country) { res.innerHTML = '<div class="card muted">No country selected yet.</div>'; return; }
    const id = W.names[country]; if (id) { svg.querySelectorAll('[data-id="' + id + '"]').forEach(e => e.classList.add("on")); const t = svg.querySelector('text[data-lid="' + id + '"]'); if (t) { t.classList.add("sel"); svg.appendChild(t); } relabel(); }
    res.innerHTML = '<div class="card muted">Loading...</div>';
    load(scope).then(d => {
      const rows = (d.by.get(country) || []).slice().sort((a, b) => a.name.localeCompare(b.name));
      const apps = {}; rows.forEach(r => apps[r.app] = (apps[r.app] || 0) + 1);
      let h = '<article class="card"><h2>' + esc(country) + '</h2><p class="muted" style="margin:4px 0 10px">' + rows.length.toLocaleString("en") + " CITES-listed " + WHAT[scope] + " occur naturally here" +
        (rows.length ? ": " + Object.keys(apps).sort().map(a => apps[a] + " in Appendix " + a).join(", ") : "") + ". Species+ export of " + esc(d.date) + ".</p>";
      if (!rows.length) h += '<div class="alert grey">No listed ' + WHAT[scope] + " are recorded as native to this country. Wood declared as originating here from a listed species deserves a closer look: it may be a re-export, plantation-grown, or mis-declared.</div>";
      else {
        h += '<div class="filters"><input id="rf" placeholder="Filter by name or family" style="font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:6px;flex:1;min-width:180px;max-width:340px"><select id="ra"><option value="">Any Appendix</option>' + Object.keys(apps).sort().map(a => '<option value="' + a + '">Appendix ' + a + "</option>").join("") + '</select><button class="btn ghost sm" id="rp">Print list</button><span class="count" id="rc"></span></div>' +
          '<div class="scroll"><table><thead><tr><th>Species</th><th>Appendix</th>' + (scope === "timber" ? "<th>Annotation</th><th>Trade names</th>" : "<th>Family</th>") + '<th>Also native to</th></tr></thead><tbody id="rb"></tbody></table></div>';
      }
      h += '<p class="small muted" style="margin-top:12px">Native distribution as recorded on Species+. A species can also be grown or re-exported elsewhere, and some listings cover only certain populations: open the species to check.</p></article>';
      res.innerHTML = h;
      if (!rows.length) return;
      const draw = () => {
        const f = $("#rf").value.toLowerCase(), a = $("#ra").value;
        const L = rows.filter(r => (!a || r.app.split("/").includes(a)) && (!f || (r.name + " " + r.extra + " " + r.fam).toLowerCase().includes(f)));
        $("#rc").textContent = L.length.toLocaleString("en") + " shown";
        $("#rb").innerHTML = L.slice(0, 600).map(r => { const o = split(r.dist).filter(c => c !== country); return '<tr><td><a class="sci" href="' + r.href + '">' + esc(r.name) + "</a></td><td>" + r.app.split("/").map(chip).join(" ") + "</td>" + (scope === "timber" ? "<td>" + esc(r.ann === "none" ? "all parts" : r.ann) + "</td><td>" + esc(r.extra) + "</td>" : "<td>" + esc(r.extra) + "</td>") + '<td class="small">' + (o.length ? esc(o.slice(0, 8).join(", ")) + (o.length > 8 ? " and " + (o.length - 8) + " more" : "") : "<b>Only this country</b>") + "</td></tr>"; }).join("") +
          (L.length > 600 ? '<tr><td colspan="5" class="muted">Showing the first 600. Use the filter to narrow the list.</td></tr>' : "");
      };
      $("#rf").oninput = draw; $("#ra").onchange = draw; $("#rp").onclick = () => print(); draw();
    }).catch(() => { res.innerHTML = '<div class="card">The data could not be loaded. Check the connection and try again.</div>'; });
  }
  function pick(c, scroll) { country = c; sel.value = c; history.replaceState(null, "", "#" + scope + (c ? "/" + encodeURIComponent(c) : "")); show(); if (scroll && c) res.scrollIntoView({ block: "start" }); }
  function setScope(s) {
    scope = s; document.querySelectorAll(".scope button").forEach(b => b.setAttribute("aria-selected", b.dataset.scope === s));
    load(s).then(d => { paint(d.by); const cur = sel.value; sel.innerHTML = '<option value="">Choose a country</option>' + [...d.by.keys()].sort((a, b) => a.localeCompare(b)).map(c => '<option value="' + esc(c) + '">' + esc(c) + " (" + d.by.get(c).length + ")</option>").join(""); sel.value = cur; });
  }
  const SHORT = { "United States of America": "USA", "Dem. Rep. Congo": "DR Congo", "Central African Rep.": "C. African Rep.", "United Kingdom": "UK", "Dominican Rep.": "Dominican Rep.", "Bosnia and Herz.": "Bosnia", "Papua New Guinea": "Papua N. Guinea", "United Arab Emirates": "UAE" };
  let counts = {};
  function relabel() { // names stay the same size on screen; more of them appear as you zoom in
    const k = 1000 / vb[2], fs = Math.max(1.2, 9.5 / k);
    svg.querySelectorAll("text").forEach(t => {
      const need = t.dataset.len * 70 / (k * k), on = t.classList.contains("sel");
      t.style.display = on || +t.dataset.area >= need || (k >= 5 && +t.dataset.area === 0) || k >= 9 ? "" : "none";
      t.setAttribute("font-size", on ? fs * 1.25 : fs);
    });
    svg.querySelectorAll("circle").forEach(c => c.setAttribute("r", Math.max(0.6, 3 / Math.sqrt(k))));
  }
  const setVB = () => { svg.setAttribute("viewBox", vb.join(" ")); relabel(); };
  function zoomAt(k, px, py) { // keep the point (px, py) under the finger
    const w = Math.min(1000, Math.max(40, vb[2] * k)), h = w / 2, fx = (px - vb[0]) / vb[2], fy = (py - vb[1]) / vb[3];
    vb = [Math.min(1000 - w, Math.max(0, px - fx * w)), Math.min(500 - h, Math.max(0, py - fy * h)), w, h]; setVB();
  }
  const zoom = k => zoomAt(k, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
  const toMap = e => { const r = svg.getBoundingClientRect(); return [vb[0] + (e.clientX - r.left) / r.width * vb[2], vb[1] + (e.clientY - r.top) / r.height * vb[3]]; };
  function focusOn(id) { const L = W.labels[id]; if (!L) return; const w = Math.min(1000, Math.max(110, Math.sqrt(L[2] || 40) * 9)), h = w / 2; vb = [Math.min(1000 - w, Math.max(0, L[0] - w / 2)), Math.min(500 - h, Math.max(0, L[1] - h / 2)), w, h]; setVB(); }

  Promise.all([fetch(BASE + "assets/world.json").then(r => r.json()), load("timber")]).then(([w]) => {
    W = w; const byId = {}; Object.keys(w.names).forEach(n => (byId[w.names[n]] = byId[w.names[n]] || []).push(n));
    svg.innerHTML = Object.keys(w.shapes).map(id => '<path data-id="' + id + '" d="' + w.shapes[id] + '"></path>').join("") +
      Object.keys(w.dots).map(id => '<circle data-id="' + id + '" cx="' + w.dots[id][0] + '" cy="' + w.dots[id][1] + '" r="3"></circle>').join("") +
      Object.keys(w.labels).map(id => { const L = w.labels[id], n = SHORT[L[3]] || L[3]; return '<text data-lid="' + id + '" data-area="' + L[2] + '" data-len="' + n.length + '" x="' + L[0] + '" y="' + (L[2] ? L[1] : L[1] - 2.5) + '">' + esc(n) + "</text>"; }).join("");
    const tip = $("#tip"), ptrs = new Map(); let start = null, moved = false, pinch = 0;
    const nameOf = id => (byId[id] || [])[0] || (w.labels[id] || [])[3] || "";
    svg.addEventListener("pointerdown", e => { ptrs.set(e.pointerId, e); if (ptrs.size === 1) { start = { x: e.clientX, y: e.clientY, vb: vb.slice() }; moved = false; } else { const p = [...ptrs.values()]; pinch = Math.hypot(p[0].clientX - p[1].clientX, p[0].clientY - p[1].clientY); moved = true; } });
    svg.addEventListener("pointermove", e => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, e);
      if (ptrs.size === 2) { const p = [...ptrs.values()], d = Math.hypot(p[0].clientX - p[1].clientX, p[0].clientY - p[1].clientY); if (pinch && d) { const m = toMap({ clientX: (p[0].clientX + p[1].clientX) / 2, clientY: (p[0].clientY + p[1].clientY) / 2 }); zoomAt(pinch / d, m[0], m[1]); pinch = d; } return; }
      if (ptrs.size === 1 && start) { const dx = e.clientX - start.x, dy = e.clientY - start.y; if (Math.abs(dx) + Math.abs(dy) > 14) { moved = true; const k = vb[2] / svg.clientWidth; vb[0] = Math.min(1000 - vb[2], Math.max(0, start.vb[0] - dx * k)); vb[1] = Math.min(500 - vb[3], Math.max(0, start.vb[1] - dy * k)); svg.setAttribute("viewBox", vb.join(" ")); } return; }
      const id = e.target.dataset && e.target.dataset.id; // mouse hover
      if (id && e.pointerType === "mouse") { const r = svg.parentNode.getBoundingClientRect(); tip.style.display = "block"; tip.style.left = e.clientX - r.left + 12 + "px"; tip.style.top = e.clientY - r.top + 12 + "px"; tip.innerHTML = "<b>" + esc(nameOf(id)) + "</b><br>" + (counts[id] || 0) + " listed " + WHAT[scope]; } else tip.style.display = "none";
    });
    const end = e => { const was = ptrs.size; ptrs.delete(e.pointerId); if (was === 1 && !moved && e.type === "pointerup") { const id = e.target.dataset && (e.target.dataset.id || e.target.dataset.lid); if (id && byId[id]) pick(byId[id][0], true); } if (!ptrs.size) { start = null; pinch = 0; } };
    svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end); svg.addEventListener("pointerleave", e => { tip.style.display = "none"; if (e.pointerType === "mouse") end(e); });
    svg.addEventListener("wheel", e => { e.preventDefault(); const m = toMap(e); zoomAt(e.deltaY > 0 ? 1.25 : 0.8, m[0], m[1]); }, { passive: false });
    svg.addEventListener("dblclick", e => { const m = toMap(e); zoomAt(0.5, m[0], m[1]); });
    $("#zin").onclick = () => zoom(0.6); $("#zout").onclick = () => zoom(1 / 0.6); $("#zreset").onclick = () => { vb = [0, 0, 1000, 500]; setVB(); };
    relabel();
    sel.onchange = () => { pick(sel.value, false); if (W.names[sel.value]) { focusOn(W.names[sel.value]); svg.scrollIntoView({ block: "center" }); } };
    document.querySelectorAll(".scope button").forEach(b => b.onclick = () => { setScope(b.dataset.scope); pick(country); });
    const p = decodeURIComponent(location.hash.slice(1)).split("/");
    setScope(["timber", "flora", "fauna"].includes(p[0]) ? p[0] : "timber");
    if (p[1]) setTimeout(() => pick(p.slice(1).join("/")), 50);
  }).catch(() => { res.innerHTML = '<div class="card">The map could not be loaded. Check the connection and try again.</div>'; });
})();

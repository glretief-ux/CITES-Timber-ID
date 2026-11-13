/* Shared page chrome and helpers. No external dependencies. */
(function () {
  const BASE = document.currentScript.dataset.base || "";
  const page = document.body.dataset.page || "";
  const NAV = [
    ["lookup", "index.html", "Lookup"],
    ["map", "map.html", "Country map"],
    ["key", "key.html", "10x key"],
    ["check", "check.html", "Consignment check"],
    ["field", "field.html", "Field procedure"],
    ["identify", "identify/index.html", "Photo ID (trial)"],
    ["about", "about.html", "Sources"],
  ];
  const mark = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13" cy="13" r="10.5" fill="none" stroke="#fff" stroke-width="2.4"/><circle cx="13" cy="13" r="6.2" fill="none" stroke="#9fd0c6" stroke-width="1.6"/><circle cx="13" cy="13" r="2.4" fill="#9fd0c6"/><path d="M21 21l8 8" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg>';
  const top = document.createElement("div");
  top.innerHTML =
    '<a class="skip" href="#main">Skip to content</a>' +
    '<header class="top"><div class="wrap"><a class="mark" href="' + BASE + 'index.html">' + mark +
    '<span>CITES Timber ID<small>Field reference for enforcement officers</small></span></a><nav class="nav" aria-label="Sections">' +
    NAV.map(n => '<a href="' + BASE + n[1] + '"' + (n[0] === page ? ' aria-current="page"' : "") + ">" + n[2] + "</a>").join("") +
    "</nav></div></header>" +
    '<div class="status"><div class="wrap"><b>Screening aid, not evidence of species.</b> A hand lens usually reaches genus or group. ' +
    'Confirm with a laboratory and the live listing on <a href="https://speciesplus.net" target="_blank" rel="noopener">Species+</a> before enforcement action.</div></div>';
  document.body.prepend(...top.childNodes);
  const foot = document.createElement("footer");
  foot.className = "foot";
  foot.innerHTML = '<div class="wrap"><span id="footver">CITES Timber ID</span> &nbsp;|&nbsp; <a href="' + BASE +
    'about.html">Sources, photo credits and licences</a> &nbsp;|&nbsp; <a href="https://github.com/glretief-ux/CITES-Timber-ID">Repository</a>' +
    " &nbsp;|&nbsp; Works offline after the first visit.</div>";
  document.body.append(foot);

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fold = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\(.*?\)/g, " ")
    .replace(/\b(spp|sp|var|subsp|ssp|syn)\.?(?=\s|$)/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const chip = a => '<span class="chip ' + a + '">Appendix ' + a + "</span>";
  const DOCS = {
    I: "Export permit (or re-export certificate) <b>and</b> an import permit issued first by the importing country. Trade for primarily commercial purposes is not allowed.",
    II: "Export permit from the exporting country, or a re-export certificate. CITES itself needs no import permit; many countries, including the EU, require one.",
    III: "From the country that listed it: export permit. From any other country: certificate of origin. Re-exports: re-export certificate.",
  };
  let timber;
  const loadTimber = () => timber || (timber = fetch(BASE + "data/timber.json").then(r => { if (!r.ok) throw 0; return r.json(); }).then(d => {
    const f = document.getElementById("footver");
    if (f) f.textContent = "Listing data checked " + d.checked + " (Species+ export " + d.checklist.date + ")";
    d.byId = Object.fromEntries(d.taxa.map(t => [t.id, t]));
    return d;
  }));
  const thumb = t => {
    const p = (t.photos || []).find(x => x.listed !== false) || (t.photos || [])[0];
    return p ? '<span class="lens ' + t.appendix + '"><img loading="lazy" alt="" src="' + BASE + "photos/" + p.thumb + '"></span>'
      : '<span class="lens draw ' + t.appendix + '"><img loading="lazy" alt="" src="' + BASE + t.schematic + '"></span>';
  };
  window.TID = { BASE, esc, fold, chip, DOCS, loadTimber, thumb, $: s => document.querySelector(s) };
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register(BASE + "sw.js").catch(() => {});
})();

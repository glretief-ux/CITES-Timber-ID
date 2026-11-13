/* 10x identification key: tick features, rank listed timbers by fit. */
(function () {
  const { esc, chip, loadTimber, thumb, $ } = TID;
  const F = [
    ["wood", "Pores (vessels) visible?", [["hardwood", "Yes: hardwood"], ["softwood", "No: softwood"], ["vesselless", "No pores, but broad rays"]]],
    ["porosity", "Pore pattern across a growth ring", [["diffuse", "Even size throughout (diffuse)"], ["semi-ring", "Larger at ring start, fading (semi-ring)"], ["ring", "Band of large pores, then small (ring)"]]],
    ["pore_size", "Pore size", [["small", "Small: only with the lens"], ["medium", "Medium: just visible"], ["large", "Large: clear to the naked eye"]]],
    ["pore_density", "How many pores", [["few", "Few"], ["moderate", "Moderate"], ["many", "Many"]]],
    ["deposits", "Pore contents", [["yellow", "Yellow"], ["white", "White or chalky"], ["dark", "Dark gum, red to black"], ["tyloses", "Shiny froth (tyloses)"]], 1],
    ["parenchyma", "Pale tissue around or between pores", [["vasicentric", "Halo round each pore"], ["aliform", "Halo with wings (eye shape)"], ["confluent", "Wings joining pores"], ["banded", "Wavy bands, independent of pores"], ["marginal", "Single line at ring boundary"], ["reticulate", "Fine net with the rays"], ["none", "None seen"]], 1],
    ["rays", "Rays", [["fine", "Fine: barely visible"], ["medium", "Medium"], ["broad", "Broad: obvious"]]],
    ["ripple", "Ripple marks on the side face", [["yes", "Yes"], ["no", "No"]]],
    ["canals", "Resin canals (softwoods)", [["yes", "Yes"], ["no", "No"]]],
    ["colour", "Heartwood colour", [["pale", "Pale, cream, straw"], ["brown", "Brown"], ["red", "Red or orange"], ["purple", "Purple or violet"], ["black", "Black or black streaks"], ["olive", "Olive or greenish"]], 1],
    ["weight", "Weight in the hand", [["heavy", "Very heavy: a chip sinks"], ["light", "Light"]]],
    ["scent", "Smell on a fresh cut", [["yes", "Distinct"], ["no", "None"]]],
  ];
  const low = x => (x || "").toLowerCase();
  function traits(t) {
    const e = t.endgrain, hw = low(t.heartwood), d = low(e.deposits), col = [], dep = [];
    if (/black/.test(hw)) col.push("black"); if (/red|orange/.test(hw)) col.push("red"); if (/purpl|violet/.test(hw)) col.push("purple");
    if (/brown|chocolate/.test(hw)) col.push("brown"); if (/olive|green/.test(hw)) col.push("olive"); if (/pale|cream|white|straw|yellowish/.test(hw)) col.push("pale");
    if (/yellow/.test(d)) dep.push("yellow"); if (/white/.test(d)) dep.push("white"); if (/dark|red|black|gum|resin/.test(d)) dep.push("dark"); if (/tylos/.test(d)) dep.push("tyloses");
    const n = parseInt((t.density.match(/(\d[\d,]*)/) || ["", "0"])[1].replace(",", ""));
    const par = e.parenchyma && e.parenchyma.length ? e.parenchyma.concat(e.parenchyma.includes("scanty") ? ["none"] : []) : ["none"];
    return { wood: e.porosity === "vesselless" ? ["vesselless"] : [t.wood_type], porosity: [e.porosity], pore_size: [e.pore_size], pore_density: [e.pore_density], deposits: dep, parenchyma: par,
      rays: [e.rays], ripple: e.ripple_marks === "variable" ? ["yes", "no"] : [e.ripple_marks], canals: [e.resin_canals], colour: col,
      weight: n >= 950 || /very heavy|sinks/.test(low(t.density)) ? ["heavy"] : n && n <= 520 ? ["light"] : [], scent: /^none/.test(low(t.odour)) ? ["no"] : ["yes"] };
  }
  loadTimber().then(D => {
    const TR = D.taxa.map(traits);
    $("#kf").innerHTML = F.map(f => "<fieldset><legend>" + f[1] + (f[3] ? ' <span class="tiny muted">(any that apply)</span>' : "") + '</legend><div class="opts" style="grid-template-columns:1fr 1fr">' +
      f[2].map(o => '<label><input type="' + (f[3] ? "checkbox" : "radio") + '" name="' + f[0] + '" value="' + o[0] + '"><span>' + o[1] + "</span></label>").join("") + "</div></fieldset>").join("");
    function render() {
      const sel = {}; new FormData($("#kf")).forEach((v, k) => (sel[k] = sel[k] || []).push(v));
      const ks = Object.keys(sel);
      const rows = D.taxa.map((t, i) => { let hit = 0; const miss = []; ks.forEach(k => { const h = sel[k].some(v => (TR[i][k] || []).includes(v)); if (h) hit++; else miss.push(F.find(f => f[0] === k)[1]); }); return { t, hit, miss }; })
        .filter(r => r.miss.length <= 1 || !ks.length).sort((a, b) => a.miss.length - b.miss.length || a.t.scientific_name.localeCompare(b.t.scientific_name));
      const full = rows.filter(r => !r.miss.length).length;
      $("#kcount").textContent = ks.length ? full + " full match" + (full === 1 ? "" : "es") + ", " + (rows.length - full) + " one feature off" : "All " + rows.length + " listed timbers";
      $("#kout").innerHTML = rows.map(r => '<a class="tcard" href="index.html#t/' + r.t.id + '">' + thumb(r.t) + '<span><b class="sci">' + esc(r.t.scientific_name.split("(")[0]) + "</b>" +
        '<span class="cn">' + esc(r.t.common_names.slice(0, 3).join(", ")) + "</span>" + chip(r.t.appendix) + (ks.length ? ' <span class="chip ' + (r.miss.length ? "nl" : "ann") + '">' + (r.miss.length ? "Differs: " + esc(r.miss[0].toLowerCase()) : "Fits all " + ks.length) + "</span>" : "") +
        '<span class="cn" style="margin-top:6px;color:var(--ink)">' + esc(r.t.key_diagnostic.length > 190 ? r.t.key_diagnostic.slice(0, 187) + "..." : r.t.key_diagnostic) + "</span></span></a>").join("") ||
        '<div class="card">No listed timber fits that combination. Untick the feature you are least sure of. The wood may also be an unlisted species.</div>';
    }
    $("#kf").addEventListener("change", render);
    $("#kf").addEventListener("click", ev => { const i = ev.target.closest("input[type=radio]"); if (i && i.dataset.was === "1") { i.checked = false; i.dataset.was = ""; render(); } else if (i) { document.querySelectorAll('input[name="' + i.name + '"]').forEach(x => x.dataset.was = ""); i.dataset.was = "1"; } });
    $("#kreset").onclick = () => { $("#kf").reset(); document.querySelectorAll("#kf input").forEach(x => x.dataset.was = ""); render(); };
    render();
  });
})();

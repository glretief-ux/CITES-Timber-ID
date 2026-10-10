#!/usr/bin/env python3
"""Build all generated files from tools/species_data.py.

    python tools/build.py

Outputs
  data/species.json, data/species.csv     machine-readable database
  docs/data.json                          copy used by the web identification key
  docs/schematics/<id>.svg                schematic 10x end-grain drawing per taxon
  species/<id>.md                         one field-guide page per taxon
  species/README.md                       index of all pages
  photos/<id>/README.md                   photo folder + what to photograph
  photos/manifest.csv                     list of real 10x photos (add rows when you add photos)
"""
import csv
import json
import math
import os
import random
import shutil
import sys
from urllib.parse import quote_plus

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from species_data import SPECIES, ANNOTATIONS, NON_TIMBER_LISTED_TREES  # noqa: E402


# ----------------------------------------------------------------- references
def reference_links(sp):
    """Per-taxon links to authoritative sources and 10x end-grain image collections."""
    first = sp["scientific_name"].split(",")[0].split("(")[0].replace("spp.", "").strip()
    q = quote_plus(first)
    return [
        ("Species+ (official CITES listing & annotation)", f"https://speciesplus.net/species#/taxon_concepts?taxonomy=cites_eu&taxon_concept_query={q}"),
        ("The Wood Database (has a 10x end-grain photo per species)", f"https://www.wood-database.com/?s={q}"),
        ("InsideWood (anatomy database, NC State)", "https://insidewood.lib.ncsu.edu/search"),
        ("CITES Timber ID repository (manuals, keys, photo atlases)", "https://cites.org/eng/timber/timber-ID-repository"),
        ("CITESwoodID (Thünen Institute, macroscopic key with images)", "https://www.thuenen.de/en/institutes/wood-research/fields-of-activity/wood-identification-and-wood-anatomy"),
        ("Pl@ntWood (CIRAD, macroscopic photos of tropical timbers)", "https://plantwood.cirad.fr"),
        ("Wikimedia Commons (free-licence images)", f"https://commons.wikimedia.org/w/index.php?search={q}+wood&title=Special:MediaSearch&type=image"),
        ("GBIF (distribution)", f"https://www.gbif.org/species/search?q={q}"),
    ]


# ----------------------------------------------------------------- schematic
COLOURS = [
    ("jet black", "#2a2220"), ("black", "#3a2b26"), ("blood-red", "#6e1f1c"), ("orange", "#c2662f"),
    ("red", "#9a4430"), ("purpl", "#6b3b3e"), ("olive", "#7d6b3e"), ("green", "#7d6b3e"),
    ("chocolate", "#5a3826"), ("teak", "#9a7444"), ("golden", "#b07f45"), ("pink", "#c08a72"),
    ("straw", "#e6d4a6"), ("cream", "#e8dab4"), ("white", "#e9dfc5"), ("pale", "#ddc79a"),
    ("yellow", "#d2b06a"), ("brown", "#8f6542"),
]


def heart_colour(text):
    t = text.lower()
    hits = [(t.find(k), -len(k), col) for k, col in COLOURS if k in t]
    return min(hits)[2] if hits else "#a9805a"


def shade(hex_col, f):
    h = hex_col.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    if f >= 0:
        r, g, b = (int(c + (255 - c) * f) for c in (r, g, b))
    else:
        r, g, b = (int(c * (1 + f)) for c in (r, g, b))
    return f"#{r:02x}{g:02x}{b:02x}"


def schematic_svg(sp):
    eg = sp["endgrain"]
    rnd = random.Random(sp["id"])
    W = H = 420
    base = heart_colour(sp["heartwood"])
    dark = base in ("#2a2220", "#3a2b26", "#6e1f1c", "#5a3826", "#6b3b3e")
    light_tissue = shade(base, 0.45 if dark else 0.38)
    dark_tissue = shade(base, -0.45)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H + 46}" width="{W}" height="{H + 46}" font-family="Verdana, sans-serif">',
           f'<title>Schematic end grain: {sp["scientific_name"]}</title>',
           '<defs><clipPath id="c"><circle cx="210" cy="210" r="205"/></clipPath></defs>',
           '<rect width="100%" height="100%" fill="#ffffff"/>',
           '<g clip-path="url(#c)">',
           f'<rect width="{W}" height="{H}" fill="{base}"/>']

    porosity = eg["porosity"]
    rings = [rnd.randint(110, 140), rnd.randint(250, 290)] if porosity in ("ring", "semi-ring") else [rnd.randint(130, 160), rnd.randint(290, 320)]

    # ---------- softwoods / vesselless
    if porosity in ("none", "vesselless"):
        for i, y in enumerate([0] + rings + [H]):
            pass
        bounds = [-20] + rings + [H + 40]
        for i in range(len(bounds) - 1):
            y0, y1 = bounds[i], bounds[i + 1]
            lw = (y1 - y0) * 0.30
            gradual = "gradual" in " ".join(eg["special"]).lower() or "indistinct" in " ".join(eg["special"]).lower()
            if gradual:
                steps = 8
                for s in range(steps):
                    yy = y1 - lw + s * lw / steps
                    out.append(f'<rect x="0" y="{yy:.1f}" width="{W}" height="{lw / steps + 0.5:.1f}" fill="{dark_tissue}" opacity="{0.08 + 0.07 * s:.2f}"/>')
            else:
                out.append(f'<rect x="0" y="{y1 - lw:.1f}" width="{W}" height="{lw:.1f}" fill="{dark_tissue}" opacity="0.6"/>')
            if eg.get("resin_canals") == "yes":
                for _ in range(rnd.randint(4, 7)):
                    x = rnd.uniform(15, W - 15)
                    y = rnd.uniform(y1 - lw * 0.9, y1 - 4)
                    out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4.5" fill="#f3e3b8" stroke="#2a1a10" stroke-width="1.6"/>')
        ray_w = 4.5 if porosity == "vesselless" else 0.8
        x = 0
        while x < W:
            x += rnd.uniform(9, 16) if porosity != "vesselless" else rnd.uniform(18, 30)
            out.append(f'<rect x="{x:.1f}" y="0" width="{ray_w}" height="{H}" fill="{dark_tissue if porosity == "vesselless" else light_tissue}" opacity="0.55"/>')
        out.append("</g>")
        return finish(out, sp, W, H)

    # ---------- hardwoods: rays
    rays = eg.get("rays", "fine")
    x = 0
    while x < W:
        x += rnd.uniform(10, 15) if rays == "fine" else rnd.uniform(14, 22)
        w = 0.7 if rays == "fine" else 1.6
        out.append(f'<rect x="{x:.1f}" y="0" width="{w}" height="{H}" fill="{light_tissue}" opacity="0.5"/>')
    if rays == "broad":
        x = rnd.uniform(20, 60)
        while x < W:
            out.append(f'<rect x="{x:.1f}" y="0" width="{rnd.uniform(6, 10):.1f}" height="{H}" fill="{light_tissue}" opacity="0.85"/>')
            x += rnd.uniform(70, 110)

    par = eg.get("parenchyma", [])
    # banded / reticulate / diffuse parenchyma lines
    if "banded" in par:
        y = rnd.uniform(5, 15)
        while y < H:
            pts = " ".join(f"{xx},{y + 2.5 * math.sin(xx / 23 + y):.1f}" for xx in range(0, W + 10, 10))
            out.append(f'<polyline points="{pts}" fill="none" stroke="{light_tissue}" stroke-width="2.2" opacity="0.8"/>')
            y += rnd.uniform(16, 24)
    if "reticulate" in par or "diffuse" in par:
        y = 3
        while y < H:
            for xx in range(0, W, 14):
                if rnd.random() < 0.6:
                    out.append(f'<line x1="{xx}" y1="{y:.1f}" x2="{xx + 9}" y2="{y:.1f}" stroke="{light_tissue}" stroke-width="0.8" opacity="0.6"/>')
            y += 7
    # marginal parenchyma
    for y in rings:
        if "marginal" in par:
            out.append(f'<rect x="0" y="{y - 2}" width="{W}" height="4" fill="{light_tissue}" opacity="0.9"/>')
        else:
            out.append(f'<rect x="0" y="{y - 0.8}" width="{W}" height="1.6" fill="{dark_tissue}" opacity="0.35"/>')

    # pores
    size = eg.get("pore_size") or "small"
    r_base = {"small": 2.6, "medium": 5.2, "large": 8.2}[size]
    n = {"few": 26, "moderate": 46, "many": 85}.get(eg.get("pore_density") or "moderate", 46)
    n = int(n * {"small": 1.4, "medium": 1.0, "large": 0.75}[size])
    grouping = eg.get("grouping") or "mixed"
    deposits = (eg.get("deposits") or "").lower()
    if "yellow" in deposits:
        fill_dep = "#e9c94a"
    elif "white" in deposits:
        fill_dep = "#f1ece0"
    elif any(k in deposits for k in ("dark", "black", "red", "gum", "resin")):
        fill_dep = dark_tissue
    else:
        fill_dep = None
    tyloses = "tylos" in deposits

    pores = []
    if porosity == "ring":
        for ry in [-10] + rings:
            x = rnd.uniform(0, 8)
            while x < W:
                for row in range(2):
                    pores.append((x + rnd.uniform(-3, 3), ry + 12 + row * r_base * 2.3 + rnd.uniform(-2, 2), r_base * rnd.uniform(0.85, 1.1)))
                x += r_base * 2.6 + rnd.uniform(0, 5)
        for _ in range(int(n * 1.3)):
            ry = rnd.choice([-10] + rings)
            nxt = min([r for r in rings + [H + 10] if r > ry] or [H])
            pores.append((rnd.uniform(0, W), rnd.uniform(ry + 12 + r_base * 5, nxt - 6), max(1.6, r_base * 0.28)))
    else:
        for _ in range(n):
            x, y = rnd.uniform(0, W), rnd.uniform(0, H)
            r = r_base * rnd.uniform(0.75, 1.15)
            if porosity == "semi-ring":
                d = min(abs(y - ry) for ry in rings + [-10])
                r *= 1.25 if d < 35 else 0.8
            k = 1
            if grouping == "multiples":
                k = rnd.choice([2, 2, 3, 4])
            elif grouping == "mixed":
                k = rnd.choice([1, 1, 2, 2, 3])
            elif grouping == "clusters":
                k = rnd.choice([3, 4, 5])
            for j in range(k):
                pores.append((x, y + j * r * 1.75, r * (0.85 if k > 1 else 1)))

    def parenchyma_halo(x, y, r):
        s = []
        if "vasicentric" in par:
            s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r + 2.4:.1f}" fill="{light_tissue}" opacity="0.85"/>')
        if "aliform" in par:
            wing = r * 2.6
            s.append(f'<path d="M{x - r - wing:.1f},{y:.1f} Q{x:.1f},{y - r * 1.9:.1f} {x + r + wing:.1f},{y:.1f} Q{x:.1f},{y + r * 1.9:.1f} {x - r - wing:.1f},{y:.1f}Z" fill="{light_tissue}" opacity="0.8"/>')
        return s

    for (x, y, r) in pores:
        out.extend(parenchyma_halo(x, y, r))
    if "confluent" in par and pores:
        srt = sorted(pores, key=lambda p: p[1])
        for i in range(0, len(srt) - 1, 3):
            a, b = srt[i], srt[i + 1]
            if abs(a[1] - b[1]) < 20 and abs(a[0] - b[0]) < 110:
                out.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{light_tissue}" stroke-width="{max(2.5, a[2]):.1f}" stroke-linecap="round" opacity="0.75"/>')
    for (x, y, r) in pores:
        if tyloses:
            out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="#e7dcc4" stroke="{dark_tissue}" stroke-width="0.9"/>')
            out.append(f'<path d="M{x - r * 0.6:.1f},{y:.1f} L{x + r * 0.6:.1f},{y - r * 0.3:.1f} M{x - r * 0.4:.1f},{y + r * 0.4:.1f} L{x + r * 0.5:.1f},{y + r * 0.2:.1f}" stroke="{dark_tissue}" stroke-width="0.6"/>')
        else:
            out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="#1b1310" stroke="{dark_tissue}" stroke-width="0.8"/>')
            if fill_dep and rnd.random() < 0.35:
                out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r * 0.82:.1f}" fill="{fill_dep}"/>')

    special = " ".join(eg.get("special", [])).lower()
    if "included" in special and "phloem" in special:
        for _ in range(22):
            x, y = rnd.uniform(0, W), rnd.uniform(0, H)
            out.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rnd.uniform(5, 9):.1f}" ry="{rnd.uniform(3, 5):.1f}" fill="#5b4a3a" opacity="0.75"/>')
    out.append("</g>")
    return finish(out, sp, W, H)


def finish(out, sp, W, H):
    out.append('<circle cx="210" cy="210" r="205" fill="none" stroke="#444" stroke-width="3"/>')
    out.append(f'<line x1="300" y1="392" x2="370" y2="392" stroke="#fff" stroke-width="4"/><line x1="300" y1="392" x2="370" y2="392" stroke="#000" stroke-width="2"/>')
    out.append('<text x="335" y="384" font-size="11" text-anchor="middle" fill="#000" stroke="#fff" stroke-width="3" paint-order="stroke">≈1 mm</text>')
    out.append(f'<text x="{W / 2}" y="{H + 18}" font-size="13" text-anchor="middle" fill="#222" font-style="italic">{esc(sp["scientific_name"][:60])}</text>')
    out.append(f'<text x="{W / 2}" y="{H + 36}" font-size="11" text-anchor="middle" fill="#b00">SCHEMATIC of 10x end grain - not a photograph</text>')
    out.append("</svg>")
    return "\n".join(out)


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ----------------------------------------------------------------- markdown
def md_page(sp):
    eg = sp["endgrain"]
    L = [f"# {sp['scientific_name']}", "",
         f"**Family:** {sp['family']}  ",
         f"**Trade / common names:** {', '.join(sp['common_names'])}  ",
         f"**CITES Appendix:** **{sp['appendix']}**  ",
         f"**Annotation:** {sp['annotation']} — {annotation_text(sp['annotation'])}  ",
         f"**Population covered:** {sp['population_scope']}  ",
         f"**First listed (approx. year in force):** {sp['listed_since']}  ",
         f"**Native range:** {sp['range']}", "",
         "> Always confirm the live listing on [Species+](https://speciesplus.net) before seizure decisions.", "",
         "## 10x end-grain view", "",
         "| Real photographs (reference specimens) | Schematic |", "|---|---|",
         f"| See [`photos/{sp['id']}/`](../photos/{sp['id']}/) and the image links below | ![schematic](../docs/schematics/{sp['id']}.svg) |", "",
         "## Key diagnostic summary", "", sp["key_diagnostic"], "",
         "## Macroscopic features (hand lens, 10x, freshly cut transverse surface)", "",
         "| Feature | Observation |", "|---|---|"]
    rows = [
        ("Wood type", sp["wood_type"]),
        ("Porosity", eg["porosity"]),
        ("Pore size", eg.get("pore_size") or "—"),
        ("Pore frequency", eg.get("pore_density") or "—"),
        ("Pore arrangement", eg.get("grouping") or "—"),
        ("Pore contents / deposits", eg.get("deposits") or "none noted"),
        ("Axial parenchyma", ", ".join(eg.get("parenchyma") or []) or "not visible / none"),
        ("Rays", eg.get("rays")),
        ("Ripple marks (storied structure, tangential face)", eg.get("ripple_marks")),
        ("Resin canals (softwoods)", eg.get("resin_canals")),
    ]
    L += [f"| {a} | {b} |" for a, b in rows]
    L += ["", "**Other features:**", ""] + [f"- {s}" for s in eg.get("special", [])]
    L += ["", "## Physical characteristics", "",
          f"- **Heartwood:** {sp['heartwood']}",
          f"- **Sapwood:** {sp['sapwood']}",
          f"- **Density:** {sp['density']}",
          f"- **Odour:** {sp['odour']}", "",
          "## Look-alikes (check these before concluding)", ""] + [f"- {x}" for x in sp["lookalikes"]]
    L += ["", "## Confirming beyond the hand lens", "", sp["lab_methods"], ""]
    if sp["species_included"]:
        L += ["## Species included in this listing", "", "| Taxon | Trade name | Range | Notes |", "|---|---|---|---|"]
        L += [f"| *{s['name']}* | {s['trade']} | {s['range']} | {s['notes']} |" for s in sp["species_included"]]
        L += [""]
    L += ["## Image sources for 10x end-grain photographs", ""]
    L += [f"- [{t}]({u})" for t, u in reference_links(sp)]
    L += ["", "---", "[← All species](README.md) · [Field procedure](../guides/field-procedure.md) · [Feature glossary](../guides/feature-glossary.md)"]
    return "\n".join(L) + "\n"


def annotation_text(a):
    key = a.split(" ")[0] if a.startswith("#") else a
    if a.startswith("S. "):
        return "see species table below."
    return ANNOTATIONS.get(key, "see Species+.")


def photo_readme(sp):
    return f"""# 10x photos — {sp['scientific_name']}

Put **real** 10x end-grain photographs of verified reference specimens here.

File naming: `{sp['id']}_<xylarium-or-agency>_<specimen-no>_<n>.jpg`
(e.g. `{sp['id']}_MADw_12345_1.jpg`)

For every photo add one row to [`../manifest.csv`](../manifest.csv).

## What to photograph
1. Transverse (end-grain) surface, cut clean with a sharp blade, **10x**, field ~5-7 mm wide, with scale bar.
2. Same spot wetted (water) — improves contrast of parenchyma.
3. Tangential face at 10x if ripple marks are expected (expected here: **{sp['endgrain'].get('ripple_marks')}**).
4. Optional: UV (365 nm) fluorescence of the end grain.

## Features the photo must show
{sp['key_diagnostic']}

Only add images you own or that carry an open licence (public domain, CC-BY, CC-BY-SA). Record the licence and author in the manifest.
"""


# ----------------------------------------------------------------- main
def main():
    data = {
        "version": "2026-10",
        "listing_basis": "CITES Appendices in force after CoP20 (Samarkand, 24 Nov - 5 Dec 2025). CoP20 adopted no new timber listings; proposals to remove Central African Afzelia bipindensis and Pterocarpus soyauxii were rejected; the Paubrasilia echinata annotation #10 was amended.",
        "disclaimer": "Macroscopic identification is a screening tool, usually reliable only to genus or group. Confirm species with an accredited wood-anatomy, DNA or mass-spectrometry laboratory and the live Species+ listing.",
        "annotations": ANNOTATIONS,
        "non_timber_listed_trees": NON_TIMBER_LISTED_TREES,
        "taxa": [],
    }
    os.makedirs(os.path.join(ROOT, "docs", "schematics"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "species"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    for sp in SPECIES:
        rec = dict(sp)
        rec["schematic"] = f"schematics/{sp['id']}.svg"
        rec["references"] = [{"title": t, "url": u} for t, u in reference_links(sp)]
        data["taxa"].append(rec)
        with open(os.path.join(ROOT, "docs", "schematics", f"{sp['id']}.svg"), "w", encoding="utf-8") as f:
            f.write(schematic_svg(sp))
        with open(os.path.join(ROOT, "species", f"{sp['id']}.md"), "w", encoding="utf-8") as f:
            f.write(md_page(sp))
        pdir = os.path.join(ROOT, "photos", sp["id"])
        os.makedirs(pdir, exist_ok=True)
        with open(os.path.join(pdir, "README.md"), "w", encoding="utf-8") as f:
            f.write(photo_readme(sp))

    # photos: merge manifest so the web key can show real photos once added
    manifest = os.path.join(ROOT, "photos", "manifest.csv")
    if not os.path.exists(manifest):
        with open(manifest, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(["taxon_id", "file", "magnification", "surface", "wet_or_dry", "specimen_source", "specimen_id", "photographer", "licence", "notes"])
    photos = {}
    with open(manifest, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            photos.setdefault(row["taxon_id"], []).append(row)
    import shutil
    for rec in data["taxa"]:
        rec["photos"] = []
        for row in photos.get(rec["id"], []):
            src = os.path.join(ROOT, "photos", rec["id"], row["file"])
            if os.path.exists(src):  # copy into docs/ so GitHub Pages can serve it
                dst = os.path.join(ROOT, "docs", "photos", rec["id"])
                os.makedirs(dst, exist_ok=True)
                shutil.copy2(src, os.path.join(dst, row["file"]))
                rec["photos"].append(row)
            else:
                print(f"WARNING: manifest lists missing file photos/{rec['id']}/{row['file']}")

    js = json.dumps(data, indent=2, ensure_ascii=False)
    for p in (os.path.join(ROOT, "data", "species.json"), os.path.join(ROOT, "docs", "data.json")):
        with open(p, "w", encoding="utf-8") as f:
            f.write(js)

    with open(os.path.join(ROOT, "data", "species.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "scientific_name", "rank", "family", "appendix", "annotation", "population_scope", "listed_since",
                    "common_names", "wood_type", "porosity", "pore_size", "pore_density", "grouping", "deposits",
                    "parenchyma", "rays", "ripple_marks", "resin_canals", "heartwood", "density", "odour", "key_diagnostic", "lookalikes"])
        for sp in SPECIES:
            e = sp["endgrain"]
            w.writerow([sp["id"], sp["scientific_name"], sp["rank"], sp["family"], sp["appendix"], sp["annotation"],
                        sp["population_scope"], sp["listed_since"], "; ".join(sp["common_names"]), sp["wood_type"],
                        e["porosity"], e.get("pore_size") or "", e.get("pore_density") or "", e.get("grouping") or "",
                        e.get("deposits") or "", "; ".join(e.get("parenchyma") or []), e.get("rays"), e.get("ripple_marks"),
                        e.get("resin_canals"), sp["heartwood"], sp["density"], sp["odour"], sp["key_diagnostic"], "; ".join(sp["lookalikes"])])

    shutil.copy2(os.path.join(ROOT, "data", "species.csv"), os.path.join(ROOT, "docs", "species.csv"))

    # species index
    L = ["# CITES-listed timber taxa — index", "",
         "Generated from `tools/species_data.py`. Listing basis: CITES Appendices after CoP20 (2025).", "",
         "| Appendix | Taxon | Family | Trade names | Annotation | Wood type |", "|---|---|---|---|---|---|"]
    for sp in sorted(SPECIES, key=lambda s: (s["appendix"], s["scientific_name"])):
        L.append(f"| {sp['appendix']} | [*{sp['scientific_name']}*]({sp['id']}.md) | {sp['family']} | {', '.join(sp['common_names'][:3])} | {sp['annotation']} | {sp['wood_type']} |")
    L += ["", "**Other CITES-listed trees not normally traded as timber:**", ""] + [f"- {x}" for x in NON_TIMBER_LISTED_TREES]
    with open(os.path.join(ROOT, "species", "README.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")

    n_sp = sum(len(s["species_included"]) or 1 for s in SPECIES)
    print(f"Built {len(SPECIES)} listing entries ({n_sp} named taxa), {sum(len(v) for v in photos.values())} photos in manifest.")


if __name__ == "__main__":
    main()

"""Prepare the web app assets and the specimen collection tracker.

1. Copies models/wood_id.onnx + config.json into web/models/ and writes
   web/models/species_info.json: for every trained class, its CITES status
   resolved from data/species_scope_africa.csv.
2. Writes data/collection_tracker.csv: which species you still need to image
   and how many specimens you have so far (from data/metadata.csv).

Class names are 'Genus_species' (e.g. Pterocarpus_angolensis). A genus-wide
listing in the scope table ('spp.') covers every species of that genus unless a
species has its own row (e.g. Pterocarpus_santalinus, Dalbergia_nigra).

Usage:
  python src/build_web_assets.py            # after export_onnx.py
  python src/build_web_assets.py --tracker-only
"""
import argparse
import csv
import json
import shutil
from pathlib import Path

import pandas as pd

from common import DATA, ROOT

SCOPE = DATA / "species_scope_africa.csv"
WEB_MODELS = ROOT / "web" / "models"  # override with --web-dir

# Species to collect for genus-wide listings (names named in the CITES sources
# where possible; others from general knowledge: confirm accepted names).
GENUS_SPECIES = {
    "Pterocarpus": ["angolensis", "soyauxii", "tessmannii", "erinaceus", "tinctorius"],
    "Afzelia": ["africana", "bipindensis", "pachyloba", "quanzensis"],
    "Khaya": ["anthotheca", "grandifoliola", "ivorensis", "senegalensis"],
    "Dalbergia": ["melanoxylon"],
    "Diospyros": [],       # Madagascar populations: choose with a Malagasy-wood expert
    "Entandrophragma": ["cylindricum", "utile", "angolense", "candollei"],
}
# Open-data images we hold or can get (not Dino-Lite; kept out of git)
OPEN_DATA = {
    "Prunus_africana": "61 phone/24x images (GOIMAI, CC BY-SA 4.0); not Dino-Lite",
    "Pericopsis_elata": "available from GOIMAI (558 MB), not yet downloaded",
}
TARGET_SPECIMENS = 20
MIN_SPECIMENS = 5


def load_scope():
    return pd.read_csv(SCOPE, keep_default_na=False)


def resolve(cls, scope):
    """CITES info for a class name like 'Pterocarpus_angolensis'."""
    genus, _, species = cls.partition("_")
    species = species.replace("_", " ").strip().lower()
    if species in ("spp", "spp."):
        species = ""
    exact = scope[(scope["genus"] == genus) & (scope["species_rule"].str.lower() == species)]
    if species and len(exact):
        row, basis = exact.iloc[0], "species row"
    else:
        g = scope[(scope["genus"] == genus) & (scope["species_rule"] == "spp.")]
        if len(g):
            row, basis = g.iloc[0], "genus-wide listing"
        else:
            return {"genus": genus, "listed": None, "appendix": "", "annotation": "",
                    "role": "unknown", "common_names": "", "basis": "no entry in scope table",
                    "note": "Not in this app's scope table. Check Species+ before drawing conclusions."}
    return {
        "genus": genus,
        "listed": row["cites_listed"] == "yes",
        "appendix": row["appendix"],
        "annotation": row["annotation"],
        "role": row["role"],
        "common_names": row["common_names"],
        "basis": basis,
        "check_status": row["check_status"],
        "note": row["scope_note"],
    }


def build_assets(web_models=None):
    web_models = web_models or WEB_MODELS
    cfg_path = ROOT / "models" / "config.json"
    onnx_path = ROOT / "models" / "wood_id.onnx"
    if not cfg_path.exists() or not onnx_path.exists():
        raise SystemExit("Run train.py and export_onnx.py first (models/wood_id.onnx missing).")
    cfg = json.loads(cfg_path.read_text())
    scope = load_scope()
    web_models.mkdir(parents=True, exist_ok=True)
    shutil.copy(onnx_path, web_models / "wood_id.onnx")
    shutil.copy(cfg_path, web_models / "config.json")
    info = {c: resolve(c, scope) for c in cfg["classes"]}
    (web_models / "species_info.json").write_text(json.dumps(info, indent=2))
    unknown = [c for c, i in info.items() if i["listed"] is None]
    print(f"{web_models} ready: {len(info)} classes, "
          f"{sum(1 for i in info.values() if i['listed'])} CITES-listed, "
          f"{sum(1 for i in info.values() if i['listed'] is False)} not listed, {len(unknown)} unknown")
    if unknown:
        print("WARNING classes missing from scope table:", ", ".join(unknown))


def build_tracker():
    scope = load_scope()
    have = {}
    meta = DATA / "metadata.csv"
    if meta.exists():
        m = pd.read_csv(meta)
        have = m.groupby("species")["specimen_id"].nunique().to_dict()
    rows = []
    for _, r in scope.iterrows():
        if r["role"] in ("out_of_scope",):
            continue
        genus = r["genus"]
        if r["species_rule"] == "spp.":
            species_list = GENUS_SPECIES.get(genus, [])
            names = [f"{genus}_{s}" for s in species_list] or [f"{genus}_spp"]
        else:
            names = [f"{genus}_{r['species_rule']}"]
        prio = {"cites_target": 1, "comparator": 3, "background_lookalike": 2}.get(r["role"], 3)
        for n in names:
            rows.append({
                "class_name": n, "role": r["role"], "priority": prio,
                "cites_status": f"App {r['appendix']} {r['annotation']}".strip() if r["cites_listed"] == "yes" else "not listed (confirm)",
                "specimens_have": int(have.get(n, 0)),
                "specimens_min": MIN_SPECIMENS, "specimens_target": TARGET_SPECIMENS,
                "notes": r["scope_note"].split(". ")[0][:160],
                "open_data_images": OPEN_DATA.get(n, ""),
            })
    out = DATA / "collection_tracker.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(sorted(rows, key=lambda x: (x["priority"], x["class_name"])))
    print(f"wrote {out} ({len(rows)} species to collect)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tracker-only", action="store_true")
    ap.add_argument("--web-dir", help="app folder; models go to <web-dir>/models (default web/)")
    args = ap.parse_args()
    build_tracker()
    if not args.tracker_only:
        build_assets(Path(args.web_dir).resolve() / "models" if args.web_dir else None)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build the full CITES checklist data for the Fauna and Flora tabs.

    python tools/build_checklist.py path/to/cites_listings_YYYY-MM-DD.csv

Input: the "CITES listed species" CSV export from Species+ (https://speciesplus.net -> Downloads).
Output (compact, loaded on demand by docs/search.html):
  docs/checklist-fauna.json
  docs/checklist-flora.json

The raw CSV (~100 MB) is NOT stored in the repository. Re-run this script when a newer export is downloaded.
Timber taxa stay in tools/species_data.py (Timber lookup); they are also present here as plants.

Record layout (arrays, to keep the files small):
  [name, rank, family, order, class, listing, parties, listed_under[], notes[], annotations[], native_distribution, group]
  rank: 0 species, 1 subspecies, 2 variety.  Strings in `S`, notes in `N`, annotations in `A`, distributions in `D`;
  the array fields hold indexes into those tables. `group` is the id of the curated group in wildlife_data.py (or "").
"""
import csv
import json
import os
import re
import sys
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from wildlife_data import FAUNA, FLORA  # noqa: E402

csv.field_size_limit(10**9)
RANK = {"SPECIES": 0, "SUBSPECIES": 1, "VARIETY": 2}


def keyify(s):
    s = re.sub(r"\(.*?\)", " ", s or "")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 -]", " ", s.lower())).strip()


def group_keys(groups):
    """key -> group id (first group wins). Keys: group name, parenthetical names, scientific names."""
    d = {}
    for g in groups:
        keys = [g["name"]] + g["names"]
        m = re.search(r"\(([^)]*)\)", g["name"])
        if m:
            keys += [x.strip() for x in re.split(r",| and ", m.group(1)) if x.strip()]
        for k in keys:
            k = keyify(k)
            if k and k not in d:
                d[k] = g["id"]
    return d


class Table:
    def __init__(self):
        self.items, self.idx = [], {}

    def add(self, s):
        if s not in self.idx:
            self.idx[s] = len(self.items)
            self.items.append(s)
        return self.idx[s]


def iso_names(rows):
    """ISO code -> country name, learned from the distribution columns (same order in both)."""
    m = {}
    for r in rows:
        codes = [c for c in r["All_DistributionISOCodes"].split(",") if c]
        names = [n for n in r["All_DistributionFullNames"].split(",") if n]
        if codes and len(codes) == len(names):
            m.update(zip(codes, names))
    return m


def build(csv_path):
    rows = list(csv.DictReader(open(csv_path, encoding="utf-8", newline="")))
    iso = iso_names(rows)
    dm = re.search(r"(\d{4}-\d{2}-\d{2})", os.path.basename(csv_path))
    meta = {"source": "Species+ CITES listed species export", "date": dm.group(1) if dm else ""}
    out = {}
    for kingdom, kind, groups in (("Animalia", "fauna", FAUNA), ("Plantae", "flora", FLORA)):
        gk = group_keys(groups)
        S, N, A, D = Table(), Table(), Table(), Table()
        S.add("")
        taxa = OrderedDict()
        for r in rows:
            if r["Kingdom"] != kingdom:
                continue
            key = (r["Scientific Name"], RANK.get(r["Rank"], 0))
            t = taxa.get(key)
            if t is None:
                t = {"name": r["Scientific Name"], "rank": key[1], "fam": r["Family"], "ord": r["Order"], "cls": r["Class"],
                     "L": r["Listing"], "party": set(), "lu": [], "n": [], "a": [], "dist": r["NativeDistributionFullNames"],
                     "genus": r["Genus"]}
                taxa[key] = t
            for p in filter(None, (x.strip() for x in r["Party"].split(","))):
                t["party"].add(p)
            lu = r["Listed under"].strip()
            if lu and lu not in t["lu"]:
                t["lu"].append(lu)
            note = r["Full note"].replace("\r\n", "\n").strip()
            ann = r["# Full note"].replace("\r\n", "\n").strip()
            if note and note not in t["n"]:
                t["n"].append(note)
            if ann and ann not in t["a"]:
                t["a"].append(ann)
            if r["Listing"] and r["Listing"] not in t["L"]:
                t["L"] = "I/II"
        recs, unmapped = [], 0
        for t in taxa.values():
            words = t["name"].split()
            cands = [keyify(t["name"]), keyify(" ".join(words[:2])), keyify(t["genus"]), keyify(t["fam"]), keyify(t["ord"])]
            gid = next((gk[c] for c in cands if c and c in gk), "")
            unmapped += 0 if gid else 1
            recs.append([t["name"], t["rank"], S.add(t["fam"]), S.add(t["ord"]), S.add(t["cls"]), t["L"],
                         S.add(",".join(sorted(t["party"]))), [S.add(x) for x in t["lu"]], [N.add(x) for x in t["n"]],
                         [A.add(x) for x in t["a"]], D.add(t["dist"]), S.add(gid)])
        recs.sort(key=lambda x: x[0].lower())
        used = sorted({p for r in recs for p in S.items[r[6]].split(",") if p})
        data = {"kind": kind, "count": len(recs), "meta": meta, "ISO": {c: iso.get(c, c) for c in used},
                "S": S.items, "N": N.items, "A": A.items, "D": D.items, "T": recs}
        path = os.path.join(ROOT, "docs", f"checklist-{kind}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{kind}: {len(recs)} taxa, {unmapped} without a curated group, {os.path.getsize(path)/1e6:.2f} MB -> {path}")
        out[kind] = len(recs)
    return out


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    build(sys.argv[1])

"""Cut each raw Dino-Lite image into square patches.

Reads data/metadata.csv (see docs/IMAGING_PROTOCOL.md) and writes
data/patches/<species>/<specimen_id>/<image>_rXcY.png plus data/patches.csv.

Usage:
  python src/make_patches.py --patch-size 1024 --stride 1024
Patch size is in source pixels; choose it so a patch covers roughly 2-4 growth
rings / a few dozen vessels. Patches are resized to 224 px at train time.
"""
import argparse
from pathlib import Path

import pandas as pd
from PIL import Image
from tqdm import tqdm

import quality
from common import DATA


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--metadata", default=str(DATA / "metadata.csv"))
    ap.add_argument("--raw-root", default=str(DATA))
    ap.add_argument("--out", default=str(DATA / "patches"))
    ap.add_argument("--patch-size", type=int, default=1024)
    ap.add_argument("--stride", type=int, default=1024)
    ap.add_argument("--min-confidence", nargs="*", default=["vouchered", "expert-ID"],
                    help="label_confidence values to keep for training data")
    ap.add_argument("--no-quality-filter", action="store_true",
                    help="keep every patch (blurry, overlay lines, borders included)")
    ap.add_argument("--min-sharpness", type=float, default=quality.DEFAULTS["min_sharpness"])
    ap.add_argument("--max-flat-frac", type=float, default=quality.DEFAULTS["max_flat_frac"])
    ap.add_argument("--max-overexposed", type=float, default=quality.DEFAULTS["max_overexposed"])
    ap.add_argument("--max-line-frac", type=float, default=quality.DEFAULTS["max_line_frac"])
    args = ap.parse_args()
    qopts = dict(min_sharpness=args.min_sharpness, max_flat_frac=args.max_flat_frac,
                 max_overexposed=args.max_overexposed, max_line_frac=args.max_line_frac)

    meta = pd.read_csv(args.metadata)
    required = {"image_path", "species", "specimen_id"}
    missing = required - set(meta.columns)
    if missing:
        raise SystemExit(f"metadata.csv missing columns: {sorted(missing)}")
    if "label_confidence" in meta.columns:
        meta = meta[meta["label_confidence"].isin(args.min_confidence)]

    rows, rejected = [], []
    out_root = Path(args.out)
    for _, r in tqdm(meta.iterrows(), total=len(meta)):
        src = Path(args.raw_root) / r["image_path"]
        if not src.exists():
            print(f"WARNING missing file {src}")
            continue
        img = Image.open(src).convert("RGB")
        w, h = img.size
        ps = min(args.patch_size, w, h)
        st = min(args.stride, ps) if args.stride < ps else args.stride
        dest = out_root / r["species"] / str(r["specimen_id"])
        dest.mkdir(parents=True, exist_ok=True)
        for ri, y in enumerate(range(0, h - ps + 1, st)):
            for ci, x in enumerate(range(0, w - ps + 1, st)):
                patch = img.crop((x, y, x + ps, y + ps))
                name = f"{src.stem}_r{ri}c{ci}.png"
                if not args.no_quality_filter:
                    ok, why, m = quality.check(patch, **qopts)
                    if not ok:
                        rejected.append({"image": str(r["image_path"]), "species": r["species"],
                                         "specimen_id": r["specimen_id"], "patch": name,
                                         "reason": why, **{k: round(v, 3) for k, v in m.items()}})
                        continue
                patch.save(dest / name)
                rows.append({
                    "patch_path": str((dest / name).relative_to(out_root)),
                    "species": r["species"],
                    "specimen_id": r["specimen_id"],
                    "image": src.name,
                })
    out = pd.DataFrame(rows)
    out.to_csv(DATA / "patches.csv", index=False)
    print(f"{len(out)} patches kept from {out['specimen_id'].nunique()} specimens, "
          f"{out['species'].nunique()} species -> {DATA / 'patches.csv'}")

    if rejected:
        rej = pd.DataFrame(rejected)
        rej.to_csv(DATA / "rejected_patches.csv", index=False)
        print(f"{len(rej)} patches rejected -> {DATA / 'rejected_patches.csv'}")
        print(rej["reason"].str.split(",").explode().value_counts().to_string())
        # images where most patches were rejected: retake these photos
        kept = out.groupby("image").size() if len(out) else pd.Series(dtype=int)
        bad = rej.assign(image=rej["image"].map(lambda p: Path(p).name)).groupby("image").size()
        worst = []
        for img_name, n_bad in bad.items():
            n_ok = int(kept.get(img_name, 0))
            if n_bad / (n_bad + n_ok) >= 0.5:
                worst.append((img_name, n_bad, n_ok))
        if worst:
            print("RETAKE (>= half of the patches rejected):")
            for img_name, n_bad, n_ok in worst:
                print(f"  {img_name}: {n_bad} rejected, {n_ok} kept")


if __name__ == "__main__":
    main()

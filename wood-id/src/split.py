"""Specimen-level train/val/test split.

Whole specimens are assigned to a split, never single images or patches,
otherwise the test accuracy is inflated by near-duplicate patches from the same
piece of wood.

Species with fewer than 3 specimens cannot be tested honestly. They are put
entirely in train and listed in data/splits_warnings.txt.
"""
import argparse

import numpy as np
import pandas as pd

from common import DATA


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--patches", default=str(DATA / "patches.csv"))
    ap.add_argument("--val-frac", type=float, default=0.15)
    ap.add_argument("--test-frac", type=float, default=0.25)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    df = pd.read_csv(args.patches)
    assign, warns = {}, []

    for sp, g in df.groupby("species"):
        specs = sorted(g["specimen_id"].unique())
        rng.shuffle(specs)
        n = len(specs)
        if n < 3:
            warns.append(f"{sp}: only {n} specimen(s); all in train, NOT evaluable")
            for s in specs:
                assign[(sp, s)] = "train"
            continue
        n_test = max(1, round(n * args.test_frac))
        n_val = max(1, round(n * args.val_frac)) if n >= 5 else 0
        n_train = n - n_test - n_val
        if n_train < 1:
            n_val, n_train = 0, n - n_test
        for i, s in enumerate(specs):
            assign[(sp, s)] = "test" if i < n_test else ("val" if i < n_test + n_val else "train")

    df["split"] = [assign[(a, b)] for a, b in zip(df["species"], df["specimen_id"])]
    df.to_csv(DATA / "splits.csv", index=False)
    (DATA / "splits_warnings.txt").write_text("\n".join(warns))
    print(df.groupby("split").agg(patches=("patch_path", "size"),
                                  specimens=("specimen_id", "nunique")))
    for w in warns:
        print("WARNING", w)


if __name__ == "__main__":
    main()

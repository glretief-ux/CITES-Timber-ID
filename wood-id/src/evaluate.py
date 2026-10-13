"""Evaluate on held-out SPECIMENS.

Reports patch-level, image-level and specimen-level accuracy (probabilities
averaged), per-species recall, the most confused species pairs, and saves a
confusion-matrix plot to reports/.
"""
import json

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch
from PIL import Image
from sklearn.metrics import confusion_matrix
from tqdm import tqdm

from common import DATA, ROOT, build_model, eval_transform, get_device


def main():
    ckpt = torch.load(ROOT / "models" / "best.pt", map_location="cpu")
    classes = ckpt["classes"]
    c2i = {c: i for i, c in enumerate(classes)}
    device = get_device()
    model = build_model(len(classes), ckpt["arch"], pretrained=False)
    model.load_state_dict(ckpt["state_dict"])
    model.to(device).eval()

    df = pd.read_csv(DATA / "splits.csv")
    df = df[df.split == "test"].reset_index(drop=True)
    if df.empty:
        raise SystemExit("No test split. Need >= 3 specimens per species.")
    tf = eval_transform()

    probs = []
    with torch.no_grad():
        for p in tqdm(df["patch_path"]):
            x = tf(Image.open(DATA / "patches" / p).convert("RGB")).unsqueeze(0).to(device)
            probs.append(torch.softmax(model(x), 1).cpu().numpy()[0])
    P = np.stack(probs)
    df["true"] = df["species"].map(c2i)

    def acc_by(keys):
        g = df.assign(**{f"p{i}": P[:, i] for i in range(len(classes))}).groupby(keys)
        pm = g[[f"p{i}" for i in range(len(classes))]].mean().values
        true = g["true"].first().values
        return (pm.argmax(1) == true).mean(), true, pm.argmax(1), pm

    patch_acc = (P.argmax(1) == df["true"].values).mean()
    img_acc, *_ = acc_by(["specimen_id", "image"])
    spec_acc, st, sp, spm = acc_by(["specimen_id"])
    print(f"patch acc    {patch_acc:.3f}  ({len(df)} patches)")
    print(f"image acc    {img_acc:.3f}")
    print(f"specimen acc {spec_acc:.3f}  ({len(st)} specimens)  <- the number to report")
    top3 = np.mean([t in np.argsort(-row)[:3] for t, row in zip(st, spm)])
    print(f"specimen top-3 {top3:.3f}")

    labels = list(range(len(classes)))
    cm = confusion_matrix(st, sp, labels=labels)
    (ROOT / "reports").mkdir(exist_ok=True)
    rec = pd.DataFrame({
        "species": classes,
        "test_specimens": cm.sum(1),
        "recall": np.where(cm.sum(1) > 0, cm.diagonal() / np.maximum(cm.sum(1), 1), np.nan),
    })
    rec.to_csv(ROOT / "reports" / "per_species.csv", index=False)

    pairs = [(classes[i], classes[j], int(cm[i, j])) for i in labels for j in labels
             if i != j and cm[i, j] > 0]
    pairs.sort(key=lambda t: -t[2])
    print("most confused (true -> predicted, count):")
    for a, b, n in pairs[:10]:
        print(f"  {a} -> {b}: {n}")

    fig, ax = plt.subplots(figsize=(max(6, len(classes) * 0.5), max(5, len(classes) * 0.5)))
    ax.imshow(cm, cmap="Blues")
    ax.set_xticks(labels, classes, rotation=90, fontsize=7)
    ax.set_yticks(labels, classes, fontsize=7)
    ax.set_xlabel("predicted")
    ax.set_ylabel("true")
    fig.tight_layout()
    fig.savefig(ROOT / "reports" / "confusion_matrix.png", dpi=150)
    json.dump({"patch_acc": patch_acc, "image_acc": img_acc, "specimen_acc": spec_acc,
               "specimen_top3": top3},
              open(ROOT / "reports" / "summary.json", "w"), indent=2)


if __name__ == "__main__":
    main()

"""Identify a specimen from one or more Dino-Lite images.

Usage:
  python src/predict.py path/to/img1.png path/to/img2.png ... [--patch-size 1024]
Patches from all images are averaged into one specimen-level prediction.
"""
import argparse

import numpy as np
import torch
from PIL import Image

from common import ROOT, build_model, eval_transform, get_device

LOW_CONF = 0.60


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--patch-size", type=int, default=1024)
    ap.add_argument("--model", default=str(ROOT / "models" / "best.pt"))
    args = ap.parse_args()

    ckpt = torch.load(args.model, map_location="cpu")
    classes = ckpt["classes"]
    device = get_device()
    model = build_model(len(classes), ckpt["arch"], pretrained=False)
    model.load_state_dict(ckpt["state_dict"])
    model.to(device).eval()
    tf = eval_transform()

    probs = []
    with torch.no_grad():
        for path in args.images:
            img = Image.open(path).convert("RGB")
            w, h = img.size
            ps = min(args.patch_size, w, h)
            for y in range(0, h - ps + 1, ps):
                for x in range(0, w - ps + 1, ps):
                    t = tf(img.crop((x, y, x + ps, y + ps))).unsqueeze(0).to(device)
                    probs.append(torch.softmax(model(t), 1).cpu().numpy()[0])
    if not probs:
        raise SystemExit("No patches produced; check image size / --patch-size.")
    mean = np.mean(probs, axis=0)
    order = np.argsort(-mean)[:5]
    print(f"{len(probs)} patches from {len(args.images)} image(s)")
    for i in order:
        print(f"  {mean[i]*100:5.1f}%  {classes[i]}")
    if mean[order[0]] < LOW_CONF:
        print("LOW CONFIDENCE: species may be outside the training set. "
              "Send the sample to a wood anatomist.")
    print("Investigative lead only; confirm by microscopic anatomy or lab analysis.")


if __name__ == "__main__":
    main()

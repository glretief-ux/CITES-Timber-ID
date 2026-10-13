"""Export the trained model to ONNX for the browser app, Raspberry Pi or phone.

Writes a single self-contained models/wood_id.onnx (weights embedded, which the
browser needs) and models/config.json (input size, normalisation, patch size).

Usage:
  python src/export_onnx.py --patch-size 1024
--patch-size must equal the patch size (source pixels) used in make_patches.py.
"""
import argparse
import json
import time

import torch

from common import MEAN, PATCH_OUT, ROOT, STD, build_model


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--patch-size", type=int, default=1024,
                    help="source pixels per patch, as used in make_patches.py")
    args = ap.parse_args()

    ckpt = torch.load(ROOT / "models" / "best.pt", map_location="cpu")
    model = build_model(len(ckpt["classes"]), ckpt["arch"], pretrained=False)
    model.load_state_dict(ckpt["state_dict"])
    model.eval()

    out = ROOT / "models" / "wood_id.onnx"
    dummy = torch.randn(1, 3, PATCH_OUT, PATCH_OUT)
    torch.onnx.export(model, dummy, str(out),
                      input_names=["input"], output_names=["logits"],
                      dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
                      opset_version=17, external_data=False)

    stray = out.with_suffix(".onnx.data")
    if stray.exists():  # older exporters: fold external weights back into one file
        import onnx
        m = onnx.load(str(out))
        onnx.save_model(m, str(out), save_as_external_data=False)
        stray.unlink()

    cfg = {
        "arch": ckpt["arch"],
        "classes": ckpt["classes"],
        "input_size": PATCH_OUT,
        "patch_size_px": args.patch_size,
        "mean": MEAN,
        "std": STD,
        "created": time.strftime("%Y-%m-%d"),
    }
    (ROOT / "models" / "config.json").write_text(json.dumps(cfg, indent=2))
    print(f"wrote {out} ({out.stat().st_size / 1e6:.1f} MB) and models/config.json")


if __name__ == "__main__":
    main()

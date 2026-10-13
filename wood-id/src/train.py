"""Fine-tune a pretrained CNN on wood end-grain patches.

Usage:
  python src/train.py --arch resnet50 --epochs 25
Writes models/best.pt and models/classes.json.
"""
import argparse
import json

import pandas as pd
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from tqdm import tqdm

from common import DATA, ROOT, build_model, eval_transform, get_device, train_transform


class PatchDS(Dataset):
    def __init__(self, df, class_to_idx, tf):
        self.df, self.c2i, self.tf = df.reset_index(drop=True), class_to_idx, tf
        self.root = DATA / "patches"

    def __len__(self):
        return len(self.df)

    def __getitem__(self, i):
        r = self.df.iloc[i]
        img = Image.open(self.root / r["patch_path"]).convert("RGB")
        return self.tf(img), self.c2i[r["species"]]


def run_epoch(model, loader, device, opt=None, loss_fn=None):
    train = opt is not None
    model.train(train)
    tot, correct, loss_sum = 0, 0, 0.0
    with torch.set_grad_enabled(train):
        for x, y in tqdm(loader, leave=False):
            x, y = x.to(device), y.to(device)
            out = model(x)
            loss = loss_fn(out, y)
            if train:
                opt.zero_grad()
                loss.backward()
                opt.step()
            loss_sum += loss.item() * len(y)
            correct += (out.argmax(1) == y).sum().item()
            tot += len(y)
    return loss_sum / max(tot, 1), correct / max(tot, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--arch", default="resnet50", choices=["resnet50", "resnet18", "efficientnet_b0"])
    ap.add_argument("--epochs", type=int, default=25)
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--color-aug", default="strong", choices=["mild", "strong"],
                    help="strength of colour jitter (strong = rely less on wood tint)")
    ap.add_argument("--gray-prob", type=float, default=0.2,
                    help="share of training patches converted to grayscale (0 = never)")
    args = ap.parse_args()

    df = pd.read_csv(DATA / "splits.csv")
    classes = sorted(df["species"].unique())
    c2i = {c: i for i, c in enumerate(classes)}
    (ROOT / "models").mkdir(exist_ok=True)
    (ROOT / "models" / "classes.json").write_text(json.dumps(classes, indent=2))

    train_df = df[df.split == "train"]
    val_df = df[df.split == "val"]
    if val_df.empty:  # tiny datasets: validate on train (only a sanity check!)
        print("WARNING: no val split; using train for monitoring. Do not trust this number.")
        val_df = train_df.sample(min(len(train_df), 500), random_state=0)

    # balance species via sampling weights
    counts = train_df["species"].value_counts()
    weights = train_df["species"].map(lambda s: 1.0 / counts[s]).values
    sampler = WeightedRandomSampler(weights, num_samples=len(train_df), replacement=True)

    tl = DataLoader(PatchDS(train_df, c2i, train_transform(args.color_aug, args.gray_prob)), batch_size=args.batch_size,
                    sampler=sampler, num_workers=args.workers)
    vl = DataLoader(PatchDS(val_df, c2i, eval_transform()), batch_size=args.batch_size,
                    shuffle=False, num_workers=args.workers)

    device = get_device()
    model = build_model(len(classes), args.arch).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs)
    loss_fn = torch.nn.CrossEntropyLoss(label_smoothing=0.1)

    best = 0.0
    for ep in range(1, args.epochs + 1):
        tr_loss, tr_acc = run_epoch(model, tl, device, opt, loss_fn)
        va_loss, va_acc = run_epoch(model, vl, device, None, loss_fn)
        sched.step()
        print(f"epoch {ep:02d} train loss {tr_loss:.3f} acc {tr_acc:.3f} | val loss {va_loss:.3f} acc {va_acc:.3f}")
        if va_acc >= best:
            best = va_acc
            torch.save({"state_dict": model.state_dict(), "arch": args.arch, "classes": classes},
                       ROOT / "models" / "best.pt")
    print(f"best val acc {best:.3f} -> models/best.pt")


if __name__ == "__main__":
    main()

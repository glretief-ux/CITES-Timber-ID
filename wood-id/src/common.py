"""Shared helpers for the macroscopic wood ID pipeline."""
from pathlib import Path

import torch
from torchvision import transforms

PATCH_OUT = 224          # model input size (pixels)
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def eval_transform():
    return transforms.Compose([
        transforms.Resize((PATCH_OUT, PATCH_OUT)),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])


COLOR_JITTER = {
    # mild: colour is kept as a real cue (use with fixed lighting and clean cuts)
    "mild": dict(brightness=0.15, contrast=0.15, saturation=0.10, hue=0.02),
    # strong: the model must rely on pores, parenchyma bands and rays, not on tint
    "strong": dict(brightness=0.35, contrast=0.35, saturation=0.45, hue=0.06),
}


def train_transform(color_aug="strong", gray_prob=0.2):
    """Training augmentation.

    Wood end grain has no canonical orientation, so flips and 90-degree
    rotations are safe. Colour of the same species changes with oxidation,
    moisture, surface finish, heartwood vs sapwood and lighting, so by default
    colour is randomised strongly and some patches are turned to grayscale.
    Compare runs with `--color-aug mild --gray-prob 0` to see what colour is worth.
    """
    return transforms.Compose([
        transforms.RandomResizedCrop(PATCH_OUT, scale=(0.6, 1.0), ratio=(0.9, 1.1)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.RandomApply([transforms.RandomRotation((90, 90))], p=0.5),
        transforms.ColorJitter(**COLOR_JITTER[color_aug]),
        transforms.RandomGrayscale(p=gray_prob),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])


def get_device():
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def build_model(num_classes, arch="resnet50", pretrained=True):
    import os
    from torchvision import models
    if os.environ.get("XYLO_NO_PRETRAINED") == "1":  # offline smoke tests only
        pretrained = False
    if arch == "resnet50":
        w = models.ResNet50_Weights.DEFAULT if pretrained else None
        m = models.resnet50(weights=w)
        m.fc = torch.nn.Linear(m.fc.in_features, num_classes)
    elif arch == "efficientnet_b0":
        w = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
        m = models.efficientnet_b0(weights=w)
        m.classifier[1] = torch.nn.Linear(m.classifier[1].in_features, num_classes)
    elif arch == "resnet18":
        w = models.ResNet18_Weights.DEFAULT if pretrained else None
        m = models.resnet18(weights=w)
        m.fc = torch.nn.Linear(m.fc.in_features, num_classes)
    else:
        raise ValueError(f"unknown arch {arch}")
    return m

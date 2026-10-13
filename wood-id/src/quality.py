"""Patch quality checks for Dino-Lite wood images.

A patch is rejected if it is:
  - blurry            (low variance of the Laplacian on a normalised copy)
  - has overlay lines (long thin pure-red / pure-green lines from app guides)
  - has flat areas    (black borders, UI bars, blown-out or empty regions)
  - over-exposed      (too many saturated pixels)

All checks use numpy + Pillow only.
"""
import numpy as np
from PIL import Image

NORM = 256  # patches are resized to NORM x NORM before measuring
LINE_STRONG = 0.85  # row/column share that counts as "line-like"

DEFAULTS = {
    "min_sharpness": 60.0,    # variance of Laplacian at 256 px (calibrated on Dino-Lite shots)
    "max_flat_frac": 0.20,    # fraction of 8x8 blocks with near-zero texture
    "max_overexposed": 0.08,  # fraction of pixels > 250
    "max_line_frac": 0.85,    # share of a row/column that looks like a guide line
}


def _laplacian_var(gray):
    g = gray.astype(np.float32)
    lap = (-4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:])
    return float(lap.var())


def _flat_fraction(gray, block=8, std_thresh=2.0):
    h, w = gray.shape
    h2, w2 = h - h % block, w - w % block
    b = gray[:h2, :w2].astype(np.float32).reshape(h2 // block, block, w2 // block, block)
    stds = b.std(axis=(1, 3))
    return float((stds < std_thresh).mean())


def _saturated_line_fraction(rgb):
    """Strongly coloured pure red / green guide lines (screenshots)."""
    r, g, b = [rgb[..., i].astype(np.int16) for i in range(3)]
    red = (r > 120) & (r - np.maximum(g, b) > 100)
    green = (g > 100) & (g - np.maximum(r, b) > 60)
    best = 0.0
    for mask in (red, green):
        best = max(best, float(mask.mean(axis=1).max()), float(mask.mean(axis=0).max()))
    return best


def _consistent_line_fraction(arr, k=5, min_shift=15.0):
    """Faint thin straight lines: a whole row/column that differs from the rows
    k pixels above and below it, shifted the same way across (almost) the whole
    width. Natural wood texture is not that consistent."""
    best = 0.0
    for a in (arr, arr.transpose(1, 0, 2)):
        if a.shape[0] <= 2 * k + 1:
            continue
        d = a[k:-k] - 0.5 * (a[:-2 * k] + a[2 * k:])          # (H-2k, W, 3)
        m = d.mean(axis=1)                                      # (H-2k, 3)
        mag = np.linalg.norm(m, axis=1)                         # (H-2k,)
        proj = (d * m[:, None, :]).sum(-1) / np.maximum(mag[:, None], 1e-6)
        frac = (proj > 0.5 * mag[:, None]).mean(axis=1)
        frac[mag < min_shift] = 0.0
        # A guide line is isolated: a few separate lines (each lights up ~10 rows
        # around it). If many separate groups, or a large share of all rows,
        # qualify, it is a regular texture (rays, growth rings), not an overlay.
        strong = np.flatnonzero(frac >= LINE_STRONG)
        if len(strong):
            # rows closer than 2k+2 belong to the same line (its edges and shoulders)
            n_lines = 1 + int((np.diff(strong) > 2 * k + 2).sum())
            if n_lines > 6 or len(strong) > 0.10 * len(frac):
                continue
        best = max(best, float(frac.max()))
    return best


def _line_fraction(img):
    im = img.convert("RGB")
    if max(im.size) > 1024:                       # cap size, keep thin lines visible
        s = 1024 / max(im.size)
        im = im.resize((int(im.width * s), int(im.height * s)), Image.BILINEAR)
    arr = np.asarray(im).astype(np.float32)
    return max(_saturated_line_fraction(arr.astype(np.int16)),
               _consistent_line_fraction(arr))


def measure(img):
    """Return quality metrics for a PIL image (RGB)."""
    small = img.convert("RGB").resize((NORM, NORM), Image.LANCZOS)
    rgb = np.asarray(small)
    gray = np.asarray(small.convert("L"))
    return {
        "sharpness": _laplacian_var(gray),
        "flat_frac": _flat_fraction(gray),
        "overexposed": float((gray > 250).mean()),
        "line_frac": _line_fraction(img),
    }


def check(img, **overrides):
    """Return (ok, reason, metrics). reason is '' when ok."""
    t = {**DEFAULTS, **overrides}
    m = measure(img)
    reasons = []
    if m["line_frac"] > t["max_line_frac"]:
        reasons.append("overlay_line")
    if m["flat_frac"] > t["max_flat_frac"]:
        reasons.append("flat_or_border")
    if m["overexposed"] > t["max_overexposed"]:
        reasons.append("overexposed")
    if m["sharpness"] < t["min_sharpness"]:
        reasons.append("blurry")
    return (not reasons), ",".join(reasons), m

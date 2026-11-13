#!/usr/bin/env python3
"""
Fetch openly licensed macroscopic end-grain photographs and store web-sized copies
in docs/photos/<taxon-id>/ with a manifest (docs/photos/manifest.json).

Source 1: GOIMAI DataSet Phase I (Montes et al. 2024), Zenodo DOI 10.5281/zenodo.11092208,
          licence CC BY-SA 4.0. Phone camera + 24x macro lens, transverse (end-grain) surface.

Run by .github/workflows/photos.yml on a GitHub runner (needs ~1 GB free disk at a time).
Usage: python tools/fetch_photos.py [--per 4] [--only "Dalbergia nigra.zip"]
"""
import argparse, io, json, os, re, sys, time, zipfile, urllib.request, urllib.parse

from PIL import Image, ImageOps, ImageFilter, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "photos")
TMP = os.environ.get("RUNNER_TEMP", "/tmp")
UA = "CITES-Timber-ID photo fetch (https://github.com/glretief-ux/CITES-Timber-ID)"
ZENODO = "https://zenodo.org/records/11092208/files/{}?download=1"

# archive -> (taxon id in tools/species_data.py, species shown, CITES-listed?, images to keep)
GOIMAI = [
    ("Abies guatemalensis.zip", "abies-guatemalensis", "Abies guatemalensis", True, 4),
    ("Aniba canelilla.zip", "aniba-rosaeodora", "Aniba canelilla", False, 3),
    ("Aniba rosodora.zip", "aniba-rosaeodora", "Aniba rosaeodora", True, 4),
    ("Aquilaria malaccensis.zip", "aquilaria-gyrinops", "Aquilaria malaccensis", True, 4),
    ("Araucaria araucana.zip", "araucaria-araucana", "Araucaria araucana", True, 4),
    ("Bulnesia sarmientoi.zip", "bulnesia-sarmientoi", "Bulnesia sarmientoi", True, 4),
    ("Caryocar costaricense.zip", "caryocar-costaricense", "Caryocar costaricense", True, 4),
    ("Cedrela odorata.zip", "cedrela-spp", "Cedrela odorata", True, 4),
    ("Dalbergia latifolia.zip", "dalbergia-spp", "Dalbergia latifolia", True, 3),
    ("Dalbergia nigra.zip", "dalbergia-nigra", "Dalbergia nigra", True, 4),
    ("Dalbergia retusa.zip", "dalbergia-spp", "Dalbergia retusa", True, 3),
    ("Dalbergia sissoo.zip", "dalbergia-spp", "Dalbergia sissoo", True, 3),
    ("Dalbergia stevensonii.zip", "dalbergia-spp", "Dalbergia stevensonii", True, 3),
    ("Diospyros spp. 1.zip", "diospyros-madagascar", "Diospyros sp. (set 1)", True, 2),
    ("Diospyros spp. 2.zip", "diospyros-madagascar", "Diospyros sp. (set 2)", True, 2),
    ("Diospyros spp. 3.zip", "diospyros-madagascar", "Diospyros sp. (set 3)", True, 2),
    ("Fitzroya cupressoides.zip", "fitzroya-cupressoides", "Fitzroya cupressoides", True, 4),
    ("Gonystylus bancanus.zip", "gonystylus-spp", "Gonystylus bancanus", True, 3),
    ("Gonystylus spp.zip", "gonystylus-spp", "Gonystylus sp.", True, 2),
    ("Guaiacum officinale.zip", "guaiacum-spp", "Guaiacum officinale", True, 4),
    ("Handroanthus chrysanthus.zip", "ipe-handroanthus-tabebuia-roseodendron", "Handroanthus chrysanthus", True, 2),
    ("Handroanthus heptaphyllus.zip", "ipe-handroanthus-tabebuia-roseodendron", "Handroanthus heptaphyllus", True, 2),
    ("Handroanthus serratifolius.zip", "ipe-handroanthus-tabebuia-roseodendron", "Handroanthus serratifolius", True, 3),
    ("Magnolia liliifera var. Obovata.zip", "magnolia-liliifera-obovata", "Magnolia liliifera var. obovata", True, 4),
    ("Paubrasilia echinata 1.zip", "paubrasilia-echinata", "Paubrasilia echinata", True, 2),
    ("Paubrasilia echinata 2.zip", "paubrasilia-echinata", "Paubrasilia echinata", True, 2),
    ("Pericopsis elata.zip", "pericopsis-elata", "Pericopsis elata", True, 4),
    ("Pilgerodendron uviferum.zip", "pilgerodendron-uviferum", "Pilgerodendron uviferum", True, 4),
    ("Platymiscium parviflorum.zip", "platymiscium-pleiostachyum", "Platymiscium parviflorum", True, 4),
    ("Podocarpus neriifolius.zip", "podocarpus-neriifolius", "Podocarpus neriifolius", True, 4),
    ("Prunus africana.zip", "prunus-africana", "Prunus africana", True, 4),
    ("Quercus mongolica.zip", "quercus-mongolica", "Quercus mongolica", True, 4),
    ("Swietenia humilis.zip", "swietenia-spp", "Swietenia humilis", True, 3),
    ("Swietenia macrophylla.zip", "swietenia-spp", "Swietenia macrophylla", True, 3),
    ("Swietenia mahagoni.zip", "swietenia-spp", "Swietenia mahagoni", True, 3),
    ("Tabebuia rosea.zip", "ipe-handroanthus-tabebuia-roseodendron", "Tabebuia rosea", True, 2),
    ("Taxus cuspidata.zip", "taxus-spp", "Taxus cuspidata", True, 4),
]
CREDIT = ("GOIMAI DataSet Phase I - Montes R., Herrera Poyatos D., Herrera-Poyatos A., Herrera F., "
          "de Palacios P., de Marco Blanco A., Garcia Iruela A., Garcia-Fernandez F., Esteban L.G. (2024), "
          "Zenodo, doi:10.5281/zenodo.11092208")


def download(url, dest, tries=4):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
                while True:
                    b = r.read(1 << 20)
                    if not b:
                        break
                    f.write(b)
            return True
        except Exception as e:  # noqa
            print(f"  download failed ({e}); retry {k + 1}/{tries}", flush=True)
            time.sleep(20 * (k + 1))
    return False


def sharpness(img):
    g = ImageOps.grayscale(img).resize((800, 600))
    e = g.filter(ImageFilter.FIND_EDGES).crop((40, 40, 760, 560))
    return ImageStat.Stat(e).var[0]


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


import subprocess, threading
from concurrent.futures import ThreadPoolExecutor

LOCK = threading.Lock()
MPATH = os.path.join(OUT, "manifest.json")
LOG = os.path.join(ROOT, "tools", "photo_fetch_log.txt")


def git(*a):
    return subprocess.run(["git", "-C", ROOT] + list(a), capture_output=True, text=True)


def checkpoint(msg, recs=None, arch=None):
    """Save progress: update the manifest and log, commit and push (when run in CI)."""
    with LOCK:
        with open(LOG, "a") as f:
            f.write(time.strftime("%H:%M:%S ") + msg + "\n")
        if recs is not None:
            old = json.load(open(MPATH)) if os.path.exists(MPATH) else []
            keep = [r for r in old if r.get("orig", "").split(":")[0] != arch]
            json.dump(keep + recs, open(MPATH, "w"), indent=1, ensure_ascii=False)
        if os.environ.get("CI"):
            git("add", "docs/photos", "tools/photo_fetch_log.txt", "tools/goimai_listing.json", "_candidates")
            if git("diff", "--cached", "--quiet").returncode:
                git("commit", "-m", "Photos: " + msg[:60])
                for _ in range(3):
                    git("pull", "--rebase", "-X", "theirs")
                    if git("push").returncode == 0:
                        break
                    time.sleep(5)


def one_archive(job, per_override=None):
    arch, tid, species, listed, per = job
    per = per_override or per
    done = json.load(open(MPATH)) if os.path.exists(MPATH) else []
    if any(r.get("orig", "").split(":")[0] == arch for r in done):
        return
    zpath = os.path.join(TMP, slug(arch) + ".zip")
    t0 = time.time()
    if not download(ZENODO.format(urllib.parse.quote(arch)), zpath):
        checkpoint(f"FAILED download {arch}")
        return
    mb = os.path.getsize(zpath) / 1e6
    dl = time.time() - t0
    recs = []
    try:
        z = zipfile.ZipFile(zpath)
        names = sorted(n for n in z.namelist()
                       if n.lower().endswith((".jpg", ".jpeg", ".png")) and "__macosx" not in n.lower()
                       and not os.path.basename(n).startswith("."))
        slices = [names[i * len(names) // per:(i + 1) * len(names) // per] for i in range(per)]
        d = os.path.join(OUT, tid)
        os.makedirs(d, exist_ok=True)
        k = 0
        for sl in slices:
            if not sl:
                continue
            best = None
            for n in sl[::max(1, len(sl) // 5)][:5]:
                try:
                    im = ImageOps.exif_transpose(Image.open(io.BytesIO(z.read(n)))).convert("RGB")
                except Exception as e:  # noqa
                    continue
                s_ = sharpness(im)
                if best is None or s_ > best[0]:
                    best = (s_, n, im)
            if not best:
                continue
            s_, n, im = best
            k += 1
            base = f"{slug(species)}-goimai-{k}"
            W, H = im.size
            full = im.copy()
            full.thumbnail((2000, 2000), Image.LANCZOS)
            full.save(os.path.join(d, base + ".jpg"), "JPEG", quality=76, optimize=True, progressive=True)
            ImageOps.fit(im, (480, 360), Image.LANCZOS).save(os.path.join(d, base + "-thumb.jpg"), "JPEG", quality=72, optimize=True)
            recs.append({"taxon": tid, "species": species, "listed": listed, "file": f"{tid}/{base}.jpg",
                         "thumb": f"{tid}/{base}-thumb.jpg", "w": full.size[0], "h": full.size[1],
                         "orig": f"{arch}:{n}", "orig_px": [W, H], "sharp": round(s_, 1),
                         "surface": "transverse (end grain)", "optics": "phone camera + 24x macro lens",
                         "source": "GOIMAI", "credit": CREDIT, "licence": "CC BY-SA 4.0",
                         "licence_url": "https://creativecommons.org/licenses/by-sa/4.0/",
                         "source_url": "https://doi.org/10.5281/zenodo.11092208"})
        z.close()
        msg = f"{arch}: {len(names)} images, kept {len(recs)}, {mb:.0f} MB in {dl:.0f}s; dirs={sorted({os.path.dirname(n) for n in names})[:4]}"
    except Exception as e:  # noqa
        msg = f"FAILED {arch}: {e}"
    finally:
        if os.path.exists(zpath):
            os.remove(zpath)
    checkpoint(msg, recs or None, arch)
    print(msg, flush=True)


def process_goimai(only=None, per_override=None):
    jobs = sorted((j for j in GOIMAI if not only or j[0] in only), key=lambda j: j[0] != "Quercus mongolica.zip")
    checkpoint(f"start, {len(jobs)} archives")
    with ThreadPoolExecutor(5) as ex:
        list(ex.map(lambda j: one_archive(j, per_override), jobs))
    return [], {}


COMMONS_TAXA = {
    "afzelia-spp": ["Afzelia"], "dipteryx-spp": ["Dipteryx odorata", "Dipteryx"],
    "fraxinus-mandshurica": ["Fraxinus mandshurica"], "guibourtia-bubinga": ["Guibourtia", "Bubinga"],
    "khaya-spp": ["Khaya"], "oreomunnea-pterocarpa": ["Oreomunnea"], "osyris-lanceolata": ["Osyris lanceolata"],
    "pinus-koraiensis": ["Pinus koraiensis"], "podocarpus-parlatorei": ["Podocarpus parlatorei"],
    "pterocarpus-africa": ["Pterocarpus soyauxii", "Pterocarpus angolensis", "Padauk"],
    "pterocarpus-erinaceus": ["Pterocarpus erinaceus"], "pterocarpus-santalinus": ["Pterocarpus santalinus"],
    "pterocarpus-tinctorius": ["Pterocarpus tinctorius"], "tetracentron-sinense": ["Tetracentron sinense"],
    "widdringtonia-whytei": ["Widdringtonia whytei", "Widdringtonia"], "taxus-spp": ["Taxus wallichiana", "Taxus chinensis"],
    "guaiacum-spp": ["Guaiacum sanctum"], "dalbergia-spp": ["Dalbergia melanoxylon", "Dalbergia cochinchinensis"],
}


def commons_candidates():
    """List (not publish) Wikimedia Commons candidates for taxa GOIMAI lacks; a person then curates them."""
    out = {}
    cdir = os.path.join(ROOT, "_candidates")
    os.makedirs(cdir, exist_ok=True)
    for tid, terms in COMMONS_TAXA.items():
        out[tid] = []
        for term in terms:
            for q in (f'"{term}" wood', f'"{term}" (holz OR "cross section" OR "end grain" OR xylem OR bois OR madera)'):
                url = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6"
                       "&gsrlimit=20&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=500&gsrsearch="
                       + urllib.parse.quote(q + " filetype:bitmap"))
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": UA})
                    js = json.load(urllib.request.urlopen(req, timeout=60))
                except Exception as e:  # noqa
                    print("commons fail", q, e)
                    continue
                for p in (js.get("query", {}).get("pages", {}) or {}).values():
                    ii = (p.get("imageinfo") or [{}])[0]
                    md = ii.get("extmetadata", {})
                    rec = {"title": p.get("title"), "page": ii.get("descriptionurl"), "url": ii.get("url"),
                           "thumb": ii.get("thumburl"), "w": ii.get("width"), "h": ii.get("height"),
                           "licence": (md.get("LicenseShortName") or {}).get("value"),
                           "artist": re.sub("<[^>]+>", "", (md.get("Artist") or {}).get("value", ""))[:200],
                           "desc": re.sub("<[^>]+>", "", (md.get("ImageDescription") or {}).get("value", ""))[:300]}
                    if rec["title"] and rec["title"] not in [r["title"] for r in out[tid]]:
                        out[tid].append(rec)
                time.sleep(1)
        for i, rec in enumerate(out[tid][:30]):
            if rec.get("thumb"):
                fn = f"{tid}__{i:02d}.jpg"
                if download(rec["thumb"], os.path.join(cdir, fn), tries=2):
                    rec["local"] = fn
                time.sleep(0.5)
        print(tid, len(out[tid]), "commons candidates", flush=True)
    json.dump(out, open(os.path.join(cdir, "commons.json"), "w"), indent=1, ensure_ascii=False)
    checkpoint("commons candidates listed")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per", type=int)
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--no-commons", action="store_true")
    ap.add_argument("--no-goimai", action="store_true")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    if not a.no_goimai:
        process_goimai(a.only, a.per)
    if not a.no_commons:
        commons_candidates()


if __name__ == "__main__":
    sys.exit(main())

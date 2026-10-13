# Macroscopic wood ID with a Dino-Lite (XyloTron-style approach)

Image-based identification of CITES-relevant timber from 10x end-grain images,
using a fine-tuned CNN. The method (transfer learning on end-grain patches,
specimen-level evaluation) follows the published XyloTron work; this is an
independent implementation. Check the original project's papers and license
before reusing any of its code or data.

## Workflow
1. Capture images following `docs/IMAGING_PROTOCOL.md` into `data/raw/<Genus_species>/<specimen_id>/`.
2. Fill `data/metadata.csv` (columns listed in the protocol; see `data/metadata_example.csv`).
3. Run the pipeline:

```bash
pip install -r requirements.txt
python src/make_patches.py --patch-size 1024 --stride 1024
python src/split.py
python src/train.py --arch resnet50 --epochs 25
python src/evaluate.py
python src/predict.py sample1.png sample2.png
python src/export_onnx.py
```

## Scope: CITES-listed African timbers
`data/species_scope_africa.csv` is the source of truth for what the model should know:
- `cites_target`: listed African taxa (Afzelia, Khaya, Pterocarpus, Pericopsis elata, Guibourtia x3, Dalbergia,
  Madagascar Diospyros, Prunus africana, Osyris lanceolata, Widdringtonia whytei).
- `background_lookalike`: common unlisted timbers (wenge, sapele group, iroko, ovangkol, ...). The model needs these
  as classes, otherwise it must call every wood a listed one.
- Source: the CITES Secretariat overview of African tree species (PC27), the Forest Trends CoP19 brief and the ATIBT
  FAQ. CoP20 (Nov-Dec 2025) did not add African timbers (ATIBT report, USFWS bulletin). The `check_status` column
  says what was verified in a source and what still needs a check on [Species+](https://speciesplus.net/).
  Listings change at every CoP: re-check before relying on this table.
- Common names are general knowledge, not from the CITES documents.

`python src/build_web_assets.py --tracker-only` writes `data/collection_tracker.csv`: every species to image,
priority, and how many specimens you have so far (counted from `data/metadata.csv`).
Aim for at least 5 specimens per species to get a first result and 20 to trust it.

## The upload-a-photo app (`docs/identify/`, served by GitHub Pages)
A static web page: choose one or several 10x photos of the same sample and get a ranked answer, a verdict
(likely listed / likely not listed / inconclusive), the CITES status of each candidate, and a by-genus view
(several African listings cover a whole genus, so the genus is often what matters).
It runs entirely in the browser with onnxruntime-web, so photos never leave the device and it works on an iPad.

```bash
python src/train.py --arch resnet18 --epochs 25
python src/export_onnx.py --patch-size 1024     # must match make_patches.py
python src/build_web_assets.py --web-dir ../docs/identify   # copies the model into docs/identify/models/ and resolves CITES status
cd ../docs && python -m http.server 8000   # then open http://localhost:8000/identify/
```
The repo already publishes docs/ with GitHub Pages, so committing docs/identify/models/ publishes the model.
The ONNX file is 15-45 MB depending on the architecture, below GitHub's 100 MB limit.
**No trained model ships with this project.** Until you add one, the page says so and the Identify button stays off.
Never publish a model that has not been evaluated on held-out specimens with `evaluate.py`.

How the page decides: patches are cut like in training, blurry/flat/glare patches are left out, probabilities are
averaged, and the verdict thresholds the combined probability of listed vs unlisted classes (provisional values in
`web/core.js`, tune them on your own held-out results). Confidence is the model's score, not a calibrated probability.

## Automatic quality filter
`make_patches.py` rejects bad patches before training and tells you which photos to retake:
- **blurry** (out of focus or tilted specimen), **overlay_line** (red/green guide lines from the capture app),
  **flat_or_border** (black borders, app bars, empty areas), **overexposed** (glare).
- Rejected patches and the reason are listed in `data/rejected_patches.csv`.
- The summary prints a `RETAKE` list for photos where at least half the patches were rejected.
- Thresholds were calibrated on real Dino-Lite photos. Adjust with `--min-sharpness`, `--max-flat-frac`,
  `--max-overexposed`, `--max-line-frac`, or switch it off with `--no-quality-filter`.
- Always save clean snapshots from the Dino-Lite app. Screenshots of the app screen carry buttons, ads and guide lines.

## Colour augmentation
By default training randomises colour strongly and turns 20% of patches grayscale, so the model relies on
pores, parenchyma bands and rays rather than tint (colour changes with oxidation, moisture, finish,
sapwood vs heartwood). To see what colour is worth, compare two runs:
```bash
python src/train.py --color-aug strong --gray-prob 0.2   # default
python src/train.py --color-aug mild   --gray-prob 0     # colour kept as a cue
```
Report specimen-level accuracy from `evaluate.py` for both.

## Reference images from the web or books
Keep them out of `data/raw`. Mixed into training they teach the model the look of that photo source,
not of the species. Store them as a visual reference gallery with source and licence.

## What the numbers mean
- Report **specimen-level accuracy** from `evaluate.py`, not patch accuracy.
- Splits are by specimen. With < 3 specimens a species cannot be evaluated.
- The model only knows species it was trained on. Unknown woods will still get a
  prediction; low-confidence output must be treated as "not in database".
- Output is an investigative lead, not forensic proof.

## Honest limits
- Close species within a genus (e.g. some Dalbergia, Pterocarpus) often cannot be
  separated by 10x end grain alone; the confusion matrix will show which.
- A model trained on one microscope and lighting setup degrades on others. Keep
  hardware fixed, or add images from every device you plan to deploy on.

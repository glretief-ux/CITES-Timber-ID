# Imaging & specimen protocol (Dino-Lite, end-grain)

Goal: a consistent, verifiable image set for training a macroscopic wood-ID model.
Consistency across specimens matters more than megapixels.

## 1. Equipment
- Dino-Lite digital microscope (any model with polarized or white LED and a measurement/calibration function; DinoCapture 2.0 or DinoXcope software).
- Rigid stand with fixed height (do NOT image handheld). Mark the stand position so it can be reproduced.
- Calibration target (Dino-Lite calibration plate or a printed ruler slide).
- Sharp tools: fresh single-edge razor blade or a very sharp chisel / microtome blade for cutting end grain; fine sandpaper (600-1000 grit) as a fallback only.
- Specimen labels, gloves, matte neutral background.

## 2. Fixed capture settings (write them into every session log)
| Setting | Value |
|---|---|
| Magnification | Fixed at ~10x (target 10x field of view; verify by calibration plate) |
| Resolution | Highest native, same for all images |
| Lighting | Same LED mode, same brightness; prefer polarized if the model supports it to reduce glare |
| White balance | Locked after calibrating on a neutral grey card |
| Exposure | Fixed (manual) |
| Focus | Manual, focus on growth rings / vessels, take focus-stack only if the model supports EDOF |
| Image format | PNG or max-quality JPEG; never re-compress |

Re-calibrate scale (pixels per mm) at the start of every session and save a calibration photo.
The nominal "10x" of a Dino-Lite depends on the display size, so always trust the measured pixels per mm.

**Save clean snapshots, never screenshots.** Use the Dino-Lite app's snapshot/save function. Screenshots of the
app contain buttons, ads and red/green guide lines that would end up in the training data. If your app draws guide
lines on the live view, switch them off before capturing.

**Specimen position:** fill the frame with wood. Black corners or specimen edges in the frame are wasted pixels and
are rejected by the quality filter.

## 3. Surface preparation (the single biggest quality factor)
1. Cut a fresh transverse (cross) surface with a razor or chisel. Cut, don't sand: sanding smears and clogs vessels.
2. Remove dust with a soft brush or air puff. Do not wet or oil the surface unless every specimen is treated the same way.
3. Make sure the surface is flat and perpendicular to the optical axis.
4. Note moisture state (dry / wet) in metadata.

## 4. Capture routine per specimen
- Capture **at least 10 non-overlapping fields** across different growth rings and regions of the surface.
- Include sapwood-adjacent and heartwood regions when present; record which in metadata.
- Include 1 image with the scale visible (calibration reference) per specimen.
- Reject images that are blurry, glared, or show saw marks or sanding scratches.

## 5. Specimen and metadata rules
- One **specimen ID** per physical piece of wood. Every image from it carries that ID.
- Prefer **vouchered reference specimens**: xylarium samples (e.g. Royal Museum for Central Africa, Tervuren; Kew; USDA FPL; Naturalis) with a herbarium voucher or xylarium accession number.
- Record the source (xylarium accession number, vendor, seizure case) and confidence of the species label: `vouchered`, `expert-ID`, or `trade-ID`. Train only on `vouchered` or `expert-ID`; keep `trade-ID` for testing field behavior.
- Aim for **>= 20 specimens per species** (minimum 5-10 to start), from more than one tree/source.
- Put look-alike species in the same dataset on purpose (same genus, same trade group) because those pairs are where the model gets tested.

## 6. Folder layout
```
data/raw/
  <Genus_species>/
    <specimen_id>/
      <specimen_id>_001.png
      ...
data/metadata.csv
```
`metadata.csv` columns: `image_path, species, specimen_id, source, label_confidence, session_date, pixels_per_mm, sapwood_heartwood, moisture, notes`

Use `Genus_species` with an underscore, e.g. `Dalbergia_nigra`, `Swietenia_macrophylla`.

## 7. CITES and legal notes
- Only collect CITES-listed material you may legally hold; xylarium loans and exempt small samples are normal routes. Check permits for cross-border shipments of samples.
- The tool gives an **investigative lead**, not legal proof. Positive IDs for enforcement should be confirmed by a wood anatomist or lab analysis (anatomy, DNA, or isotopes).

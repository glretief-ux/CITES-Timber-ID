# Photo protocol — building the 10x reference photo library

The repository ships with **schematic drawings** of each taxon and **links** to published 10x end-grain photo collections. Real photographs are added by contributors from **verified reference specimens** (xylarium samples, lab-confirmed seizures) so the library stays legally reusable and scientifically reliable.

## Why photos are not copied in from websites
Most online 10x photo collections (The Wood Database, CITESwoodID, Pl@ntWood, atlases) are copyrighted. Link to them; do not upload their images unless the licence allows it (public domain, CC-BY, CC-BY-SA). US Government (USDA Forest Products Laboratory) publications are generally public domain — check each source.

## Taking a 10x photo
1. Specimen: verified heartwood, identity confirmed by a xylarium label or laboratory report.
2. Cut the end grain fresh with a razor blade (see [field procedure](field-procedure.md)); sanded surfaces (to 600–1,500 grit) are also good for imaging.
3. Lens: 10x loupe held against the phone camera, a clip-on macro lens, or a XyloPhone / XyloScope device (open-source, USDA FPL). Field of view about 5–7 mm.
4. Light: even, from the side at a low angle; no flash glare.
5. Take: dry, then wet; include a mm scale in at least one shot; keep the rays vertical (radial direction up the image).
6. Tangential face at 10x if ripple marks are expected.

## Adding photos
1. Put the file in `photos/<taxon-id>/` named `<taxon-id>_<source>_<specimen-no>_<n>.jpg` (max ~2 MB, JPEG).
2. Add a row to `photos/manifest.csv`:

```
taxon_id,file,magnification,surface,wet_or_dry,specimen_source,specimen_id,photographer,licence,notes
dalbergia-nigra,dalbergia-nigra_MADw_12345_1.jpg,10x,transverse,wet,USDA FPL xylarium,MADw-12345,J. Smith,CC-BY-4.0,heartwood
```

3. Commit. The GitHub Action re-runs `tools/build.py`, copies the photo into `docs/photos/` and the web key shows it on the species card.

On GitHub's website: open `photos/<taxon-id>/` → **Add file → Upload files**, then edit `photos/manifest.csv` with the pencil icon and add your row.

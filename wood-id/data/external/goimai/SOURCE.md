# GOIMAI open wood images (external, not Dino-Lite)

- Source: GOIMAI dataset, Zenodo, DOI 10.5281/zenodo.11092208
- Authors listed on the record: Rosana Montes and others (data manager Luis G. Esteban). Check the record for the exact citation.
- Licence: CC BY-SA 4.0. Keep attribution and share any derived image sets under the same licence.
- Camera: phone with a 24x macro lens (not a Dino-Lite at 10x). Different optics, colour and scale.
- The images are NOT stored in this repository (about 250 MB for Prunus africana). Download them from Zenodo into
  `wood-id/data/external/goimai/<Genus_species>/` (ignored by git).

## What we hold so far
| Species | CITES | Images | Notes |
|---|---|---|---|
| Prunus africana | App II #4 | 61 (4032x3024), 361 of 366 1024px tiles pass the quality filter, 5 blurry | Specimen IDs are not given, so a specimen-level split is not possible. Use only for a first test or to see the features; never to measure accuracy. |

Still to get: Pericopsis elata.zip (558 MB) from the same record.
Do not mix these with Dino-Lite training data without a separate camera label, or the model learns the camera.

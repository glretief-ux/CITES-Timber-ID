# CITES Timber ID

**A field reference that helps customs, police, forestry and border officers screen timber against the CITES Appendices.**

Open it: **https://glretief-ux.github.io/CITES-Timber-ID/docs/** (works on a phone, and offline after the first visit)

> **Screening aid, not evidence of species.** End-grain features seen with a 10x hand lens usually identify wood to genus or species group. Confirm with a qualified laboratory and the live listing on [Species+](https://speciesplus.net) before enforcement action. This is an independent open reference, not an official publication of the CITES Secretariat or of any government.

## What an officer can do with it

| Page | Use it to |
|---|---|
| [Lookup](docs/index.html) | Type any scientific, trade or common name (English, Spanish, French) or an old synonym. Every one of the 696 CITES-listed tree taxa resolves to a profile with end-grain photographs, what the listing controls, required documents, 10x features, look-alikes and the complete list of listed species with native distribution. Non-listed look-alikes are flagged. Two more tabs search every CITES-listed plant (34,363 taxa) and animal (6,678 taxa). |
| [Country map](docs/map.html) | Tap a country to list every CITES-listed timber, plant or animal that is native to it. |
| [10x key](docs/key.html) | Tick what you see on the end grain; the listed timbers that fit are ranked. |
| [DELTA keys](docs/delta.html) | Direct links to the CITESwoodID (DELTA-Intkey) description of every listed timber and its common look-alikes. |
| [DELTA keys](docs/delta.html) | Direct links to the CITESwoodID (DELTA-Intkey) description, 10x photo and interactive key for every listed timber. |
| [Consignment check](docs/check.html) | Pick the timber and the product form (by HS heading) to see whether CITES documents are required and which ones. Includes the five checks, a permit checklist, source and purpose codes, the annotation matrix and worked examples. |
| [Field procedure](docs/field.html) | Red flags, kit, how to cut and read end grain, quick tests, sampling and chain of custody, what each laboratory method can answer, feature glossary. |
| [Photo ID trial](docs/identify/index.html) | Experimental photo recognition for African timbers. Demonstration model only; not for casework. |
| [Sources](docs/about.html) | Listing basis, changes since CoP20, photo credits and licences, limits. |

Each profile prints as a one-page sheet and has its own link to share.

## Listing basis

CITES Appendices in force from **5 March 2026** (amendments adopted at CoP20, Samarkand, 24 Nov to 5 Dec 2025), checked on 13 November 2026 against the Species+ export of 22 October 2026.

Changes reflected:

- *Podocarpus parlatorei* transferred from Appendix I to Appendix II with a zero export quota for wild-taken specimens for commercial purposes.
- *Paubrasilia echinata* (pernambuco) stays in Appendix II with a revised annotation #10 and a zero quota for wild-harvested specimens in commercial trade.
- Proposals to remove Central African populations of *Afzelia bipindensis* and *Pterocarpus soyauxii* were rejected.
- *Pterocarpus erinaceus* and *P. tinctorius* are covered by the *Pterocarpus* spp. (African populations) listing with annotation #17.
- *Platymiscium pleiostachyum* is listed under the name *Platymiscium parviflorum*.

**Appendix I:** *Dalbergia nigra*, *Abies guatemalensis*, *Araucaria araucana*, *Fitzroya cupressoides*, *Pilgerodendron uviferum*

**Appendix II:** *Dalbergia* spp., *Guibourtia demeusei / pellegriniana / tessmannii*, *Pterocarpus* spp. (Africa) including *P. erinaceus* and *P. tinctorius*, *P. santalinus*, *Swietenia* (3 spp.), *Cedrela* spp. (Neotropics), *Khaya* spp. (Africa), *Afzelia* spp. (Africa), *Handroanthus*, *Tabebuia*, *Roseodendron*, *Dipteryx* spp., *Paubrasilia echinata*, *Gonystylus* spp., *Aquilaria* and *Gyrinops*, *Pericopsis elata*, *Platymiscium parviflorum*, *Caryocar costaricense*, *Diospyros* spp. (Madagascar), *Bulnesia sarmientoi*, *Guaiacum* spp., *Osyris lanceolata* (six East African populations), *Prunus africana*, *Aniba rosaeodora*, *Oreomunnea pterocarpa*, Asian *Taxus* (5 spp.), *Widdringtonia whytei*, *Podocarpus parlatorei*

**Appendix III:** *Pinus koraiensis*, *Quercus mongolica*, *Fraxinus mandshurica* (Russian Federation); *Podocarpus neriifolius*, *Tetracentron sinense*, *Magnolia liliifera* var. *obovata* (Nepal)

Species within a genus usually cannot be separated with a hand lens, so the 696 listed taxa are grouped into 39 identification entries.

## End-grain photographs

Photographs are stored in `docs/photos/` and come only from sources whose licence allows reuse:

- **GOIMAI DataSet Phase I** (Montes et al. 2024, [doi:10.5281/zenodo.11092208](https://doi.org/10.5281/zenodo.11092208), CC BY-SA 4.0): end-grain images of 37 CITES timber species taken with a phone and 24x macro lens. `tools/fetch_photos.py` downloads the archives, keeps the sharpest images per species and writes web-sized copies with credits to `docs/photos/manifest.json`.
- **Your own reference specimens:** put the file in `photos/<taxon-id>/` and add a row to `photos/manifest.csv`. These appear first on the profile.

Copyright atlases (CITESwoodID, The Wood Database, InsideWood, Pl@ntWood) are linked from each profile, not copied. Timbers that still lack an open photograph show a schematic drawing and are listed on the [Sources](docs/about.html#credits) page.

## Repository layout

| Path | Contents |
|---|---|
| `tools/species_data.py` | **Single source** for the 39 entries: listing, annotation, features, look-alikes, annotation coverage table |
| `tools/build.py` | Builds `docs/data/timber.json`, CSVs, `species/*.md`, schematic drawings. Attaches the full species lists, synonyms and common names from the Species+ export |
| `tools/build_checklist.py`, `tools/build_names.py` | Rebuild the plant and animal checklist from a new Species+ export |
| `tools/build_map.js` | Builds the world map outlines and country-name lookup (`docs/assets/world.json`) |
| `tools/fetch_photos.py`, `.github/workflows/photos.yml` | Fetch open-licence photographs (run from the Actions tab) |
| `docs/` | The website (GitHub Pages) |
| `species/`, `data/` | Field-guide pages in Markdown and the database as CSV and JSON |
| `guides/` | Field procedure, CITES documents, glossary, photo protocol in Markdown |
| `wood-id/` | Training pipeline and imaging protocol for the photo ID trial |

## Keeping it current

1. Edit `tools/species_data.py` (on GitHub: pencil icon). The Action rebuilds everything.
2. After a CoP or an Appendix III change, download the *CITES listed species* CSV from Species+ and run `python tools/build_checklist.py <file.csv>`, then `python tools/build.py`. The build prints a warning wherever an entry disagrees with the export.
3. Offline on a laptop: download the repository, run `python -m http.server` in the folder and open `http://localhost:8000/docs/`.

## Licence

Code: MIT. Text and compiled data: CC BY 4.0. Photographs: the licence shown beside each one (GOIMAI: CC BY-SA 4.0). See [LICENSE](LICENSE).

## Key references

- CITES Appendices and Species+: https://cites.org/eng/app/appendices.php, https://speciesplus.net
- CITES timber identification repository: https://cites.org/eng/timber/timber-ID-repository
- *CITES and Timber: a guide to CITES-listed tree species* (Kew and CITES)
- UNODC (2016) *Best Practice Guide for Forensic Timber Identification*
- Richter, Gembruch and Koch, *CITESwoodID* (Thünen Institute)
- Ruffinatto and Crivellaro (2019) *Atlas of Macroscopic Wood Identification*, Springer
- Wiedenhoeft (2011) *Identification of Central American Woods*, USDA Forest Products Laboratory

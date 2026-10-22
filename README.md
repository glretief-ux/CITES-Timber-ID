# CITES Timber ID

**A field reference for law enforcement to screen CITES-listed wood species at the macroscopic (10x hand-lens) level.**

Covers every tree taxon listed in CITES Appendices I, II and III that is traded as timber or wood products — genera, species, subspecies/varieties and population-limited listings — with their listing status, annotations, physical characteristics, 10x end-grain features, look-alikes and links to 10x photo collections.

> ⚠️ **Screening tool, not a final identification.** Hand-lens anatomy usually identifies wood to genus or species group. Confirm species with an accredited laboratory (wood anatomy, DNA, DART-TOF mass spectrometry, NIR) and always check the live listing on [Species+](https://speciesplus.net) before enforcement action.

## What's inside

| Path | Contents |
|---|---|
| [`docs/search.html`](docs/search.html) | **Species lookup** — type a scientific name, synonym or trade name and get the full profile (listing, annotation, 10x features, characteristics, look-alikes, photo sources). Recognises any species of a listed genus and warns about non-listed look-alikes. Shareable link per species, printable |
| [`docs/index.html`](docs/index.html) | **Interactive identification key** — tick what you see under the lens, get ranked candidates (works on phone; publish with GitHub Pages) |
| [`species/`](species/README.md) | One field-guide page per listed taxon: listing, annotation, 10x features, colour, density, smell, look-alikes, species covered, photo sources |
| [`data/species.json`](data/species.json), [`data/species.csv`](data/species.csv) | Full database (opens in Excel) |
| [`docs/schematics/`](docs/schematics) | Schematic 10x end-grain drawing for every taxon (clearly labelled *not a photograph*) |
| [`photos/`](photos) | 10x photo library — one folder per taxon, with what to photograph; `manifest.csv` lists added photos |
| [`docs/identify/`](docs/identify/index.html) | **Identify from photo (in development)** — upload a 10x end-grain photo and get a CITES-listed vs unlisted African timber lead, computed in the browser. Needs a trained model; none is installed yet |
| [`wood-id/`](wood-id/README.md) | Training pipeline, imaging protocol and CITES African scope table for that model |
| [`guides/field-procedure.md`](guides/field-procedure.md) | How to cut, observe, test, document and sample suspect timber |
| [`guides/cites-documents.md`](guides/cites-documents.md) | **Documents required per Appendix** — export/import permits, re-export certificates, certificates of origin, validity, codes, exemptions and a document check |
| [`guides/feature-glossary.md`](guides/feature-glossary.md) | What each end-grain feature looks like |
| [`guides/photo-protocol.md`](guides/photo-protocol.md) | How to take and add 10x reference photos |
| [`tools/species_data.py`](tools/species_data.py) | **The single source** — edit here, then everything is rebuilt |

## Coverage (listing basis: after CoP20, Samarkand, Nov–Dec 2025)

CoP20 adopted **no new timber listings**. Proposals to remove Central African *Afzelia bipindensis* and *Pterocarpus soyauxii* from Appendix II were **rejected**; the annotation for pernambuco (*Paubrasilia echinata*, #10) was **amended**, with new decisions on bow traceability.

**Appendix I:** *Dalbergia nigra*, *Abies guatemalensis*, *Araucaria araucana*, *Fitzroya cupressoides*, *Pilgerodendron uviferum*, *Podocarpus parlatorei*

**Appendix II:** *Dalbergia* spp. (all), *Guibourtia demeusei / pellegriniana / tessmannii* (bubinga), *Pterocarpus erinaceus*, *P. santalinus*, *P. tinctorius*, *Pterocarpus* spp. (Africa), *Swietenia* (3 spp.), *Cedrela* spp. (Neotropics), *Khaya* spp. (Africa), *Afzelia* spp. (Africa), *Handroanthus*, *Tabebuia*, *Roseodendron* (ipê), *Dipteryx* spp. (cumaru), *Paubrasilia echinata*, *Gonystylus* spp. (ramin), *Aquilaria* & *Gyrinops* (agarwood), *Pericopsis elata*, *Platymiscium pleiostachyum*, *Caryocar costaricense*, *Diospyros* spp. (Madagascar), *Bulnesia sarmientoi*, *Guaiacum* spp., *Osyris lanceolata* (East Africa), *Prunus africana*, *Aniba rosaeodora*, *Oreomunnea pterocarpa*, Asian *Taxus* (5 spp.), *Widdringtonia whytei*

**Appendix III:** *Pinus koraiensis*, *Quercus mongolica*, *Fraxinus mandshurica* (Russia); *Podocarpus neriifolius*, *Tetracentron sinense*, *Magnolia liliifera* var. *obovata* (Nepal)

38 listing entries · ~90 named taxa. Large genera (*Dalbergia* ~250–300 spp., Malagasy *Diospyros*, *Tabebuia*, *Aquilaria*) are covered at genus level with the commercially important species named — the full species lists are on Species+ and in the CITES/Kew *Dalbergia* checklist.

## About the 10x photos

Each taxon has (1) a **schematic drawing** generated from its anatomical features, (2) **links** to published 10x end-grain photographs (The Wood Database, CITESwoodID, Pl@ntWood, InsideWood, CITES Timber ID repository, Wikimedia Commons), and (3) a **photo folder** for real photographs of verified reference specimens. Most published photo collections are copyrighted, so they are linked rather than copied. See [photo protocol](guides/photo-protocol.md) to add your own.

## Use it

- **Online:** Settings → Pages → *Deploy from branch* → `main` / `/docs`. The key is then at `https://<user>.github.io/CITES-Timber-ID/`.
- **Offline (laptop):** download the repo, then in the folder run `python -m http.server` and open `http://localhost:8000/docs/`.
- **Edit data:** change `tools/species_data.py` (on GitHub: pencil icon). The GitHub Action rebuilds the pages, JSON, CSV and drawings automatically. Locally: `python tools/build.py`.

## Key references
- CITES Appendices & Species+: https://cites.org/eng/app/appendices.php · https://speciesplus.net
- CITES Timber ID repository: https://cites.org/eng/timber/timber-ID-repository
- *CITES and Timber — A guide to CITES-listed tree species* (Kew/CITES, 2023 ed.)
- UNODC (2016) *Best Practice Guide for Forensic Timber Identification*
- Wiedenhoeft, A.C. (2011) *Identification of Central American Woods*, USDA FPL
- Ruffinatto, F. & Crivellaro, A. (2019) *Atlas of Macroscopic Wood Identification*, Springer
- Ravindran et al. (2020) *The XyloTron: open-source image-based macroscopic field identification of wood products*, Frontiers in Plant Science

## Licence
Code: MIT. Text and data: CC BY 4.0. Photos: licence as stated per image in `photos/manifest.csv`.

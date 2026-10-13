Put the trained model here (created by `python src/export_onnx.py` then `python src/build_web_assets.py`):

- `wood_id.onnx`      the model (single file)
- `config.json`       input size, patch size, normalisation, class list
- `species_info.json` CITES status for every class, resolved from `data/species_scope_africa.csv`

No model is included on purpose: an untrained or unevaluated model would give answers that look real and are not.

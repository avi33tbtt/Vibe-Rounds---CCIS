# Chunk DS1-demo-loader: Load and validate artefacts and envelope

_Needs: 1.5b, EMR B5b format only. Stage 2 already started (1.x done)._ **Core rules:** attach `01-core.md`.
**Read only:** `docs/DEMO-SLICE.md`; `ccis/validators/ccis-validators.js` exports (grep); `ccis/examples/snake/README.md`; `ccis/schemas/import-report.schema.json`.

**Build:**
1. `ccis-demo-loader.js` (pure: takes parsed JSON objects, no file access): validates the pathway, nodes, analytics, binding and element with the committed validators; validates the envelope; returns `{ ok, package, envelope, importReport }` where the import report validates against its schema and lists reasons for refusal (unknown critical field, wrong major version, missing artefact).
2. Header comment "DEMO RUNNER: replaced by rows 2.x and 3.x".
3. Tests: examples load; each of 4 broken inputs (bad envelope, unknown major, missing analytics, unknown critical field) is refused with a reason; envelope with hostile strings loads without effect.
**Done when:** valid artefacts + a fixture envelope give an ok report; broken inputs never reach execution.
**Size guard:** 1 module, 1 test file.

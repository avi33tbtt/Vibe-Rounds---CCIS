# Chunk 1.6c-layer7-layer8-examples: The layer 7 invalid example and the layer 8 scope example

_Phase 1, Stage 2. Needs: 1.6 and 1.6b (done; A-003 approved, schema members added). Written just in time. This chunk file is docs only; the examples are built at the next "do next"._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/examples/invalid/README.md`; the layer 8 pair in `ccis/examples/invalid/8-governance/` (as the model for file shape); `ccis/examples/snake/snake-interval.analytics.0.1.1.json` (outputs, parameters, evidence); `ccis/fixtures/snake/index.json` (case ids only); the A-003 entry in `ccis/CHANGELOG.md`; the "Package tests and validation scope" paragraph in `ccis/schemas/README.md`; `test/invalid-examples.test.js` (to extend it).

## What this row is for

Close gate B-03's layer list: one invalid example for each of the eight layers, each with expected diagnostics, **before** the validator exists. Layers 1 to 6 and the evidence part of layer 8 exist (row 1.6). This row adds layer 7 (test verification) and the scope part of layer 8, using the members row 1.6b added. It builds no validator and runs nothing.

## Lessons from earlier rows to follow

- One deliberate defect per example, a copy of one valid snake artefact (use the 0.1.1 interval analytics). The expected file records `changedPaths`, and a test recomputes the difference.
- Both examples must **pass the schemas** and fail only the later layer; a test proves it.
- No threshold, dose, clinical code or number in any example. A package test carries no values (D-078); parameter values would come from the fixture, which is not read or run here.
- Plain prose; the safety test scans for forbidden words. Same diagnostic shape as row 1.6: `severity`, `ruleId` (`CCIS-V<layer>-<nnn>`), `path`, `message`, `hint`.
- If a layer needs something the schemas still cannot hold, stop, list it and propose a numbered amendment. Do not stretch a schema.

## Decisions this chunk proposes (owner approves the chunk file; builder logs them, at most three rows)

- **Layer 7 example** `7-test-verification/test-expects-missing-output.json`: the base plus a `tests` member with one test that names a real fixture case id from `ccis/fixtures/snake/index.json` and one real parameter id marked test-only, but expects an **output id the package does not declare** (one letter off the real id). Expected diagnostic `CCIS-V7-001` at the path of that expectation. Only the added `tests` leaves differ from the base.
- **Layer 8 scope example** `8-governance/validated-for-another-version.json`: the base with status `validated` and a `validation` scope whose `version` is not the manifest's version. The evidence statement is changed to a plain, clearly fictional sentence so the evidence rule (`CCIS-V8-001`) is not also triggered, so that the one expected diagnostic is `CCIS-V8-002` at `/manifest/validation/version`. Status, the validation leaves and the evidence statement are the three changed places, and they form one defect (a claim for a version this is not). No real evidence is cited; `sources` stays empty if the schema allows it, otherwise a clearly synthetic local-protocol placeholder is used and listed.
- **Existing files stay.** The row 1.6 layer 8 example is left as it is. The invalid README gains the two rows and loses the "not built" text for layer 7.

## Build

1. The two examples and their two expected-diagnostics files, in the layout above.
2. `ccis/examples/invalid/README.md`: layer 7 row, second layer 8 row, remove the gap text, keep the diagnostic shape section.
3. Extend `test/invalid-examples.test.js`: layers now 1 to 8 with no gap (the first test currently expects seven); the two new examples pass the schemas; the changed-path rule holds; the layer 7 test names a real fixture case and real parameter id and an output id absent from the package; the layer 8 scope version differs from the manifest version.
4. Tracker, `DECISIONS.md`, and `ccis/CHANGELOG.md` only if something changes there.

**Done when:** both examples and their expected files are committed, the README lists all eight layers, the extended test is written, and three deliberate breakages (make the layer 7 output id real; make the scope version equal the manifest version; add a second changed path) are seen failing. The owner runs or skips `npm test` as instructed in that session.

**Size guard:** 2 examples, 2 expected files, 1 README edit, 1 test edit. If more is needed, cut a diagnostic, not a rule.

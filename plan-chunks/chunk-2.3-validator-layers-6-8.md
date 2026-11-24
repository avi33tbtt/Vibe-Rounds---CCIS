# Chunk 2.3-validator-layers-6-8: Layers 6 to 8 (executable safety, test verification, governance)

_Phase 2, Stage 2 (written 2026-11-24). Needs: 2.2 and 2.2b (done: `ccis-validator-semantic.js`, rule ids V4-001 to V4-011 and V5-001 to V5-008). This chunk file is docs only; the layers are built at the next "do next". The report writer from the plan brief is split to row 2.3a (see "Split")._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-validator.js` (`LAYER_NAMES`, `RULES`, the pipeline in `validateArtefact`, `NOT_BUILT`, `renderText`); `ccis-validator-semantic.js` (`diag`, `SEMANTIC_RULES`; only to match its style); `ccis/examples/invalid/6-executable-safety/`, `7-test-verification/`, `8-governance/` (the three layers' acceptance targets, both layer 8 examples); `ccis/schemas/analytics.schema.json` (`tests`) and `manifest.schema.json` (`status`, `validation`, `evidence`); `ccis/fixtures/snake/index.json` (case names only); `ccis/SPEC.md` REQ-047, 049, 052, 088; `ccis/CHANGELOG.md` A-003.

## What this row is for

Today layers 6 to 8 are reported as "not run" with a fixed reason. Build them so that:

- the three 1.6 and 1.6c examples (layer 6, layer 7, and both layer 8 examples) give exactly their expected diagnostics, and all 9 valid snake artefacts still give none;
- the result lists layers 6 to 8 as `passed`, `failed` or `not-run` with a reason, as layers 1 to 5 do (D-087). The top outcome stays `failed` or `no-errors-so-far`; never `passed` while any layer did not run.

Nothing is run, compiled or executed: layer 7 compares what a package declares about itself with what it also declares elsewhere. Running a package against a fixture is the executor's job (rows 3.x).

## Lessons from earlier rows to follow

- Extend the existing pipeline in `ccis-validator.js`; new checks live in a new pure module `ccis-validator-governance.js` (same rules as the semantic module: no file access, network, clock, randomness, imports other than none; the scan test copies the 2.2 one). Same diagnostic parts and the order "rule id, then path" for layers 6 to 8.
- Stable ids continue the catalogue. Plain prose in messages; no clinical code, threshold or value in any message.
- **Unknown is not a pass.** If layer 7 needs the list of fixture cases and none was supplied, that is a warning ("not checked"), never a silent pass.
- A layer that fails stops later layers for that artefact (fail closed), as layers 1 to 5 do.
- 2.2b finding: a defect the schema stops cannot reach a later layer through the pipeline. Test such cases on the library call, and say so in the test.

## Decisions this chunk proposes (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

Layer 6, executable safety (all packages; any artefact kind with `x-` members):

- `CCIS-V6-001` (error): any `x-` member, at any depth, holds text that looks like code (a function or arrow form, `eval(`, `new Function`, `import(`, `require(`, a shell pipe or backtick command, or a statement ending in a semicolon after a call). The text is never run. Example: `/x-handler` in the 1.6 layer 6 example.
- `CCIS-V6-002` (error): any string anywhere holds markup that can run in a page (`<script`, `javascript:`, an `on...=` handler attribute) or a network address (`http://`, `https://`) outside the members that are defined to hold a reference or a citation. (The list of exempt members is written into the module as data, from the schemas.)
- Proposed limit: the check is by pattern, so it can miss clever text and cannot judge intent. Message and docs say so. The executor's whitelist (core rules) is the real barrier; this layer is the early refusal.

Layer 7, test verification (analytics packages that declare `tests`):

- `CCIS-V7-001` (error): a test expects an output id the package does not declare (the layer 7 example).
- `CCIS-V7-002` (error): a test enables a parameter id the package does not declare.
- `CCIS-V7-003` (error): a test expects a state its output does not declare (reads `states` and `labels` of the output; same label rule as V4-005).
- `CCIS-V7-004` (warning): a test names a fixture case and the caller supplied no fixture list, so the case name was not checked. With a list, an unknown case is an error `CCIS-V7-005`.
- A package with no `tests` gets no layer 7 diagnostic of its own: whether tests are required is a governance matter (V8), not a verification one.

Layer 8, governance (manifest of any artefact kind):

- `CCIS-V8-001` (error): status `validated` or `conditionally-validated`, while the artefact's own evidence statement says no evidence is claimed or no review has taken place (the first layer 8 example). Wording is matched against a small written list of phrases kept as data; what the list cannot decide gives a warning `CCIS-V8-003` ("not checked").
- `CCIS-V8-002` (error): the validation scope names a version other than the artefact's own version (the second layer 8 example). A scope with a missing part is already a schema error (A-003), not a V8 rule.
- No rule judges whether a clinician reviewed anything: that is an owner and process matter (R0 gate, "Items only you can do"). The messages say "claimed", never "true".

Decisions to confirm by approving this file: (1) the two layer 6 ids and their pattern limit; (2) the fixture list is an input to the library (`options.fixtures`, names only), and `--fixtures <dir>` is added to the CLI `validate` command to read `index.json`; (3) the evidence wording list is data inside the module and is extended only by a new row.

## Build

1. `ccis-validator-governance.js`: `executableSafetyLayer`, `testVerificationLayer`, `governanceLayer`; their entries in a `GOVERNANCE_RULES` array added to `RULES` in `ccis-validator.js`.
2. `ccis-validator.js`: run layers 6 to 8 after layer 5 passes (a failed layer stops the next); `options.fixtures`; remove `NOT_BUILT` for these layers; `ccis-cli.js` `validate` gets `--fixtures <dir>`; root `README.md` "Validate" table and known-gaps line.
3. `test/ccis-validator-governance.test.js`: (a) the four examples are matched exactly, through the pipeline; (b) all 9 valid snake artefacts give no diagnostics and layers 6 to 8 `passed` (with the fixture list supplied; with none supplied, the warning V7-004 appears only on packages that declare tests, and the outcome stays `no-errors-so-far`); (c) a handmade case per new id (V6-002, V7-002, V7-003, V7-005, V8-003 are new to this test; others are the examples); (d) about 12 accepted and 12 refused extension strings; (e) the pure-library scan; (f) the catalogue lists each new id once with the right severity. The row 2.2 and 2.1 tests that say "layers 6 to 8 are not run" change to the new text; list them in the summary.
4. `DECISIONS.md`, tracker.

**Done when:** all four examples give exactly their expected diagnostics, valid files stay clean, and three deliberate breakages (let a code-like `x-` string pass; accept a test output that is not declared; let a validated status with a different scope version pass) are seen failing. The owner runs or skips `npm test` as instructed in that session.

## Split

The plan brief for 2.3 also says "report writer". The validation-record schema already exists (row 1.4a), so the writer is separate work with its own tests (subject reference, standard and validator versions, the five assurance members that are never collapsed into one badge, REQ-048 and 090). It becomes row **2.3a** (chunk file first), after this row. 2.4 needs both.

**Size guard:** 1 new module, 1 pipeline and CLI edit, 1 test file, 1 README edit, about 9 rule ids. If more is needed, drop V6-002 and V7-003 first.

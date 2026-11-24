# Chunk 2.2-validator-layers-4-5: Validator layers 4 and 5 (semantic; graph and compatibility)

_Phase 2, Stage 2 (written 2026-11-24). Needs: 2.1 (done: `ccis-validator.js`, layers 1 to 3, `validate` command). Written just in time from the plan brief. This chunk file is docs only; the layers are built at the next "do next"._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-validator.js` (pipeline, `layer3`, `mark`/`skip`, result shape; extend it, do not fork it); `ccis/examples/invalid/README.md` and the expected files of layers 4 and 5 (the acceptance targets); `ccis/schemas/README.md` ("Left to the Phase 2 validator", the analytics and decision-node paragraphs); `ccis/schemas/analytics.schema.json` (operator list, `conversions`, `outputs`); `ccis/examples/snake/snake-interval.analytics.0.1.1.json` and `snake-documentation.pathway.json` (the valid models); `ccis/SPEC.md` REQ-026, 042, 043, 044.

## What this row is for

Add layers 4 (semantic) and 5 (graph and compatibility) to the same pipeline. After this row the layer 4 and layer 5 invalid examples give exactly their expected diagnostics, every valid snake artefact still has none, and the layer 6, 7 and 8 examples pass layers 1 to 5. Layers 6 to 8 and the report writer are row 2.3. Fail closed as in 2.1: a failed layer stops the later ones for that artefact, and layers not yet built stay `not-run`.

## Lessons from earlier rows to follow

- **Extend `validateArtefact`**; layers 4 and 5 are two more `mark`/`skip` steps. Same diagnostic parts, same pure library, same CLI (no new command).
- **Stable ids** `CCIS-V4-nnn` and `CCIS-V5-nnn`, the first of each kept as written in row 1.6 (V4-001, V5-001, V5-002). Plain prose in messages; no threshold, dose or clinical code in any message.
- **Say what was not checked.** Where a rule needs something not supplied (an element not among the known artefacts), skip that rule quietly: layer 3 already reported the missing artefact.
- **Unknown is not false (core rules).** A rule that cannot decide (for example an input type that cannot be found) gives no diagnostic of its own, never a guessed pass or fail message.

## Decisions this chunk proposes (owner approves the chunk file; builder logs them, at most three rows)

- **Layer 4, analytics (rule ids the builder fixes in `DECISIONS.md`, first ones named):** `CCIS-V4-001` an operator argument has the wrong type (the row 1.6 example: time-diff over a code input); operator arity; every `ref` and `output` id resolves; `add`, `sub` and comparisons need identical units or an explicit declared `convert`, and `convert` must name a declared conversion whose from and to match (REQ-042, 043); `time-zone` conversions name known zones; each `onMissing` and non-value output state is one the computation can produce. Warnings (not errors): a declared input or parameter that is never used.
- **Layer 4, elements and bindings:** a binding on a non-`code` field, a binding whose type does not fit its field, and a unit string that is not valid UCUM (the three items layer 3 left here). UCUM check is a small grammar check in the library, no network and no table download; anything it cannot decide is a warning that says so.
- **Layer 5, pathways and nodes:** `CCIS-V5-001` a transition or `next.stage` names a stage that does not exist; `CCIS-V5-002` a stage unreachable from the first stage; every outcome `input` is one of the node's inputs; outcomes cover every state a node input can be in (the explicit indeterminate and missing-data branches stay required, REQ-026); `timing.parameter` ids exist in the required analytics; a stage that is not final has an exit. **Cycles:** the plan brief says "bounded cycles", but gap G-09 (row 5.3) has not defined "bounded". Here a cycle is reported as a **warning** that says boundedness is not checked yet; no error for a cycle. Dead-end analysis beyond a stage with no way out waits for 5.3.
- **Compatibility:** the artefact's `standard.version` major is one this validator supports; the analytics `operatorSet` names only operators the validator's whitelist knows. Execution-profile feasibility and pin resolution stay in 2.4.
- **Result shape** unchanged from 2.1; layers 4 and 5 are filled in, 6 to 8 stay `not-run`. The top outcome stays `failed` or `no-errors-so-far` until row 2.3.

## Build

1. `ccis-validator.js` extended (or one new flat file `ccis-validator-semantic.js` imported by it, if the file passes about 700 lines); README "Validate" section updated (layers built, new rule ids, known gaps).
2. `test/ccis-validator-semantic.test.js`: (a) the layer 4 and layer 5 examples give exactly their expected diagnostics; (b) every valid snake artefact (both analytics versions, pathway, nodes, element, binding) has no error diagnostics through layer 5; (c) the layer 6, 7 and 8 examples pass layers 1 to 5 and list 6 to 8 as not run; (d) fail closed: a layer 4 error leaves layer 5 `not-run`, and a layer 2 or 3 error leaves both `not-run`; (e) one handmade defect per new rule id, from a copy of a valid artefact, each giving its one rule at its pointer; (f) the pure-library scan from the 2.1 test still holds for any new file; (g) the rule catalogue lists every new id once.
3. `DECISIONS.md`, tracker. Requirements-matrix note in `ccis/CHANGELOG.md` only if a requirement text is found wrong.

**Done when:** the examples for layers 4 and 5 match exactly, every valid artefact passes through layer 5, every new rule id has a handmade case, and three deliberate breakages (let time-diff accept a code input; drop the unreachable-stage rule; let a layer 4 failure continue to layer 5) are seen failing. The owner runs or skips `npm test` as instructed in that session.

**Size guard:** 1 or 2 modules, 1 test file, 1 README section, about 12 rule ids. If more is needed, split off **layer 5 as 2.2a** (cut it whole, with its tests), then the element and binding checks of layer 4 (2.2b). Do not cut tests.

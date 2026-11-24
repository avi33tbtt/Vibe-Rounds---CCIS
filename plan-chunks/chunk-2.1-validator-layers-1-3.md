# Chunk 2.1-validator-layers-1-3: Validator layers 1 to 3 (syntax, structural, reference integrity)

_Phase 2, Stage 2 (started 2026-11-24). Needs: 1.6 to 1.6c (done; all eight invalid examples exist). Written just in time from the plan brief. This chunk file is docs only; the validator is built at the next "do next"._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/SPEC.md` section 12 and REQ-088 to 090; `ccis/examples/invalid/README.md` and the expected-diagnostics files of layers 1 to 3 (these are the acceptance targets); `ccis/schemas/README.md` ("Left to the Phase 2 validator"); `ccis/validators/ccis-validators.js` export names only; `ccis-cli.js` (how `run` parses arguments and sets exit codes, to match it); `ccis-demo-loader.js` (how the demo already reads artefacts, to avoid a second loading style).

## What this row is for

Build the first three layers of the validator, with the diagnostics fixed in row 1.6, as a pure library plus a CLI command. After this row, the layer 1, 2 and 3 invalid examples give exactly their expected diagnostics, and every valid snake artefact and schema fixture passes layers 1 to 3. Layers 4 to 8 are rows 2.2 and 2.3; the validation record writer is row 2.3.

## Lessons from earlier rows to follow

- **Pure core (core rules).** The library takes text or a parsed document and a list of known artefacts, and returns diagnostics. No file access, no network, no clock. Only the CLI reads files.
- **Reuse the committed schema validators** for layer 2. Do not write a second schema. Nothing compiles a schema at runtime (D-005).
- **Fail closed.** A layer that fails stops the later layers for that artefact, and the result says which layers did not run. Silence is never a pass (REQ-088).
- **Same pipeline everywhere (REQ-088).** One function serves authoring, ingestion and runtime preflight; the CLI is a thin caller.
- **Stable rule ids, kept as written in row 1.6** (`CCIS-V1-001`, `CCIS-V2-001`, `CCIS-V3-001`). The rule catalogue grows by adding ids, never by changing one.
- Diagnostic parts exactly as in row 1.6: `severity`, `ruleId`, `path` (JSON pointer; a line and column for layer 1), `message`, `hint` (REQ-089). A plain-text rendering is produced from the same data.
- Plain prose in messages. No threshold, dose or clinical code appears in any message or fixture.

## Decisions this chunk proposes (owner approves the chunk file; builder logs them, at most three rows)

- **Files.** `ccis-validator.js` (library, flat root file) and a `validate` command added to `ccis-cli.js` (`node ccis-cli.js validate <file>... [--known <dir>]`). The existing `run` command and its tests stay unchanged. Exit codes follow the existing CLI rule: 0 when no error diagnostics, 1 when there are errors, 2 for usage or unreadable input.
- **Layer 1.** Parse text as JSON. On failure give `CCIS-V1-001` with the line and column of the break. Also refuse, as errors, a document that is not a JSON object. A byte order mark or duplicate object keys are listed as a gap if found hard to detect with the built-in parser; they are not stretched into this row.
- **Layer 2.** Pick the schema from `manifest.type` (and the pathway or decision node shape). Map schema errors to diagnostics: a small table by keyword, with these first ids: `CCIS-V2-001` a parameter carries a value, default or suggestion (D-022); `CCIS-V2-002` unknown member (closed object); `CCIS-V2-003` a required member is missing; `CCIS-V2-004` wrong type, value or pattern. Every schema error becomes a diagnostic with its own pointer; none is dropped. The rest of the table is the builder's choice, listed in `DECISIONS.md`.
- **Layer 3 (what the schemas cannot check, from the schema README list), within the artefacts provided:** `CCIS-V3-001` an input or context field names a field the referenced element does not define (the row 1.6 example); `CCIS-V3-002` field keys not unique within an element; `CCIS-V3-003` a relationship names a field key that does not exist; `CCIS-V3-004` a referenced artefact (by id) is not among the known artefacts; `CCIS-V3-005` a referenced artefact is known but no known version satisfies the exact version or range. A binding whose type does not fit its field and UCUM unit validity belong to layer 4 (row 2.2), not here.
- **Known artefacts.** Layer 3 resolves references only against the artefacts it is given, so a missing artefact is reported, never assumed. A small pure semver comparator (exact, `^`, `~`, `>=`, `<`, as the manifest schema allows) lives in the library and is tested on its own.
- **Result shape.** `{ outcome, layers: { syntax, structural, 'reference-integrity' }, diagnostics }`, each layer `ran` or `not-run` with a reason. This is not the validation record (schema from row 1.4a); row 2.3 maps it to one.

## Build

1. `ccis-validator.js`, the `validate` command, and a short README section on use.
2. `test/ccis-validator.test.js`: (a) each layer 1 to 3 example from `ccis/examples/invalid/` gives exactly its expected diagnostics (rule id, path, severity; message and hint equal); (b) every valid snake artefact, with the snake folder as known artefacts, gives no error diagnostics; every valid schema fixture gives none at layers 1 and 2; (c) the examples for layers 4 to 8 pass layers 1 to 3 (they are meant to fail only later layers), and the result lists layers 4 to 8 as not run, not passed; (d) fail closed: a layer 1 failure runs no later layer; (e) the semver comparator cases; (f) the CLI exit codes 0, 1 and 2, and that `run` still behaves; (g) no `eval`, `Function`, dynamic import, file access or clock in the library.
3. Extend the requirements matrix note in `ccis/CHANGELOG.md` only if a requirement text is found wrong; otherwise leave it. Tracker, `DECISIONS.md`.

**Done when:** the library, the command and the test are committed, the expected diagnostics for layers 1 to 3 are matched exactly, every valid artefact passes layers 1 to 3, and three deliberate breakages (remove the layer 3 field check; make layer 2 drop one schema error; let a layer 1 failure continue to layer 2) are seen failing. The owner runs or skips `npm test` as instructed in that session.

**Size guard:** 1 module, 1 CLI edit, 1 test file, 1 README section. If more is needed, cut layer 3 rules (V3-004 and V3-005 first, as 2.1a), not tests.

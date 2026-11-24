# Chunk 2.3a-report-writer: Validation record from a validator result

_Phase 2, Stage 2 (written 2026-11-24). Needs: 2.3 (done: all eight layers in `ccis-validator.js` and `ccis-validator-governance.js`). Split from 2.3 (D-077 style, size). This chunk file is docs only; the writer is built at the next "do next". Row 2.4 (compiler) needs it._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/schemas/validation-record.schema.json` (the target shape); `ccis/fixtures/schemas/validation-record-good-full.json`, `-good-minimal.json` and the four `validation-record-bad-*.json` (shape and refusals); `ccis-validator.js` (`validateArtefact` result: `outcome`, `layers`, `diagnostics`; `renderText`); `ccis-demo-record.js` (`canonicalJson`, only to reuse); `ccis-cli.js` (`validateMain`); `ccis/SPEC.md` REQ-047, 048, 049, 052, 053, 089, 090; `docs/TRACEABILITY.md` (only the lines for REQ-048 and 090).

## What this row is for

Turn a validator result into the record the 1.4a schema describes (REQ-090: names the exact standard version and validator, retained in the audit history), so that later rows (2.4 compiler, marketplace, the app) can keep it. Pure function, no clock, no randomness: the same artefact and result give byte-identical record text. Software conformance and clinical safety stay separate (core rules, REQ-048, 053): the writer can say what software checked and never anything about clinical review.

## What the schema forces (found by reading it; the writer must handle each)

1. **Rule ids.** The schema's `diagnostic.ruleId` pattern is lowercase dotted (`^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$`). Validator ids are `CCIS-V4-009`. Proposed: a fixed, reversible mapping `CCIS-V4-009` -> `ccis.v4-009` (lowercase, dot after the prefix), with the inverse in the same module and a test that every catalogue id round-trips. No schema change (the 1.4a schema stays as approved).
2. **Layer 1 path.** A layer 1 diagnostic has `path: { line, column }`; the schema wants a JSON pointer string. Proposed: path `""` (the top level) and the position kept in an `x-position` member `{ line, column }` on that diagnostic (extensions are allowed). The message already holds the words. (This is the mapping note from D-087.)
3. **Outcome.** The schema has `passed` or `failed`; the validator says `failed` or `no-errors-so-far`. Proposed: `passed` only when the validator outcome is `no-errors-so-far` and all eight layers are `passed`; otherwise `failed`. A record's `passed` means "no layer found an error", never "safe", and the rendered text says so.
4. **Subject.** `subject` needs `id`, `type`, `version` from the artefact's manifest. If layer 1 or layer 2 failed, or the manifest cannot give a valid subject, **no record is written**: the function returns `{ ok: false, reason }` (a record must attach to one exact artefact version, REQ-052). The validator result is still shown by the CLI as before. Fail closed; nothing is guessed.
5. **Layers.** `failed` needs at least one error diagnostic and `not-run` needs a `reason`: both already true of the validator result (the test proves it by validating every output against the committed schema).
6. **Assurance.** Five members, each `met`, `not-met` or `not-assessed`; `met` and `not-met` need `assessedBy` and at least one `evidence` line, and `met` needs a `scope`.

## Decisions this chunk proposes (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

- **Assurance rules.** `structural` is `met` when layers 1 to 3 passed, `not-met` when one failed, `not-assessed` otherwise. `semantic` is the same for layers 4 and 5. `clinical`, `execution` and `security-privacy` are **always `not-assessed`** in this row, with a one-line condition each (no clinician review is recorded here; no engine has run the package; no security or privacy review is recorded). Layers 6 to 8 appear in `layers` only and are not folded into any assurance member. `assessedBy` is the validator's own name and version (software, not a person); `evidence` names the layers and counts. Warnings of the layers a member covers are listed in its `conditions`, so they are shown wherever the member is.
- **Scope text for software checks.** The required `scope` is filled with the artefact's own version and three fixed phrases that say the check is of software conformance only (population: "not applicable, software conformance check"; setting: same; intended use: "conformance to the standard; not for clinical use"). No population, setting or use of the artefact is invented.
- **Versions.** `standard.version` is the standard the validator supports (a constant, `0.1.0`); `validator` is `ccis-validator` with a constant version `0.1.0`. A test keeps the constants equal to the supported-version constants already in the validator. (`package.json` stays 0.0.0; it is not a release version.)
- **CLI.** `validate` gains `--record <dir>`: for each file with a record, write `<file name>.validation-record.json` in canonical JSON plus a newline; an existing different file is never overwritten (exit 2, as D-061); files that give no record print the reason and are otherwise unchanged. Without `--record`, `validate` is unchanged. Drop this item first if the size guard bites (the library alone meets the row).

## Build

1. `ccis-validation-record.js`: `buildValidationRecord(doc, result)` -> `{ ok: true, record }` or `{ ok: false, reason }`; `toRecordRuleId`, `fromRecordRuleId`; constants. Pure, no imports other than `canonicalJson` if it is pure (else write the sort inline).
2. `ccis-cli.js`: `--record <dir>`.
3. `test/ccis-validation-record.test.js`: (a) every valid snake artefact gives a record that passes the committed `validationRecord` validator, with outcome `passed`, five assurance members, and `clinical`, `execution`, `security-privacy` all `not-assessed`; (b) each of the invalid examples for layers 2 to 8 gives a record that passes the schema with the right layer `failed`, later layers `not-run` with reasons, and outcome `failed`; (c) a layer 1 failure and a manifest-less document give `{ ok: false }` with a reason and no record; (d) rule ids round-trip for every id in `RULES`; the layer 1 position is kept in `x-position`; (e) byte-identical output on two runs and unchanged input (frozen); (f) a warning appears in the `conditions` of its member (use the V4-011 case from 2.2b); (g) the pure-library scan; (h) CLI: writes the file, refuses a different existing file, prints the reason for an unwritable subject.
4. `README.md` (a short "Validation record" paragraph), `DECISIONS.md`, tracker.

**Done when:** every valid artefact and every invalid example (layers 2 to 8) gives a schema-valid record, the layer 1 and no-manifest cases are refused with a reason, and three deliberate breakages (let a `not-run` layer lose its reason; make `clinical` say `met`; drop the warning from `conditions`) are seen failing. The owner runs or skips `npm test` as instructed in that session.

**Size guard:** 1 new module, 1 CLI edit, 1 test file, 1 README edit, no new rule ids. If more is needed, drop the CLI item first.

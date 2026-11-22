# Chunk 1.4a-schemas-validation-run: Schemas for the validation record, run result and run record

_Phase 1, Stage 2. Needs: 1.4 (done). Written just in time; split off from 1.4 for size. This chunk file is docs only; the schemas are built at the next "do next"._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/SPEC.md` (REQ-032, 033, 047 to 053, 066, 069, 070, 072, 073, 075 to 078, 088 to 090); `docs/IMPORT-CONTRACT.md` IMP-093 and section 5 only; `ccis/schemas/README.md`; `ccis/schemas/context-envelope.schema.json` (for `$defs`: `time`, `observation`, `event`, `appliedRef`, `sourceClass`); `ccis/schemas/import-report.schema.json`; `ccis/schemas/analytics.schema.json` (only `outputs`, `nonValueState`, `output`); `ccis/schemas/execution-manifest.schema.json`; `scripts/build-validators.js`.

## Lessons from 1.1 to 1.4 to follow

- Closed objects with `patternProperties: {"^x-": {}}`; ids `https://ccis.invalid/schemas/<n>.schema.json`; `$ref` shared definitions, never copy them.
- Ajv strict mode needs `"type": "object"` beside `properties` inside `if`, `allOf`, `contains`, `then`, `else`, `oneOf` branches. `strictRequired` is off (D-016).
- No `uniqueItems`, `format`, non-ASCII `minLength`; the validator safety test also scans schema **descriptions** for the words `import (`, `eval (`, `Function (` and similar: write prose that cannot match.
- Check any `$ref` into another schema compiles to standalone code with no runtime import before writing the rest.

## Decisions this chunk proposes (owner approves the chunk file; builder logs them)

- **The validation record is the validator report plus assurance.** It names the artefact at an exact version, the exact standard and validator versions (REQ-090), the eight layers by name each with an outcome and diagnostics (REQ-088, 089), and an `assurance` object with **five required members**, one per dimension (structural, semantic, clinical review or validation, execution, security and privacy; REQ-048), so no single badge can stand in for them. Each member is `{result, scope?, assessedBy, evidence, conditions[]}`; `result` is `met`, `not-met` or `not-assessed`; when `met`, `scope` `{version, population, setting, intendedUse}` is required (REQ-049, 052). `assessedBy` is a role, never a name. The review workflow itself (who may assess, independence rule G-02) is row 6.2; only the record's shape is here.
- **A run result is one output's outcome.** Kinds `value`, `classification`, `table` (A-002) or one of the five declared non-value states; every result carries `warnings`, `limitations` and `missingDataNotes` (REQ-073); a `parameter-not-enabled` result lists the parameter ids it depends on (REQ-072); a result never carries both a value and a state. A decision-path rule trace is added with the walker at row 3.4 as an extension, not here.
- **A run record is one run of one package, immutable.** It holds everything REQ-075 lists: package id and version, standard version, **exact** engine version, operator set, the exact versions of the selected context, the input snapshot (the observations and events used, reusing the envelope definitions so identity and narrative stay impossible), every parameter with `enabled` and, only when enabled, its locally supplied value and `suppliedBy` role, the supplied evaluation time (zone stated), the output contract version, validation messages (diagnostics), the import report, results, warnings and limitations. `status` is `completed` or `failed`; a failed record names which limit or rule failed and holds **no** results (REQ-069). `corrects` optionally names an earlier record id (REQ-076). The record id is supplied as input (REQ-068); no checksum or content address field yet (G-05, row 2.4).
- **Batch runs stay open (G-03).** One record is one package run. How several analytics share one context is decided before row 3.5; nothing here pre-empts it.

## Build

1. **`ccis/schemas/validation-record.schema.json`**: as above. Diagnostics are `{severity (error, warning, info), ruleId (stable, lower-case dotted pattern), path (JSON pointer pattern), message, hint}` and are defined once in `$defs` (`diagnostic`) for reuse by the run record. A layer with outcome `failed` must contain at least one `error` diagnostic; a layer `not-run` must carry a reason.
2. **`ccis/schemas/run-result.schema.json`**: as above, id of the output, kind, then `value` or `state`, plus the three note arrays and `dependsOnParameters` (required, non-empty, when the state is `parameter-not-enabled`).
3. **`ccis/schemas/run-record.schema.json`**: as above, `$ref` the validation-record `diagnostic`, the run-result schema, the import-report schema and the envelope `observation`, `event`, `appliedRef`, `time` definitions. Parameter values are typed as a string, number, or array of strings with optional `units`; no ranges or defaults appear (those are the package's).
4. **Build script**: add `validationRecord`, `runResult`, `runRecord` to the export list; regenerate and commit validators.
5. **Left to later rows** (add to `ccis/schemas/README.md`): outputs match the package's declared contract (REQ-070; Phase 2 and 3.5); parameter ids exist and match the package; the snapshot is exactly what the computation read; byte-identical rerun (REQ-077; row 3.5); immutability and content addressing (REQ-076; G-05, rows 2.4 and 3.5); who may record assurance and independence (G-02; row 6.2); batch sharing (G-03).

## Fixtures (`ccis/fixtures/schemas/`, add to `index.json`), up to 16

Synthetic only; no clinical numbers; parameter values are labelled test placeholders (D-013) and never clinical.
- Validation record: `validation-record-good-minimal` (eight layers passed, assurance all `not-assessed`); `-good-full` (diagnostics, one layer failed, `met` with scope and a condition); `-bad-diagnostic-no-ruleid`; `-bad-met-no-scope`; `-bad-assurance-missing-dimension`; `-bad-failed-layer-no-error`.
- Run result: `run-result-good-value`; `run-result-good-parameter-not-enabled` (with its dependency); `-bad-value-and-state`; `-bad-missing-limitations`; `-bad-parameter-not-enabled-no-dependency`.
- Run record: `run-record-good-completed`; `run-record-good-failed`; `-bad-failed-with-results`; `-bad-no-evaluation-time-zone`; `-bad-engine-range` (engine as a range).
Inline mutations in the test (not files): enabled parameter without a value; disabled parameter with a value; a personal field on the snapshot; an unknown layer name; `assessedBy` missing; `corrects` not a token; result kind outside the three; a missing standard version.

## Do not

- No cohort, batch, decision-path trace or FHIR fields. No checksum, hash or signature fields (G-05). No review workflow (row 6.2).
- No edits to `ccis/SPEC.md`. If the spec cannot express a rule, propose a numbered amendment in `ccis/CHANGELOG.md` (next is A-003) and stop on that point.
- No clinical numbers, thresholds or defaults. Reference runs with hand-calculated results are row 1.5.

## Done when

`npm test` passes once; `npm run build` leaves no diff; the standalone validator has no runtime import; at most 3 deliberate-breakage checks (for example allow a value and a state together, drop one assurance dimension from required, allow results on a failed record), each seen failing then restored.

## Size guard

3 schemas, the build script's export list, up to 16 fixtures plus the index edit, test additions, README update, regenerated validators, up to 3 decision rows. If it does not fit, build the validation record and run result first and split the run record into `1.4b`.

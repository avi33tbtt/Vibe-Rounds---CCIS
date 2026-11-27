# Chunk 4.2d.2: code-authoring SDK, part 5c: outputs and the closing members (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.2d and 4.2d.1 (done). Adds member builders `outputs`, `interpretation`, `executionProfile`, `tests`, `evidence`, `provenance` to `ccis-sdk-analytics.js` (88 lines now), proved member by member on the four snake analytics examples with `compareRoutes`. The whole `analytics()` and the README section are 4.2d.3. Same rules as 4.2: pure, plain frozen JSON, no invented content, fixed-sentence errors with a path, same validator as the file route. A new member is never given a default (no `carries`, no limits, no `unit`)._

**Core rules:** attach `01-core.md` too. Rule 12: a NEW test file `test/ccis-sdk-analytics-closing.test.js` (at most 8 cases).

**Read only (4 files):** `ccis/schemas/analytics.schema.json` with `grep -n` on `"output"`, `"tests"`, `"evidence"`, `"interpretation"`, `"executionProfile"`, `"provenance"` (about 60 lines in all); `ccis-sdk-analytics.js` lines 1-20 and the `inputs` builder (the pattern to copy); `test/ccis-sdk-expression.test.js` lines 1-20 (helpers to copy). The four examples are loaded by the test, never read.

## Build (1 module edit of at most 50 lines, 1 new test of at most 8 cases)
In `ccis-sdk-analytics.js`:
1. `export const OUTPUT_KINDS` (`value`, `classification`, `table`), `VALUE_TYPES` (`quantity`, `time`, `integer`), `CARRIES` (`warnings`, `limitations`, `missingDataNotes`, `certainty`), `SOURCE_KINDS` (`guideline`, `publication`, `local-protocol`, `expert-opinion`); the test compares each with the schema. `NON_VALUE_STATES` already exists.
2. `export const outputs`: list of at least 1; each item closed (`x-` allowed, as the file route allows), required `id` (keyText), `kind`, `states` (at least 1 of `NON_VALUE_STATES`), `carries` (must hold `warnings`, `limitations`, `missingDataNotes`, else `S-004`); `kind` rules, each `S-002` when the required member is missing: `value` needs `valueType` and `unit` (no whitespace), `classification` needs `labels` (at least 2 texts), `table` needs `columns` (at least 1, each exactly `key`, `label`). A member of another kind (`labels` on a value) is `S-004`.
3. `interpretation` (`meaning` text, `prohibited` at least 1 text), `executionProfile` (three integers of at least 1: `maxSteps`, `maxDepth`, `maxOutputBytes`; a float, 0 or a string is `S-003`), `evidence` (`statement`, `sources` list of `kind` and `citation`; an empty `sources` list is allowed), `provenance` (`origin`, `basis`): all closed, no `x-`.
4. `tests`: list of at least 1; each `id` (keyText), `fixture` (`^[a-z0-9][a-z0-9-]*$`), `enables` (list, may be empty; each exactly `parameter` and `testOnly`, where `testOnly` must be `true`, anything else `S-003`), `expect` (at least 1; each has `output` plus exactly one of `state`, `label`, `matchesFixture` (only `true`); none or two is `S-004`). No value member anywhere (CCIS-REQ-029).
5. NOT added (validator): an `expect.output` naming no output, an unknown `enables.parameter`, an output with no computation, a `fixture` that does not exist.

## Test: `test/ccis-sdk-analytics-closing.test.js` (at most 8 cases)
1. `outputs`, `interpretation`, `executionProfile`, `evidence`, `provenance` of all four snake examples are `identical` on the code route (same checksum); 2. `tests` of all four the same;
3. the four enum lists equal the schema; 4. `carries` missing `limitations` is `S-004`; a `value` output without `unit` is `S-002`; `labels` on a value is `S-004`;
5. `executionProfile`: 0, 1.5 and `'9'` are `S-003` at the member path;
6. `testOnly: false` and a missing `testOnly` refused; an `expect` with both `state` and `label` is `S-004`;
7. `x-` allowed on an output, refused on `interpretation` (`S-001`); error paths carry indices (`outputs.1.kind`); results are frozen;
8. hostile string never in a message; purity scan of `ccis-sdk-analytics.js` passes.

**Done when:** `node --test test/ccis-sdk-analytics-closing.test.js test/ccis-sdk-expression.test.js` passes. Two breakages each seen failing, then restored: (a) drop the `carries` rule; (b) accept `testOnly: false`.

**Size guard:** module grows by at most 50 lines (about 138 in all), 1 new test file, tracker and DECISIONS only otherwise. If a schema member of these blocks is not listed here, or a snake example uses a member this chunk does not build, STOP and report; split `tests` into 4.2d.2a.

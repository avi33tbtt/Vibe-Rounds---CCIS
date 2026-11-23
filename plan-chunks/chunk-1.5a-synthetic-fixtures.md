# Chunk 1.5a-synthetic-fixtures: Synthetic cases with hand-calculated expected results

_Phase 1, Stage 2. Needs: 1.5 (done). Written just in time from the plan brief for 1.5 (second half) and the six fixture classes in `docs/USE-CASE-SNAKE.md` section 6. This chunk file is docs only; the fixtures are built at the next "do next"._

**Core rules:** attach `01-core.md` too.

**Read only:** `docs/USE-CASE-SNAKE.md` sections 4 to 6; `ccis/examples/snake/README.md`; the two analytics files and the pathway in `ccis/examples/snake/`; `ccis/schemas/context-envelope.schema.json` and `run-result.schema.json`; one good fixture of each in `ccis/fixtures/schemas/`; `ccis/SPEC.md` REQ-032, 033, 035, 042, 043, 066, 072; `docs/IMPORT-CONTRACT.md` IMP-043 to 046.

## What this row delivers

Synthetic cases (envelopes) and, beside each, the **expected result** worked out by hand, for both analytics and the pathway route. Nothing runs them yet: the executor is row 3.4. Here they are data plus a test that proves the data is well formed and the hand calculations are internally consistent.

## Decisions this chunk proposes (owner approves the chunk file; builder logs them, max 3 rows)

- **Location and names.** `ccis/fixtures/snake/`, one folder per class (`normal`, `boundary`, `missing`, `conflicting`, `out-of-scope`, `unit-conversion`). Per case two files: `<case>.envelope.json` (valid against the envelope schema) and `<case>.expected.json` (see below). A top `index.json` lists every case with its class and what it tests.
- **Expected-result file.** Not a new schema. It holds: `case`, `class`, `parameters` (the test-only placeholder values used, or `none`), `evaluationTime`, `results` (an array of objects that validate against `run-result.schema.json`, one per output of each analytic, with the hand calculation in a `workings` note kept **outside** the result object, in the same file), and `pathwayRoute` (stage ids in order, naming the outcome id taken at each node). If a plain wrapper object with these members cannot be validated by an existing schema, validate each `results` entry only and check the wrapper with the test. Do not stretch a schema.
- **Test-only placeholders (D-013).** Parameter values used by fixtures are written only in `<case>.expected.json` under `parameters`, each marked `"testOnly": true` and never inside a reference artefact. Values are chosen for easy hand arithmetic (whole numbers of minutes, round clock times), carry the note "test-only placeholder, not a clinical value", and appear in no real run record. The test fails if any placeholder appears in `ccis/examples/`.
- **Concept ids.** The envelope's `concept.id` must match the artefact id pattern (lower-case dotted), but element field keys are camelCase. The builder defines a one-to-one convention, for example `snake.envenomation-timing.bite-time` for field `biteTime`, writes the table in `ccis/fixtures/snake/README.md`, and the test checks it is one-to-one and covers all ten fields. If the envelope cannot carry a field (a datetime value, a coded value, a state, or the certainty companion), the builder **stops**, lists the point, and proposes a numbered amendment or new row.

## Build

1. **Cases.** At least these, each with an envelope and an expected file. Times use whole minutes and stated offsets. The `workings` note shows the arithmetic in words and numbers.
   - **normal** (2): complete consistent record, exact bite time, parameters enabled (placeholders) and not enabled. Expected: interval, comparison, per-item states, count, overall status, pathway route to the end.
   - **boundary** (3): interval exactly equal to the placeholder target, with the edge rule `inside` and then `outside`; read time exactly on the window limit, both rules. Expected results differ between the two rules.
   - **missing** (one case per fact removed in turn that matters: F1 time, F1 certainty, F7 status, F8 time, F3 status, F5, F6; and one with F3 status unknown): never zero, false or complete. Expected: needs-data or indeterminate, and the gap-report route.
   - **conflicting** (3): administration earlier than the bite; read time earlier than start; two records disagreeing about the clotting test status. Expected: conflict states (or the conflicting node outcome), no computed value.
   - **out-of-scope** (2): anti-snake-venom explicitly not given (not applicable, not a value); clotting test explicitly not performed (items F4 to F6 not applicable, not counted as missing).
   - **unit-conversion** (2): the same instants given with different stated offsets give the same interval; a parameter given in hours. Parameter units are minutes only in 1.5 (D-034). If the hours case needs a declared conversion, the builder **stops on that case**, adds it as a new row (a new artefact version, never an edit of 1.5), and builds the rest.
   - **estimated certainty** (2): estimated bite time with the certainty choice `accept`, then `flag-only`, then not enabled (so `parameter-not-enabled`). Records that the estimate stays visible.
2. **Independence of the hand calculation.** The expected values are derived from the dossier wording (sections 4.1 and 4.2) and the arithmetic, not by reading values out of the expression trees. The `workings` note names the dossier sentence each result follows. Where the trees and the dossier disagree, the builder stops and reports the disagreement instead of choosing.
3. **`ccis/fixtures/snake/README.md`**: the class table, the concept id convention, the placeholder rule, what is not proved (nothing here is clinical), and what rows 3.4 and 1.6 add.
4. **`test/snake-fixtures.test.js`** (no new dependency): every envelope validates with the committed validator; every `results` entry validates; every case is listed in the index and every index entry has both files; all six classes are present; every parameter value is marked test-only and absent from `ccis/examples/`; concept ids are one-to-one with field keys; every envelope's applied versions match the reference artefacts exactly; no envelope holds identity or narrative; a small independent check recomputes each interval and window from the envelope times with plain arithmetic and compares to the expected file; a missing, conflicting or not-applicable case never expects a value.
5. **Logging.** Max 3 rows in `DECISIONS.md`.

## Do not

- Do not run, interpret or implement the expression trees (row 3.4). No executor, no importer.
- No real data, no names, no real terminology codes. No clinical meaning claimed for any number.
- No changes to `ccis/examples/`, the schemas, `ccis/SPEC.md` or earlier chunk files; a needed change is a numbered amendment or a new row.
- No invalid examples (row 1.6).

## Done when

`npm test` passes once; at most 3 deliberate-breakage checks (for example change an expected interval by one minute, remove the `testOnly` mark from a placeholder, put a placeholder value into an example artefact), each seen failing then restored.

## Size guard

About 20 cases (40 files), 1 index, 1 README, 1 test file, up to 3 decision rows. If it does not fit, split into `1.5b` by class: `normal` and `boundary` first; the rest after.

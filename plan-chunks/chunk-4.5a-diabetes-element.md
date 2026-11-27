# Chunk 4.5a: second demo, part 1: the diabetes element and a short use-case note (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Row 4.5 is split (D-273): 4.5a diabetes element, 4.5b CKD element, 4.5c composition (needs an owner decision), 4.5d combined analytic, 4.5e fixtures, 4.5f failure-policy fixtures, 4.5g wiring. This row builds data only: no module, no page change._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `ccis/examples/snake/snake-envenomation.element.json` (the shape to copy; view lines 1-60 only); `ccis/examples/snake/README.md` lines 1-8 (the demonstration-only wording); the SDK element equivalence test (`ls test | grep sdk-element`; view its first 30 lines for the snake equivalence pattern to copy); `ccis-sdk-element.js` lines 1-20 (`EPISTEMIC_STATES`, `SOURCE_CLASSES`, `TIME_SEMANTICS`, `FIELD_TYPES`); `docs/USE-CASE-SNAKE.md` lines 1-30 (the style of a use-case note).

## Build
1. `docs/USE-CASE-DIABETES-CKD.md` (under 60 lines): demonstration only, synthetic, no clinical review, no clinician owner, so no threshold, target, band, dose or drug appears anywhere. It states the facts D1 to D8 below, says the second demo proves composition and failure policy (later rows), and lists 4.5a to 4.5g.
2. `ccis/examples/diabetes-ckd/diabetes.element.json`: id `diabetes.glycaemia-documentation`, version `0.1.0`, `status: draft`, standard `0.1.0`, publisher `Synthetic test publisher`. Eight fields (documentation facts only):
   - D1 `diabetesTypeStatement` (string; epistemic includes `absent`, `unknown`, `not-collected`; clinician-entered)
   - D2 `diagnosisDate` (date)
   - D3 `hba1cValue` (quantity, units `mmol/mol` and `%` as two declared units; no conversion here)
   - D4 `hba1cResultTime` (datetime, `collection-time`)
   - D5 `glucoseValue` (quantity, units `mmol/L` and `mg/dL`)
   - D6 `glucoseResultTime` (datetime, `collection-time`)
   - D7 `glucoseFastingStatus` (string; allowed members stated in `constraints` as a list of statuses, not values)
   - D8 `treatmentPlanDocumented` (boolean; only that a plan is written down, never what it is)
   Relationships: `hba1cResultTime` and `glucoseResultTime` each `refines` their value field (use only relationship kinds the snake element already uses). Intent states purpose, setting, population, exclusions and rationale in plain words. No terminology binding and no real code.
3. Build the element through the SDK `element()` in the test (not by hand) and write the JSON from the same spec, so the file and the SDK route give identical bytes.

## Test: `test/ccis-diabetes-element.test.js` (at most 8 cases)
1. The file validates with no error rows (`validateArtefact`).
2. Canonical bytes are stable; the checksum is recorded as a constant in the test (computed once, then pinned).
3. The file equals the SDK `element()` output on the same spec (byte for byte).
4. Manifest: draft, `0.1.0`, standard `0.1.0`, synthetic publisher; exactly eight fields with the keys above.
5. Every field lists epistemic states from `EPISTEMIC_STATES` and includes `unknown` and `absent`.
6. No member name or string contains `threshold`, `target`, `band`, `dose`, `mg/kg`, `insulin`, `metformin`, a drug name, or a number used as a limit (scan keys and strings, except units).
7. Both result-time fields are datetimes with `collection-time`; no field has `timeSemantics` missing where a time is held.
8. The folder `ccis/examples/diabetes-ckd/` holds exactly the one element file (later rows add more), and the file parses as JSON with no `x-` member and no member the snake element lacks at the top level (`manifest`, `intent`, `fields`, `relationships`, `provenance`).

**Done when:** `node --test test/ccis-diabetes-element.test.js` passes (`test/examples.test.js` lists the snake files by hand and is not touched). Two breakages each seen failing, then restored: (a) add a field named `hba1cTarget` (case 6 fails); (b) change one unit string (case 3 fails).

**Size guard:** 1 doc, 1 JSON, 1 test (8 cases), no edit to an existing test. If the element passes 5 KB, STOP and move D7 and D8 to a new row.

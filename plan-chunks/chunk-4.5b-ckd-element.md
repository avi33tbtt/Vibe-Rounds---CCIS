# Chunk 4.5b: second demo, part 2: the kidney element (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.5a (done). Same shape as 4.5a: one element file built through the SDK, one test, one small doc edit. No module, no page change. Unit conversion is NOT done here (a conversion factor is a number and belongs to an analytic parameter, row 4.5d); this element only declares the units a value may carry (D-276)._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `ccis/examples/diabetes-ckd/diabetes.element.json` (the shape to copy; view lines 1-70); `test/ccis-diabetes-element.test.js` (copy its 8-case structure; view all); `docs/USE-CASE-DIABETES-CKD.md` (sections 2 and 3, to extend); `ccis-sdk-element.js` lines 1-12 (constants, already known); one more file only if a validator row asks for it.

## Build
1. `ccis/examples/diabetes-ckd/ckd.element.json`: id `ckd.kidney-function-documentation`, version `0.1.0`, `status: draft`, standard `0.1.0`, publisher `Synthetic test publisher`. Eight documentation fields, each with the six epistemic states, source classes `patient-reported`, `clinician-entered`, `imported`, cardinality 0 to 1:
   - K1 `kidneyDiseaseStatement` (string; the words the record uses, never classified or staged)
   - K2 `diagnosisDate` (date, `event-time`; **meaning: the date chronic kidney disease was recorded as diagnosed**)
   - K3 `creatinineValue` (quantity, units `umol/L` and `mg/dL`; value and unit travel together, no conversion, no judgement)
   - K4 `creatinineResultTime` (datetime, `collection-time`)
   - K5 `egfrValue` (quantity, unit `mL/min/1.73m2`; as reported, never calculated here)
   - K6 `egfrResultTime` (datetime, `collection-time`)
   - K7 `egfrMethodStatement` (string; the method as the result states it; no formula, no equation named as a rule)
   - K8 `kidneyFollowUpDocumented` (boolean; only that a follow-up arrangement is written down, never what it is)
   Relationships: `creatinineResultTime` and `egfrResultTime` each `refines` their value field. Intent: purpose, setting, population, exclusions (diagnosis, staging, targets, treatment choice, any drug or dose) and rationale in plain words. No terminology binding and no real code.
   **Deliberate for row 4.5c:** `diagnosisDate` has the same key as the diabetes field but a different meaning, and `kidneyFollowUpDocumented` has a label close to the diabetes `treatmentPlanDocumented` but a different meaning. Neither may be merged by label (REQ-024). Write each meaning in the field's own `constraints`.
2. Build with the SDK `element()` from a spec in a one-off script (not committed), write the file as `JSON.stringify(element(spec), null, 2)` plus a newline (keys come out sorted, D-275), and pin the checksum in the test.
3. `docs/USE-CASE-DIABETES-CKD.md`: add a section with the K1 to K8 table (same columns as D1 to D8) and one sentence on the two deliberate near-collisions. Keep the file under 80 lines.

## Test: `test/ccis-ckd-element.test.js` (at most 8 cases)
1. Validates with no diagnostic rows on any layer.
2. Canonical bytes stable; the checksum is pinned (this also catches a changed unit).
3. SDK route identical; the file equals `JSON.stringify(element(file), null, 2)` plus a newline.
4. Manifest values and exactly the eight keys above, in that order.
5. Every field lists the six epistemic states.
6. No member name, field key or label contains `threshold`, `target`, `band`, `dose`, `mg/kg`, a drug name, `stage`, `staging`, `formula` or `equation`; every number in the file is 0 or 1 (cardinality).
7. Both result times are datetimes with `collection-time`; `egfrValue` has exactly one unit; `creatinineValue` has exactly two.
8. Near-collisions are kept apart: load both element files; the two `diagnosisDate` labels differ, the two `diagnosisDate` constraints differ, the follow-up and treatment-plan labels differ, and no key in the CKD file is merged into or removed from the diabetes file (the diabetes checksum still equals the one pinned in `test/ccis-diabetes-element.test.js`).

**Done when:** `node --test test/ccis-ckd-element.test.js test/ccis-diabetes-element.test.js` passes. Two breakages each seen failing, then restored: (a) add a field `egfrBand` (case 6 fails); (b) change one unit string (case 2 fails).

**Size guard:** 1 JSON (expect about 6 to 7 KB; stop only if it passes 9 KB), 1 test (8 cases), 1 doc edit. No edit to an existing test or module.

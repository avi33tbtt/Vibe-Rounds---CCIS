# Chunk 4.5c.2: second demo, part 3c: the diabetes and CKD group file (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.5c and 4.5c.1 (done). One group file that composes the two elements by declared meaning, one test, one doc edit. No module, no schema, no page change. The SDK has no group builder, so the file is written by hand and pinned (D-284)._

**Core rules:** attach `01-core.md` too.

**Read only (4 files):** `test/ccis-validator-group.test.js` (the `group()` object and `run` helper to reuse; view all); `ccis/examples/diabetes-ckd/ckd.element.json` lines 1 to 12 and the `manifest` block (ids and versions only); `docs/USE-CASE-DIABETES-CKD.md` (sections 2b and 3); `ccis/schemas/element-group.schema.json` (only if a validator row asks).

## Build
1. `ccis/examples/diabetes-ckd/diabetes-ckd.group.json`: id `diabetes-ckd.group`, version `0.1.0`, `status: draft`, standard `0.1.0`, publisher `Synthetic test publisher`. Write it as `JSON.stringify(doc, null, 2)` plus a newline with keys sorted (as the element files), and pin its checksum in the test.
   - `members`: the diabetes element (`required: true`) and the CKD element (`required: false`), each by id and exact version `0.1.0`. Reason in the intent: the combined analytic in 4.5d must report `indeterminate` when the kidney context is missing, never false (failure policy, row 4.5f).
   - `sharedConcepts`, both `related-not-merged` (no entry is `same-concept`: the demo has no pair of fields that are the same concept, which is itself the point):
     1. `diagnosisDates`: the `diagnosisDate` of each element. Meaning: "Two different dates. One is when diabetes was recorded as diagnosed, the other when chronic kidney disease was. They share a key and are never one value."
     2. `plannedFollowUp`: `treatmentPlanDocumented` (diabetes) and `kidneyFollowUpDocumented` (CKD). Meaning: "Both only record that an arrangement is written down. One is a diabetes treatment plan, the other a kidney follow-up arrangement. They are different facts with different owners and are never combined."
   - `versionPolicy`: `{ conflict: "refuse" }`.
   - `intent`: purpose, setting, population, exclusions (diagnosis, staging, targets, treatment choice, any drug or dose), rationale, in plain words, no number. `provenance`: basis "None. No clinical source and no clinical review.", origin "Synthetic demonstration written for the second demo (row 4.5c.2)."
2. `docs/USE-CASE-DIABETES-CKD.md`: add section 2c (about 8 lines): what the group declares, why no pair is `same-concept`, and that unit conversion (glucose, creatinine) is still left to 4.5d. Keep the file under 80 lines.

## Test: `test/ccis-diabetes-ckd-group.test.js` (at most 8 cases)
1. The file validates through every layer with `known` = the two element files: no error row (a warning from an element, such as the eGFR unit one, is allowed and listed exactly).
2. Canonical bytes stable; the checksum is pinned.
3. The file equals `JSON.stringify(parsed, null, 2)` plus a newline.
4. Members: exactly the two elements, in order, `required` `true` then `false`, versions pinned (no range).
5. Exactly two shared concepts, both `related-not-merged`; none `same-concept`; no member named `label` anywhere in the file.
6. Every field named in a concept exists in its element, and every key defined in both elements is listed by a concept (so no overlap is left to inference).
7. Remove the `diagnosisDates` concept in memory: validation reports CCIS-V5-012 and nothing else.
8. Change `diagnosisDates` to `same-concept` in memory: validation passes (same type) but the test asserts the meaning text still says the two are different dates, so a reviewer cannot flip it silently (the pinned checksum in case 2 also changes).

**Done when:** `node --test test/ccis-diabetes-ckd-group.test.js test/ccis-validator-group.test.js` passes. Two breakages each seen failing, then restored: (a) change a member version to a range (case 4 fails); (b) edit one meaning sentence (case 2 fails).

**Size guard:** 1 JSON (expect about 3 KB), 1 test (8 cases), 1 doc edit. No edit to an existing test or module.

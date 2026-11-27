# Chunk 4.5e: second demo, part 5: synthetic fixtures with hand-calculated results for the combined analytic (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.5d.2 (done). First half only (rule 12): four cases. The unit-conversion edge cases and the remaining classes are 4.5e.1; failure-policy cases stay 4.5f._

**Core rules:** attach `01-core.md` too. Synthetic data only. Parameter values in expected files are test-only placeholders, never clinical values.

**Read only (5 files):**
1. `ccis/examples/diabetes-ckd/diabetes-ckd.sample-gap.analytics.0.1.3.json`: print only `outputs` and `computation` with a one-off `node -e` (the file is 26 KB, never read whole; stays unchanged).
2. `ccis/fixtures/snake/normal/normal-01-all-enabled.envelope.json` and its `.expected.json` (envelope and expected shape to copy; first 60 lines each).
3. `test/snake-fixtures.test.js` lines 1 to 60 only (helpers: `obsOf`, `stateOf`, `same`, plain-arithmetic style).
4. `ccis/fixtures/snake/index.json` first 20 lines (index shape).
5. `ccis/examples/diabetes-ckd/diabetes-ckd.group.json`, `members` only (the two element ids and versions).

## Build
New folder `ccis/fixtures/diabetes-ckd/` with `index.json` and four cases, each an `.envelope.json` and an `.expected.json` (8 files plus index, all under 2 KB each). Both contexts present in every case; the analytic is 0.1.3, named in `x-analyticVersion`. Times are fixed ISO instants; the evaluation time is an input in the expected file.
1. `normal-01-targets`: HbA1c collected `2026-03-01T08:00:00Z`, creatinine collected `2026-03-01T10:30:00Z`; creatinine `100` `umol/L`, glucose `90` `mg/dL` (already in target units); all four facts present. Hand-calculated: `sampleGap` 150 min, hba1c first; `documentedFactCount` 4; both converted outputs equal the input values unchanged; `sampleWithinWindow` says parameter not enabled.
2. `normal-02-converted`: same times; creatinine `1` `mg/dL`, glucose `5` `mmol/L`. Hand-calculated: `creatinineUmolL` 88.4, `glucoseMgdL` 90.08 (1 x 88.4; 5 x 18.016); gap and count as case 1.
3. `boundary-01-same-minute`: both collected `2026-03-01T08:00:00Z`. Gap 0 minutes; read the order output's wording for equal times from the 0.1.3 tree and record it, do not guess; if the tree gives an undeclared state, STOP and add a finding.
4. `boundary-02-reversed`: creatinine collected `2026-03-01T06:00:00Z` (before HbA1c at 08:00). Gap magnitude and sign per the 0.1.3 tree (hand-calculated first: 120 min), creatinine first.

## Test: `test/ccis-combined-fixtures.test.js` (at most 8 cases)
1. Index lists exactly the four cases; every listed file exists, no extra file in the folder.
2. Every envelope passes `contextEnvelope`; every case has both contexts.
3. Expected results recomputed with plain arithmetic (not read from the tree) equal the stored expected for gap and count.
4. The executor run of 0.1.3 on each envelope equals the stored expected (`runResult`), compared output by output.
5. Converted values: 88.4 and 90.08 within 1e-9; the target-unit case is unchanged.
6. Same-minute case gives gap 0 and never an absent or zero-for-missing.
7. Reversed case: sign and order agree with each other.
8. Rerun is byte-identical (canonical bytes of two runs equal).

**Done when:** `node --test test/ccis-combined-fixtures.test.js` passes (new file only). Two breakages seen failing, then restored: (a) change `90.08` to `90.8` in case 2 (cases 3 to 5 fail); (b) swap the two times in `boundary-02` (case 7 fails).

**Size guard:** 9 JSON data files (each under 2 KB), 1 test (8 cases), 0 modules, 0 edits to existing files except a doc line in `docs/USE-CASE-DIABETES-CKD.md` (2e, under 80 lines). If a quantity or time shape is unclear from file 2, say so and drop that case instead of guessing.

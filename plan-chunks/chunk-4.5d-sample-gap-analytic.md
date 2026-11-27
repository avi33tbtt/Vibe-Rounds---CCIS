# Chunk 4.5d: second demo, part 4: the combined analytic, first slice (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.5c.2 (done). Row 4.5d is split (rule 12, D-285). This slice is **one analytic over both contexts that needs no clock, no parameter and no number**: how far apart the HbA1c and creatinine samples were collected, and which came first. Evaluation-time recency and a completeness count are 4.5d.1; unit conversion is 4.5d.2 and needs your decision first._

**Core rules:** attach `01-core.md` too.

**Read only (5 files; for big files use `sed -n`):** `ccis-sdk-analytics.js` lines 136 to 170 (the `analytics()` spec shape); `test/ccis-sdk-analytics-whole.test.js` (or the 4.2d.3 test; copy its equivalence case); `ccis/examples/snake/snake-interval.analytics.0.1.1.json` lines 1 to 80 and the `outputs` and `executionProfile` members only (shape to copy); `ccis-exec.js` lines 360 to 364 (`time-diff` is `second minus first`, in minutes); `ccis/examples/diabetes-ckd/diabetes-ckd.group.json` (member ids and versions).

## Build
1. `ccis/examples/diabetes-ckd/diabetes-ckd.sample-gap.analytics.json`, built through the SDK `analytics()` from a one-off script (not committed), written sorted with two-space indent plus a newline, checksum pinned in the test. Id `diabetes-ckd.sample-gap`, version `0.1.0`, `status: draft`, standard `0.1.0`, publisher `Synthetic test publisher`; manifest `references` the two elements at exact version `0.1.0`.
   - `question`, `intendedUsers`, `population`, `limitations` in plain words. Limitations say: it measures when samples were recorded as collected, never a value, never care, never a trend.
   - `context`: two entries, the diabetes element (field `hba1cResultTime`) and the CKD element (field `creatinineResultTime`), range `^0.1.0`.
   - `inputs`: `hba1cCollected` (datetime, `onMissing: needs-data`), `creatinineCollected` (datetime, `onMissing: indeterminate`). **The failure policy lives here:** a missing kidney context is `indeterminate`, never false or normal (row 4.5f proves it). Choose the asymmetry deliberately and state it in `limitations`.
   - `parameters`: none. `conversions`: none. `operatorSet`: `ccis-core-ops` `0.1.0`. `executionProfile`: copy the snake numbers.
   - `outputs`: `sampleGap` (value, `valueType` time, unit `min`, five non-value states, carries warnings, limitations, missingDataNotes) and `sampleOrder` (classification, labels `hba1c-first`, `creatinine-first`, `same-time`, same states).
   - `computation`: `sampleGap` = `time-diff(hba1cCollected, creatinineCollected)` (positive when creatinine was collected later); `sampleOrder` = `if(lt(h,c), "hba1c-first", if(lt(c,h), "creatinine-first", "same-time"))`. No numeric literal anywhere. Guard each with `is-present` as the snake interval does, so a missing input gives its declared state.
   - `interpretation`: meaning and `prohibited` (not a statement about the quality or timeliness of care; not a recommendation, alert or order). `evidence`: "No evidence is claimed." `provenance` as the elements.
2. `docs/USE-CASE-DIABETES-CKD.md`: one short section (about 5 lines) for the analytic and the asymmetry; keep the file under 80 lines.

## Test: `test/ccis-sample-gap-analytic.test.js` (at most 8 cases)
1. Validates with `known` = the two elements: no error row, and the layer 4 check that every non-value state is declared passes.
2. Canonical bytes stable; checksum pinned.
3. SDK route identical (`compareRoutes`); the file equals the SDK output formatted as above.
4. Manifest values; references pin exact element versions; context names exactly the two fields.
5. No `parameters`, no `conversions`; no number in the file except the execution profile and cardinality-free members (list them).
6. Only whitelisted operators are used; no `literal` is a number.
7. `hba1cCollected` is `needs-data` and `creatinineCollected` is `indeterminate` when missing (the stated asymmetry).
8. Every output declares the five non-value states.

**Done when:** `node --test test/ccis-sample-gap-analytic.test.js` passes and the group validator test still passes. Two breakages each seen failing, then restored: (a) add a numeric literal to the tree (case 6 fails); (b) change `creatinineCollected` `onMissing` to `needs-data` (case 7 fails).

**Size guard:** 1 JSON (expect 9 to 12 KB; stop only past 16 KB), 1 test (8 cases), 1 doc edit. No module change. Fixtures and hand-calculated results are 4.5e.

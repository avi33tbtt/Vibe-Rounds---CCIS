# Chunk 4.5f: second demo, part 6: failure-policy fixtures for the combined analytic (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.5e.1 (done). Three cases only (rule 12), one new test file. Market entry and page selection stay 4.5g. No module, no analytic change._

**Core rules:** attach `01-core.md` too. Synthetic data only. Unknown never becomes false or normal. A missing context is not a low count and not a normal value. Parameter values in expected files are test-only placeholders.

**Read only (5 files):**
1. `ccis/fixtures/diabetes-ckd/normal-01-targets.envelope.json` (copy; about 4.7 KB) and its `.expected.json`.
2. `ccis/fixtures/diabetes-ckd/index.json` (add three entries, same shape).
3. `ccis/examples/diabetes-ckd/diabetes-ckd.sample-gap.analytics.0.1.3.json`: one-off `node -e` printing only `inputs[].key` with `onMissing`, and `outputs[].id` with `states`. Never read it whole (26 KB). Known: diabetes inputs are `needs-data` when missing, kidney inputs `indeterminate`.
4. `test/ccis-combined-fixtures-edge.test.js` lines 1 to 60 only (helpers to copy).
5. `ccis/examples/diabetes-ckd/diabetes-ckd.group.json` only if the envelope shape for "element not applied" is unclear.

## Build
Three cases in `ccis/fixtures/diabetes-ckd/` (6 JSON, 3 index entries). Work each expected result out by hand FIRST from the declared states, then compare with the 0.1.3 tree.
1. `failure-01-kidney-context-missing`: the kidney element is not applied at all (the group member is optional). Expected: every output that needs a kidney input is `indeterminate` (gap, order, creatinine, fact count per D-291); the glucose output is still computed from the diabetes context. No count of 2 standing in for 4.
2. `failure-02-diabetes-context-missing`: only the kidney element applied. Expected: outputs needing a diabetes input are `needs-data` (deliberate asymmetry, D-285); creatinine still computed.
3. `failure-03-kidney-time-unknown`: both contexts applied, creatinine collection time recorded as unknown (not absent). Expected per the tree; it must not equal case 1 by accident and must never be a zero gap.

If the tree declares no state for a case, STOP, drop it, add a finding to `DECISIONS.md` (max 3 rows) and say so. Do not edit the analytic. A both-contexts-missing case, if wanted, is a new row.

## Test: `test/ccis-combined-fixtures-failure.test.js` (new file, at most 8 cases)
1. Index lists exactly ten cases (seven old plus three new); no extra file in the folder.
2. Every new envelope passes `contextEnvelope`.
3. Case 1: kidney-dependent outputs are `indeterminate`; glucose is a number; fact count is not a number.
4. Case 2: diabetes-dependent outputs are `needs-data`; creatinine is a number.
5. Case 3: the declared state, not 0, not `false`, and different from case 1's reason.
6. In all three, no output is `false`, `normal` or a number invented for a missing input.
7. Stored expected equals the run for all three; the seven old cases still equal theirs.
8. Rerun is byte-identical (canonical bytes) for all three.

**Small edit (D-298 pattern):** `ccis-combined-fixtures-edge.test.js` case 1 asserts the folder holds exactly seven cases and will fail. Change it to check its seven named cases are listed and their files exist, nothing more. Run it once to confirm.

**Done when:** `node --test test/ccis-combined-fixtures-failure.test.js` passes (new file only), plus the edited edge test. Two breakages seen failing, then restored: (a) give case 1 a kidney creatinine time (cases 3 and 6 fail); (b) change case 2's expected glucose state (case 4 fails).

**Size guard:** 6 JSON (about 4 KB each), 3 index entries, 1 test (8 cases), 0 modules, 1 small test edit. One doc line in `docs/USE-CASE-DIABETES-CKD.md` (2f). If a case needs a new field or analytic change, drop it and add a row.

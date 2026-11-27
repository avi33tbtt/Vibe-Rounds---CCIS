# Chunk 4.5d.1a: second demo, part 4c: a count of documented facts across both contexts (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.5d.1 (done). Version 0.1.2 of the sample-gap analytic adds one output, `documentedFactCount`: how many of four listed facts are recorded, two per context. **No "complete" label:** that needs an expected number or an expected-facts set (a clinician's choice), so this slice only counts. The point is the failure policy: a missing kidney context must read `indeterminate`, never a low count and never complete._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** the 0.1.1 file `ccis/examples/diabetes-ckd/diabetes-ckd.sample-gap.analytics.0.1.1.json` (all, 19 KB; stays unchanged); `test/ccis-sample-window.test.js` (copy its structure and helpers; pinned checksum of 0.1.1 is `sha256:994cc07475d54366907ce58ef28f3abfb3bd2db88b657026b7b054491ef75bf8`); `ccis-exec.js` lines 348 to 351 (`count` takes booleans; any unknown argument makes the whole count unknown, so count only `is-present` results); `docs/USE-CASE-DIABETES-CKD.md` section 2d.

## Build
1. **New file** `diabetes-ckd.sample-gap.analytics.0.1.2.json` (id unchanged, version `0.1.2`), built through the SDK `analytics()` from a one-off script (not committed) that starts from the 0.1.1 spec. 0.1.0 and 0.1.1 are **not edited**.
   - `inputs`: the existing four, plus `diabetesTypeStatement` (element `diabetes.glycaemia-documentation`, field `diabetesTypeStatement`, type `string`, `onMissing` `needs-data`) and `kidneyDiseaseStatement` (element `ckd.kidney-function-documentation`, field `kidneyDiseaseStatement`, type `string`, `onMissing` `indeterminate`). Add both fields to the matching `context` entries.
   - `outputs`: the three existing unchanged, plus `documentedFactCount` (kind `value`, `valueType` `integer`, `unit` `1`, states `needs-data` and `indeterminate` only, D-286).
   - `computation`: existing three unchanged, plus `documentedFactCount`: diabetes side recorded = `or(is-present(diabetesTypeStatement), is-present(hba1cCollected))`, kidney side likewise with `kidneyDiseaseStatement` and `creatinineCollected`. If the diabetes side has nothing: `needs-data`. Else if the kidney side has nothing: `indeterminate`. Else `count` of the four `is-present` results. No numeric literal, no parameter.
   - `interpretation`: one sentence (a count of recorded facts, not a measure of care). `limitations`: one item (nothing reads as complete; a missing kidney context gives `indeterminate`, not a low count). `tests`: none (4.5e).
2. `docs/USE-CASE-DIABETES-CKD.md`: two lines under 2d (version 0.1.2; why count only). File stays under 80 lines.

## Test: `test/ccis-fact-count.test.js` (at most 8 cases)
1. 0.1.2 validates with both elements known: no error row.
2. Canonical bytes stable; checksum pinned; the 0.1.1 checksum above is still equal.
3. SDK route identical; file equals the sorted SDK output.
4. First three outputs and computation entries deep-equal to 0.1.1; parameters and conversions deep-equal to 0.1.1.
5. `documentedFactCount` declares exactly `needs-data` and `indeterminate`; no `literal` is a number; no new number outside the 0.1.1 numbers.
6. Executor: all four facts present gives `number` 4, unit `1` (hand-calculated).
7. Executor: both diabetes facts present, kidney inputs `absent`: `indeterminate`, not 2. Diabetes inputs `absent`: `needs-data`.
8. Executor: one fact per side present gives 2; `unknown` in a fact counts as not recorded (`is-present` false), never errors.

**Done when:** `node --test test/ccis-fact-count.test.js` passes (new file only). Two breakages seen failing, then restored: (a) swap the two `onMissing` words on the new inputs (case 7 fails); (b) edit one 0.1.1 computation entry (case 4 fails).

**Size guard:** 1 JSON (expect about 24 KB; stop past 28 KB), 1 test (8 cases), 1 doc edit. No module change. Input states for the executor are `present`, `absent`, `unknown`, and so on; text values are `{ t: 'text', v }`, instants `{ t: 'instant', ms }`.

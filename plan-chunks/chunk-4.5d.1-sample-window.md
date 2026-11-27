# Chunk 4.5d.1: second demo, part 4b: a disabled sample window (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.5d (done). **Finding F-13 (D-287):** the operator whitelist has no "now" and no evaluation-time reference, so "how recent is a result" against the evaluation time cannot be written in a tree. This slice therefore asks the recency question between two **recorded** times: were the two samples collected within a window a local clinician supplies. The window and the boundary rule are disabled parameters with no value (core rule: thresholds arrive disabled). The completeness count is 4.5d.1a._

**Core rules:** attach `01-core.md` too.

**Read only (5 files; `sed -n` or python summaries for the big ones):** `ccis/examples/diabetes-ckd/diabetes-ckd.sample-gap.analytics.json` (the 0.1.0 file, all, 7.7 KB; it stays unchanged); `ccis/examples/snake/snake-interval.analytics.0.1.1.json` (only the `parameters`, `conversions` members and the `comparison` entry of `computation`: the pattern to copy for `parameter-not-enabled`, the `hoursToMinutes` convert and the edge rule); `test/ccis-sample-gap-analytic.test.js` (copy its structure); `ccis-exec.js` lines 360 to 364 (`time-diff` is second minus first, in minutes).

## Build
1. A **new file** `diabetes-ckd.sample-gap.analytics.0.1.1.json` (id unchanged, version `0.1.1`), built through the SDK `analytics()` from a one-off script (not committed) that starts from the 0.1.0 spec. The 0.1.0 file is **not edited** (rule 10 spirit; its checksum stays pinned by the 4.5d test).
   - `parameters`: `sampleWindow` (kind `duration`, units `min` and `h`, `allowedRange` 0 to 525600 as a technical bound with the snake note, `enabledByDefault: false`, `suppliedBy` "Local clinician (role, not yet named)") and `edgeRule` (kind `choice`, `inside` or `outside`, disabled), both copied from the snake 0.1.1 file. **No value, default or suggestion.**
   - `conversions`: `hoursToMinutes` copied from the snake 0.1.1 file (a definition of units, not a clinical value).
   - `outputs`: the two 0.1.0 outputs unchanged, plus `sampleWithinWindow` (classification, labels `within-window`, `outside-window`, states `needs-data`, `indeterminate`, `parameter-not-enabled`). Declare only states the tree can give (D-286).
   - `computation`: the 0.1.0 entries unchanged, plus `sampleWithinWindow`: first `parameter-not-enabled` when either parameter is absent, then the same two input guards as `sampleGap`, then: the window in minutes (through the declared convert, as the snake comparison does), compared to the gap in **both directions** (`time-diff(h,c)` and `time-diff(c,h)`), so no `abs` is needed; the edge rule decides inclusive or exclusive as in the snake file. No numeric literal in the tree.
   - `interpretation`: add one sentence: a window is a description of the record, not a standard of care. `limitations`: add one item that no window is supplied, so the output reads `parameter-not-enabled`.
   - `tests`: none (4.5e).
2. `docs/USE-CASE-DIABETES-CKD.md`: two lines under section 2d (version 0.1.1, the F-13 reason). File stays under 80 lines.

## Test: `test/ccis-sample-window.test.js` (at most 8 cases)
1. The 0.1.1 file validates with the two elements known: no error row.
2. Canonical bytes stable; checksum pinned. The 0.1.0 file's checksum still equals the one pinned in `test/ccis-sample-gap-analytic.test.js`.
3. SDK route identical; file equals the sorted SDK output.
4. Both parameters are disabled and carry no `value`, `default` or `suggestion` member; the allowed range numbers are the only numbers outside the execution profile and the conversion factor.
5. `hoursToMinutes` equals the snake 0.1.1 conversion (same factor, units and kind).
6. The first 0.1.0 outputs and computation entries are deep-equal to the 0.1.0 file.
7. `sampleWithinWindow` declares exactly `needs-data`, `indeterminate`, `parameter-not-enabled`; no `literal` is a number.
8. Run the tree through `ccis-exec.js` (the same call the snake tests make) with no parameter enabled: `sampleWithinWindow` is `parameter-not-enabled` and `sampleGap` is still a value. (Hand-calculated enabled cases are 4.5e.)

**Done when:** `node --test test/ccis-sample-window.test.js test/ccis-sample-gap-analytic.test.js` passes. Two breakages each seen failing, then restored: (a) give `sampleWindow` a `default` member (case 4 fails); (b) change `hoursToMinutes` factor (case 5 fails).

**Size guard:** 1 JSON (expect about 14 KB; stop past 20 KB), 1 test (8 cases), 1 doc edit. No module change. If the executor call in case 8 needs more than the snake tests' helper, drop case 8 and say so.

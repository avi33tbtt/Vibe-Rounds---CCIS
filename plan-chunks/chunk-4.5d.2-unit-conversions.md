# Chunk 4.5d.2: second demo, part 4d: declared unit conversions for creatinine and glucose (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.5d.1a (done). **Owner decision 2026-11-27 ("unlock 4.5d.2 as it is"):** the factors go in as declared conversions, which are definitions of units, not clinical values or thresholds. No clinical source has been reviewed, so every conversion says so (D-292). Version 0.1.3 of the sample-gap analytic._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** the 0.1.2 file `ccis/examples/diabetes-ckd/diabetes-ckd.sample-gap.analytics.0.1.2.json` (all, 23 KB; stays unchanged; pinned `sha256:507692f82069fa5f94574f4bdfa830afbfa53a0b2c7ddd8d07d427dc85602876`); `test/ccis-fact-count.test.js` (copy its helpers and structure); `ccis-exec.js` lines 326 to 336 (`convert`: a value already in the target unit passes unchanged, a value in the declared source unit is multiplied, any other unit is refusal X-010, never guessed); `snake-interval.analytics.0.1.1.json` `conversions` member only.

## Build
1. **New file** `diabetes-ckd.sample-gap.analytics.0.1.3.json` (id unchanged, version `0.1.3`), built through the SDK `analytics()` from a one-off script (not committed) starting from the 0.1.2 spec. Earlier files are **not edited**.
   - `conversions` (added to the existing `hoursToMinutes`, each version `0.1.0`, kind `linear`, with an `x-note`: "A definition of units. Not a clinical value. No clinical source reviewed."):
     - `mgdlToUmolL`: from `mg/dL` to `umol/L`, factor `88.4` (creatinine).
     - `mmolLToMgdL`: from `mmol/L` to `mg/dL`, factor `18.016` (glucose).
   - `inputs`: the six existing, plus `creatinineValue` (element `ckd.kidney-function-documentation`, field `creatinineValue`, type `quantity`, units `umol/L` and `mg/dL`, `onMissing` `indeterminate`) and `glucoseValue` (element `diabetes.glycaemia-documentation`, field `glucoseValue`, type `quantity`, units `mmol/L` and `mg/dL`, `onMissing` `needs-data`). Add both fields to the matching `context` entries.
   - `outputs`: the four existing unchanged, plus `creatinineUmolL` (value, `valueType` `quantity`, unit `umol/L`, states `indeterminate`) and `glucoseMgdL` (value, `quantity`, unit `mg/dL`, states `needs-data`). Declare only states the tree gives (D-286).
   - `computation`: existing four unchanged, plus for each new output: not present gives `indeterminate` (creatinine) or `needs-data` (glucose), else `convert(input, conversion)`. No numeric literal in any tree.
   - `limitations`: one item: the two factors are unit definitions with no reviewed source, the value is shown, never judged, and no threshold exists. `tests`: none (4.5e).
2. `docs/USE-CASE-DIABETES-CKD.md`: two lines under 2d (version 0.1.3; factors unreviewed, D-292). Stays under 80 lines.

## Test: `test/ccis-unit-conversions.test.js` (at most 8 cases)
1. 0.1.3 validates with both elements known: no row.
2. Canonical bytes stable; checksum pinned; the 0.1.2 checksum above still equal.
3. SDK route identical; file equals the sorted SDK output.
4. Earlier four outputs and computation entries, and `parameters`, deep-equal to 0.1.2.
5. Conversions: exactly `hoursToMinutes`, `mgdlToUmolL`, `mmolLToMgdL`; the new two carry the unreviewed `x-note`; the only new numbers anywhere are the two factors (`88.4`, `18.016`); no `literal` is a number.
6. Executor: creatinine `1` `mg/dL` gives `88.4` `umol/L` (hand-calculated); glucose `5` `mmol/L` gives `90.08` `mg/dL` (compare within 1e-9).
7. Executor: a value already in the target unit is returned unchanged; creatinine in `mmol/L` is refused X-010 with no value (never guessed).
8. Executor: creatinine `absent` gives `indeterminate`; glucose `absent` gives `needs-data`; neither gives zero.

**Done when:** `node --test test/ccis-unit-conversions.test.js` passes (new file only). Two breakages seen failing, then restored: (a) change `88.4` in the file (cases 2 and 6 fail); (b) remove the `x-note` from `mmolLToMgdL` (case 5 fails).

**Size guard:** 1 JSON (expect about 29 KB; stop past 34 KB), 1 test (8 cases), 1 doc edit. No module change. If an executor quantity value needs a shape not shown in `ccis-exec.js` `readValue`, say so and drop cases 6 to 8 instead of guessing.

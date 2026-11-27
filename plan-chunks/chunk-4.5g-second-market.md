# Chunk 4.5g: second demo 7: the diabetes and CKD market folder (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.5a to 4.5f (done). Row 4.5g was split by rule 12 (D-303): this row builds the market folder only; page selection is 4.5g.1 and the real-Chrome smoke is 4.5g.2._

**Core rules:** attach `01-core.md` too.

**Read only (3 files):** `scripts/market-build.js` (whole, 3.5 KB); `ccis-market.js` lines 26 and 144-175 only (`PUBLISHABLE_TYPES`, `publishArtefact`); `test/ccis-market.test.js` lines 1-20 and 95-110 only (it imports `buildMarket`, `main` and `ORDER` from the script, so keep those exports and the default behaviour unchanged).

## What this row is for
`market/` holds the snake demo and stays byte-for-byte as it is: about ten tests pin it. The diabetes and CKD demo gets its **own folder**, `market-diabetes-ckd/`, which a user picks with the same folder input. A probe on 2026-11-27 showed that six artefacts publish cleanly with the ten-case fixture list (both elements, analytics 0.1.0 to 0.1.3). The group file does **not** publish: the market accepts only elements, analytics packages and pathways (M-002), and its screen flags `/members` (L-002). That is a limit, not a bug: the group is a design artefact, shown in docs only. Do not widen `PUBLISHABLE_TYPES` here.

## Build (0 new modules, 1 test, 1 script edit, generated files)
1. `scripts/market-build.js`: a `SETS` table with two entries, `snake` (current `ORDER`, `FIX`, `market/`) and `diabetes-ckd`. `buildMarket(set = 'snake')` returns the same bytes as today for `snake`. `diabetes-ckd` order: `diabetes.element.json`, `ckd.element.json`, then the four `diabetes-ckd.sample-gap.analytics*.json` files by version; examples from `ccis/examples/diabetes-ckd/`, fixtures names from `ccis/fixtures/diabetes-ckd/index.json`, output `market-diabetes-ckd/`.
2. CLI: `--set diabetes-ckd` (default `snake`), still with `--check`. An unknown set name exits non-zero with one fixed line. No new dependency.
3. Run `node scripts/market-build.js --set diabetes-ckd`; commit `market-diabetes-ckd/` including a `.gitattributes` holding `* -text` (as `market/` has; line endings change checksums, M-010).
4. No `ci.yml` change: CI has no market check today (the old market is guarded by `test/ccis-market.test.js`); the new test is the guard.

## Test: `test/ccis-market-diabetes-ckd.test.js` (at most 8 cases)
1. The set builds: six index entries, ids and versions as listed, all `outcome: passed`, status `draft`.
2. The committed folder equals a fresh build (`--check` logic, in memory).
3. `loadMarket` accepts the committed folder, and the pinned checksums resolve each analytics version.
4. The default (`snake`) build still equals the committed `market/` (the old market is untouched).
5. The group file is refused with M-002 or M-004 (pins the documented limit).
6. Both elements are referenced by every analytics version, and 0.1.3 lists the two unit conversions (read from the index, no recomputing).
7. Unknown `--set` name refuses; the folder holds no patient identifiers (the screen passes).
8. No clock, network or random call in the script (source scan).

**Done when:** the new test and `test/ccis-market.test.js` pass (2 files; never the full suite). Two breakages each seen failing, then restored: (a) change one byte in a committed artefact; (b) swap the two elements in `ORDER`.

**Size guard:** 1 script edit (about 25 lines), 1 test, about 8 generated files. If the snake output changes by even one byte, or any old test needs editing, STOP and split. Add `docs/USE-CASE-DIABETES-CKD.md` section 2g (3 lines: folder name, six entries, group not published).

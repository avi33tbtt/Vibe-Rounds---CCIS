# Chunk 3.8c.2: wire the selector into the page (no new module)

_Phase 3, Stage 2. Needs: 3.8c.1 (done). No schema change, no core module change._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app.js` (1.7 KB, whole), `ccis-app.template.html` (0.8 KB, whole), `ccis-app-import-view.js` lines 31-55 (`state`, `stop`, `show`), `test/ccis-app-import-wire.test.js` lines 9-42 (the jsdom page helpers: `page`, `until`, `pickMarket`, `pickEnvelope`, `plain`). Do not read `scripts/build-app.js`; run `node scripts/build-app.js` to rebuild. Decisions D-148, D-153, D-155, D-157, D-158.

## What this row is for

The page gets a Choose section under Import. The selector follows the market it was drawn from: loading, clearing or replacing the market empties the selection. The import tells the selector which artefacts it applied, so the options can say "(applied by import)". Choosing runs nothing.

## Build (0 new modules, 1 test, 4 small edits, rebuild)

1. `ccis-app-import-view.js`: the `state` defaults gain `applied: []`, and `show` passes `applied: v.applied` (the id, type, version, held list already in the view model; no values). Nothing else changes. `importState()` stays six keys because `ccis-app.js` copies only the keys of its own `imp` object.
2. `ccis-app.js`: add `const sel = { contextChosen: false, pathwayChosen: false, mismatch: false, ready: false }`. Mount the selector on `#select` BEFORE the import and market views, with an `onState` that copies those four booleans into `sel` and does NOT call `setStatus` (so the market message wins, D-153). The import `onState` also calls `selectorView.setImport(s.applied)`. The market `onState` calls `selectorView.setMarket(market)` after `importView.reset()` and before `setStatus`. Guard each call for a missing root. Add `window.ccisApp.selectorState()` returning `{ ...sel }`. The market and the selector model stay in the closure, never on `window.ccisApp`. `state()` and `importState()` keep their keys.
3. `ccis-app.template.html`: add `<section id="select"></section>` after `#import`. CSS is unchanged.
4. Run `node scripts/build-app.js` and commit the rebuilt `index.html`.
5. New `test/ccis-app-selector-wire.test.js`, at most 8 cases, jsdom over the committed `index.html` with scripts run (helpers from `ccis-app-import-wire.test.js`):
   - Fresh page: `#select` holds two disabled selects; `selectorState()` is all false.
   - Load the committed `market/`: both selects are enabled with one option beyond the placeholder; the status still starts "Market loaded".
   - Choose both: `selectorState().ready` is true and the status line is unchanged by choosing.
   - Import `boundary-01-edge-inside.envelope.json`: an option reads "(applied by import)" exactly when the pure `importEnvelope` with `heldFromMarket` names it in `appliedVersions` (computed in the test); the selection survives; Clear on the import removes the marks and keeps the selection.
   - Clearing the market, and replacing it with a refused one (one changed byte), each empty the selection and disable the selects; the status starts "Ready." after a Clear.
   - Seams: `state()` has four keys, `importState()` six, `selectorState()` four booleans; their JSON holds no market string and no id; no `on*` attribute on any element after choosing.
   - No storage, network, `innerHTML` or inline handlers in `ccis-app.js` and `ccis-app-import-view.js`.
6. `DECISIONS.md`: one row at most. Tracker: 3.8c.2 done; next is 3.8d (chunk file first).

**Not in this row:** the catalogue, compatibility, any run, any results display, CSP changes.

**Done when:** the new test file, `ccis-app-build.test.js` and `ccis-app-import-view.test.js` pass (the third because step 1 edits its module; if it fails only on the new `applied` key, add that key to the one assertion, nothing more), and two breakages are each seen failing (not calling `setMarket` when the market clears; not passing `applied` from the import view). Run only those three files.

**Size guard:** 0 new modules, 1 test, 4 small edits, 1 generated page.

# Chunk 3.8b.2: wire the import view into the page (no new module)

_Phase 3, Stage 2. Needs: 3.8b.1 (done). No schema change, no core module change._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app.js` (958 bytes, whole), `ccis-app.template.html` (whole, 725 bytes), `ccis-app-market-view.js` lines 38-48 (`report`, `showMarket`) and 86-98 (Clear), `test/ccis-app-market.test.js` lines 98-118 (the jsdom page pattern: `fake`, `until`, `pick`, `page`). Do not read `scripts/build-app.js`; run `node scripts/build-app.js` to rebuild. Decisions D-146, D-148, D-152.

## What this row is for

The page gets an Import section under Market. An envelope is imported only against the market that is loaded now. Clearing or replacing the market clears the import, so a report never outlives the market it was checked against.

## Build (0 new modules, 1 test, 4 small edits, rebuild)

1. `ccis-app-market-view.js`: `report` also passes the loaded `market` object to `onState` (`market` is `null` for Clear and refusal). Nothing else changes in the file.
2. `ccis-app-import-view.js`: `mountImportView` returns `{ reset }`. `reset()` does what Clear does (bump `ticket`, empty input and box, `state({})`). Clear calls it.
3. `ccis-app.js`: keep `let market = null` in the module closure, never on `app` and never on `window.ccisApp`. The market `onState` stores `s.market`, then calls `importView.reset()` BEFORE `setStatus`, so the market message wins. Mount the import view on `#import` with `getMarket: () => market`. Its `onState` keeps booleans and counts and calls `setStatus`. Add `window.ccisApp.importState()` returning `{ imported, refused, accepted, rejected, unmapped, ambiguous }` (counts and booleans only). `state()` keeps exactly its four keys (D-148), so no existing test changes.
4. `ccis-app.template.html`: add `<section id="import"></section>` after `#market`. CSS is unchanged.
5. Run `node scripts/build-app.js` and commit the rebuilt `index.html`.
6. New `test/ccis-app-import-wire.test.js`, at most 8 cases, jsdom over the committed `index.html` with scripts run (pattern from `ccis-app-market.test.js`):
   - Picking a snake envelope with no market shows the fixed "Load a market first" sentence and `importState().imported` is false.
   - Load the committed `market/` folder, then pick `ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json`: the report shows, `importState()` counts equal those of `importEnvelope` with `heldFromMarket`.
   - Clearing the market empties the import report and resets `importState()`; the status line starts with "Ready.".
   - Replacing the market with a refused one (one changed byte) also clears the import report.
   - `Object.keys(w.ccisApp.state())` is still the four keys; `JSON.stringify` of both states holds no market string.
   - No storage, no network, no `innerHTML`, no inline handlers in `ccis-app-import-view.js` and `ccis-app.js`; no `on*` attribute on any element of the page after an import.
   - The existing `ccis-app-build.test.js` checks (hash, CSP) pass on the rebuilt page.
7. `DECISIONS.md`: D-153 (`importState()` is a separate seam so `state()` keeps its keys). Tracker: 3.8b.2 done; next is 3.8c (chunk file first).

**Not in this row:** the context and pathway selector, the catalogue, any run, any results display, CSP changes.

**Done when:** the new test file and `ccis-app-build.test.js` pass, and two breakages are each seen failing (not resetting the import when the market clears; putting the market on `window.ccisApp`). Run only those two files.

**Size guard:** 0 new modules, 1 test, 4 small edits, 1 generated page.

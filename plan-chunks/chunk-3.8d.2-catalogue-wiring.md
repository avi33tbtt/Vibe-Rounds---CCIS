# Chunk 3.8d.2: wire the catalogue into the page (no new module)

_Phase 3, Stage 2. Needs: 3.8d.1 (done). No schema change, no core module change._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app.js` (2.5 KB, whole), `ccis-app-import-view.js` lines 36-42 (`ticket`, `stop`) and 86-101 (the change handler end, `reset`, the return), `ccis-app-selector-view.js` lines 85-110 (`api`), `test/ccis-app-selector-wire.test.js` lines 9-50 (the jsdom page helpers). Do not read `scripts/build-app.js`; run `node scripts/build-app.js` to rebuild. Decisions D-153, D-159, D-161 to D-164.

## What this row is for

The page gets a Compatibility section under Choose. It shows the result for the chosen pathway against the imported context, or the fixed sentence "Load a market first." or "Choose a pathway first." With no import the context is null, so the packages show as Needs data (the catalogue view, D-112). Nothing runs. The imported context stays in the closure of `ccis-app.js` behind a getter; it is never on `window.ccisApp`.

## Build (0 new modules, 1 test, 5 small edits, rebuild)

1. `ccis-app-import-view.js`: keep `let lastContext = null` in the closure. In the change handler, take the import result in a variable, set `lastContext = result.ok === true && result.context ? result.context : null` BEFORE `show(...)`. `stop` and `reset` set it to `null` before they call `state`. `mountImportView` returns `{ reset, getContext: () => lastContext }`.
2. `ccis-app-selector-view.js`: the returned `api` gains `selectedPathwayKey: () => selection.pathwayKey`. Nothing else changes (the state stays booleans only).
3. `ccis-app.js`: declare `let catalogueView = null` and `const cat = { shown: false, rows: 0, needsData: 0, incompatible: 0, other: 0 }` before anything is mounted (the selector calls back at mount). Mount `mountCatalogueView` on `#compat` with an `onState` that copies the five keys into `cat` and does not call `setStatus`. Add `refreshCatalogue()`: `compatibilityFor({ market, pathwayKey: selectorView?.selectedPathwayKey() ?? null, context: importView?.getContext() ?? null })`, then `showResult` or `showSentence`; do nothing while `catalogueView` is null. Call it at the end of the selector `onState`, the import `onState` and the market `onState` (before `setStatus`). Add `window.ccisApp.catalogueState()` returning `{ ...cat }`. Neither the context nor the model goes on `window`.
4. `ccis-app.template.html`: add `<section id="compat"></section>` after `#select`. CSS is unchanged.
5. `test/ccis-app-import-wire.test.js` line 91: the sorted key list gains `catalogueState` (the one stale assertion, as in D-160). Nothing else in that file changes.
6. Run `node scripts/build-app.js` and commit the rebuilt `index.html`. If the build reports a `node:` import, or the page grows by more than 1 MB, STOP and report: that is a split point (add a row), not a defect to patch here.
7. New `test/ccis-app-selector-wire.test.js`-style file `test/ccis-app-catalogue-wire.test.js`, at most 8 cases, jsdom over the committed `index.html` with scripts run (helpers from `ccis-app-selector-wire.test.js`):
   - Fresh page: `#compat` shows "Load a market first."; `catalogueState().shown` is false.
   - With the market loaded and no pathway: "Choose a pathway first.".
   - Choosing the pathway with no import: the result shows, the two packages under "Needs data", and `catalogueState()` has `shown` true and `needsData` 2.
   - After importing `boundary-01-edge-inside.envelope.json`, the headings and the count line equal those drawn from `compatibilityFor` with the context from the pure `importEnvelope` (computed in the test).
   - Clearing the import (its Clear button) returns the view to the no-context result.
   - Clearing the market, and replacing it with a refused one, each give "Load a market first." and `shown` false.
   - Seams: the sorted keys of `window.ccisApp` are `catalogueState`, `checksumOf`, `importState`, `selectorState`, `state`; `catalogueState()` holds only a boolean and counts; the JSON of all four state seams holds no market string and no string from the context; no `on*` attribute on any element.
   - No storage, network, `innerHTML` or inline handlers in `ccis-app.js`, `ccis-app-import-view.js` and `ccis-app-selector-view.js`.
8. `DECISIONS.md`: one row at most. Tracker: 3.8d.2 done; next is 3.9 (chunk file first).

**Not in this row:** any run, any results display, CSP changes, a change to the catalogue model or view.

**Done when:** the new test, `ccis-app-build.test.js`, `ccis-app-import-wire.test.js`, `ccis-app-selector-wire.test.js` and `ccis-app-import-view.test.js` pass, and two breakages are each seen failing (the import `onState` not refreshing the catalogue; `reset` not clearing `lastContext`). Run only those five files.

**Size guard:** 0 new modules, 1 test, 5 small edits, 1 generated page. If it will not fit, split off steps 1-2 as their own row first.

# Chunk 3.9.1a: wire the run view into the page (no new module)

_Phase 3, Stage 2. Needs: 3.9.1 (done). No schema change, no core module change._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app.js` (whole), `ccis-app-import-view.js` lines 36-42 and 90-106, `ccis-app-run-view.js` lines 1-12 and 60-90 (mount signature, `run` and `onRun`), `test/ccis-app-catalogue-wire.test.js` lines 1-60 (jsdom helpers). Do not read `scripts/build-app.js`. Decisions D-153, D-165, D-167 to D-170.

## What this row is for

The page gets a Run section after Compatibility. The person ticks packages, types an evaluation time and presses Run; the page runs `runForPage` and shows the status line and counts. The record is kept in the closure of `ccis-app.js` for row 3.9a (results display) and never goes on `window`. No results are drawn here.

## Build (0 new modules, 1 test, small edits, rebuild)

1. `ccis-app-import-view.js`: keep `let lastResult = null` beside `lastContext`. In the change handler set `lastResult = result` (the whole `importEnvelope` result, refused or not) before `show(...)`. `stop` and `reset` set it to `null`. The return gains `getResult: () => lastResult`.
2. `ccis-app.js`: import `mountRunView`, `runForPage`, `catalogueModel`. Declare `let runView = null`, `let lastRecord = null`, `let lastSkipped = []` and `const run = { ready: false, selected: 0, ran: false, failed: false, results: 0, skipped: 0, refused: false }` before anything is mounted (the other views call back at mount). Mount the run view on `#run` first of all views: `run` is `(a) => runForPage({ market, pathwayKey: selectorView?.selectedPathwayKey() ?? null, importResult: importView?.getResult() ?? null, supplied: {}, evaluationTime: a.evaluationTime, runNeedsData: a.runNeedsData, only: a.only })`, `onRun` keeps the record and skipped list in the two variables, `onState` copies the seven keys into `run` and does not call `setStatus`.
3. `ccis-app.js`: add `refreshRun()`: set `lastRecord = null` and `lastSkipped = []` (a changed market, import or choice never leaves a stale record), build the rows from `compatibilityFor` (the same call as `refreshCatalogue`; when `ok`, `catalogueModel(result.result).rows` filtered to `kind === 'analytics-package'`, mapped to `{ id, version, label, mayRun }`, else `[]`), call `runView.setChoices(rows)` then `runView.setReady(rows.length > 0 && importView?.getResult() != null)`. Do nothing while `runView` is null. Call it at the end of `refreshCatalogue`. Add `window.ccisApp.runState()` returning `{ ...run }`. The market, context, import result, record and rows never go on `window`.
4. `ccis-app.template.html`: add `<section id="run"></section>` after `#compat`. CSS is unchanged.
5. The two stale key lists (`test/ccis-app-import-wire.test.js` line 91 and `test/ccis-app-catalogue-wire.test.js` line 135) gain `runState` in sorted position. Nothing else in those files changes.
6. Run `node scripts/build-app.js` and commit the rebuilt `index.html`. If the build reports a `node:` import, or the page grows by more than 1 MB, STOP and report: that is a split point, not a defect to patch here.
7. New `test/ccis-app-run-wire.test.js`, at most 8 cases, jsdom over the committed `index.html` with scripts run (helpers as in the catalogue wire test), real `market/` and `boundary-01-edge-inside.envelope.json`:
   - Fresh page: Run is disabled and the not-ready sentence shows; `runState().ready` is false.
   - Market, pathway and import give two ticked boxes; with a typed time, Run gives "Run complete: 8 results, 0 skipped." and `runState()` has `ran` true and `results` 8.
   - Unticking one package gives fewer results.
   - Choosing another pathway, clearing the import, or clearing the market resets `runState()` to the empty state.
   - Seams: the sorted keys of `window.ccisApp` are `catalogueState`, `checksumOf`, `importState`, `runState`, `selectorState`, `state`; `runState()` holds only booleans and counts; the JSON of all five state seams holds neither a market string, a context string nor the typed time; no `on*` attribute on any element.
   - The record is not reachable: no own property of `window.ccisApp` or `window` returns a value with `results`.
   - No storage, network, clock, `innerHTML` or inline handlers in `ccis-app.js` and `ccis-app-import-view.js`.
8. `DECISIONS.md`: one row at most. Tracker: 3.9.1a done; next is 3.9a (chunk file first).

**Not in this row:** any results display, export, CSP change, a change to the run view, the adapter or the catalogue.

**Done when:** the new test, `ccis-app-build.test.js`, `ccis-app-import-wire.test.js`, `ccis-app-catalogue-wire.test.js` and `ccis-app-run-view.test.js` pass, and two breakages are each seen failing (`refreshRun` not clearing `lastRecord`; `getResult` returning the context instead of the result). Run only those five files.

**Size guard:** 0 new modules, 1 test, 5 small edits, 1 generated page. If it will not fit, split steps 1 and 5 into their own row first.

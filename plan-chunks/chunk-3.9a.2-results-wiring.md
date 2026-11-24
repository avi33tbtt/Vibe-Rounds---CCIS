# Chunk 3.9a.2: wire the results view into the page (no new module)

_Phase 3, Stage 2. Needs: 3.9a.1 (done). No schema change, no core module change._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app.js` lines 14-60 and 117-125 (closure state, `refreshRun`, run mount, seam), `ccis-app-run-view.js` lines 60-90 (when `onRun` fires), `test/ccis-app-run-wire.test.js` lines 1-52 (jsdom helpers, `EMPTY`). Do not read `scripts/build-app.js`. Decisions D-171, D-172, D-173 to D-175.

## What this row is for

After a run, the page draws the results under the Run section. A changed market, import or pathway choice clears the drawing (never a stale result). The record stays in the closure of `ccis-app.js`; the view gets it only as an argument to `show`.

## Build (0 new modules, 1 test, 4 small edits, rebuild)

1. `ccis-app.js`: import `mountResultsView`. Declare `let resultsView = null` and `const results = { shown: false, state: 'none', groups: 0, items: 0, trace: 0, missing: 0 }` beside `runView`, before any mount. Mount the results view on `#results` right after the run view, with `onState: (s) => { for (const k of Object.keys(results)) results[k] = s[k]; }` (it never calls `setStatus`).
2. `ccis-app.js`: in the run mount, `onRun` also calls `resultsView?.show({ ok: true, record, skipped })` after it keeps the two variables. In `refreshRun`, after the two clears, call `resultsView?.reset()`.
3. `ccis-app.js`: add `resultsState: () => ({ ...results })` to `window.ccisApp`. Record, skipped list and rows never go on `window`.
4. `ccis-app.template.html`: add `<section id="results"></section>` after `#run`. CSS unchanged.
5. The three stale key lists (`test/ccis-app-import-wire.test.js` line 91, `test/ccis-app-catalogue-wire.test.js` line 135, `test/ccis-app-run-wire.test.js` line 100) gain `resultsState` in sorted position (after `importState`). Nothing else in those files changes.
6. Run `node scripts/build-app.js` and commit the rebuilt `index.html`. If the build reports a `node:` import, or the page grows by more than 1 MB (now 1.33 MB), STOP and report: that is a split point.
7. New `test/ccis-app-results-wire.test.js`, at most 8 cases, jsdom over the committed `index.html` with scripts run (helpers as in the run wire test), real `market/` and `boundary-01-edge-inside.envelope.json`:
   - Fresh page: "No run yet." shows; `resultsState()` is the empty state.
   - After market, pathway, import and Run: the text "Run complete:" shows under `#results`, one `h3` per analytic, and `resultsState()` has `shown` true, `state` 'completed', counts above 0.
   - A second run with one package unticked changes the item count.
   - Choosing another pathway, clearing the import and clearing the market each bring back "No run yet." and the empty state.
   - A run on `missing-01-no-bite-time` shows the Missing section open with "needs-data".
   - Seams: sorted keys of `window.ccisApp` are `catalogueState`, `checksumOf`, `importState`, `resultsState`, `runState`, `selectorState`, `state`; `resultsState()` holds only booleans, 'none' or 'completed', and counts; the JSON of all six state seams holds no checksum, record id or typed time; no `on*` attribute on any element.
   - The record is not reachable: no own property of `window.ccisApp` or `window` returns a value with `results`.
   - No storage, network, clock, `innerHTML` or inline handlers in `ccis-app.js`.
8. `DECISIONS.md`: one row at most. Tracker: 3.9a.2 done; next is 3.9b (chunk file first).

**Not in this row:** export, CSP change, any change to the results model, results view, run view or adapter.

**Done when:** the new test, `ccis-app-build.test.js`, the three existing wire tests and `ccis-app-results-view.test.js` pass, and two breakages are each seen failing (`resultsView.reset()` removed from `refreshRun`, so the drawing stays after a clear; `onRun` not calling `show`). Run only those six files.

**Size guard:** 0 new modules, 1 test, 4 small edits, 1 generated page. If it will not fit, split step 5 into its own row first.

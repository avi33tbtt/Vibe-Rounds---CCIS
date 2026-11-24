# Chunk 3.9b.2: wire the export view into the page, with the real download (no new module)

_Phase 3, Stage 2. Needs: 3.9b.1 (done). No schema change, no core module change._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app.js` lines 11-36, 56-75 and 128-140 (imports, closure state, `refreshRun`, run and results mounts, seam), `test/ccis-app-results-wire.test.js` lines 1-52 and 98-125 (jsdom helpers, key list). Do not read `scripts/build-app.js`. Decisions D-172, D-176, D-177, D-179 to D-181.

## What this row is for

After a run, the page offers "Download run record" under the results. The person gets the canonical record file. A changed market, import or choice clears the offer. The record stays in the closure; the view receives it only as an argument to `show`.

## Build (0 new modules, 1 test, 5 small edits, rebuild)

1. `ccis-app.js`: import `mountExportView`. Declare `let exportView = null` and `const exported = { shown: false, verified: false, saved: false }` beside `resultsView`, before any mount. Add `savePage({ filename, text })`: make a `Blob` of `text` (type `application/json`), `URL.createObjectURL` it, create an `a` with that `href` and `download = filename`, click it, then `URL.revokeObjectURL`. Return `true`; let a failure throw (the view words it). This is the only place in the bundle that uses `Blob` or `URL`; 3.10 must allow-list it by name.
2. `ccis-app.js`: mount the export view on `#export` right after the results view, `onState: (s) => { for (const k of Object.keys(exported)) exported[k] = s[k]; }`, `save: savePage`. It never calls `setStatus`.
3. `ccis-app.js`: `onRun` also calls `exportView?.show(record)`. `refreshRun` also calls `exportView?.reset()` beside `resultsView?.reset()`. Add `exportState: () => ({ ...exported })` to `window.ccisApp`. Record, text and filename never go on `window`.
4. `ccis-app.template.html`: add `<section id="export"></section>` after `#results`. CSS unchanged.
5. The four stale key lists (`test/ccis-app-import-wire.test.js` line 91, `ccis-app-catalogue-wire.test.js` line 135, `ccis-app-run-wire.test.js` line 100, `ccis-app-results-wire.test.js` line 113) gain `exportState` between `checksumOf` and `importState`. Nothing else in those files changes.
6. Run `node scripts/build-app.js` and commit the rebuilt `index.html`. If the build reports a `node:` import, or the page grows by more than 1 MB (now 1.34 MB), STOP and report.
7. New `test/ccis-app-export-wire.test.js`, at most 8 cases, jsdom over the committed `index.html` with scripts run (helpers as in the results wire test). `beforeParse` stubs `URL.createObjectURL` (keeps the Blob) and `URL.revokeObjectURL`, and patches `HTMLAnchorElement.prototype.click` to record `download` and `href`; the Blob is read back with `FileReader`:
   - Fresh page: "Nothing to export yet." shows; `exportState()` is all false.
   - After market, pathway, import, time and Run: the verified sentence and one Download button show; `exportState()` is `{ shown: true, verified: true, saved: false }`.
   - Click: one anchor click with `download` equal to `run-<64 hex>.json`; the Blob text ends with a newline, parses, and `JSON.parse` of it has `status: 'completed'`; `exportState().saved` is true; the revoke ran.
   - A throwing `createObjectURL` gives "The file could not be saved." and `saved` false.
   - Choosing another pathway, clearing the import and clearing the market each bring back the empty state and the start sentence.
   - Seams: sorted keys of `window.ccisApp` are `catalogueState`, `checksumOf`, `exportState`, `importState`, `resultsState`, `runState`, `selectorState`, `state`; `exportState()` holds only booleans; the JSON of all seven state seams holds no checksum, record id, file name or typed time; no `on*` attribute.
   - The record and text are not reachable: no own property of `window.ccisApp` or `window` returns a value with `results` or holds the Blob text.
   - `ccis-app.js` has no storage, network, clock, `innerHTML` or inline handler; `Blob` and `URL` appear only in `ccis-app.js`, never in a view or model file.
8. `DECISIONS.md`: one row at most. Tracker: 3.9b.2 done; next is 3.10 (chunk file first).

**Not in this row:** CSP, the bundle-wide scan (3.10), any change to the export model, view or earlier views.

**Done when:** the new test, `ccis-app-build.test.js`, the four existing wire tests and `ccis-app-export-view.test.js` pass, and two breakages are each seen failing (`exportView.reset()` removed from `refreshRun`; `savePage` setting `download` to a fixed name). Run only those seven files.

**Size guard:** 0 new modules, 1 test, 5 small edits, 1 generated page. If it will not fit, split step 5 into its own row first.

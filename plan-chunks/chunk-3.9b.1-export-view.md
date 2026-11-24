# Chunk 3.9b.1: export view (module and jsdom test only, not wired)

_Phase 3, Stage 2. Needs: 3.9b (done). No schema change, no core module change. Wiring and the real file save are the new row 3.9b.2 (D-181)._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app-results-view.js` lines 1-30 and 95-115 (element helper, `state`, `reset`), `ccis-app-export.js` lines 20-60 (model shape), `test/ccis-app-results-view.test.js` lines 1-25 (jsdom helper). Decisions D-063, D-179, D-180.

## What this row is for

A small view that shows, for one run record, the verification line, the notices, the file name, size and checksum, and a "Download run record" button. The view never touches `Blob`, `URL` or a link: saving is a function the page hands in (`save`), so the view stays testable and the browser-only part lands in row 3.9b.2.

## Build (1 new module, 1 test, 0 edits)

`ccis-app-export-view.js`: `mountExportView({ document, root, onState, save })` returns `{ show(record), reset() }`.

- `createElement` and `textContent` only, no `innerHTML`, no inline handlers (the button uses `addEventListener`), no storage, no network, no clock. Body has `aria-live="polite"`; the root gets an `h2` "Export".
- `reset()`: "Nothing to export yet." (muted) and `onState({ shown: false, verified: false, saved: false })`.
- `show(record)`: `exportModel(record)`. Not ok: the model's sentence as a refusal paragraph, no button, state as in `reset`. Ok, in order: the verification line (class `refusal` when not verified); each notice (muted); "File: NAME. SIZE bytes. Checksum: CHECKSUM."; the button "Download run record". State `{ shown: true, verified, saved: false }`.
- Click: call `save({ filename, text })` inside try. A normal return gives "Saved as NAME." (live status, replaces the previous status) and `saved: true`. A throw, or a return of `false`, gives "The file could not be saved." and `saved: false`. The text is held in the view's closure only; it never appears in the DOM or in `onState`.
- If `save` is not a function the button is disabled and the sentence "Saving is not available here." shows.
- A new `show` or `reset` replaces everything, including the status.

**Not in this row:** `Blob`, `URL.createObjectURL`, any anchor or download attribute (3.9b.2), wiring, CSP, a change to the export model.

**Test (`test/ccis-app-export-view.test.js`, at most 8 cases):** jsdom, real `market/`, a real record from `runForPage` as in the 3.9b test, `save` a spy.
- start state shows "Nothing to export yet." and a not-shown state.
- `show` draws the verified sentence, the snapshot notice, the file line with the record id, and one button.
- click calls `save` once with exactly the model's filename and text, shows "Saved as ...", and `onState` says saved.
- `save` throwing, and `save` returning false, each show "The file could not be saved." and `saved` false.
- a failed show (`null`) gives "No run to export." and no button; `reset` after a show removes the button.
- the DOM text holds no snapshot or observation text, and `onState` holds only booleans (JSON has no checksum or id).
- no `save` function: the button is disabled and the sentence shows.
- source scan: no `innerHTML`, `Blob`, `URL`, `createObjectURL`, `fetch`, `localStorage`, `Date`, `onclick`, `eval`.

**Done when:** the new test passes (run only that file) and two breakages are each seen failing (`save` called with the record object instead of the text; the button left enabled without `save`).

**Size guard:** 1 module, 1 test, 0 edits. If it will not fit, split the status handling into 3.9b.0.

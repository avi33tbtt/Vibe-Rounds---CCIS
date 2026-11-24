# Chunk 3.9a.1: results view (module and jsdom test only, not wired)

_Phase 3, Stage 2. Needs: 3.9a (done). No schema change, no core module change. Wiring is the new row 3.9a.2 (D-175)._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app-catalogue-view.js` lines 1-45 (element helper, `state`, `reset`), `ccis-app-results.js` lines 36-50 and 95-125 (model shape), `test/ccis-app-catalogue-view.test.js` lines 1-30 (jsdom helper). Decisions D-063, D-173, D-174.

## What this row is for

A view draws the output of `resultsModel` into a root element: headline, scope, results by analytic, decision path, missing, limitations, provenance. It is mounted and tested alone. The page does not know it yet.

## Build (1 new module, 1 test, 0 edits)

`ccis-app-results-view.js`: `mountResultsView({ document, root, onState })` returns `{ show(run), reset() }`.

- Same pattern as the catalogue view: `createElement` and `textContent` only, no `innerHTML`, no inline handlers, no storage, no network, no clock. The body has `aria-live="polite"`; the root gets an `h2` "Results".
- `reset()` shows "No run yet." (muted) and calls `onState({ shown: false, state: 'none', groups: 0, items: 0, trace: 0, missing: 0 })`. It is the starting state.
- `show(run)` calls `resultsModel(run)`. State `none` or `failed`: show the model's headline as one refusal paragraph, and nothing else except the limitations list. Otherwise draw, in this order:
  1. headline, then the scope line ("Pathway P. Analytics A, B. Evaluation time T."), then `testOnlyNote` when present (refusal class).
  2. one `h3` per group (the analytic) and a list of its items: `outputId: display`. A table `display` becomes a real `table` (`th` columns, `td` cells, text only, capped at 50 rows with "and N more"). Item warnings, limitations and missingDataNotes sit under the item as small lists.
  3. `details` "Decision path": one entry per trace node, `node`, then each input `key: state (records)` and the outcomes (`id matched or not matched`), then `takenText`. Closed by default, capped at 100 nodes with "and N more".
  4. "Missing": the `missing` rows (`id version: reason`) or `missingNote`. Open by default when not empty.
  5. "Limitations": the list.
  6. `details` "Provenance": id, standard, engine, operator set, three checksums, as text.
- `onState` after `show` carries only booleans and counts: `{ shown: true, state, groups, items, trace, missing }`. Never a value, id or checksum.

**Not in this row:** wiring, export, CSP change, any change to the model, adapter or page.

**Test (`test/ccis-app-results-view.test.js`, at most 8 cases):** jsdom with the real `market/` and a real record composed through `runForPage` as in the 3.9a test.
- start state shows "No run yet." and a not-shown state.
- a completed run draws the headline, one `h3` per group, and the value text "N min" for a known value.
- a failed record shows its sentence and no group.
- a hand-built table result draws a real `table`, and 60 rows give "and 10 more".
- a trace node with `taken: null` shows "No outcome matched (indeterminate)."; the decision path is closed, the missing list open when not empty.
- hostile text (`<img src=x onerror=1>` as an id, label and display) appears as text and creates no `img` or `on*` attribute.
- `onState` holds only booleans and counts (JSON has no checksum, id or value).
- source scan: no `innerHTML`, `eval`, `fetch`, `localStorage`, `Date`, `onclick`.

**Done when:** the new test passes (run only that file) and two breakages are each seen failing (a table cell set with `innerHTML`; the decision path opened by default).

**Size guard:** 1 module, 1 test, 0 edits. If it will not fit, split the trace and provenance drawing into 3.9a.0.

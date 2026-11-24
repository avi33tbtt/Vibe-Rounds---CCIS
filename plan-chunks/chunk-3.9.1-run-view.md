# Chunk 3.9.1: run view (module and jsdom test only, not wired) and the `only` filter

_Phase 3, Stage 2. Needs: 3.9 (done). No schema change. 3.9.1 is split: this row is the view and one small edit to the adapter; wiring is new row 3.9.1a (D-169)._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app-run.js` (4 KB, whole), `ccis-app-catalogue-view.js` lines 1-30 (the `el` helper and mount pattern), `test/ccis-app-catalogue-view.test.js` lines 1-30 (the jsdom helpers). At most 4 files. Decisions D-132, D-133, D-167, D-168, D-169.

## What this row is for

The person picks which analytics packages to run, whether to also run items that need data, and types an evaluation time, then presses Run. This row builds that control as a view that is tested alone. It shows a status sentence and counts only; results are drawn in 3.9a. The view never reads a clock: the time is typed.

## Build (1 new module, 1 test, 1 small edit)

1. `ccis-app-run.js`: `runForPage` gains an optional `only` (array of analytic ids). When given, keep only the pathway analytics whose `ref.id` is listed; if none is left, return the fixed sentence "Choose at least one package." (added to `RUN_SENTENCES`). Absent `only` keeps today's behaviour. Nothing else changes.
2. New `ccis-app-run-view.js`, exporting `mountRunView({ document, root, onState, run, onRun })`. Elements by `createElement` and `textContent` only; no inline handlers, storage, network or `innerHTML`.
   - Heading "Run". A checkbox list, an "Also run items that need data" checkbox, a text input "Evaluation time (for example 2026-01-01T00:00:00Z)", a Run button, a Clear button, a status line (`aria-live`).
   - `setChoices(rows)`: rows are `{ id, version, label, mayRun }` for analytics packages (the page builds them from the catalogue rows in 3.9.1a). A row with `mayRun` false is unticked; every ticked-by-default row can be unticked. Replaces the list and clears any earlier status.
   - `setReady(boolean)`: false (no market, pathway or import) disables Run and shows "Load a market, choose a pathway and import an envelope first."
   - Run is enabled only when ready, at least one box is ticked and the time field is not empty. On click it calls `run({ only, runNeedsData, evaluationTime })` (the page supplies it) and shows: the returned sentence in `p.refusal` when `ok` is false; otherwise "Run complete: N results, M skipped." (`failed` records read "The run failed: the import was refused.", no counts invented). On `ok` it also calls `onRun(record, skipped)` so the page can hold the record. The view keeps no record.
   - `reset()`: empties the time field and status, keeps the choices, calls `onState` with the empty state.
   - `onState` receives `{ ready, selected, ran, failed, results, skipped, refused }`: booleans and counts only, never an id, a time or a record.
3. New `test/ccis-app-run-view.test.js`, at most 8 cases, jsdom over a bare `<div>` (helpers as in the catalogue view test), a stub `run`:
   - Mounts with the heading, Run disabled; `setReady(false)` shows the fixed sentence.
   - Run enables only with ready, one ticked box and a time; unticking all disables it.
   - `run` gets exactly the ticked ids, the needs-data flag and the typed time; the time is not trimmed to a different value.
   - A refusal shows its sentence and no count line; `onRun` is not called.
   - A completed result shows the counts; a failed record shows the failure sentence.
   - `reset` and `setChoices` clear the status; the state holds only booleans and counts.
   - Real adapter: `runForPage` with `only` of one id gives fewer results and another id than without; an empty `only` gives the fixed sentence.
   - Source: no storage, network, `Date`, `innerHTML` or `on*` attributes; no element has an `on*` attribute.
4. `DECISIONS.md` at most 2 rows. Tracker: 3.9.1 done; next is 3.9.1a (chunk file first).

**Not in this row:** wiring into `ccis-app.js`, `getResult()`, the template, CSS, `index.html`, results display, export.

**Done when:** `test/ccis-app-run-view.test.js` and `test/ccis-app-run.test.js` pass (run only those two) and two breakages are each seen failing (`only` ignored; Run enabled with nothing ticked).

**Size guard:** 1 module, 1 test, 1 small edit. If the view will not fit, split the `only` edit into its own row.

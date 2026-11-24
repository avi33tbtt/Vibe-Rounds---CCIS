# Chunk 3.8c.1: selector view (module and jsdom test only, not wired)

_Phase 3, Stage 2. Needs: 3.8c (done). No schema change, no core module change, no edit to any existing file. Wiring into the page is 3.8c.2 (split off, D-157)._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app-selector.js` (whole, 3.4 KB: `selectorModel`, `selectOption`, `selectionView`) and `ccis-app-import-view.js` lines 1-30 (the DOM pattern: `el`, `createElement`, `textContent`, `addEventListener`, `aria-live`). Do not read other files. Decisions D-063, D-148, D-155, D-156.

## What this row is for

Two drop-downs, one for the context and one for the pathway, drawn from the loaded market, with a fixed-sentence line that says what is chosen. Choosing runs nothing. A pathway that does not reference the chosen context is allowed and flagged (D-155).

## Build (1 module, 1 test, 0 edits)

New `ccis-app-selector-view.js`, ES module. DOM only through `createElement` and `textContent`; `addEventListener` only; no inline handlers, no storage, no network, no `innerHTML`.

1. `mountSelectorView({ document, root, onState })` returns `{ setMarket, setImport, reset }`. It draws an `h2` "Choose", a labelled `select` for the context, a labelled `select` for the pathway, a "Clear" button (`type=button`) and a status line (`aria-live=polite`).
2. `setMarket(market)` rebuilds the model with no import and empties the selection. `setImport(appliedVersions)` rebuilds the model with `{ report: { appliedVersions } }` (an array, or `[]`) and keeps the selection (stale keys fall away through `selectOption`). `reset()` empties the selection and the model (as with no market).
3. Each `select` starts with a placeholder option "Choose a context" or "Choose a pathway" (value empty). Option text is `id version (status)`, plus ` (deprecated)` and ` (applied by import)` when true. Option value is the item `key`. With no market both selects hold only the placeholder and are `disabled`.
4. On `change`, call `selectOption` with the chosen key (empty value gives `clear` of that side only: keep the other side by selecting the placeholder as "nothing chosen" for that kind; build this with the existing actions and a small local step, no change to `ccis-app-selector.js`). Then draw the line from `selectionView`.
5. Line sentences (fixed): none chosen "Load a market to choose a context and a pathway." when no market, else "Nothing is chosen."; chosen "Context: <label>. Pathway: <label>."; plus "This pathway does not reference the chosen context." when `mismatch`; plus "Nothing has been run." always last.
6. `onState({ contextChosen, pathwayChosen, mismatch, ready, message })` after every change, `message` being the line. Booleans and the sentence only; no ids in the state.
7. New `test/ccis-app-selector-view.test.js`, at most 8 cases, jsdom with no scripts, mounting on a bare `div`:
   - Before `setMarket`: both selects disabled with only the placeholder; the "Load a market" sentence.
   - `setMarket` with the committed `market/` object: one context and one pathway option beyond the placeholders; option text holds the status.
   - Choosing both gives `ready` true and the "Context: ... Pathway: ..." sentence ending "Nothing has been run."
   - A hand-built market with two contexts: choosing the context the pathway does not reference gives `mismatch` true, `ready` false, and the fixed mismatch sentence.
   - `setImport` marks the applied option and keeps the selection; a second `setMarket` empties the selection.
   - Clear and `reset()` empty both selects and call `onState` with all booleans false.
   - A hostile id such as `<img src=x onerror=1>` shows as text: no `img` element, no `on*` attribute anywhere.
   - Source scan of `ccis-app-selector-view.js`: no `innerHTML`, `localStorage`, `sessionStorage`, `indexedDB`, `fetch`, `eval`, `Date`, `Math.random`, `import(`, `onclick`.
8. `DECISIONS.md`: one row at most. Tracker: 3.8c.1 done; next is 3.8c.2 (chunk file first).

**Not in this row:** `ccis-app.js`, the template, CSS, `index.html`, the import view, the catalogue, any run.

**Done when:** the new test file passes and two breakages are each seen failing (`setMarket` not emptying the selection; building option text with `innerHTML`). Run only that file.

**Size guard:** 1 module, 1 test, 0 edits.

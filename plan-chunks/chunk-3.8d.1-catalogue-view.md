# Chunk 3.8d.1: catalogue view (module and jsdom test only, not wired)

_Phase 3, Stage 2. Needs: 3.8d (done). No schema change, no core module change, no edit to any existing file. Wiring into the page is 3.8d.2 (split off, D-163)._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app-catalogue.js` (whole, 4.2 KB: `compatibilityFor`, `catalogueModel`, the row shape) and `ccis-app-selector-view.js` lines 14-40 (the DOM pattern: `el`, `createElement`, `textContent`, `aria-live`). Do not read other files. Decisions D-063, D-161, D-162.

## What this row is for

Show one compatibility result: a banner, a count line, and the rows grouped by outcome, each with its reasons in plain sentences. Rows that need data or are incompatible are open by default. Nothing runs.

## Build (1 module, 1 test, 0 edits)

New `ccis-app-catalogue-view.js`, ES module. DOM only through `createElement` and `textContent`; `addEventListener` only if needed (none is); no inline handlers, no storage, no network, no `innerHTML`.

1. `mountCatalogueView({ document, root, onState })` returns `{ showResult, showSentence, reset }`. It draws an `h2` "Compatibility" and a body `div` (`aria-live=polite`).
2. `showResult(result)` builds `catalogueModel(result)` and draws: each banner as a `p` (class `muted`); a count line "Compatible N, Compatible with limitations N, Needs data N, Incompatible N, Not eligible N, Unrecognised N."; then, for each group that has rows, an `h3` with the outcome label and count, and one `details` per row. The `summary` reads `kind id version: label`. Groups needs-data, incompatible, not-eligible and other set `details.open = true`.
3. Inside a row: "Can be run as a preview." or "Cannot be run." from `mayRun`; a list of explanations, each `check, reason: meaning detail Needs: needs` (omit empty parts; cap at 50 with "and N more"); "Satisfied" and "Needed" lists when not empty. Every string goes in through `textContent`.
4. Finding F-12 (D-162): when the first row (the pathway) is not `needs-data` and some other row is, add one fixed sentence under the count line: "The pathway row does not check data. Packages marked Needs data cannot run without it."
5. `showSentence(sentence)` draws the sentence as `p.refusal` (a fixed sentence from `compatibilityFor`, e.g. "Choose a pathway first."). `reset()` draws "No compatibility result yet." and is the starting state.
6. `onState({ shown, rows, needsData, incompatible, other })` after every draw: a boolean and counts only. `shown` is true only after `showResult`.
7. New `test/ccis-app-catalogue-view.test.js`, at most 8 cases, jsdom with no scripts, mounting on a bare `div`; results from `compatibilityFor` over the committed `market/` (context from the boundary-01 envelope imported with `heldFromMarket`, as in `test/ccis-app-catalogue.test.js` lines 1-17):
   - Start state: the "No compatibility result yet." sentence, `shown` false.
   - `showSentence` draws the refusal paragraph, `shown` false; `reset()` returns to the start state.
   - `showResult` with the imported context: three `details`, group headings match `catalogueModel` counts, the preview banner text is present, the count line is exact.
   - `showResult` with `context: null`: the two package rows sit under "Needs data", open, and the F-12 sentence shows; with the imported context it does not show if the pathway row is `needs-data` or no package is (compute the expectation from the model).
   - A row lists its explanations with reason ids, for example `CMP-4-01` when there is no context.
   - A hand-made result with an unknown outcome shows "Unrecognised outcome" and never an "h3" reading "Compatible".
   - A hostile string in `detail` shows as text only: no `img` element, no `on*` attribute anywhere.
   - Source scan of `ccis-app-catalogue-view.js`: no `innerHTML`, `localStorage`, `sessionStorage`, `indexedDB`, `fetch`, `eval`, `Date`, `Math.random`, `import(`, `onclick`.
8. `DECISIONS.md`: one row at most. Tracker: 3.8d.1 done; next is 3.8d.2 (chunk file first).

**Not in this row:** `ccis-app.js`, the template, CSS, `index.html`, the import view, the selector view, any run.

**Done when:** the new test file passes and two breakages are each seen failing (building an explanation with `innerHTML`; leaving out the F-12 sentence). Run only that file.

**Size guard:** 1 module, 1 test, 0 edits.

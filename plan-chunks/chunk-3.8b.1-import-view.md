# Chunk 3.8b.1: envelope import view (module and jsdom test only, not wired)

_Phase 3, Stage 2. Needs: 3.8b (done). No schema change, no core module change, no edit to any existing file except tracker and `DECISIONS.md`._

**Core rules:** attach `01-core.md` too.

**Read only (line ranges, not whole files):** `ccis-app-market-view.js` (whole, 4 KB; the pattern to copy: `el` helper, `ticket`, `onState`, Clear); `ccis-app-import-report.js` lines 1-20 (exports only); `ccis-import.js` lines 122-135 (`importEnvelope` options). Do not read `ccis-app.js` or the template. Decisions D-142, D-146, D-150.

## What this row is for

One envelope file is picked, size-capped, parsed in the page and imported against the held artefacts of the loaded market (never with an empty `held`). The result is shown as counts, fixed sentences and opaque record ids only (IMP-091). This row builds the view and tests it alone; row 3.8b.2 wires it.

## Build (1 module, 1 test)

1. New `ccis-app-import-view.js`, under 110 lines, one export `mountImportView({ document, root, getMarket, onState })`:
   - Copy the 3.8a conventions: `createElement` and `textContent` only, `addEventListener` only (no inline handlers), a `ticket` so a newer pick replaces a slower one, one `input type=file` (single file, `accept=".json"`), a Clear button, an `aria-live` result box. No `innerHTML`, no storage, no network.
   - Size cap: a file over 5 MB (`file.size`) is refused before reading, with the fixed sentence "The file is larger than 5 MB and was not read."
   - No market loaded (`getMarket()` is `null`): show the fixed sentence "Load a market first. An envelope is checked against the held artefacts of the market." and read nothing. Never call `importEnvelope` with an empty `held`.
   - Otherwise: `JSON.parse` of the file text; a parse error shows the fixed sentence "The file is not valid JSON." (never the parser message). Then `importEnvelope(parsed, { held: heldFromMarket(market) })` and `importReportView(result)`.
   - Render: outcome line, header (version, exported at, producer), the four counts, reason sentences with counts, ids per category (with "and N more"), notes, applied versions, ignored paths. Refused shows only `refusalSentence`. The file name is never shown.
   - Always show the line: "Nothing was applied to any patient record. This is an import report, not a clinical result."
   - `onState({ imported, refused, accepted, rejected, unmapped, ambiguous, message })`: booleans and counts only. Clear resets to `{ imported: false, ... }` with a fixed "No envelope is loaded." message and empties the input and the box.
2. New `test/ccis-app-import-view.test.js`, at most 8 cases, jsdom with a bare `document` (no `index.html`):
   - A committed snake envelope with the real market (`loadFromFiles` over the `market/` folder as in `ccis-app-market.test.js`) shows counts equal to `importReportView` of the same `importEnvelope` call.
   - No market: fixed sentence, `importEnvelope` not reached (state `imported: false`).
   - Invalid JSON: fixed sentence, and the parser message appears nowhere in the DOM.
   - File over 5 MB (fake `size`, `text()` throws if called): refused, never read.
   - Sentinel value, unit and code text in an envelope never appear in `root.textContent`.
   - A second pick before the first resolves: only the second is shown.
   - Clear empties the box and state; the file name never appears.
3. `DECISIONS.md`: add D-152 only if a choice is made. Tracker: 3.8b.1 done; next is 3.8b.2 (chunk file first).

**Not in this row:** `ccis-app.js`, template, CSS, `index.html`, build, market-clear reset, `window.ccisApp`.

**Done when:** the new test file passes and two breakages (rendering the unit text; calling `importEnvelope` with an empty `held` when no market is loaded) are each seen failing. Run only the new test file.

**Size guard:** 1 module, 1 test, 0 edits to existing code files.

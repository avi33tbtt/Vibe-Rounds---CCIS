# Chunk 3.8b-envelope-import: envelope input, import report view (no values), Clear, no-storage scan

_Phase 3, Stage 2. Needs: 3.8a (done). Written 2026-11-24 for the free-tier budget. Docs only until approved. No schema change, no spec amendment, no change to any core module._

**Core rules:** attach `01-core.md` too.

**Read only (five files):** `ccis-import.js` (`importEnvelope`, `REJECTION_CODES`, report shape); `ccis-cli-flow.js` (only how `import` builds `held` from the market, D-142); `ccis-app-market-view.js` (how it reports state and keeps the loaded market); `ccis-app.js`; `ccis-app.template.html`. Decisions D-142, D-146, D-148.

## What this row is for

Let the person pick one context envelope file from their device, run it through `importEnvelope` against the loaded market, and see the import report: counts, reasons and ids, never values. The accepted context is kept in memory for rows 3.8c to 3.9, not shown and not exposed on `window`. Nothing is selected or run yet.

## Findings the build must handle

1. `importEnvelope(envelope, { held })` needs the **held artefacts** (full objects with `manifest` and `fields`). They come from the loaded market, exactly as `import` in `ccis-cli-flow.js` builds them (D-142: every non-blocked entry). With no market the page must not call the importer with an empty `held`: that would refuse every envelope for the wrong reason. It says "Load a market first" instead.
2. The importer takes a parsed object. The page does `JSON.parse` itself, so a parse failure is the page's own refusal. Its sentence is fixed and never quotes the input (IMP-091). A byte-order mark makes `JSON.parse` fail; it is refused, not stripped (same rule as 3.8a).
3. A refusal is a normal result (`ok: false`, `report.outcome: 'refused'`, `refusalReason` a fixed sentence that never quotes input). Show it as the refusal view. Nothing from a refused envelope is kept: no context, no partial records.
4. The report holds categories, codes and opaque record ids, never a value, unit or code text (IMP-091). Safe to show: counts per category; per-code counts with the fixed sentence from `REJECTION_CODES`; the record ids of rejected, unmapped and ambiguous records (ids only, capped at 200 with "and N more"); accepted records as a count only; `notes` codes (`recorded-time-unknown`, `time-zone-unknown`) as counts; applied references (id, type, version, held yes or no); ignored extension **paths** only; envelope version, export time and producer name and version.
5. The envelope **file name** can carry identity (a person may name it after a patient). It is never shown, never stored, never put in the status line.
6. The same file picked twice fires no `change` event, so Clear and a re-pick would seem dead. The input value is reset after reading.
7. The context depends on the market it was imported against. When the market is cleared or replaced, the envelope, context and report are cleared with it. The context is handed to later rows through a callback inside the page (`onContext`), never through `window.ccisApp`, which keeps counts and booleans only.
8. A very large file would freeze the tab. A file over 5 MB is refused before reading, with a fixed sentence.
9. Every text goes through `textContent` or `createElement`; no `innerHTML`, no inline handlers (D-063).

## Design (at most one row in `DECISIONS.md`)

- One new module, `ccis-app-import-view.js`, with two exports so the part that decides what is shown can be tested without a DOM:
  - `importReportView(result)` (pure): returns `{ outcome, header, counts, reasons: [{ code, sentence, count }], refs: { rejected, unmapped, ambiguous } (ids, capped), notes: [{ code, count }], applied, ignoredPaths, refusalSentence }`. Unknown reason codes show the code and a fixed "unrecognised reason" line. No value ever enters it.
  - `mountImportView({ document, root, getHeld, onContext, onState })`: a "Choose envelope file" input (single file, `.json`), one `change` listener added with `addEventListener`, size check, `file.text()`, `JSON.parse`, `importEnvelope`, render, reset input value. A Clear button empties the view and state. `getHeld()` returns the held list or `null` when no market is loaded.
- `ccis-app-market-view.js`: small edit so `onState` also receives the loaded market (or `null`), nothing else changes.
- `ccis-app.js`: wires the two views. `window.ccisApp.state()` keeps its keys and gains `envelopeRead` (boolean) and `imported: { accepted, rejected, unmapped, ambiguous }` (counts, zeros when cleared). When the market view clears or replaces the market, the import view is reset.
- `ccis-app.template.html` gains one `<section id="import">`; `ccis-app.css` small. `node scripts/build-app.js` regenerates `index.html` and the CSP hashes.

## Build

1. New: `ccis-app-import-view.js`. Edited: `ccis-app-market-view.js` (one line), `ccis-app.js`, `ccis-app.template.html`, `ccis-app.css` (small), regenerated `index.html`.
2. New `test/ccis-app-import.test.js` (Node `--test`, jsdom for the view):
   - For the committed synthetic envelopes (the same set row 3.7 uses), the view counts equal the counts of `importEnvelope` called directly with the same `held`; the context passed to `onContext` equals the importer's context byte for byte (canonical text).
   - Refusals show their fixed sentence and keep nothing: not JSON, JSON that is not an object, a byte-order mark, a schema-bad envelope, an applied version not held, a duplicate record id, a file over 5 MB. `onContext` is never called and `imported` stays zero.
   - No market loaded: "Load a market first", the importer is not called.
   - A handmade envelope with sentinel strings (distinctive value, unit, code text, concept text, file name) renders none of them anywhere in the page text, the status line or `window.ccisApp.state()`; entered-in-error records appear only as a rejected count and id.
   - Clear empties the view, calls `onContext(null)`, and `state()` returns to zeros; re-picking the same file after Clear imports again. Clearing or replacing the market clears the import.
   - **No-storage scan:** every `ccis-app*.js` file contains no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `localStorage`, `sessionStorage`, `indexedDB`, `caches`, `cookie`, or `import(`.
   - `node scripts/build-app.js --check` passes on the regenerated page; the 3.8 and 3.8a tests still pass.
3. `DECISIONS.md` (one row), tracker (3.8b done; 3.8c next, chunk file first).

**Not in this row:** context or pathway selection, the compatibility catalogue, running anything, showing context values, exporting a report, a real-browser test, any change to `ccis-import.js` or another core module.

## Questions (defaults apply if you only say "do next")

1. Show record ids of rejected, unmapped and ambiguous records (ids only, capped at 200), and accepted records as a count? Default: yes.
2. Envelope by file picker only, file name never shown, 5 MB cap? Default: yes.
3. Clear or replace the market clears the imported envelope too? Default: yes.

**Done when:** every committed envelope's report in the page agrees with the importer, every refusal case shows its fixed sentence and keeps nothing, no sentinel value appears anywhere, the storage and network scan is clean over all `ccis-app*.js`, `index.html` matches a fresh build, and three breakages (printing a unit in the report; importing with an empty `held` when no market is loaded; keeping the context after Clear) are each seen failing a test.

**Size guard:** 1 new module, 1 test, small edits to 4 existing assets, 1 regenerated page, no dependency. If the module passes about 200 lines, STOP and split the pure `importReportView` into its own module as a new row.

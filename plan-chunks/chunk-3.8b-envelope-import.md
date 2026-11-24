# Chunk 3.8b: pure import report view (no DOM, no wiring)

_Phase 3, Stage 2. Needs: 3.8a (done). Narrowed 2026-11-24 (D-151): the DOM, wiring and build parts moved to rows 3.8b.1 and 3.8b.2. No schema change, no core module change._

**Core rules:** attach `01-core.md` too.

**Read only (line ranges, not whole files):** `ccis-import.js` lines 22-60 and 122-219 (exports, `REJECTION_CODES`, report shape); `ccis-cli-flow.js` lines 143-150 (`heldAll`); ONE committed envelope, `ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json`. Decisions D-142, D-146.

## What this row is for

A pure module that turns an `importEnvelope` result into what the page may show: counts, reason sentences and opaque record ids, never a value, unit or code text (IMP-091). Nothing touches the DOM, the page or the build.

## Build (1 module, 1 test)

1. New `ccis-app-import-report.js`, under 120 lines, two pure exports:
   - `heldFromMarket(market)`: same rule as `heldAll` (every non-blocked entry, parsed). Returns `null` when `market` is null.
   - `importReportView(result)`: returns `{ outcome, header, counts, reasons: [{ code, sentence, count }], refs: { rejected, unmapped, ambiguous }, notes: [{ code, count }], applied, ignoredPaths, refusalSentence }`. Ids capped at 200 with a `more` count. Accepted records are a count only. Unknown reason codes show the code and a fixed "unrecognised reason" line. Refused results carry only `refusalSentence`. The envelope file name is not an input.
2. New `test/ccis-app-import-report.test.js`, at most 8 cases:
   - For every committed snake envelope (all `*.envelope.json` under `ccis/fixtures/snake/`) the view counts equal the counts of `importEnvelope` called with the same `held`.
   - A refused result shows only its fixed sentence and no counts.
   - A handmade result with sentinel strings (value, unit, code text, concept text) puts none of them anywhere in `JSON.stringify` of the view.
   - Ids over 200 are capped with the right `more` count; an unknown reason code is handled.
   - `heldFromMarket(null)` is `null`.
3. `DECISIONS.md`: none unless a choice is made. Tracker: 3.8b done; next is 3.8b.1 (chunk file first).

**Not in this row:** DOM, file input, size cap, Clear, `window.ccisApp`, template, CSS, `index.html`, build.

**Done when:** the tests pass and two breakages (printing a unit in the view; building `held` from blocked entries) are each seen failing. Run only the new test file.

**Size guard:** 1 module, 1 test, 0 edits to existing files.

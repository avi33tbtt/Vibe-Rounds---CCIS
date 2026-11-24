# Chunk 3.8c: pure context and pathway selector model (no DOM, no wiring)

_Phase 3, Stage 2. Needs: 3.8b.2 (done). No schema change, no core module change. The view and wiring are 3.8c.1._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app-market.js` lines 64-82 (`marketView`, the row shape to match) and `ccis-app-import-report.js` lines 25-30 and 47-48 (`applied` entries). One market entry has `id`, `type`, `version`, `status`, `references` (list of `{ id, type, version }`). Do not read `ccis-market.js`, `ccis-compat.js` or any pathway file. Decisions D-146 to D-154.

## What this row is for

The user picks one **context** (a contextual element) and one **pathway** from the loaded market. This row builds only the pure model and a pure selection step, so the next row can draw it. Nothing here runs a pathway or judges compatibility (that is 3.8d and 3.9).

## Build (1 module, 1 test, 0 edits)

New `ccis-app-selector.js`, ES module, pure: no DOM, clock, storage or network, no `eval`.

1. `selectorModel({ market, importResult })` returns `{ contexts, pathways }`. `market` null gives both lists empty. Entries of type `contextual-element` and `pathway` only; status `rejected` or `withdrawn` is left out (same rule as `heldFromMarket`).
2. Each item: `{ key: "<id>@<version>", id, version, status, deprecated, appliedByImport }`. `appliedByImport` is true when `importResult.report.appliedVersions` holds the same id and version; false when there is no import. Order: id, then version, by code-unit comparison (no `localeCompare`).
3. Each pathway item also has `contextKeys`: the `key`s of its `references` of type `contextual-element` (sorted, deduplicated).
4. `selectOption(model, selection, action)` returns a new `{ contextKey, pathwayKey }` and never changes its inputs. Actions: `{ kind: 'context', key }`, `{ kind: 'pathway', key }`, `{ kind: 'clear' }`. A key not in the model is ignored (selection unchanged). Choosing a pathway whose `contextKeys` does not hold the chosen context is allowed, and `selectionView` says so.
5. `selectionView(model, selection)` returns `{ contextLabel, pathwayLabel, mismatch, ready }`. Labels are `id version` or the fixed sentence "Nothing chosen." `mismatch` is true only when both are chosen and the pathway does not reference that context. `ready` is true when both are chosen and `mismatch` is false. Fixed sentences only; no field values are shown.
6. New `test/ccis-app-selector.test.js`, at most 8 cases, using the committed `market/` folder through `loadMarket`:
   - No market gives empty lists; the committed market lists the contextual elements and pathways it holds.
   - Order is stable and a rejected or withdrawn entry is left out (build a small market object by hand).
   - `appliedByImport` is true for items named in `appliedVersions`, false with no import.
   - `selectOption` is pure (frozen inputs), ignores an unknown key, and `clear` empties both.
   - `mismatch` and `ready` for a matching, a non-matching and a half-chosen selection.
   - `ccis-app-selector.js` has no `document`, `window`, storage, `fetch`, `innerHTML` or `eval`.
7. `DECISIONS.md`: D-155 (the selector model is separate from the view so it can be tested without a page; a context mismatch is shown, not blocked). Tracker: 3.8c done; next is 3.8c.1 (chunk file first).

**Not in this row:** any element on the page, `ccis-app.js` edits, the catalogue, compatibility, running.

**Done when:** the new test file passes and two breakages are each seen failing (comparing keys by id only, ignoring version; letting `selectOption` change its input). Run only that file.

**Size guard:** 1 module, 1 test, 0 edits.

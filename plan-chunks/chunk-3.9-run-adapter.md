# Chunk 3.9: in-page run adapter (pure module and test, not wired, no UI)

_Phase 3, Stage 2. Needs: 3.8d.2 (done). No schema change. No edit to any existing file except `DECISIONS.md` and the tracker._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-cli-flow.js` lines 228-250 (`runCmd`, the model to copy), `ccis-run.js` lines 1-30 (the API comment) and 92-96, `ccis-app-catalogue.js` lines 1-35 (`APP_RUNTIME`, `compatibilityFor`), `ccis-app-import-report.js` lines 11-16 (`heldFromMarket`). At most 5 files. Decisions D-132, D-133, D-165, D-167.

## What this row is for

The page will run the chosen pathway. This row builds only the pure function that does it, so rows 3.9.1 (wiring) and 3.9a (results) have one tested seam to call. It is the browser twin of the CLI `run` command: same planner, same executor, same record, but the market is an object already in memory and nothing is read from disk.

## Build (1 new module, 1 test, 0 edits)

1. New `ccis-app-run.js`, pure (no clock, no randomness, no storage, no network, no `node:` import, no `innerHTML`). It exports:
   - `runForPage({ market, pathwayKey, importResult, supplied, evaluationTime, runNeedsData })` returning `{ ok: true, record, skipped }` or `{ ok: false, sentence }`.
   - `RUN_SENTENCES`, a frozen list of the fixed sentences below.
2. Steps, in this order, each failure giving one fixed sentence that never echoes input:
   - No market: "Load a market first." No pathway key: "Choose a pathway first." Key not found: reuse the sentence of `compatibilityFor`.
   - No `importResult` (null or not an object): "Import an envelope first."
   - `evaluationTime` missing or not a string: "An evaluation time is needed." (the executor checks its shape; its refusal becomes "The run was refused." with the rule id, e.g. `R-008`, and nothing else). The time is an input, never read from a clock.
   - Pin the pathway and each of its analytics refs with `pin` and `verifyPin` from `ccis-market.js`, as `runCmd` does. A pin failure: "The market could not be checked against its pins."
   - `planRun` with `runtime: APP_RUNTIME` (so the compatibility view and the run agree), `held: heldFromMarket(market)`, `request: { mode: 'preview', runNeedsData: runNeedsData === true }`. A refusal: "The run was refused." plus its rule id.
   - `executeRun({ plan, supplied: supplied ?? {}, evaluationTime })`. Return the frozen record and `skipped` (the `x-plan` list of items not run, copied as plain data).
3. Nothing passed in is changed. A `failed` record (refused import) is returned as `ok: true`, because it is a record (D-044).
4. New `test/ccis-app-run.test.js`, at most 8 cases, Node only, real `market/` and `boundary-01-edge-inside.envelope.json`:
   - A run gives a record that `verifyRecord` accepts and whose id is `runIdOf(record)`.
   - The same inputs twice give byte-identical records; a changed `evaluationTime` gives a different id.
   - `runNeedsData: true` changes the id and runs more items than `false`; `skipped` lists the rest.
   - A refused import gives a `failed` record, no results.
   - Each fixed sentence appears for its case (no market, no key, unknown key, no import, no time); none contains any input string.
   - Inputs are unchanged afterwards (deep-compare a JSON copy).
   - The record equals the one the CLI path builds from the same inputs (compose `planRun` and `executeRun` in the test the way `runCmd` does, with `CLI_RUNTIME` replaced by `APP_RUNTIME`).
   - Bundle check: `bundleScript()` from `scripts/build-app.js` is not changed, so in the test bundle `ccis-app-run.js` alone with `esbuild` `buildSync` (same `alias` as the script, `write: false`): no `node:` import remains, and the output is under 1.6 MB. Source has no storage, network, `Date`, `Math.random` or `innerHTML`.
5. `DECISIONS.md` at most 2 rows. Tracker: 3.9 done; next is 3.9.1 (chunk file first).

**Hand-over for row 3.9.1 (do not build here):** the import view keeps only the context. The run needs the whole import result, so 3.9.1 adds `getResult()` beside `getContext()` in the same closure, never on `window`.

**Not in this row:** any UI, any wiring, any change to `ccis-app.js`, `index.html` or the CSP, results display, export. `index.html` does not change, so no rebuild.

**Done when:** `test/ccis-app-run.test.js` passes (run only that file) and two breakages are each seen failing (the pin check skipped; `evaluationTime` defaulted instead of required).

**Size guard:** 1 module, 1 test. If the bundle check shows growth over 1 MB for the module alone, STOP and report: add a row, do not patch here.

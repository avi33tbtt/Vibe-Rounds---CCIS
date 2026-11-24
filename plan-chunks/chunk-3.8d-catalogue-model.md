# Chunk 3.8d: pure compatibility catalogue model (no DOM, no wiring)

_Phase 3, Stage 2. Needs: 3.8c.2 (done). No schema change, no core module change. The view and wiring are 3.8d.1._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-cli-flow.js` lines 28-34 (`CLI_RUNTIME`), `ccis-compat.js` lines 18-31 (`OUTCOMES`, `CHECK_NAMES`, `PREVIEW_BANNER`) and 339-350 (the entry shape from `finish`), plus the last `return {` of `resolveCompatibility` (find it with `grep -n "return {" ccis-compat.js | tail -3`; the result has `pathway` and `packages`). Do not read `COMPAT_REASONS` (import it). Decisions D-112, D-141, D-155.

## What this row is for

Turn one compatibility result into rows a page can show: for each entry its outcome, the reasons in plain sentences, what it needs, and which group it belongs to (including the "Needs data" and "Incompatible" views). Unknown never becomes compatible.

## Build (1 module, 1 test, 0 edits)

New `ccis-app-catalogue.js`, pure, bundle-safe (imports only `ccis-compat.js` and `ccis-app-import-report.js`; no `node:` module, no DOM, clock, storage or network).

1. `APP_RUNTIME`: a frozen copy of the `CLI_RUNTIME` values (the CLI file is not bundle-safe, D-141). The test proves the two are equal.
2. `compatibilityFor({ market, pathwayKey, context })` finds the pathway document by its `id@version` key in the market index, calls `resolveCompatibility({ pathway, held: heldFromMarket(market), context, runtime: APP_RUNTIME, request: { mode: 'preview' } })` and returns `{ ok: true, result }`. `context` may be null (the catalogue view; data readiness then needs data). Otherwise `{ ok: false, sentence }` with fixed sentences: "Load a market first.", "Choose a pathway first.", "The chosen pathway is not in the market."
3. `catalogueModel(result)` returns `{ rows, groups, counts, banners }`. One row per entry (the pathway first, then its packages, in result order): `{ kind, id, version, outcome, label, mayRun, explanations, satisfied, needed }`. `label` is `OUTCOMES[outcome]`. `explanations` is, for every finding of every check, `{ check, state, reason, meaning, detail, needs }`; `meaning` comes from `COMPAT_REASONS` by id, or the fixed sentence "The reason is not recognised by this version of the page." Strings only.
4. `groups` holds the row indexes by outcome in the fixed order of `OUTCOMES`; an outcome not in `OUTCOMES` goes to an `other` group with label "Unrecognised outcome" and never to a compatible group. `counts` is the size of each group. `banners` is `PREVIEW_BANNER` plus the de-duplicated banner texts of the pathway entry's policy.
5. New `test/ccis-app-catalogue.test.js`, at most 8 cases (committed `market/`, and the boundary-01 envelope imported with `heldFromMarket` for the context):
   - `compatibilityFor` gives the three fixed sentences for no market, no key and an unknown key.
   - With the market, the pathway key and the imported context: three rows, and each outcome equals the outcome of a direct `resolveCompatibility` call with `CLI_RUNTIME`.
   - With `context: null`, every row is `needs-data` and some explanation has reason `CMP-4-01`. If the real result differs, report it as a finding; do not bend the code.
   - A hand-made result with an unknown reason id and an unknown outcome: the fixed sentence, group `other`, and not in any compatible group.
   - The model does not change a deeply frozen input, and the same input gives the same JSON.
   - A hostile string in `detail` stays a plain string in the model.
   - `APP_RUNTIME` deep-equals `CLI_RUNTIME`.
   - Source scan: no `node:`, `document`, `window`, `localStorage`, `sessionStorage`, `fetch`, `eval`, `Date`, `Math.random`, `import(`.
6. `DECISIONS.md`: one row at most. Tracker: 3.8d done; next is 3.8d.1 (chunk file first).

**Not in this row:** any element on the page, `ccis-app.js` edits, getting the context out of the import view (3.8d.1 decides that, in memory only, never on `window`), any run.

**Done when:** the new test file passes and two breakages are each seen failing (grouping an unknown outcome as compatible; changing one `APP_RUNTIME` value). Run only that file.

**Size guard:** 1 module, 1 test, 0 edits.

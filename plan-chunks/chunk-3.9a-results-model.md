# Chunk 3.9a: pure results model (no DOM, not wired)

_Phase 3, Stage 2. Needs: 3.9.1a (done). No schema change, no core module change._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app-catalogue.js` lines 1-20 (style of a pure model), `ccis-app-run.js` lines 42-58 and 70-78 (return shape), `ccis-run.js` lines 205-235 (record fields), `ccis-walk.js` lines 120-127 (trace entry). For test data read one `ccis/fixtures/snake/*/*.expected.json` `results` array with `sed -n`. Decisions D-134, D-143, D-168, D-170.

## What this row is for

One pure function turns the `{ ok, record, skipped }` that `runForPage` returns into plain rows a view can draw. Nothing is drawn, parsed from text or stored here. Row 3.9a.1 draws it; row 3.9b exports the record.

## Build (1 new module, 1 test, 0 edits)

`ccis-app-results.js`, pure ES module (no DOM, no clock, no network, no storage, no `Date`, no `Math.random`), exports frozen `RESULTS_SENTENCES` and `resultsModel(run)`.

`resultsModel(run)` returns `{ state, headline, groups, trace, missing, scope, limitations, provenance }`, all plain data, deterministic, input never mutated:

1. `state`: `'none'` when `run` is not an object or has no `record`; `'failed'` when `record.status === 'failed'`; else `'completed'`. A failed record gives the sentence "The run failed. No results." and empty groups. `none` gives "No run yet."
2. `groups`: one per `x-analytic` in order of first appearance, each `{ analytic, items }`. Each item: `{ outputId, kind, display, warnings, limitations, missingDataNotes }`. `display` by kind, only these four:
   - `value`: `"90 min"` (amount, a space, unit). Unit `"1"` shows the amount alone. Never rounded, never converted.
   - `classification`: the label as given.
   - `table`: `{ columns, rows }` copied as given.
   - any other kind: the text "Not displayed: unknown result kind." (never guessed).
   A missing or null value shows "No value." It is never "0", "normal" or "none". Unknown never becomes false.
3. `trace`: from `record['x-trace']`, a list of `{ node, inputs: [{ key, concept, state, records }], outcomes, taken }`. `recordIds` are NOT copied (identity stays out of the view). `taken === null` gives the text "No outcome matched (indeterminate)." If there is no trace, `[]`.
4. `missing`: the skipped items from `run.skipped` as `{ id, version, reason }` (copy the three fields only, as text) plus `record['x-omitted']` keys as ids. Empty list gives "Nothing skipped or omitted."
5. `scope`: `{ pathway: "<id> <version>", analytics: ["<id> <version>"], evaluationTime, testOnly }` from `record.package`, `record['x-analytics']`, `record.evaluationTime.value` and `record['x-testOnly'] === true`. Test-only records add the line "Test-only parameters. Not clinical values."
6. `limitations`: the record's own list followed by each item's limitations, de-duplicated, order kept. The model never adds a limitation sentence of its own except the prototype line "Prototype. Synthetic data only. Not for clinical use." as the first entry.
7. `provenance`: `{ id, standard, engine, operatorSet, checksums }` as plain text pairs: `record.id`, `record.standard.version`, `record.engine.version`, operator set name and version, and `x-checksums` envelope, context and results (null shows "none"). Never the snapshot, the context or recordIds.
8. `headline` for completed: "Run complete: N results." (N is the count over all groups). No "normal", "safe" or "ok" wording anywhere in `RESULTS_SENTENCES`.

**Not in this row:** any DOM, wiring, export, CSP change, the F-10 or F-11 decisions (this model only shows what the record holds), or a change to the adapter or core.

**Test (`test/ccis-app-results.test.js`, at most 8 cases).** Use a record composed through `runForPage` on the real `market/` and `boundary-01-edge-inside.envelope.json`, as the 3.9 test does, plus hand-built records:
- completed record: two groups, values with units match hand-written strings ("90 min"); headline count equals the sum.
- failed record and `none` input give the fixed sentences and empty groups.
- unknown kind and null value give the fixed texts, never "0" or "normal".
- trace shows `taken: null` text; `recordIds` absent from the JSON of the model.
- skipped items and `x-omitted` appear in `missing`; the empty case gives its sentence.
- same input twice gives byte-identical JSON; the input record is deep-equal before and after.
- the model JSON holds no snapshot observation text, context string or `recordIds`.
- source scan: no `document`, `window`, `fetch`, `localStorage`, `Date`, `Math.random`, `innerHTML`, `eval`.

**Done when:** the new test passes (run only that file) and two breakages are each seen failing (a null value shown as "0"; `recordIds` copied into the trace).

**Size guard:** 1 module, 1 test, 0 edits. If it will not fit, split the trace and provenance parts into 3.9a.0.

**Defaults on "approve":** units as given; `recordIds` never shown; F-10, F-11 open.

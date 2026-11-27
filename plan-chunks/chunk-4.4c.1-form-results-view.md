# Chunk 4.4c.1: form authoring, part 4b: the results view (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.4, 4.4a, 4.4b, 4.4c (all done). Draws what the page computes from the form; it calls no builder, validator, compiler, diff or preview itself (the page does, in 4.4d). Module and jsdom test only, not wired._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `ccis-app-results-view.js` lines 12-45 (the `list`, `section`, `state` and cap pattern to copy); `ccis-app-form.js` lines 45-58 (the `draftFromForm` result: `ok`, `checksum`, `sdk`, `diagnostics`); `ccis-app-preview.js` lines 31-34 and 50-54 (the preview result and row members); `ccis-app-diff.js` lines 64-73 (the diff result); `test/ccis-app-form-view.test.js` lines 1-30 (jsdom rig).

## Build: `ccis-app-form-results-view.js` (1 new module, about 110 lines) and its test
`export function mountFormResultsView({ document, root, onState })` returns `{ show(model), clear() }`. `model` is `{ draft, preview, diff }`: the three results above, each optional (the page passes `null` for a missing one). Elements come from `makeDom` and `textContent` only; the view imports nothing else.
1. **Nothing yet:** the fixed line `No form result yet.` (`clear()` returns to it).
2. **Refused** (`draft.ok === false`): the fixed line `Refused. No element was produced.`, then one row `<code> at <path>: <sentence>` from `draft.sdk`. No checksum, preview or diff is drawn.
3. **Accepted:** the fixed line `Built from the form. Status: draft. This is not a validation.`; the checksum as text (`Checksum: <value>`); a `Validator rows` section with one `<severity> <ruleId> <layer> <path>: <message>` row per diagnostic (hint on the same row when present), or the fixed line `The validator reported no rows.` when empty. Never say passed, valid, safe or approved.
4. **Preview** (when `preview.ok`): the preview `headline`, three small tables (fields: key, label, type, cardinality, units, states; modules: id, appliesWhen, field count; relationships: text, with `Dangling` in an extra column) and the `notes` line, plus `Truncated.` when `preview.truncated`. When `preview.ok` is false show its `sentence` instead.
5. **Diff** (when given and `diff.ok`): `diff.summary`, then one row per change `<change> <path>: <before> -> <after>` (omit a missing side); `Truncated.` when set. When `diff.ok` is false show its `sentence`. Without a diff show `No previous version kept.`
6. Every list is capped at 100 rows; beyond that one line `More rows exist than are shown.` `onState({ shown, refused, rows })`: two booleans and a whole number (rows drawn), nothing else.
7. No storage, timers, network, `innerHTML`, `on*` attribute, or Copy/Save/Publish/Approve control.

## Edits
`test/ccis-app-hostile-sweep.test.js` `COVERED`: add `'ccis-app-form-results-view.js': 'ccis-app-form-results-view.test.js'`.

## Test: `test/ccis-app-form-results-view.test.js` (at most 8 cases)
1. Mount and `clear()`: the fixed no-result line, `onState` `{ shown: false, refused: false, rows: 0 }`.
2. Refused: fixed line, one code/path/sentence row, no checksum or tables.
3. Accepted from a real `draftFromForm` result (minimal valid form as in 4.4c): fixed line, checksum text, diagnostics rows or the fixed empty line; none of the words `passed`, `valid`, `safe`, `approved` as a verdict.
4. Preview tables: row counts match `previewModel`; a dangling edge shows `Dangling`; `truncated` shows `Truncated.`; refused preview shows its sentence.
5. Diff: summary and change rows from a real `diffArtefacts`; no diff shows the fixed line; refused diff shows its sentence.
6. Cap: 150 diagnostics draw 100 rows plus the fixed more-rows line.
7. Hostile strings in every model string (sdk sentence, path, diagnostics, preview and diff text): `inert(root)` (from `test/hostile-kit.js`) passes; text is shown unchanged; `onState` holds only two booleans and a whole number.
8. Source scan: imports only `ccis-app-dom.js`; no `fetch`, storage, `Date`, `Math.random`, `innerHTML`; no control named Copy, Save, Publish or Approve; at least one `makeDom` use.

**Done when:** `node --test test/ccis-app-form-results-view.test.js test/ccis-app-hostile-sweep.test.js` passes; `node scripts/build-app.js --check` still passes (not wired, nothing bundled changes). Two breakages each seen failing, then restored: (a) draw the checksum when refused (case 2 fails); (b) drop the 100-row cap (case 6 fails).

**Size guard:** 1 module (about 110 lines), 1 test (8 cases), 1 small edit. If the module passes 130 lines, STOP and move the preview tables into a new row.

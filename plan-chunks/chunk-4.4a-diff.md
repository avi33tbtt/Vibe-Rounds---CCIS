# Chunk 4.4a: form authoring, part 2: pure diff of two canonical artefacts (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.4 (done: `draftFromForm` returns the canonical text this row compares). No DOM, no network, no storage, no wiring. The page shows the rows later (4.4c)._

**Core rules:** attach `01-core.md` too.

**Read only (3 files):** `ccis-compile.js` lines 277-299 (`kindOf`, `child`, how `firstDifference` walks objects and arrays; this row copies the walk, not the module); `ccis-app-form.js` lines 52-60 (`draftFromForm` result: `canonical`); `test/ccis-app-form.test.js` lines 1-12 (test style).

## Build: `ccis-app-diff.js` (1 new module, about 70 lines, pure) and its test
`export function diffArtefacts(before, after)` where each argument is canonical JSON text or an already parsed object. Returns a frozen result.
1. **Refused input:** a non-string non-object, text that is not JSON, or a root that is not an object gives `{ ok: false, sentence: 'The previous or the new version is not an artefact document.' }`. The sentence is fixed and never holds the text.
2. **Rows:** `{ ok: true, same, summary, rows, truncated }`. A row is `{ path, change, before, after }`, `change` one of `added`, `removed`, `changed`, `reordered`; `before` is absent for `added`, `after` absent for `removed`. Rows are sorted by `path` (plain code-unit order). `summary` is `No differences.` or `<n> added, <n> removed, <n> changed.` (`reordered` counts as changed).
3. **Paths** read like `fields[dose].label` and `intent.purpose`. An array of objects where every item has a unique string `key` (or else a unique string `id`) is matched by that value, so inserting or removing a field gives one `added` or `removed` row and shifts nothing. The same items in a different order give one `reordered` row at the array's path. Any other array is compared by position and its paths read `exclusions[2]`; a longer or shorter list gives `added` or `removed` rows at the extra positions.
4. **Values shown:** a string, number, boolean or null is shown as its JSON text, cut at 120 characters with `...`. An object is shown as `object of <n> members`, an array as `list of <n> items`, so a large member never fills the page. A change of kind (string to number, object to list) is one `changed` row.
5. **Limits:** at most 200 rows; more sets `truncated: true` (the summary still counts only the shown rows). Depth over 100 stops the walk and gives the refused result of rule 1 (hostile input cannot overflow the stack).
6. No other export. No clock, randomness, DOM, `fetch`, storage or `window`. The inputs are not changed.

## Test: `test/ccis-app-diff.test.js` (at most 8 cases)
Small hand-written JSON texts.
1. Identical texts: `same: true`, no rows, summary `No differences.`.
2. A changed leaf, an added member and a removed member: three rows with the exact path, change and shown values, sorted.
3. Keyed array: a field inserted at the front gives one `added` row `fields[note]` and no other row.
4. Keyed array reordered: one `reordered` row at `fields`; a removed item gives one `removed` row.
5. Unkeyed array: a changed item and a longer list give `exclusions[1]` `changed` and `exclusions[2]` `added`.
6. Values: a 300-character string is cut at 120 with `...`; an object is shown as `object of 2 members`; string to number is `changed`; a hostile string (`<img onerror=1>`) comes back as plain data in `before`/`after`.
7. Refused: invalid JSON, an array root, `42` and `null` all give the fixed sentence, and the sentence holds no part of the input. Depth 101 is refused too.
8. Purity and determinism: twice gives equal output; results frozen; inputs unchanged; 250 changed items give 200 rows and `truncated: true`; source scan finds no `fetch`, `window`, `document`, `Date`, `Math.random`, storage or `import(`.

**Done when:** `node --test test/ccis-app-diff.test.js` passes (new file only). Two breakages each seen failing, then restored: (a) match keyed arrays by position (case 3 fails); (b) show an object's whole JSON instead of the summary (case 6 fails).

**Size guard:** 1 module (about 70 lines), 1 test (8 cases), 0 edits. If the keyed matching or the cap pushes the module over 100 lines, STOP and move the keyed matching to a new row.

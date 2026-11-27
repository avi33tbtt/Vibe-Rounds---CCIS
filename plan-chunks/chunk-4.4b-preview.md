# Chunk 4.4b: form authoring, part 3: the readable preview model for a contextual element (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.4 (done). No DOM, no network, no storage, no wiring, no SVG: the "graph" is text rows (fields, then relationships as `from --kind--> to`). The page draws the rows later (4.4c)._

**Core rules:** attach `01-core.md` too.

**Read only (4 files):** `ccis-sdk-element.js` lines 41-61 (the element members: `fields`, `modules`, `relationships`); `ccis/examples/snake/snake-envenomation.element.json` (use `node -e` to print the keys, the first two fields and the relationships only; do not read it whole, it is 11 KB); `ccis-app-diff.js` lines 8-25 (style: `plain`, input loading, fixed refusal sentence); `test/ccis-app-diff.test.js` lines 1-12 (test style).

## Build: `ccis-app-preview.js` (1 new module, about 70 lines, pure) and its test
`export function previewModel(input)` where `input` is canonical JSON text or a parsed object. Returns a frozen result.
1. **Refused:** not JSON, a non-object root, or `manifest.type` other than `contextual-element` gives `{ ok: false, sentence: 'The preview needs a contextual element document.' }`. The sentence is fixed and never holds the input.
2. **Result:** `{ ok: true, headline, title, status, fieldRows, moduleRows, edgeRows, notes, truncated }`. `headline` is the fixed sentence `Preview only. It is not a validation result.`; `title` is `manifest.name` and `status` is `manifest.status`, both shown as text (empty string when missing or not a string). Nothing in the preview changes or implies the status.
3. **`fieldRows`:** one per field in `fields` order, then one per module field, each `{ key, label, type, cardinality, units, states, module, linked }`. `cardinality` reads `0 to 1`, `1 to unbounded`, or `exactly 1` when min equals max. `units` and `states` (epistemic) are the list items joined with `, `. `module` is the module id, or `''` for a top-level field. `linked` is true when the key appears in any relationship.
4. **`moduleRows`:** `{ id, appliesWhen, fieldCount }` in module order.
5. **`edgeRows`:** one per relationship in order: `{ from, kind, to, text, dangling }`. `text` is `<from label> <kind> <to label>` with the kind's hyphens turned into spaces (`derived-from` becomes `derived from`). A key with no matching field is shown as the key itself and sets `dangling: true`; the preview never throws and never fixes it (the validator reports it).
6. **`notes`:** `<n> fields, <n> modules, <n> relationships.` (singular form for 1).
7. **Tolerant:** any member that is missing or the wrong type shows as `''`, `0` or no rows; a row that is not an object is skipped. At most 500 rows in all; more sets `truncated: true`.
8. No other export. No clock, randomness, DOM, `fetch`, storage or `window`. The input is not changed.

## Test: `test/ccis-app-preview.test.js` (at most 8 cases)
1. The snake element: 10 field rows with key, label and type from the file, and `notes` `10 fields, 0 modules, 5 relationships.`.
2. Cardinality, units and states: `{0,1}`, `{1,'unbounded'}` and `{2,2}` read as above; two units and two states join with `, `.
3. The snake relationships: 5 edge rows, `text` built from the labels, none dangling, and every field named in an edge is `linked`.
4. A relationship naming an unknown key: `dangling: true`, the key shown, and the other rows unchanged; two fields with the same key both appear.
5. A module with two fields: module field rows carry the module id, top-level rows carry `''`, `moduleRows` gives the count.
6. Refused: invalid JSON, `[1]`, `42`, `null`, and a pathway document all give the fixed sentence, and it holds no part of the input.
7. Tolerant: a field with a numeric label, a non-object field, and `relationships: 'x'` give rows or none and never throw; a hostile label (`<img onerror=1>`) is plain data in the row.
8. Deterministic, frozen, input unchanged; 600 fields give 500 rows and `truncated: true`; the headline is the fixed sentence even when `status` is `validated`; a source scan finds no `fetch`, `window`, `document.x`, `Date`, `Math.random`, storage or `import(`.

**Done when:** `node --test test/ccis-app-preview.test.js` passes (new file only). Two breakages each seen failing, then restored: (a) look a label up by position instead of by key (cases 3 and 4 fail); (b) leave module fields out of `fieldRows` (case 5 fails).

**Size guard:** 1 module (about 70 lines), 1 test (8 cases), 0 edits. If the module needs more than 100 lines, STOP and split the edge rows into a new row.

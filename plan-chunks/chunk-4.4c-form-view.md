# Chunk 4.4c: form authoring, part 4: the form view, inputs only (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.4 (done). The results panels (refusal, checksum, validator rows, preview, diff) are the next row, 4.4c.1 (D-264). This row is the inputs and hands the page the current form as plain strings; it calls no builder, validator or compiler. Module and jsdom test only, not wired (wiring is 4.4d)._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `ccis-app-draft-view.js` lines 12-58 (the `field`, `pick` and mount pattern to copy); `ccis-app-form.js` lines 14-44 (`FORM_TYPES`, the form member names, `lines`); `test/ccis-app-draft-view.test.js` lines 14-40 (jsdom rig, `fire`, `set`); `ccis-app-dom.js` lines 6-10 (`ALLOWED_TAGS`); `test/ccis-app-hostile-sweep.test.js` lines 17-23 (the `COVERED` table).

## Build: `ccis-app-form-view.js` (1 new module, about 110 lines) and its test
`export function mountFormView({ document, root, onState, onForm, types, lists })`. `types` is `FORM_TYPES`; `lists` is `{ epistemic, sourceClasses, timeSemantics }` (arrays the page passes from the SDK constants; the view imports no builder, like the draft view). Elements come from `makeDom` and `textContent` only.
1. **Top part:** one text input each for `id`, `name`, `version`, `publisher`, `purpose`, `setting`, `population`, `rationale`, `origin`, `basis`, and a textarea for `exclusions` (one per line). A fixed line `Status: draft (fixed). A form cannot set a status.`; there is no status input.
2. **Field cards:** one card per field: inputs `key`, `label`, `min`, `max`; a select `type` (from `types`); a select `timeSemantics` (an empty first option, then `lists.timeSemantics`); textareas `epistemic`, `sourceClasses`, `units`, `constraints` (one per line), each with a hint line `Allowed: <list items joined by ", ">` for the two enumerated lists. Buttons: `Add field` (disabled at 50 fields), a `Remove field` per card (disabled when only one card is left), and `Reset form`.
3. **Output:** on mount and after every edit, `onForm(form)` gets a fresh plain object of strings in the shape `draftFromForm` reads (top members, and `fields: [{ key, label, type, min, max, epistemic, sourceClasses, units, timeSemantics, constraints }]`), never the view's own object. `onState({ fields, touched })`: a whole number and a boolean, nothing else.
4. The form lives only in the inputs: no storage, no timers, no network, no `innerHTML`, no `on*` attribute. Remove drops the clicked card and keeps every other card's values. Reset gives one blank card.

## Edits
`ccis-app-dom.js`: add `'textarea'` to `ALLOWED_TAGS` (sorted position, one word). `test/ccis-app-hostile-sweep.test.js` `COVERED`: add `'ccis-app-form-view.js': 'ccis-app-form-view.test.js'`, and also `'ccis-app-remote-view.js'` pointing at its existing view test (found with `ls test | grep remote-view`), which fixes the old D-258 failure (D-265).

## Test: `test/ccis-app-form-view.test.js` (at most 8 cases)
1. Mount: one card, the fixed status line, no status input, `onForm` blank strings with the exact member names, Remove disabled.
2. Typing in each top input shows up in the next `onForm`; the object is a fresh copy (changing it changes nothing later).
3. Field inputs: key, label, type, min, max, lists and time semantics are carried; a minimal filled form passes `draftFromForm(form).ok === true`.
4. Add and Remove: a new blank card; removing the second of three keeps the first and third values; at 50 cards Add is disabled; one card left disables Remove.
5. Reset blanks everything and leaves one card.
6. Hostile strings typed into every input and given as `types` and `lists` entries: `inert(root)` (from `test/hostile-kit.js`) passes and the values come back unchanged in `onForm`.
7. Seam: every `onState` value is a boolean or a whole number; no `on*` attribute; no `textarea` or `input` named status.
8. Source scan: imports only `ccis-app-dom.js`; no `fetch`, storage, `Date`, `Math.random`, `innerHTML`; at least one `addEventListener`.

**Done when:** `node --test test/ccis-app-form-view.test.js test/ccis-app-dom.test.js test/ccis-app-hostile-sweep.test.js` passes; `ccis-app-bundle-scan` and `node scripts/build-app.js --check` still pass (not wired). Two breakages each seen failing, then restored: (a) Remove drops the last card (case 4 fails); (b) pass the live form object to `onForm` (case 2 fails).

**Size guard:** 1 module (about 110 lines), 1 test (8 cases), 2 small edits. If the module passes 130 lines, STOP and move the field card into a new row.

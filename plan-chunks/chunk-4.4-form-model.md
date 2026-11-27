# Chunk 4.4: form authoring, part 1: the pure form model for a contextual element (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.2b.1a (element builder), 3.x (compiler, validator). The whole of 4.4 is split (rule 12): this row is the pure model; 4.4a diff, 4.4b preview model, 4.4c form view, 4.4d wiring and rebuild, 4.4e sweeps and real-Chrome test. Contextual elements only; pathway and analytics forms come after 4.5. No DOM, no network, no storage, no wiring (D-259)._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `ccis-sdk.js` lines 8-30 (`SDK_REFUSALS`, `SdkError`); `ccis-sdk-element.js` lines 24-61 (the spec the builder accepts); `ccis-compile.js` lines 203-215 and 301-320 (`canonicalize`, `compareRoutes` result); `ccis-validator.js` lines 596-611 (result shape `{ outcome, layers, diagnostics }`); `test/ccis-sdk-elementbody.test.js` lines 1-30 (loading, `verdict`).

## Build: `ccis-app-form.js` (1 new module, about 90 lines, pure) and its test
Form state is what text boxes give: every value is a string. Shape: `{ id, name, version, publisher, purpose, setting, population, rationale, exclusions, origin, basis, fields: [ { key, label, type, min, max, epistemic, sourceClasses, units, timeSemantics, constraints } ] }`. List members (`exclusions`, `epistemic`, `sourceClasses`, `units`, `constraints`) are one item per line; blank lines are dropped; `min` and `max` are digit strings or `unbounded`.
1. `export const FORM_TYPES` = `FIELD_TYPES` without `code` (a code field needs a terminology binding, which this form does not offer yet; D-259), and `export const FORM_STATUS = 'draft'`.
2. `export function formToSpec(form)`: pure map from strings to the element spec. It never judges: a value that is not a whole number stays the string it was, so the SDK builder refuses it with its own code and path. Manifest fields set here: `type: 'contextual-element'`, `status: 'draft'` always (a form can never claim a validated status), `standard: { version: '0.1.0' }`, `publisher: { name: form.publisher }`. Empty optional members (`units`, `timeSemantics`, `constraints`, `modules`, `relationships`) are left out, not empty.
3. `export function draftFromForm(form, options = {})` returns a frozen `{ ok, spec, canonical, checksum, sdk, diagnostics }`. It runs `element(formToSpec(form))`; an `SdkError` gives `ok: false`, `sdk: { code, path, sentence }` (the sentence from `SDK_REFUSALS`, never the value), `diagnostics: []`. Otherwise it runs `canonicalize` and `checksumOf`, then `validateArtefact(spec, options)`, and `diagnostics` is one row per diagnostic: `{ layer, severity, ruleId, path, message, hint }` (path as text, line and column for syntax errors). `ok` is true only when the SDK accepted the spec; it never means "valid" and never changes `status`.
4. No other export. No clock, randomness, DOM, `fetch`, storage or `window`.

## Test: `test/ccis-app-form.test.js` (at most 8 cases)
Hand-written form state for a small element (string, quantity with units, integer, date with time semantics) and the matching JSON written by hand.
1. Form route and JSON route are byte-identical through `compareRoutes` (same checksum).
2. Same validator verdict (layer outcomes and rule ids) for both routes.
3. Number fields: `'0'`, `'3'`, `'unbounded'` parse; `'abc'` is refused with `S-003` at `fields.0.cardinality.min`.
4. Lists: blank lines dropped, order kept; an all-blank list for a required list is refused.
5. An empty label is refused with a fixed sentence naming code and path and not the value.
6. Duplicate field keys give validator rows (`ok: true`, `sdk: null`, a layer-3 row with rule id and path).
7. Determinism and purity: twice gives byte-identical output; the input form is not changed; results are frozen; `status` is `draft` even when the form holds `validated`.
8. A `code` type is refused (not in `FORM_TYPES`); a source scan of the module finds no `fetch`, `window`, `document`, `Date`, `Math.random`, storage or `import(`.

**Done when:** `node --test test/ccis-app-form.test.js` passes (new file only). Two breakages each seen failing, then restored: (a) parse `max` with `Number()` so `'abc'` becomes `NaN` silently (case 3 fails); (b) copy `form.status` into the manifest (case 7 fails).

**Size guard:** 1 module (about 90 lines), 1 test (8 cases), 0 edits. If `formToSpec` needs more than the members above, STOP and add the rest as a new row.

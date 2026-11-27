# Chunk 4.2b.1a: code-authoring SDK, part 3c: the element builder (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.2b and 4.2b.1 (done). Adds `element(spec)` to `ccis-sdk-element.js` (42 lines now) and one equivalence test. It puts the manifest, intent, fields, modules, relationships, provenance and tests together. Same rules as 4.2: pure, plain frozen JSON, no invented content (no default intent text, no empty `modules`, `relationships` or `tests` added), fixed-sentence errors with a path, same canonicalizer and validator as the file route._

**Core rules:** attach `01-core.md` too. Rule 12: a NEW test file `test/ccis-sdk-elementbody.test.js` (at most 8 cases).

**Read only (4 files):** `ccis-sdk-element.js` (whole, 42 lines: extend it); `ccis/schemas/element.schema.json` lines 1-62 only (`sed -n`: manifest, intent, fields, modules, relationships, provenance, tests; the `$defs.field` block is already built); `test/ccis-sdk-field.test.js` lines 1-20 (helpers to copy); `ccis-sdk.js` lines 138-166 (`referenceAt`, `manifest`). Do NOT read the 11 KB example: the test loads it.

## Build (1 module edit of at most 45 lines, 1 word edit, 1 new test of at most 8 cases)
1. In `ccis-sdk.js`: `const referenceAt` becomes `export const referenceAt` (one word; no logic change).
2. In `ccis-sdk-element.js`: generalise the existing `withPath` helper to take the builder as its first argument (`withPath(build)(v, p)`; the binding use stays the same), then add `export function element(spec)`:
   - required `manifest` (built by `manifest(v, { type: 'contextual-element' })`, errors prefixed `manifest.`; a wrong type is `S-003` at `manifest.type`), `intent`, `fields` (list, at least 1, each built by `field`), `provenance`;
   - optional `modules` (list, may be empty; each `{ id: keyText, appliesWhen: text, fields: list of at least 1 `field` }`, all required), `relationships` (list; each `{ kind, from, to }`, all required, `kind` one of `derived-from`, `part-of`, `refines`, `requires`, `from` and `to` keyText), `tests` (list of `referenceAt`, may be empty);
   - `intent`: required `purpose`, `setting`, `population`, `rationale` (text) and `exclusions` (list of text, may be empty, the member itself required); `provenance`: required `origin`, `basis` (text);
   - `x-` members pass on the element, intent, provenance, each module and each relationship, exactly as the schema allows;
   - export `RELATIONSHIP_KINDS` (the test compares it with the schema).
   - NOT added (stay with the validator, layer 3): duplicate field keys, a relationship naming an unknown key, a module id clash. The SDK adds no rule the file route lacks.

## Test: `test/ccis-sdk-elementbody.test.js` (at most 8 cases)
1. the snake element is `identical` on the code route (`compareRoutes` of the file text vs `element(JSON.parse(text))`), same checksum, and the validator verdict of the built element equals the file's (copy the `verdict` helper from the 4.2 test);
2. a minimal element (one field, empty `exclusions`) builds, holds only what was given (no `modules`, `relationships`, `tests`), frozen; a missing member `S-002` with its path;
3. a manifest of another type is `S-003` at `manifest.type`; a bad manifest member keeps its code with the `manifest.` prefix;
4. a field refused inside the list carries the index (`fields.1.cardinality.max`); `fields: []` is `S-003`;
5. modules: built in order; `fields` empty `S-003`; a missing `appliesWhen` `S-002` at `modules.0.appliesWhen`;
6. relationships: `RELATIONSHIP_KINDS` equals the schema; a bad kind `S-003`; order kept; no reference check (an unknown `to` builds);
7. `tests` references go through `referenceAt` (version xor range `S-004` at `tests.0`); `x-` passes on the element, intent, provenance, a module and a relationship;
8. hostile string never in a message; purity scan of `ccis-sdk-element.js` passes.

**Done when:** `node --test test/ccis-sdk-elementbody.test.js` passes. Two breakages each seen failing, then restored: (a) drop the `contextual-element` pin; (b) sort `relationships` by `from`.

**Size guard:** module grows by at most 45 lines, 1 word edit, 1 new test file, tracker and DECISIONS only otherwise. If an element member of the schema is not listed here, STOP and report.

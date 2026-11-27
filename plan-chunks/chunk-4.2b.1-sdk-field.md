# Chunk 4.2b.1: code-authoring SDK, part 3b: the element field builder (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.2b (done). The element body (intent, modules, relationships, provenance, tests, manifest) was too big with its field, and `ccis-sdk.js` is 167 lines, so another +60 would pass the 200-line stop set in 4.2b. So this row builds the **field** alone, in a NEW module `ccis-sdk-element.js`; the element body becomes row 4.2b.1a. Same rules as 4.2: pure, plain frozen JSON, no invented content (no default `epistemic`, `sourceClasses`, `cardinality`, `label`), fixed-sentence errors with a path, same canonicalizer and validator as the file route._

**Core rules:** attach `01-core.md` too. Rule 12: a NEW test file `test/ccis-sdk-field.test.js` (at most 8 cases); older SDK tests are not extended or run beyond the one named below.

**Read only (4 files):** `ccis/schemas/element.schema.json`, only the `$defs.field` block (`grep -n '"field"'`, then `sed -n` the block, about 55 lines); `ccis-sdk.js` lines 1-60 and 84-100 (`shape`, `need`, `list`, `binding`; do not read the rest); `test/ccis-sdk-manifest.test.js` lines 1-20 (helpers to copy); the `fields` member of `ccis/examples/snake/snake-envenomation.element.json` (print with `node -e`, 10 fields, one line each; do not read the file whole, it is 11 KB).

## Build (1 new module of at most 70 lines, 1 one-line edit, 1 new test of at most 8 cases)
1. In `ccis-sdk.js`: change `function shape`, `const need`, `const list`, `const keyText` and `const textOf` to `export` (five word-level edits, no logic change). Nothing else in that file changes.
2. New `ccis-sdk-element.js`, importing those and `binding`, exporting `field(spec)` and the enums `FIELD_TYPES`, `EPISTEMIC_STATES`, `SOURCE_CLASSES`, `TIME_SEMANTICS` (the test compares each with the schema):
   - required `key` (keyText), `label` (text), `type`, `cardinality` (`{ min, max }`, both required, closed: no `x-`; `min` integer 0 or more, `max` integer 1 or more or `'unbounded'`), `epistemic` (list, at least 1), `sourceClasses` (list, at least 1);
   - optional `units` (list of non-space strings, at least 1), `precision` (`{ decimals }`, integer 0 or more, closed), `timeSemantics`, `binding` (built with the existing `binding`), `constraints` (list of text, may be empty);
   - the four schema rules as `S-004` at the field path: `quantity` or `integer` needs `units`; `date` or `datetime` needs `timeSemantics`; `code` needs `binding`; `string`, `boolean`, `code`, `date`, `datetime` must not carry `units`.
   - one SDK-only check is NOT added: `min` greater than `max` stays with the validator (the SDK adds no rule the file route lacks).

## Test: `test/ccis-sdk-field.test.js` (at most 8 cases)
1. every field of the snake element is `identical` on the code route (`compareRoutes` of the field as JSON text vs `field(member)`), same checksum;
2. a minimal `string` field builds, holds only what was given, frozen; missing member `S-002` with its path; unknown member `S-001`;
3. the four type rules: each broken one is `S-004`, each satisfied one passes;
4. cardinality: `{ min: 0, max: 'unbounded' }` passes; `max: 0`, `min: -1`, `max: 'many'`, an `x-` member inside it refused `S-003` or `S-001` as the shape rules say;
5. the four enums equal the schema's; a value outside each is `S-003` with its path;
6. `binding` inside a field is built by the existing builder (an `unmapped` binding with a code is `S-004` at `binding`); `x-` passes on the field;
7. list order kept (`epistemic`, `sourceClasses`, `units`, never sorted); an empty required list is `S-003`;
8. hostile string never in a message; purity scan of `ccis-sdk-element.js` passes.

**Done when:** `node --test test/ccis-sdk-field.test.js` passes. Two breakages each seen failing, then restored: (a) drop the `code` needs `binding` rule; (b) allow `units` on a `string` field.

**Size guard:** 1 new module (70 lines at most), 5 word edits in `ccis-sdk.js`, 1 new test file, tracker and DECISIONS only otherwise. If a field member of the schema is not listed here, STOP and report.

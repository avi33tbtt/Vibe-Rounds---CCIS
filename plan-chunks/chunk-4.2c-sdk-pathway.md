# Chunk 4.2c: code-authoring SDK, part 4: the pathway builder (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.2a, 4.2b, 4.2b.1a (done). Adds `pathway(spec)` in a NEW module `ccis-sdk-pathway.js` and one equivalence test. Same rules as 4.2: pure, plain frozen JSON, no invented content (no default stage, transition or timing; no number anywhere), fixed-sentence errors with a path, same canonicalizer and validator as the file route._

**Core rules:** attach `01-core.md` too. Rule 12: a NEW test file `test/ccis-sdk-pathway.test.js` (at most 8 cases).

**Read only (5 files):** `ccis/schemas/pathway.schema.json` (4 KB, whole); `ccis-sdk-element.js` lines 1-25 and the `element` function (helpers `oneOf`, `withPath`); `ccis-sdk.js` lines 101-130 (`idText`, `decisionNode`); `test/ccis-sdk-elementbody.test.js` lines 1-30 (helpers to copy); the whole snake pathway is NOT read: the test loads it (6 KB) and `node -e` prints only `Object.keys`.

## Build (1 new module of at most 60 lines, 3 small edits, 1 new test of at most 8 cases)
1. `ccis-sdk.js`: `const idText` becomes `export const idText`; `withPath` moves here from `ccis-sdk-element.js` as `export const withPath` (same code); `ccis-sdk-element.js` imports it and drops its own copy. No logic change.
2. New `ccis-sdk-pathway.js` exporting `pathway(spec)`, `STAGE_KINDS` and `REQUIREMENTS` (the test compares both with the schema):
   - required `manifest` (`manifest(v, { type: 'pathway' })` under `withPath`), `scope`, `intendedUse` (text), `exclusions` (list of text, may be empty, the member itself required), `elements`, `stages`;
   - `elements`: list of at least 1, each built by `referenceAt` and then checked: `type` must be `contextual-element` (`S-003` at `elements.N.type`) and it must carry `range`, not `version` (`S-004` at `elements.N`);
   - `stages`: list of at least 1; each `{ id: idText, label: text, kind: information or report, entry: list of at least 1 text, exit: list of at least 1 text, needs: list of keyText, may be empty }`, the first five required;
   - optional `nodes` (list, each built by `decisionNode` under `withPath`), `transitions` (list of `{ from: idText, to: idText, via?: idText }`), `timing` (list of `{ id: idText, description?: text, between: { from, to } closed, parameter: keyText }`), `analytics` (list of `{ ref, requirement: required or optional }`, `ref` built by `referenceAt` with `type` pinned to `analytics-package`, `S-003` at `analytics.N.ref.type`);
   - `x-` passes on the pathway, stage, transition, timing and analytics item, never inside `between`.
   - NOT added (validator, layer 3): a `needs` key missing from the elements, a transition naming an unknown stage or node, duplicate ids. Timing carries a parameter id only; no number member exists, so none can be built.

## Test: `test/ccis-sdk-pathway.test.js` (at most 8 cases)
1. the snake pathway is `identical` on the code route, same checksum, and the validator verdict of the built pathway equals the file's;
2. a minimal pathway (one element range, one stage, empty `exclusions`) builds, holds only what was given (no `nodes`, `transitions`, `timing`, `analytics`), frozen; a missing member `S-002` with its path;
3. manifest pinned to `pathway` (`S-003` at `manifest.type`); an element given by `version` is `S-004`, of another type `S-003`;
4. stages: order kept, `STAGE_KINDS` equals the schema, empty `entry` `S-003` at `stages.0.entry`, a bad `needs` key `S-003`;
5. nodes are built by `decisionNode` with the index and the inner path (`nodes.0.outcomes`); `transitions` and `via` ids checked, order kept, unknown stage ids not checked;
6. timing: `between` closed (`x-` inside is `S-001`), a numeric member is `S-001`, `parameter` is a key;
7. analytics: `REQUIREMENTS` equals the schema, `ref` type pinned, `x-` passes on the pathway and an item;
8. hostile string never in a message; purity scan of `ccis-sdk-pathway.js` passes.

**Done when:** `node --test test/ccis-sdk-pathway.test.js` passes, plus `node --test test/ccis-sdk-elementbody.test.js` (the `withPath` move). Two breakages each seen failing, then restored: (a) drop the `range`-only rule on elements; (b) let `between` accept `x-` members.

**Size guard:** one new module (60 lines at most), 3 small edits, 1 new test file, tracker and DECISIONS only otherwise. If a pathway member of the schema is not listed here, STOP and report.

# Chunk 4.2a: code-authoring SDK, part 2: the decision-node builder (written 2026-11-26, docs only; build after owner approval)

_Phase 4. Needs 4.2 (done). Adds `decisionNode(spec)` to `ccis-sdk.js` and one equivalence test. Same rules as 4.2: pure, plain frozen JSON, no invented content, fixed-sentence errors with a path, the same canonicalizer and validator as the file route._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `ccis/schemas/decision-node.schema.json` (2.8 KB, whole) and the `artefactId` definition in `ccis/schemas/manifest.schema.json` (grep, then `sed` the few lines); `ccis/examples/snake/snake-node-antivenom.node.json` (2.7 KB; the clotting node is the second target, read only its first 25 lines for a shape that differs); `ccis-sdk.js` (whole, 94 lines: extend it); `test/ccis-sdk.test.js` lines 1-25 (helpers to reuse; extend the file). Do not edit any other file.

## Build (1 module edit of about 55 lines, 1 test edit of 4 cases)
In `ccis-sdk.js`:
1. `shape()` gains `closed: true` in its rules: an `x-` member is then refused `S-001` (the schema's `when` and `next` objects allow no extension keys; the node, its inputs and its outcomes do).
2. A small `list(v, path, { min, item })` helper: a non-array or too short is `S-003` (an array too short is an unacceptable value), items built in order; array order is kept as given (never sorted).
3. `export function decisionNode(spec)`, exactly the schema: `id` (`^[a-z][a-z0-9-]*$`), `question` (text), `inputs` (at least 1 of `key`, `element` (the manifest `artefactId` pattern), `field`), optional `preconditions` (list of text), `outcomes` (at least 2). Outcome: `id`, `kind` (`answer`, `missing-data`, `conflicting`, `indeterminate`), `when` (at least 1 of `input` key and `is` from the eight states `present, absent, unknown, not-collected, not-applicable, explicitly-negative, entered-in-error, conflicting`), `next` (closed; exactly one of `{ stage: id }` or `{ end: true }`), optional `note`.
4. Combination rules, `S-004`: no outcome of kind `indeterminate`; `next` with both or neither of `stage` and `end`. Nothing else: that every `when.input` names a declared input stays with the validator (one source of truth, layer 3), so the SDK adds no rule the file route lacks.
5. Export the two enums as `OUTCOME_KINDS` and `INPUT_STATES` (the test compares them with the schema).

## Test (extend `test/ccis-sdk.test.js`; 4 new cases, file stays at most 12 in total because it holds two families)
1. both node examples are `identical` to their code route through `compareRoutes`, same checksum, and the same validator verdict on file and code;
2. an unknown member at any depth is `S-001` with the path (`outcomes.1.colour`), an `x-` extension passes on the node, an input and an outcome, and is refused inside `when` and `next`;
3. `S-002` for a missing `outcomes`; `S-003` for one outcome only, an empty `inputs`, a bad `kind`, a bad `is`; `S-004` for no indeterminate outcome and for `next` with both or neither key; the two enums equal the schema's (read from the schema, not copied);
4. outcome and input order is kept (swap two outcomes: the routes differ and `firstDifference.path` names `outcomes`), no default (no `preconditions` or `note` appears unless given), and the purity scan still passes.

**Done when:** `node --test test/ccis-sdk.test.js` passes. Two breakages each seen failing, then restored: (a) drop the indeterminate check; (b) sort `outcomes` by id.

**Size guard:** module grows by at most 60 lines (stop at 160 total, then split off the list helper), 4 test cases. If a node field of the schema is not in this list, STOP and report.

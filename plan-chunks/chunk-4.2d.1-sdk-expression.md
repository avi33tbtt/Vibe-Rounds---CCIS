# Chunk 4.2d.1: code-authoring SDK, part 5b: the expression tree and the computation member (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.2d (done). Adds `expr(spec)`, small node helpers and `computation(list)` to `ccis-sdk-analytics.js` (59 lines now). The tree has no numeric literal and no executable code (CCIS-REQ-028): the builder can only produce what the whitelist interpreter accepts, and a number or an unknown operator is refused. Proved on the four snake examples (depth 9 to 12). Same rules as 4.2: pure, plain frozen JSON, no invented content, fixed-sentence errors with a path, same validator as the file route._

**Core rules:** attach `01-core.md` too. Rule 12: a NEW test file `test/ccis-sdk-expression.test.js` (at most 8 cases).

**Read only (4 files):** `ccis/schemas/analytics.schema.json`: the `computation` block (`grep -n '"computation"'`, about 14 lines) and `$defs.expr` (`grep -n '"expr"'`, about 35 lines); `ccis-sdk-analytics.js` lines 1-20 (imports, helpers); `test/ccis-sdk-analytics-inputs.test.js` lines 1-20 (helpers to copy); the `computation` of the four snake analytics examples is loaded by the test, never read (3 to 8 KB each).

## Build (1 module edit of at most 45 lines, 1 new test of at most 8 cases)
In `ccis-sdk-analytics.js`:
1. `export const OPERATORS` (the 18 whitelist names, in schema order) and `REF_KINDS` (`input`, `parameter`, `conversion`); the test compares both with the schema.
2. `export function expr(spec)`, recursive, with a depth guard: a tree deeper than 100 levels is `S-003` at the node path (stack safety only; it is not a content rule, and the run-time limit stays `executionProfile.maxDepth`). Node kind is found by its key:
   - `op` node: exactly `op` (in `OPERATORS`) and `args` (list of at least 1 `expr`, order kept), closed: an `x-` or other member is `S-001`;
   - `ref` node: exactly `ref` (in `REF_KINDS`) and `id` (keyText), closed;
   - `literal` node: exactly `literal`, a boolean or a string; a number, null, array or object is `S-003` at `<path>.literal`; closed;
   - none of the three keys: `S-003` at the node path; more than one kind key: `S-001` at the extra member.
   - NOT added (validator): operator arity, type fit between arguments, a `ref.id` naming no input, parameter or conversion.
3. Helpers returning built nodes: `input(id)`, `param(id)`, `conv(id)` (the three ref kinds), `lit(value)`, `op(name, ...args)`; each goes through `expr`, so a bad call is refused the same way.
4. `export const computation = (v, p = '') => list(v, p, 1, ...)`: each item exactly `output` (keyText) and `expr`, closed (no `x-`), at least 1 item; named `computation()` and exported.

## Test: `test/ccis-sdk-expression.test.js` (at most 8 cases)
1. every `computation` of the four snake examples is `identical` on the code route (JSON text vs `computation(member)`), same checksum, and each ran through the deepest tree;
2. the same expression built with the helpers (`op('if', op('eq', ...), lit('not-applicable'), ...)`) equals the JSON form and is frozen;
3. `OPERATORS` and `REF_KINDS` equal the schema; an unknown operator `S-003` at `<path>.op`; empty `args` `S-003`;
4. no number: `lit(30)`, `{ literal: 30 }`, `{ literal: null }`, `{ literal: [] }` all `S-003` with the path ending `literal`; booleans and strings pass;
5. node kinds: none of the three keys `S-003`; `{ op, ref }` `S-001`; an `x-` member on any node `S-001`;
6. order of `args` kept; paths carry indices (`expr.args.1.args.0.id`);
7. depth: 100 levels build, 101 `S-003`; `computation([])` `S-003`; an `output` that is not a key `S-003`;
8. hostile string never in a message; purity scan of `ccis-sdk-analytics.js` passes.

**Done when:** `node --test test/ccis-sdk-expression.test.js test/ccis-sdk-analytics-inputs.test.js` passes. Two breakages each seen failing, then restored: (a) accept a number literal; (b) drop the depth guard (case 7 must fail or the process must not hang).

**Size guard:** module grows by at most 45 lines, 1 new test file, tracker and DECISIONS only otherwise. If a schema member of these blocks is not listed here, STOP and report.

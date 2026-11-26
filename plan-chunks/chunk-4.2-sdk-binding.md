# Chunk 4.2: code-authoring SDK, part 1: foundation and the terminology-binding builder (written 2026-11-26, docs only; build after owner approval)

_Phase 4 (brief: "Code-authoring SDK and typed builders; equivalence test across routes"). The whole brief is too big for one session (the analytics example is 38 KB), so it is split: 4.2 (this row: the SDK module and the smallest family, the binding), then 4.2a node, 4.2b element, 4.2c pathway, 4.2d analytics. Each later row adds builders to the same module and one equivalence case._

**Core rules:** attach `01-core.md` too. The SDK is pure (no file, network, clock, randomness). CCIS-REQ-086: code authoring must produce the same artefact representation and pass the same pipeline as every other route.

**Read only (5 files):** `ccis/schemas/terminology-binding.schema.json` (2.5 KB, whole); `ccis/examples/snake/snake-demo-terminology.binding.json` (the target); `ccis-compile.js` lines 203-221 (`canonicalize`, `checksumOf`) and 301-322 (`compareRoutes`); `ccis-validator.js` lines 550-612 (`validateArtefact`; check by ONE call whether a lone binding is accepted, and if not, validate it with the vendored binding validator under `ccis/validators/`); `test/ccis-compile.test.js` lines 1-25 (test style). Do not edit any of them.

## Build (1 new module, 1 test of at most 8 cases)
New `ccis-sdk.js` (about 80 lines):
- `export class SdkError extends Error` with a stable `code` (`S-001` unknown member, `S-002` missing required member, `S-003` wrong type or value, `S-004` extension key not in the `x-` namespace) and a `path` string. Messages are fixed sentences and never quote the offending value.
- `export function binding(spec)` returns a frozen plain object holding exactly the schema's members. It checks the schema's own rules in code (required members, the `mapping.status` enum, id and version patterns) and refuses unknown members (`x-` keys pass). No defaults and no inference: it never invents a code, display, mapping status or note. An omitted required member is refused, not filled.
- A small internal `shape(spec, rules, path)` helper that the later builders reuse (no export yet; row 4.2a decides whether to export it).
- The output is plain JSON data, so `canonicalize` sorts and checks it exactly as it does a file. Nothing in the SDK computes a checksum or canonical text of its own.

## Test: `test/ccis-sdk.test.js` (at most 8 cases)
1. `binding({...the example's values...})` and the example file are `identical` through `compareRoutes([{name:'json', input: fileText}, {name:'code', input: obj}])`, with the same checksum;
2. both routes get the same verdict from the same validator (same layer and rule ids on a deliberately broken copy, the same pass on the good one);
3. an unknown member is refused `S-001`; an `x-note` extension passes and appears in the canonical text;
4. a missing required member is refused `S-002` with its path;
5. a `mapping.status` outside the schema's enum is refused `S-003`, and the SDK accepts every status the schema lists (read from the schema, not copied);
6. a changed `display` makes `compareRoutes` give `identical: false` with `firstDifference.path` pointing at `display`;
7. error messages never contain the value that was refused (hostile string `<img onerror=x>` in `code`);
8. purity scan of `ccis-sdk.js`: no `import` of `node:`, no `Date`, `Math.random`, `fetch`, `eval`, `Function(`, `import(`, `process`.

**Done when:** `node --test test/ccis-sdk.test.js` passes. Two breakages each seen failing, then restored: (a) let an unknown member through; (b) fill a missing `display` with the code.

**Size guard:** 1 module (about 80 lines; stop at 110), 1 test, 0 edits to existing files except the tracker (rows 4.2a to 4.2d), `README.md` untouched (the SDK is documented when the family set is complete, row 4.2d). If the validator cannot take a lone binding and the vendored validator route is also unclear, STOP and report.

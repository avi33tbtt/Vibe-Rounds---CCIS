# Chunk 4.2d.3: code-authoring SDK, part 5d: the whole `analytics()` and the README SDK section (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.2d to 4.2d.2 (done). Closes the analytics builder: `analytics(spec)` assembles the 15 required members and the two optional ones from the member builders already in `ccis-sdk-analytics.js` (130 lines now), and the README gains a short SDK section. Same rules as 4.2: pure, plain frozen JSON, nothing invented, fixed-sentence errors with a path, same validator as the file route. No member is ever defaulted (no empty `parameters`, no `limitations`, no `tests`)._

**Core rules:** attach `01-core.md` too. Rule 12: a NEW test file `test/ccis-sdk-analytics-whole.test.js` (at most 8 cases).

**Read only (4 files):** `ccis/schemas/analytics.schema.json` top level only (`required`, `operatorSet`, `limitations`, `conversions`, `tests`: `grep -n`, about 25 lines); `ccis-sdk-pathway.js` (38 lines, the whole-artefact pattern to copy); `test/ccis-sdk-pathway.test.js` lines 1-30 (the validator call and `compareRoutes` helper to copy); `README.md` lines 80-95 (where the SDK is mentioned as not built). The four snake analytics examples are loaded by the test, never read.

## Build (1 module edit of at most 40 lines, 1 new test of at most 8 cases, 1 README edit of at most 25 lines)
In `ccis-sdk-analytics.js`:
1. `export const operatorSet`: closed, exactly `name` (`^[a-z][a-z0-9-]*$`) and `version` (`semver`), both required.
2. `export function analytics(spec)`: manifest through `manifest(spec.manifest, { type: 'analytics-package' })`; then, each through the builder of its row: `question`, `population` (text), `intendedUsers` (at least 1 text), `limitations` (closed: `statement` text, `items` list of 0 or more texts), `context` (at least 1 `contextEntry`), `inputs` (at least 1 `analyticsInput`), `parameters` (0 or more `parameter`), optional `conversions` (0 or more `conversion`), `operatorSet`, `computation`, `outputs`, `interpretation`, `executionProfile`, optional `tests`, `evidence`, `provenance`. `x-` members allowed on the top level as on the file route. A missing required member is `S-002`, an unknown one `S-001`; errors keep the inner path (`outputs.1.kind`).
3. NOT added (validator): every cross-reference (an input naming no context element, an output with no computation, an unused parameter, a duplicate key, a `ref.id` naming nothing, a `tests` fixture that does not exist).

In `README.md`: replace the line that says the SDK is not built with a section "Authoring in code (SDK)" of at most 25 lines: the builders by artefact (binding, decision node, element, pathway, analytics), the two routes and `compareRoutes`, the error codes `S-001` to `S-004` (fixed sentences, never a value), and the limits: no defaults, no number literal in an expression, parameters never valued, cross-references checked only by the validator.

## Test: `test/ccis-sdk-analytics-whole.test.js` (at most 8 cases)
1. each of the four snake analytics files is `identical` through `analytics(file)` (same checksum) and gets the same validator verdict on both routes;
2. the result is frozen at the top level and in `outputs`, `computation`;
3. each of the 13 members that the schema requires and the code builds, removed in turn, is `S-002` at that member (a loop, one case);
4. an unknown member `S-001`; an `x-` member kept; `manifest.type` other than `analytics-package` refused;
5. `operatorSet` with a bad name or a missing version refused; `conversions` and `tests` may be absent, and `conversions: []` is kept as given;
6. an error deep inside keeps its path (`outputs.1.kind`, `computation.0.expr.args.1.literal`);
7. cross-references are not checked here: an input naming no context element builds, and the validator then rejects it (the code route and the file route agree);
8. hostile string never in a message; purity scan of `ccis-sdk-analytics.js` passes.

**Done when:** `node --test test/ccis-sdk-analytics-whole.test.js test/ccis-sdk-analytics-closing.test.js` passes. Two breakages each seen failing, then restored: (a) skip the `outputs` member in `analytics()`; (b) let `x-` pass inside `operatorSet`.

**Size guard:** module grows by at most 40 lines (about 170 in all), 1 new test file, README, tracker and DECISIONS only otherwise. If a snake example holds a top-level member this chunk does not list, STOP and report.

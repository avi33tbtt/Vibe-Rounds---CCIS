# Chunk 4.2b: code-authoring SDK, part 3: the manifest and reference builders (written 2026-11-26, docs only; build after owner approval)

_Phase 4. Needs 4.2a (done). The element builder (row 4.2b in the tracker) is too big with its manifest: the element schema is 5.5 KB and the manifest schema 4.5 KB, and the manifest is shared by the element, pathway and analytics builders. So this row builds the manifest alone; the element body becomes row 4.2b.1. Same rules as 4.2: pure, plain frozen JSON, no invented content, fixed-sentence errors with a path, the same canonicalizer and validator as the file route._

**Core rules:** attach `01-core.md` too. Rule 12 (a test file has at most 8 cases): this row uses a NEW test file `test/ccis-sdk-manifest.test.js`; `test/ccis-sdk.test.js` (12 cases, over the limit after 4.2a, recorded as D-233) is not extended again.

**Read only (5 files):** `ccis/schemas/manifest.schema.json` (4.5 KB, whole); `ccis-sdk.js` (whole, 129 lines: extend it); `test/ccis-sdk.test.js` lines 1-20 (helpers to copy); the `manifest` member of each file in `ccis/examples/snake/*.json` (print with `node -e`, one line each, do not read the files whole); `ccis-compile.js` lines 301-322 is already known.

## Build (1 module edit of at most 60 lines, 1 new test of at most 8 cases)
In `ccis-sdk.js` (stop if it would pass 200 lines: then move `SdkError`, `shape`, `list`, `need` into `ccis-sdk-core.js` first, as its own row):
- `export function manifest(spec, { type } = {})`, exactly the schema: required `id` (artefactId pattern), `name` (text), `type` (the six artefact types), `version` (semver), `publisher` (`{ name }`), `standard` (`{ version }`), `status` (nine states); optional `requires` (`engine`, `fhir`: version-range pattern), `references` (list of reference), `validation` (`version`, `population`, `setting`, `intendedUse`, all required inside), `mandatoryExtensions` (list of `^x-[a-z0-9][a-z0-9-]*$`).
- `export function reference(spec)`: `id`, `type`, and exactly one of `version` or `range` (`S-004` for both or neither).
- `manifest` rule `S-004`: status `validated` or `conditionally-validated` without `validation`. Whether the validation scope matches the exact version stays with the validator (layer 8).
- The optional `{ type }` makes any other `type` an `S-003` at path `type` (the element, pathway and analytics builders will pass theirs).
- Export `ARTEFACT_TYPES` and `MANIFEST_STATUSES` (the test compares them with the schema).

## Test: `test/ccis-sdk-manifest.test.js` (at most 8 cases)
1. the `manifest` of every snake example artefact that has one is `identical` on the code route (`compareRoutes` of the member as JSON text vs `manifest(member)`), same checksum;
2. a minimal draft manifest builds, holds only what was given (no `requires`, `references`, `validation`), frozen;
3. references: version xor range (`S-004`), bad id `S-003`, bad type `S-003`, a range reference passes;
4. statuses equal the schema's; `validated` without `validation` is `S-004`; with it passes; a missing member inside `validation` is `S-002` with its path;
5. semver and range patterns: the values used in the examples pass; `1.0`, `^1`, `v1.0.0` refused `S-003`; `mandatoryExtensions` entry without `x-` refused;
6. `{ type }`: a mismatch is `S-003` at `type`; the match passes; both enums equal the schema;
7. unknown member `S-001` with path; `x-` passes on the manifest, publisher, standard, validation and a reference;
8. hostile string never in a message; the purity scan of `ccis-sdk.js` still passes.

**Done when:** `node --test test/ccis-sdk-manifest.test.js test/ccis-sdk.test.js` passes (12 + 8). Two breakages each seen failing, then restored: (a) drop the validated-needs-validation rule; (b) accept both `version` and `range`.

**Size guard:** module grows by at most 60 lines, 1 new test file (8 cases), tracker and DECISIONS only otherwise. If a manifest member of the schema is not listed, STOP and report.

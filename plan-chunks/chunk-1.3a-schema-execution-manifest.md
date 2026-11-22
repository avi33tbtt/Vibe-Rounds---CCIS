# Chunk 1.3a-schema-execution-manifest: Schema for the execution manifest

_Phase 1, Stage 2. Needs: 1.3 (done). Written just in time. Split off from 1.3 for size. This chunk file is docs only; the schema is built at the next "do next"._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/SPEC.md` (REQ-009, 011, 014, 016, 062 to 065, 067, 069, 070, 075); `ccis/schemas/README.md`; `ccis/schemas/manifest.schema.json` (to `$ref` its `semver`, `versionRange`, `artefactId`, `reference`); `ccis/schemas/analytics.schema.json` (only `operatorSet`, `executionProfile`, `outputs` ids); `scripts/build-validators.js`.

## What the execution manifest is

The package manifest (1.1) describes what an artefact **is**. The execution manifest describes what one **run needs**: a closed, fully pinned list of the exact artefact versions, operator set, engine range and limits that the compiler (row 2.4) resolved, so the engine never executes an authoring document or a mutable reference (REQ-064) and the run record can copy it (REQ-075, row 1.4). It is a declaration only. The compiler that produces it, its canonical form and its checksum are Phase 2 (gap G-05).

## Lessons from 1.1 to 1.3 to follow

- Closed objects with `patternProperties: {"^x-": {}}`; id `https://ccis.invalid/schemas/execution-manifest.schema.json`; `$ref` the manifest's `semver`, `versionRange`, `artefactId`; never copy them.
- Ajv strict mode needs `"type": "object"` beside `properties` inside `if`, `allOf`, `contains`, `then`. `strictRequired` is off (D-016).
- No `uniqueItems`, `format`, or non-ASCII `minLength` (they pull in Ajv runtime helpers).

## Decisions this chunk proposes (owner approves the chunk file; builder logs them)

- **Pins are exact.** Every dependency is `{id, type, version}` with an exact semver. A range or `latest` is rejected by the schema (REQ-064). Ranges stay in the package manifest's `requires`; resolving them is the compiler's job.
- **No integrity fields.** No checksum, hash or signature (G-05, decided at row 2.4).
- **Engine is a range here, an exact version only in the run record.** The execution manifest states the engine range the compiled form needs; the run record (1.4) records the exact engine that ran (REQ-011, 075).

## Build

1. **`ccis/schemas/execution-manifest.schema.json`**. Required fields:
   - `package`: `{id, version}` of the analytics package or pathway being run (exact).
   - `standard`: `{version}`; `engine`: `{range}` (a `versionRange`); `fhir` optional `{range}` only where FHIR Mode applies.
   - `operatorSet`: `{name, version}`, same shape as the analytics package, exact version.
   - `dependencies`: array of exact pins `{id, type, version}` (elements, terminology bindings, pathways, conversions' package if any). May be empty only if the package has none; the array itself is required.
   - `mandatoryExtensions`: array of `x-` names (may be empty), so an engine that does not understand one fails safely (REQ-016, 065).
   - `executionProfile`: same three positive integers as the analytics package (`maxSteps`, `maxDepth`, `maxOutputBytes`); `$ref` the analytics definition if it can be shared, otherwise restate it and log why.
   - `outputContractVersion`: semver of the output contract (REQ-070, 075).
   - `compiledFrom`: `{authoringRoute, authoringVersion}` where `authoringRoute` is one of `native`, `fhir`, `ai-assisted` (names the route only; no content).
2. **Build script**: add `execution-manifest` to the export list; regenerate and commit validators.
3. **Left to Phase 2** (add to `ccis/schemas/README.md`): every dependency resolves and matches the package manifest's references; the operator set exists in the engine; the profile is no looser than the package's own profile; compilation fails closed when any pin cannot be resolved (REQ-065); canonical form and checksum (G-05, row 2.4).

## Fixtures (`ccis/fixtures/schemas/`, add to `index.json`), up to 7

Synthetic only; no clinical numbers.
- `execution-manifest-good-minimal`: one package pin, empty dependencies and extensions.
- `execution-manifest-good-full`: several dependencies, a mandatory extension, an FHIR range.
- `execution-manifest-bad-range-pin`: a dependency version written as a range.
- `execution-manifest-bad-latest`: a dependency version `latest`.
- `execution-manifest-bad-no-profile`: no execution profile.
- `execution-manifest-bad-unknown-field`: an unknown non-`x-` field.
- `execution-manifest-bad-checksum`: a `checksum` field (closed object rejects it; G-05).
Inline mutations in the test (not files): missing `operatorSet`; `operatorSet.version` a range; empty `package.id`; `authoringRoute` outside the three; `maxSteps` zero; missing `outputContractVersion`.

## Do not

- No context envelope, import report, validation record, run result or run record (row 1.4). No checksum or signature fields (G-05).
- No edits to `ccis/SPEC.md`. If the spec cannot express a rule, propose a numbered amendment in `ccis/CHANGELOG.md` and stop on that point.
- No clinical numbers, thresholds or defaults anywhere.

## Done when

`npm test` passes once; `npm run build` leaves no diff; the standalone validator has no runtime import; at most 3 deliberate-breakage checks (for example allow a range as a pin, drop `executionProfile` from required, allow extra properties), each seen failing then restored.

## Size guard

1 schema, the build script's export list, up to 7 fixtures plus the index edit, test additions, README update, regenerated validators, up to 3 decision rows. If it does not fit, split off the fixtures and tests as `1.3b`.

# Chunk 1.6b-schemas-tests-validation: Schema members for amendment A-003 (package tests, validation scope)

_Phase 1, Stage 2. Needs: 1.6 and A-003 approved (2026-11-24). Written just in time. This chunk file is docs only; the schema change is built at the next "do next". It replaces the earlier plan for 1.6b, which is split in two (see "Why this row was split")._

**Core rules:** attach `01-core.md` too.

**Read only:** the A-003 entry in `ccis/CHANGELOG.md`; `ccis/schemas/manifest.schema.json`; `ccis/schemas/analytics.schema.json` (the `evidence` member and the top-level `required`/`additionalProperties`); `ccis/schemas/README.md`; `ccis/fixtures/schemas/` file names, for how valid and invalid schema fixtures are named; `ccis/fixtures/snake/index.json` (case ids only); `scripts/build-validators.js`.

## Why this row was split

A-003 is decided, but the committed schemas still reject a `tests` member in a package and a `validation` member in a manifest (closed objects). An invalid layer 7 or layer 8 example that must **pass the schemas** cannot exist until they do. Changing two schemas, regenerating the validators and adding fixtures is a full row. The two invalid examples move to a new row **1.6c**, written after this one is built.

## What A-003 says (restated, nothing added)

1. A package may declare `tests`. Each names a fixture, the parameters it enables (test-only, marked as such) and the expected result by output id.
2. A manifest with status `validated` or `conditionally-validated` must carry a `validation` member naming the exact package version, population, setting and intended use. Both members are optional for status `draft`.

## Decisions this chunk proposes (owner approves the chunk file; builder logs them, at most three rows)

- **Tests carry no values.** A test entry holds: an id; the fixture case id (a string that must exist in the fixture index, which the validator checks at layer 7, not the schema); the ids of the parameters it enables, each with a marker that it is test-only; and the expected result as a map from output id to a declared state or classification label. The parameter **values** come from the named fixture's own expected file (as the demo batch already does, D-065). So `parameters` stays disabled and value-free (D-022), and no number appears in any package file (D-013).
- **Where.** `tests` is an optional member of the analytics schema only in this row. The element schema already has `tests` as a list of references and is left alone. Decision nodes and pathways get `tests` in a later row if needed; this is listed, not built.
- **Validation scope.** `validation` is an optional member of the manifest schema: exact `version` (a semver string), `population`, `setting`, `intendedUse`, each plain text. The schema requires it when `status` is `validated` or `conditionally-validated` (a conditional rule, as terminology binding does for `lossy`). It cannot check that `version` equals the manifest version; that is a layer 8 rule (row 1.6c's example, row 2.x's check).

## Build

1. Edit `manifest.schema.json` (`validation` member, conditional requirement) and `analytics.schema.json` (`tests` member). Closed objects stay closed; `x-` members stay allowed.
2. Regenerate the Ajv standalone validators with `scripts/build-validators.js` (the existing test keeps the generated file current). No `eval` or runtime import (D-005, D-006).
3. Fixtures in `ccis/fixtures/schemas/`, following the existing naming: valid (draft package with tests; validated manifest with a full `validation`; draft without either) and invalid (validated with no `validation`; a test with no expected result; a test enabling a parameter without the test-only marker; a `validation` with an empty population; a test value member, which must stay refused). About 8 files.
4. Add rows to `test/schemas.test.js` (or a new `test/schemas-a003.test.js`): each valid fixture passes, each invalid one fails, and every committed snake artefact still passes unchanged (they must not need edits).
5. `ccis/schemas/README.md`: one short paragraph on the two members and what the schema leaves to layers 7 and 8. `ccis/CHANGELOG.md`: note under A-003 that the schema rows landed. Tracker, `DECISIONS.md`.

**Done when:** the two schemas and the regenerated validators are committed, every new fixture behaves as listed, all existing artefacts still pass, and three deliberate breakages (drop the conditional requirement; allow a value member in a test; drop the test-only marker rule) are seen failing. The owner runs or skips `npm test` as instructed in that session.

**Size guard:** 2 schemas, 1 regenerated file, up to 8 fixtures, 1 test, 1 README paragraph. If more is needed, cut fixtures, not rules.

## Next

Row **1.6c** (chunk file first): the layer 7 invalid example (a test that names a fixture or output that does not exist) and the layer 8 scope example (`validation.version` differs from the manifest version), each one defect, schema-valid, with expected diagnostics, added to `ccis/examples/invalid/`.

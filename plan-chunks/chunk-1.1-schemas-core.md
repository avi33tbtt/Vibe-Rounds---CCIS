# Chunk 1.1-schemas-core: Schemas for manifest, contextual element, terminology binding

_Phase 1, Stage 2. Needs: R0 (done). Decisions: D-005, D-006, D-012. Written just in time from the plan brief for 1.1._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/SPEC.md` (REQ-009 to 016, 020 to 022, 030, 032 to 045); `docs/USE-CASE-SNAKE.md` (the element in words); `docs/TRACEABILITY.md` section 2 (gaps G-05, G-06 only).

## Build

1. **Tooling (verify first, before any schema).** Add ONE pinned dev dependency, Ajv (exact version, no ranges), and commit the lockfile. Write `scripts/build-validators.js` that compiles the schemas with Ajv standalone code generation (JSON Schema 2020-12) and writes the generated validators to `ccis/validators/`, committed. Confirm and record in `DECISIONS.md`:
   - standalone generation works for 2020-12 with the chosen Ajv build;
   - the generated validator files contain no `eval`, `new Function` or dynamic import (a test greps for them);
   - the browser app can later import them as plain ES modules with no schema compiler.
   If this does not hold, STOP and add a decision row and a split row. Do not work around it with a runtime compiler (D-005).
2. **Three schemas** in `ccis/schemas/` (JSON Schema 2020-12, `$id` per schema, closed objects by default):
   - **Manifest**: canonical id (stable when the display name changes, REQ-009), artefact type, own semver version, publisher, targeted standard version (REQ-010), separate slots for engine and FHIR version where they apply (REQ-011), references by exact version or range and never embedded copies (REQ-014), a lifecycle status from the D-012 list, and the `x-` extension rule (REQ-015, 016). Integrity or checksum fields are NOT defined here: that is gap G-05, decided before row 2.4. Do not reserve or invent them.
   - **Contextual element**: identity, clinical intent, data definitions (type, cardinality, units, precision, constraints), concepts with terminology bindings, separate temporal meanings (event, recorded, collection), epistemic state set (absent, unknown, not collected, not applicable, explicitly negative, entered in error, kept distinct), source class set (REQ-036), relationships, provenance, tests; required core plus optional modules (REQ-021, 022, 032, 035, 036). Source-class extension for informants is gap G-01: decide it at 1.4/1.5, not here; leave the source class set as REQ-036 states it.
   - **Terminology binding**: code-system reference, value-set reference, pinned version where one exists, mapping status and confidence, explicit `unmapped` representation (REQ-039, 041, 044). No free-text matching fields; no invented codes.
3. **Rules the schemas must enforce** (in the schema itself where JSON Schema can, otherwise listed in a short `ccis/schemas/README.md` as "validator layer, Phase 2"): numeric fields declare permitted units (REQ-042); no field named or typed as a clinical threshold, dose or band with a value (thresholds are parameters, arrive disabled, and belong to analytics at 1.3); unknown critical fields rejected, `x-` fields allowed.
4. **Fixtures** in `ccis/fixtures/schemas/`: for each schema one valid minimal, one valid fuller, and bad cases, one defect each: missing required field, unknown critical field, bad semver, range-less reference, embedded copy of a referenced artefact, numeric field without units, unversioned binding where a version exists, label-only match. Each bad fixture has a one-line expected diagnostic in a single index file.
5. **Tests** `test/schemas.test.js` (`node --test`): every good fixture passes, every bad fixture fails for its stated reason, no-eval grep on generated validators, generated files are up to date with the schemas (rebuild and compare).

## Do not

- No pathway, decision node, analytics, envelope, import report, run record or manifest checksum schemas (rows 1.2 to 1.4).
- No validator rule ids (CCIS-V-nnn): Phase 2.
- No clinical values anywhere. Fixtures use obviously synthetic ids and the snake element only as far as the schema needs a realistic example.
- Do not edit `ccis/SPEC.md`. If a schema cannot express a requirement or the spec is ambiguous, record a numbered amendment proposal in `ccis/CHANGELOG.md` for the owner and stop on that point.

## Done when

`npm install` then `npm test` passes once; rebuilding validators produces no diff; deliberate-breakage checks (max 3): remove a required field from a schema, add `eval` to a generated file, loosen the units rule, each seen failing then restored.

## Size guard

3 schemas, 1 build script, 1 test file, 1 schemas README, up to 12 small fixtures plus 1 index, generated validators, `package.json` and lockfile. If it does not fit, split into `1.1a` (tooling plus manifest) and `1.1b` (element and terminology binding).

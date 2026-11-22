# Chunk 1.3-schemas-analytics: Schema for the analytics package

_Phase 1, Stage 2. Needs: 1.2 (done). Written just in time from the plan brief for 1.3. The brief's second schema, the execution manifest, is split off as row `1.3a` to keep this chunk inside its size guard._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/SPEC.md` (REQ-005, 028, 029, 032, 033, 042, 043, 066, 069, 070, 072, 073, 074); `docs/USE-CASE-SNAKE.md` sections 4 and 5 (the two analytics and the six parameters); `ccis/schemas/README.md`; `ccis/schemas/pathway.schema.json` (for style and how it refers to analytics); `scripts/build-validators.js`.

## Lessons from 1.1 and 1.2 to follow

- Closed objects with `patternProperties: {"^x-": {}}`; ids `https://ccis.invalid/schemas/<name>.schema.json`; `$ref` the manifest's `reference` and `artefactId`, never copy them.
- Ajv strict mode needs `"type": "object"` beside `properties` inside `if`, `allOf`, `contains` and `then`. `strictRequired` is off (D-016).
- No `uniqueItems`, `format`, or non-ASCII `minLength`: they pull in Ajv runtime helpers and the no-runtime-import test fails.
- Recursion (the expression tree) must compile to standalone code with no runtime import. Verify this first, before writing the rest.

## Decisions this chunk proposes (owner approves the chunk file; builder logs them)

- **G-04 result kinds.** The output contract allows three kinds: `value` (a typed quantity or time with unit and optional certainty), `classification` (one of declared labels), `table` (declared columns, one row per item). `series` is not in 0.1.0. Every output may also end in one of five declared non-value states: `needs-data`, `indeterminate`, `not-applicable`, `conflict`, `parameter-not-enabled`. If approved, the builder adds amendment A-002 to `ccis/CHANGELOG.md` (not to SPEC.md) naming this set; gap G-04 is then closed in `docs/TRACEABILITY.md`.
- **No numbers in the expression tree.** Numbers reach a computation only from inputs, parameters, or a named, versioned unit conversion declared in the package. The tree has no numeric literal. Allowed literals: booleans, the epistemic states, and label strings. This keeps thresholds out (core rules, REQ-029).
- **Parameters carry no value.** A parameter declares id, label, kind, units, allowed range or allowed choices, `enabledByDefault: false` and the role that supplies it. There is no `default`, `value` or `suggested` field: the value is supplied locally and recorded at run time (row 1.4).

## Build

1. **`ccis/schemas/analytics.schema.json`** (REQ-028). Embedded manifest with `type` fixed to `analytics-package`, then:
   - `question`, `intendedUsers`, `population`, `limitations` (text; limitations list may be empty only with an explicit statement field).
   - `context`: element references **with ranges** plus the field keys required.
   - `inputs`: `{key, element, field, type, units?, onMissing}` where `onMissing` declares the explicit missing-data behaviour (REQ-033) as one of the five non-value states. Every input must declare it.
   - `parameters` as above. A `duration` parameter requires `units` and an allowed range; a `choice` requires `allowedChoices`; a `set` requires `allowedMembers`.
   - `conversions`: named, versioned unit conversions (REQ-043); the only place a conversion factor may appear.
   - `computation`: one closed expression tree. Node shape `{op, args}` or a leaf `{ref: input|parameter|conversion, id}` or an allowed literal. `op` is a closed enum (the whitelist, D-006): three-valued logic (`and`, `or`, `not`), state tests (`is-present`, `state-of`), comparison (`eq`, `ne`, `lt`, `le`, `gt`, `ge`), arithmetic (`add`, `sub`), time (`time-diff`, `convert`), `if`, `count`, `select`. Arity and type checking of the tree are Phase 2; the schema enforces the whitelist, closed shapes and no numeric literals. Add `operatorSet` (name and exact version) so run records can name operator versions (REQ-075).
   - `outputs`: the output contract per kind above, each with the allowed non-value states and a `carries` list that must include `warnings`, `limitations` and `missingDataNotes` (REQ-073).
   - `interpretation`: `{meaning, prohibited[]}`. No field for a recommendation or decision-support use: the object is closed, so these packages stay descriptive (REQ-005).
   - `executionProfile`: `{maxSteps, maxDepth, maxOutputBytes}` positive integers (REQ-069).
   - `evidence`: sources (kind, citation text) and a statement; `provenance`: `{origin, basis}`.
2. **Build script**: add `analytics` to the export list; regenerate and commit validators.
3. **Left to Phase 2** (add to `ccis/schemas/README.md`): operator arity and types; every `ref` resolves; every parameter used is declared; unit consistency (REQ-042, 043); each output reachable; execution-profile feasibility; a computation that depends on a disabled parameter reports it (REQ-072, a runtime rule).

## Fixtures (`ccis/fixtures/schemas/`, add to `index.json`), up to 10

Synthetic only; no clinical numbers.
- `analytics-good-minimal`: one input, no parameters, one `value` output.
- `analytics-good-full`: shaped like dossier Analytic A with parameters for a target duration, an accepted-certainty choice and an edge rule (all disabled, no values), one conversion, a `time-diff` computation, a `value` and a `classification` output.
- `analytics-bad-parameter-value`: a parameter carrying `default` or `value`.
- `analytics-bad-parameter-enabled`: `enabledByDefault: true`.
- `analytics-bad-duration-no-units`: a duration parameter without units or range.
- `analytics-bad-operator`: an operator outside the whitelist.
- `analytics-bad-numeric-literal`: a numeric literal in the tree.
- `analytics-bad-input-no-onmissing`: an input without declared missing-data behaviour.
- `analytics-bad-output-kind`: an output kind outside the three.
- `analytics-bad-no-profile`: no execution profile.
Inline mutations in the test (not files): a `recommendation` field on the package; empty `outputs`; `carries` missing `limitations`; `type` of the manifest not `analytics-package`; a `ref` without `id`; a tree node with both `op` and `ref`.

## Do not

- No execution manifest (row 1.3a), envelope, import report, validation record, run result or run record (rows 1.3a and 1.4). No checksum fields (gap G-05, before row 2.4).
- No edits to `ccis/SPEC.md`. Where the spec cannot express a rule, propose a numbered amendment in `ccis/CHANGELOG.md` and stop on that point.
- No clinical numbers, thresholds or defaults anywhere. Test-only placeholders (D-013) belong to fixtures at row 1.5, not here.

## Done when

`npm test` passes once; `npm run build` leaves no diff; the standalone validator contains no runtime import; at most 3 deliberate-breakage checks (for example allow a numeric literal, default `enabledByDefault` to true, drop `onMissing` from required), each seen failing then restored.

## Size guard

1 schema, the build script's export list, up to 10 fixtures plus the index edit, test additions, README update, regenerated validators, up to 3 decision rows. If it does not fit, split into `1.3b` (inputs, parameters, conversions) and `1.3c` (computation, outputs, profile).

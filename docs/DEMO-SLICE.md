# Demo slice scope contract (row DS0, 2026-11-23)

Prototype. Synthetic data only. Not for clinical use. This is **not** the CCIS standard runtime (rows 2.x, 3.x). It is a small, clearly labelled demo runner so the EMR and CCIS can be shown working end to end.

## Purpose
Take a context envelope from the EMR Enhancer (schema: `ccis/schemas/context-envelope.schema.json`), run the snake-envenomation reference artefacts, and return a run record (`run-record.schema.json`) with provenance. Demonstrates D-001 (integration only through an export file), D-007 (three-valued results) and D-009 (immutable run records).

## In scope (real)
- Loading the example artefacts in `ccis/examples/snake/` (element, binding, pathway with 2 nodes, 2 analytics at version 0.1.1 after row 1.5b).
- Validating artefacts, the envelope and the output with the committed Ajv validators (no `eval`).
- A whitelist interpreter for only the operators the two analytics and two nodes use. Unknown operator = refuse, never guess.
- Three-valued results and the six data states; explicit indeterminate and missing-data branches.
- A run record: content-addressed id, input snapshot, package, standard and engine versions, parameters (enabled or disabled), evaluation time with zone, results, warnings, limitations.
- A Node CLI (`ccis-cli.js`) and a static viewer page.
- Byte-identical output for identical inputs.

## Staged (clearly labelled in the UI)
- Cohort view (DS6): a batch of the real runner over the 23 synthetic fixture cases, shown as aggregate counts. Labelled "staged, not the cohort engine (rows 5.x)".
- Second package: shown only as a roadmap card (second demo is row 4.5).

## Out of scope
Full layered validator and compiler (2.x), importer with compatibility rules (3.x), marketplace, templates, research-to-package, LLM, FHIR Mode, any server or database, any network request.

## Safety rules for the demo
1. Thresholds stay **disabled** by default (D-008). The runner enables the test-only placeholder values only when the CLI is given `--demo-parameters`; every record and view then carries "demo placeholders, not clinical values".
2. Outputs are descriptive process metrics. No treatment criteria, doses or recommendations.
3. Unknown, absent, not collected, not applicable, negative and entered-in-error stay distinct; unknown never becomes false or normal.
4. Demo files use the prefix `ccis-demo-` and carry a header comment "DEMO RUNNER: replaced by rows 2.x and 3.x". The CLI `ccis-cli.js` and the fixtures are kept; the fixtures remain the regression oracle for the real executor.

## Acceptance
Every fixture case in `ccis/fixtures/snake/index.json` produces a run record whose `results` equal its `.expected.json`. The EMR's exported envelope for the seeded demo case produces a record that the EMR imports.

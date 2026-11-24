# FHIR Mode worked example (row 1.6a)

Prototype. Synthetic data only. Not for clinical use. **Nothing converts anything yet.** The converter and the mapping tables belong to row 6.1. These files are written by hand and are the target a later converter must reproduce and report (REQ-091: FHIR Mode is a route into the same model, not a second engine; REQ-092: every unsupported or lossy construct is reported).

## The files

| File | What it is |
|------|------------|
| `snake-timing.questionnaire.json` | The input: a small, hand-written FHIR R4 Questionnaire (version label only, not a claim of full conformance). Ten mappable items, one free-text item, one derived item, and two extensions the example is meant to drop or refuse. |
| `snake-timing-fhir.element.json` | The output: the CCIS element a conversion would give, from the mappable items only. It has its own id and does not replace the artefact in `ccis/examples/snake/`. It passes the element schema. |
| `snake-timing.mapping-report.json` | The report: every source item and extension listed once, with an outcome, a reason or note, and counts. It also names the defaults the converter had to add and the declared limits. |

## The five outcomes

`mapped` (to a named field), `mapped-with-note` (lossy, with the loss in words and a confidence of the kind the terminology binding uses), `excluded-by-policy` (free text), `unsupported` (refused, with a reason and a hint), `ignored-presentation` (no clinical meaning; dropped but still reported).

## What this example shows

- The form's coded answers point at the local `ccis-demo` value sets by name. No real code, code system or terminology url is written anywhere (IMP-073). The two extension urls are synthetic `example.invalid` stand-ins, not the real definitions.
- A time answer in the form cannot say "estimate" or tell event time from recorded time, so those two fields are `mapped-with-note`.
- The free-text item is excluded by policy. The derived "gap" item and its calculated expression are refused: elements hold facts, and calculations belong in an analytics package. The styling extension is dropped and still reported.
- Things the form never states (the six data states, who entered a value, setting, population, relationships between fields) are filled with stated defaults or marked as not stated, and listed under `defaultsApplied`. Nothing is invented.

## LIMITS

- One-way only. No round trip back to FHIR is claimed.
- No SDC (Structured Data Capture) conformance is claimed.
- No real terminology is resolved. Terminology mapping stays unverified.
- The converted element is unreviewed and draft. A valid Questionnaire does not make a valid CCIS element (REQ-092). The element is checked here against the committed element schema only; the eight validator layers (see `ccis/examples/invalid/README.md`) are still to come.

## Proposed amendment A-004

There is no schema for a conversion report, so the report here is an illustrative shape, checked by `test/fhir-mode-example.test.js` for internal consistency only. `ccis/CHANGELOG.md` records proposed amendment **A-004** for the owner to decide; row 6.1 uses the decision.

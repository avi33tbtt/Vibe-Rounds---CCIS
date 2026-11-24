# Chunk 1.6a-fhir-mode-example: A FHIR-Mode example with a mapping report and declared limits

_Phase 1, Stage 2. Needs: 1.6 (done, with layer 7 open). Split from the plan brief for 1.6. Written just in time. This chunk file is docs only; the example is built at the next "do next"._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/SPEC.md` REQ-011, 039, 091, 092 and section 12; `docs/TRACEABILITY.md` lines naming FHIR (Ch6 6.2, Ch7 8, Ch10 6, the deferred table); `ccis/examples/snake/snake-envenomation.element.json` and `snake-demo-terminology.binding.json`; `ccis/examples/snake/README.md`; `ccis/schemas/README.md`; the `fhir` members of `manifest.schema.json` (`requires.fhir`) and `execution-manifest.schema.json`.

## What this row is, and what it is not

REQ-091 says FHIR Mode is a route into the **same** canonical model, not a second engine. REQ-092 says every unsupported or lossy construct in a conversion must be reported, and a syntactically valid FHIR resource is never assumed to be a valid CCIS artefact. The **mapping tables and the conversion tool belong to row 6.1** (TRACEABILITY, "FHIR Mode mapping tables"), so this row builds no converter and no tables.

It builds one **worked example** that shows what a later converter must produce and report: a small FHIR form as input, the CCIS element it would become, a report saying what mapped, what was lost and what was refused, and a plain statement of what is not claimed. Everything is written by hand and is a target for row 6.1, in the same way row 1.6's invalid examples are targets for the validator.

## Lessons from earlier rows to follow

- **No invented codes (IMP-073).** No SNOMED, LOINC, ICD or similar code is written from memory, in the FHIR file or anywhere. Coded answers use the local `ccis-demo` labels already in the binding, marked demonstration and unverified.
- **No threshold, dose, number-with-clinical-meaning** in any file (D-013). Parameters stay disabled and value-free (D-022).
- The example reuses the nine facts of the snake element (F1 to F9). It does not add a new use case.
- Plain prose; the validator safety test scans for forbidden words.
- A schema gap stops the build and is listed (as in row 1.6). Nothing is stretched.

## Decisions this chunk proposes (owner approves the chunk file; builder logs them)

- **Input.** A hand-written, minimal FHIR R4 **Questionnaire** (R4 is version 4.0.1; written as a label, not a claim of full conformance) with one item per snake fact: date-time items for the four time facts, choice items for the coded facts, a free-text notes item, and two constructs the example is meant to refuse (a calculated-expression extension and a purely presentational styling extension). Choice answers use `ccis-demo` labels only. File marked synthetic.
- **Output.** The CCIS element **as the conversion would give it**: a copy of the existing `snake-envenomation.element.json` content, built from the Questionnaire's mappable items only, with the unmapped item and refused constructs absent. It must validate against the element schema. It is a new file with its own id (not the existing element) so the existing artefacts stay untouched.
- **Mapping report.** A JSON file listing every source item and construct exactly once with one of five outcomes: `mapped` (to a named field key), `mapped-with-note` (lossy, with the loss in words and a confidence of the kind terminology binding already uses), `excluded-by-policy` (for example free text, which core rules exclude by default), `unsupported` (refused, with the reason and a hint), and `ignored-presentation` (no clinical meaning, safe to drop, still reported). It records the FHIR version label, the CCIS standard version, a count per outcome, and states that the result is unreviewed. **No schema exists for it**, so it is documented as an illustrative shape and checked by the test only for internal consistency. A proposed amendment **A-004** records the gap (a conversion-report schema, REQ-092) in `ccis/CHANGELOG.md` for the owner to decide; row 6.1 uses the decision. This is not a stop: the report is a target example, and the gap is listed.
- **Declared limits.** A short `LIMITS` section in the example's README and in the report: one-way only (no round trip claimed); no SDC conformance claimed; terminology not resolved against any real code system; the converted element is unreviewed and draft; a valid Questionnaire does not make a valid CCIS element (REQ-092), so the converted element is run through the committed element schema and the 1.6 layer list is named as the checks still to come.
- **Location.** `ccis/examples/fhir-mode/`: `snake-timing.questionnaire.json`, `snake-timing-fhir.element.json`, `snake-timing.mapping-report.json`, `README.md`.

## Build

1. The four files above.
2. **`ccis/examples/fhir-mode/README.md`:** what each file is; that nothing converts anything yet (row 6.1); the declared limits; the proposed amendment A-004.
3. **`ccis/CHANGELOG.md`:** add **A-004 (proposed, awaiting owner approval)**, same layout as A-003: requirement REQ-092, gap (no place for a conversion report), proposed change in words (a report lists each source construct once with an outcome, a reason, and counts, and names both versions), raised by 1.6a.
4. **`test/fhir-mode-example.test.js`:** (a) the converted element passes the element schema; (b) every FHIR item and construct in the Questionnaire appears exactly once in the report, and nothing in the report is absent from the Questionnaire; (c) the outcome counts add up to the number of source constructs; (d) every `mapped` entry names a field key that exists in the converted element, and every converted field is named by at least one mapped entry; (e) the unmapped item and both refused constructs are absent from the element; (f) coded answers use only `ccis-demo` labels and no real terminology system url appears anywhere in the three files; (g) no number in any file other than item ids and versions; the report says unreviewed; the limits text names one-way, no SDC conformance and no real terminology.
5. Tracker, DECISIONS (at most three rows).

**Done when:** the four files and the test are committed, the element passes its schema, the report is internally consistent, and three deliberate breakages (drop a report entry; add a real-looking code system url; change a mapped field key) are seen failing. The owner runs or skips `npm test` as instructed in that session.

**Size guard:** 3 example files, 1 README, 1 test, 1 changelog entry. If the report needs more than about 20 entries, cut items, not rules.

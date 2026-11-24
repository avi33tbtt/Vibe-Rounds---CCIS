# CCIS Change Log

Newest first. The standard follows semantic versioning (CCIS-REQ-012 in `SPEC.md`; the amendment rule below implements CCIS-REQ-019).

## A-001 (2026-11-23): informant source class (gap G-01)

- **Requirements affected:** CCIS-REQ-036 (every value carries a source class from a closed set); clarifies, does not change, CCIS-REQ-037.
- **Change:** the source-class set gains one value, `informant-reported`: a value reported by someone other than the patient (for example a companion giving a bite time). It is distinct from `patient-reported`, is never merged into it, and is never treated as verified. The set is now: patient-reported, informant-reported, clinician-entered, clinician-verified, imported, device, derived, ai-proposed.
- **Reason:** the use-case dossier (`docs/USE-CASE-SNAKE.md`, question 5) found that an informant's report fits none of the seven classes without being merged into another.
- **Raised by:** task 1.4 (`plan-chunks/chunk-1.4-schemas-envelope-report.md`).
- **Approved:** by the project owner on 2026-11-23, by approving that chunk file ("do next"). `ccis/SPEC.md` text is not edited; this entry is the amendment.

## A-004 (proposed 2026-11-24, awaiting owner approval): a conversion report for FHIR Mode

- **Requirements affected:** CCIS-REQ-092 (every unsupported or lossy construct in a conversion is reported; a valid FHIR resource is never assumed to be a valid CCIS artefact); CCIS-REQ-091.
- **Gap:** no schema or contract says what a conversion report holds, so a converter has nothing to be tested against.
- **Proposed change (words only, for the owner to approve or change):** a conversion report lists each source construct exactly once, with an outcome (mapped, mapped with a note, excluded by policy, unsupported, ignored as presentation), a reason or note, and a hint for refused constructs; it gives counts per outcome that add up to the number of source constructs; it names the source version label and the CCIS standard version; it lists the defaults the converter added; it states that the result is unreviewed. A schema follows in row 6.1 once decided.
- **Reason:** the worked example in `ccis/examples/fhir-mode/` needs a report shape to aim at; today it is illustrative only.
- **Raised by:** task 1.6a (`plan-chunks/chunk-1.6a-fhir-mode-example.md`).
- **Approved:** not yet. `ccis/SPEC.md` text is not edited.

## A-003 (proposed 2026-11-24, awaiting owner approval): where a package declares its own tests and its validation scope

- **Requirements affected:** CCIS-REQ-088 (eight validator layers; layer 7 test verification and layer 8 governance); CCIS-REQ-089 (diagnostics must be demonstrable).
- **Gap:** analytics packages and pathways have no member in which to declare their own test cases (inputs plus the expected result, tied to a fixture), so layer 7 has nothing to verify and no invalid example can be written for it. The element schema holds only `tests`, a list of references. The manifest has `status: validated` but no member for the version, population, setting and intended use the claim covers (core rule: "validated" always carries scope).
- **Proposed change (words only, for the owner to approve or change):** (1) a package may declare `tests`: each names a fixture, the parameters it enables (test-only, marked as such) and the expected result by output id; (2) a manifest that has status `validated` or `conditionally-validated` must carry a `validation` member naming the exact package version, population, setting and intended use. Both are optional for status `draft`.
- **Reason:** gate B-03 needs an invalid example, with expected diagnostics, for every layer, and layer 8 must check that a claim matches the exact version and scope.
- **Raised by:** task 1.6 (`plan-chunks/chunk-1.6-invalid-examples.md`). Row `1.6b` builds the layer 7 example, and the layer 8 scope example, once this is decided; schema rows follow the decision.
- **Approved:** not yet. `ccis/SPEC.md` text is not edited.

## A-002 (2026-11-23): kinds of result (gap G-04)

- **Requirements affected:** CCIS-REQ-070 (outputs checked against a declared output contract); clarifies, does not change, CCIS-REQ-066.
- **Change:** an output contract declares one kind per output: `value` (a typed quantity, time or integer with unit), `classification` (one of declared labels) or `table` (declared columns). `series` is not part of 0.1.0. Any output may also end in one of five declared non-value states: `needs-data`, `indeterminate`, `not-applicable`, `conflict`, `parameter-not-enabled`. A state is reported, never converted into a value.
- **Reason:** the book (Ch6 section 7.2) names several kinds of result, and the spec only required that outputs match a declared contract.
- **Raised by:** task 1.3 (`plan-chunks/chunk-1.3-schemas-analytics.md`).
- **Approved:** by the project owner on 2026-11-23, by approving that chunk file ("proceed"). `ccis/SPEC.md` text is not edited; this entry is the amendment. `A-001` (gap G-01) was raised at row 1.4.

## 0.1.0-draft (2026-11-22)

First draft baseline of `ccis/SPEC.md`: normative requirements in words only, each with an id `CCIS-REQ-nnn` and a rationale; the eight validator layers by name; and an empty requirements matrix (test column unfilled).

Not included, by design: schemas, field-level shapes, validator rule catalogue, compiler algorithm, storage formats, CLI and module interfaces, FHIR Mode mapping tables, cohort contracts. These belong to Stage 2 or later.

## Amendment rule

The specification is prototype-baselined in Phase 0 and is not frozen. It is frozen at CCIS 0.1.0.

1. A gap or error found after this baseline is recorded here as a **numbered amendment** (`A-001`, `A-002`, and so on), in the order raised.
2. Each amendment states: the requirement ids affected, the change, the reason, and the task that exposed it.
3. An amendment takes effect only after the project owner approves it, and the approval is recorded in the entry.
4. Requirement ids are never reused. A withdrawn requirement keeps its id and is marked withdrawn.
5. Amendments are added; entries above are never edited after the fact.

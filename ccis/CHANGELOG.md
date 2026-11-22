# CCIS Change Log

Newest first. The standard follows semantic versioning (CCIS-REQ-012 in `SPEC.md`; the amendment rule below implements CCIS-REQ-019).

## A-001 (2026-11-23): informant source class (gap G-01)

- **Requirements affected:** CCIS-REQ-036 (every value carries a source class from a closed set); clarifies, does not change, CCIS-REQ-037.
- **Change:** the source-class set gains one value, `informant-reported`: a value reported by someone other than the patient (for example a companion giving a bite time). It is distinct from `patient-reported`, is never merged into it, and is never treated as verified. The set is now: patient-reported, informant-reported, clinician-entered, clinician-verified, imported, device, derived, ai-proposed.
- **Reason:** the use-case dossier (`docs/USE-CASE-SNAKE.md`, question 5) found that an informant's report fits none of the seven classes without being merged into another.
- **Raised by:** task 1.4 (`plan-chunks/chunk-1.4-schemas-envelope-report.md`).
- **Approved:** by the project owner on 2026-11-23, by approving that chunk file ("do next"). `ccis/SPEC.md` text is not edited; this entry is the amendment.

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

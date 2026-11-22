# CCIS Change Log

Newest first. The standard follows semantic versioning (CCIS-REQ-012 in `SPEC.md`; the amendment rule below implements CCIS-REQ-019).

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

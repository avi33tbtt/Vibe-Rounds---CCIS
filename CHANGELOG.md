# CCIS Change Log

Newest first. The standard follows semantic versioning (CCIS-REQ-012 in `SPEC.md`; the amendment rule below implements CCIS-REQ-019).

## 0.1.0 (2026-11-25)

- **Status:** the first release target (plan section 7, row 3.11), frozen. Gate C passed: `npm run accept` 6/6, the negative tests pass, and the owner approved `docs/LIMITATIONS.md` on 2026-11-25 ("approve limitations").
- **Contains:** the snake slice (one pathway, two analytics), the CLI, the browser page, `npm run accept` and the negative tests.
- **Version:** `package.json` is 0.1.0. The tag `v0.1.0` is made by the owner (`git tag v0.1.0`).

## A-009 (2026-11-28): operators and standard 0.2.0 (0.2.0)

- **Requirements affected:** CCIS-REQ-107 and CCIS-REQ-108; CCIS-REQ-019 (the amendment rule applied).
- **Change:** The executor gains `min`, `max` and `coalesce` (three-valued; operator set 0.2.0; refusals X-017 and X-018). The validator, the compatibility check and the importer accept standard 0.2.0, 0.1.0 artefacts still validate, and the strict concept and group rules start at minor 2. Record stamps stay 0.1.0.
- **Reason:** The ecosystem plan needs rules and analytics that compare values, and one standard version that carries the new members.
- **Raised by:** rows B9 and B19 (`plan-chunks/chunk-B9-exec-min-max-coalesce.md`, `chunk-B19-standard-0-2-0.md` in the Studio repo).
- **Approved:** by the project owner on 2026-11-28, by approving `plan-chunks/chunk-B20-docs-amendments.md` ("do next"). The text of `ccis/SPEC.md` is not edited; only matrix rows REQ-095 to REQ-108 are appended.

## A-008 (2026-11-28): rule packs (0.2.0)

- **Requirements affected:** CCIS-REQ-102 to CCIS-REQ-106; CCIS-REQ-019.
- **Change:** A new artefact type `rule-pack`: class `data-quality` only; no number, threshold or parameter value in a rule; each rule has fires, does-not-fire and not-evaluated tests; parameters arrive disabled; a prompt carries the rule id, pack version, pack checksum and record ids, never values; the reviewer is never the author.
- **Reason:** The EMR needs visible data-quality prompts that never order or change data, and clinical prompts wait for a named clinician owner (ED-2, ED-6).
- **Raised by:** rows B10 to B14a and B17.
- **Approved:** by the project owner on 2026-11-28, by approving `plan-chunks/chunk-B20-docs-amendments.md` ("do next"). The text of `ccis/SPEC.md` is not edited; only matrix rows REQ-095 to REQ-108 are appended.

## A-007 (2026-11-28): entry form, contexts and composition (0.2.0)

- **Requirements affected:** CCIS-REQ-099 to CCIS-REQ-101; CCIS-REQ-019.
- **Change:** A pathway may carry a layout-only `entryForm` (sections, element and section items, row groups) and `contexts`. Composition is by reference and matches fields by concept key, never by label; a conflict report names the owner, the users, the unit and the blockers.
- **Reason:** The EMR entry form is a pathway, and two pathways must share a field once.
- **Raised by:** rows B5 to B8a and B16a.
- **Approved:** by the project owner on 2026-11-28, by approving `plan-chunks/chunk-B20-docs-amendments.md` ("do next"). The text of `ccis/SPEC.md` is not edited; only matrix rows REQ-095 to REQ-108 are appended.

## A-006 (2026-11-28): concept keys and ownership (0.2.0)

- **Requirements affected:** CCIS-REQ-095 to CCIS-REQ-098; CCIS-REQ-019.
- **Change:** A field may carry a concept key in the `local` code system (optional `concept`, `contexts`, `ownedBy`). A concept has exactly one owner element; others reference it; the market refuses a second owner (M-014). A new local `terminology-package` holds keys, value sets and replacement links; no licensed code list. Note: `docs/TRACEABILITY.md` calls the checksum amendment (REQ-093, 094) "A-005" while this file uses A-005 for administrations; both are left as written (ED-61).
- **Reason:** Concepts must follow a patient across pathways without matching by label.
- **Raised by:** rows B1 to B4, B15 and B16.
- **Approved:** by the project owner on 2026-11-28, by approving `plan-chunks/chunk-B20-docs-amendments.md` ("do next"). The text of `ccis/SPEC.md` is not edited; only matrix rows REQ-095 to REQ-108 are appended.

## A-005 (2026-11-26): envelope section administrations (0.3.0)

- **Requirements affected:** CCIS-REQ-082 and CCIS-REQ-084 (clarified, not changed); CCIS-REQ-019 (the amendment rule applied).
- **Change:** the context envelope gains one optional section, `administrations`. Each item has a classified concept id, an `outcome` (`given`, `held`, `refused`, `unknown`), status, source class, provenance, recorded time, and optionally an effective time, an `orderRef` and a `correctionOf`. It has no free-text member (no dose, reason, note, route or site). A section needs envelope version 0.3.0 or later; entered-in-error and `unclassified` entries are never kept; held and refused are never a dose; `orderRef` is carried as given and not checked. Accepted administrations are read into the context but not yet bound to analytics (D-229).
- **Reason:** the EMR row R5h needs to export the medication administration record without free text.
- **Raised by:** rows E2a, E2b and E2c (`plan-chunks/chunk-E2a-envelope-administrations-schema.md`, `chunk-E2b-envelope-administrations-importer.md`, `chunk-E2c-envelope-administrations-paperwork.md`).
- **Approved:** by the project owner on 2026-11-26, by approving those chunk files ("do next"). `ccis/SPEC.md` text is not edited (D-214); the version numbers of the package, the standard and the importer are unchanged (D-215).

## A-004 (2026-11-26): envelope sections for the EMR (0.2.0)

- **Requirements affected:** CCIS-REQ-082 and CCIS-REQ-084 (clarified, not changed); CCIS-REQ-019 (the amendment rule applied).
- **Change:** the context envelope gains four optional sections. `problems`, `allergies` and `orders` share one classified-item shape: a classified concept id, a closed lifecycle (`active`, `resolved`, `stopped`, `cancelled`, `replaced`, `unknown`), status, source class, provenance and recorded time, and no free-text member. `results` reuse the observation shape. A section needs envelope version 0.2.0 or later; a 0.1.0 envelope that carries one is refused. Entered-in-error items and items with the reserved concept `unclassified` are never kept (reported rejected or unmapped). Accepted items and results are read into the context but are not yet bound to analytics or put in the run snapshot (D-211). 0.1.0 envelopes and fixtures stay valid and give identical contexts.
- **Reason:** the EMR rows R3i and R4j need to export problems, allergies, orders and results without free text.
- **Raised by:** rows E1a, E1b and E1c (`plan-chunks/chunk-E1a-envelope-sections-schema.md`, `chunk-E1b-envelope-sections-importer.md`, `chunk-E1c-envelope-sections-paperwork.md`).
- **Approved:** by the project owner on 2026-11-26, by approving those chunk files ("do next"). `ccis/SPEC.md` text is not edited (D-214); the version numbers of the package, the standard and the importer are unchanged (D-215).

## A-002 (2026-11-23): kinds of result (gap G-04)

- **Requirements affected:** CCIS-REQ-070 (outputs checked against a declared output contract); clarifies, does not change, CCIS-REQ-066.
- **Change:** an output contract declares one kind per output: `value` (a typed quantity, time or integer with unit), `classification` (one of declared labels) or `table` (declared columns). `series` is not part of 0.1.0. Any output may also end in one of five declared non-value states: `needs-data`, `indeterminate`, `not-applicable`, `conflict`, `parameter-not-enabled`. A state is reported, never converted into a value.
- **Reason:** the book (Ch6 section 7.2) names several kinds of result, and the spec only required that outputs match a declared contract.
- **Raised by:** task 1.3 (`plan-chunks/chunk-1.3-schemas-analytics.md`).
- **Approved:** by the project owner on 2026-11-23, by approving that chunk file ("proceed"). `ccis/SPEC.md` text is not edited; this entry is the amendment. `A-001` is reserved for gap G-01 (informant source class) and has not been raised.

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

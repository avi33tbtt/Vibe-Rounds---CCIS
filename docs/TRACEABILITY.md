# CCIS Traceability and Acceptance Checklist, draft 0.1

> **Status:** draft for review at gate R0. Prototype. Synthetic data only. Not for clinical use. This file contains no schemas, field names or code. It links the research book, the specification, the build rows and the acceptance criteria.

## 0. How to read this file

- **Section 1** maps each numbered heading of Chapters 6 to 10 of the book to the requirement ids in `ccis/SPEC.md` and to the tracker row that will implement it. Chapters 1 to 5 are background and are not mapped heading by heading.
- Requirement ids are written `REQ-nnn` here for short; the full form is `CCIS-REQ-nnn`.
- **Coverage:** Covered (the spec has the requirement), Partial (some of it is required, the rest is a gap), Gap (nothing in the spec yet), No requirement needed (narrative, plan or process).
- **Section 2** lists the gaps, each with a number `G-nn`. Gaps are **not** spec amendments yet. An amendment needs the project owner's approval (`ccis/CHANGELOG.md`).
- **Section 3** is the acceptance checklist. **Section 4** lists the deferred Stage 2 items. **Section 5** traces the import contract and the use case. **Appendix A** is the requirement index.
- Tracker rows: `1.1` to `6.4` are the rows of `CCIS_TASK_TRACKER.md`. Rows from Phase 1 are locked until the user says "start stage 2".

## 1. Book concept to requirement to row

| Book | Concept | Coverage | Requirements | Implemented by (rows) | Note |
|------|---------|----------|--------------|-----------------------|------|
| Ch6 | 1 Two products, one shared clinical context model | Covered | REQ-003, REQ-004 | 3.1 |  |
| Ch6 | 1.1 What contextual EMR data means | Covered | REQ-032, REQ-035, REQ-036 | 3.1 |  |
| Ch6 | 2 The end-to-end user workflow | No requirement needed | (none) | 3.7, 3.8, 3.9, 3.11 | Process narrative; proven by the slice. |
| Ch6 | 2.1 Example workflow | No requirement needed | (none) | 3.11 | Becomes the one-command slice test. |
| Ch6 | 3 The GitHub knowledge marketplace | Partial | REQ-017, REQ-079, REQ-080, REQ-081 | 3.6, 4.1 | Repository organisation and index not specified (G-06). Content boundary is covered. |
| Ch6 | 3.1 Two primary package families | Covered | REQ-020 | 1.1 to 1.3 | Ch7 refines this to six artefact families. |
| Ch6 | 3.2 Suggested repository organisation | Gap | (none) | 3.6, 4.1 | No requirement; layout is Stage 2 (G-06). |
| Ch6 | 3.3 A package manifest is mandatory | Partial | REQ-009, REQ-010, REQ-011, REQ-014 | 1.1 | Manifest contents are Stage 2. Integrity and checksum are not yet a requirement (G-05). |
| Ch6 | 4 Compatibility: the key marketplace capability | Covered | REQ-055, REQ-056, REQ-057, REQ-058, REQ-059, REQ-060, REQ-061 | 3.2 |  |
| Ch6 | 4.1 Three levels of compatibility | Covered | REQ-055 | 3.2 | Superseded by Ch7 s11.1 (six checks). |
| Ch6 | 4.2 Compatibility matching sequence | Covered | REQ-055, REQ-060 | 3.2, 3.6 |  |
| Ch6 | 4.3 The analytics listing should explain itself | Covered | REQ-057 | 3.2, 3.8 |  |
| Ch6 | 5 The intelligence and analytics engine | Covered | REQ-062, REQ-063, REQ-064, REQ-065, REQ-066, REQ-067, REQ-068, REQ-069, REQ-070 | 3.3, 3.4, 3.5 |  |
| Ch6 | 5.1 Engine subsystems | Covered | REQ-063, REQ-064, REQ-070 | 3.3, 3.4, 3.5 |  |
| Ch6 | 5.2 A reusable operator library | Partial | REQ-063, REQ-075 | 3.4 | Operator versions are recorded. The operator contract itself is Stage 2. |
| Ch6 | 5.3 Analytics package versus engine operator | Covered | REQ-062, REQ-063 | 1.3, 3.4 |  |
| Ch6 | 5.4 Deterministic core, AI-assisted edges | Covered | REQ-067, REQ-068, REQ-074 | 3.3, 3.11, 4.3 |  |
| Ch6 | 6 Import, normalization and patient-context assembly | Covered | REQ-044, REQ-082, REQ-083, REQ-084 | 3.1 | See docs/IMPORT-CONTRACT.md. |
| Ch6 | 6.1 Import pipeline | Covered | REQ-034, REQ-040, REQ-041, REQ-044, REQ-082, REQ-083, REQ-084 | 3.1 |  |
| Ch6 | 6.2 FHIR R4 and SDC support | Covered | REQ-039, REQ-091, REQ-092 | 6.1 | FHIR import comes after the native export. |
| Ch6 | 6.3 Preserve temporal and epistemic meaning | Covered | REQ-032, REQ-033, REQ-035, REQ-036, REQ-037 | 3.1, 3.4 |  |
| Ch6 | 7 Running many analytics and presenting results | Partial | REQ-071, REQ-073 | 3.5, 3.9 | Batch isolation is not specified (G-03). |
| Ch6 | 7.1 Execution lifecycle | Covered | REQ-064, REQ-070, REQ-071, REQ-075 | 3.5 | Batch and shared intermediates: G-03. |
| Ch6 | 7.2 Result types | Partial | REQ-070 | 1.4, 3.5 | Kinds of result: amendment A-002 (G-04 closed). |
| Ch6 | 7.3 Results are not recommendations by default | Covered | REQ-005, REQ-073 | 3.9, 3.11 |  |
| Ch6 | 8 Review, validation and lifecycle governance | Covered | REQ-046, REQ-047, REQ-048, REQ-049, REQ-050, REQ-051, REQ-052, REQ-053, REQ-054 | 2.3, 6.2 |  |
| Ch6 | 8.1 Validation is scoped, not a universal badge | Covered | REQ-048, REQ-049, REQ-050, REQ-052 | 2.3, 5.2, 6.2 |  |
| Ch6 | 8.2 Review workflow | Partial | REQ-051, REQ-054 | 6.2 | The independence rule (author never reviewer) is not yet a requirement (G-02). |
| Ch6 | 9 Privacy, safety and execution boundaries | Covered | REQ-062, REQ-063, REQ-064, REQ-067, REQ-068, REQ-069, REQ-078, REQ-079, REQ-080, REQ-081, REQ-085 | 3.3, 3.6, 3.10, 3.11 |  |
| Ch6 | 10 Proposed application architecture | No requirement needed | (none) | 3.1 to 3.10 | Decisions D-002, D-003. No requirement needed. |
| Ch6 | 10.1 Keep the first implementation modular | No requirement needed | (none) | 3.1 to 3.10 | D-002, D-003. |
| Ch6 | 10.2 Core internal objects | No requirement needed | (none) | 1.1 to 1.4 | Shapes are Stage 2. |
| Ch6 | 11 A staged implementation plan | No requirement needed | (none) | (plan section 7) | The build plan itself. |
| Ch6 | 12 The first end-to-end vertical slice | Covered | REQ-007, REQ-008 | 3.11 | See docs/USE-CASE-SNAKE.md. |
| Ch6 | 13 What the finished product should achieve | No requirement needed | (none) | 3.11, Phases 4 to 6 |  |
| Ch7 | 1 Why the architecture needs a formal standard | Covered | REQ-001, REQ-002 | R0, 3.11 |  |
| Ch7 | 2 What to learn from openEHR, FHIR and FHIR SDC | No requirement needed | REQ-091 | 6.1 | Guidance. Reuse external standards where they fit. |
| Ch7 | 3 The proposed native standard and its boundaries | Covered | REQ-001, REQ-020 | 1.1 to 1.4 |  |
| Ch7 | 3.1 Specification layers | Covered | REQ-001, REQ-020 | 1.1 to 1.4 |  |
| Ch7 | 3.2 Separate the specification from its serializations | Covered | REQ-064, REQ-086, REQ-091 | 2.4, 4.2 |  |
| Ch7 | 3.3 Core artefact families | Covered | REQ-020 | 1.1 to 1.3 |  |
| Ch7 | 4 Contextual element specification | Covered | REQ-021, REQ-022 | 1.1, 1.5 |  |
| Ch7 | 4.1 Required sections | Covered | REQ-021 | 1.1 |  |
| Ch7 | 4.2 A field is more than a label and type | Covered | REQ-015, REQ-016, REQ-021, REQ-042 | 1.1, 2.2 |  |
| Ch7 | 5 Pathway and composition specification | Covered | REQ-023, REQ-024, REQ-025, REQ-026, REQ-027 | 1.2, 2.2 |  |
| Ch7 | 5.1 Pathway contract | Covered | REQ-025, REQ-026, REQ-027 | 1.2 |  |
| Ch7 | 5.2 Composition rules | Covered | REQ-023, REQ-024 | 1.2, 2.2 |  |
| Ch7 | 6 Analytics package specification | Covered | REQ-028, REQ-029, REQ-062, REQ-063 | 1.3 |  |
| Ch7 | 6.1 Required analytics contract | Covered | REQ-028, REQ-029, REQ-031 | 1.3 |  |
| Ch7 | 6.2 Separate analytic definition from reusable operators | Covered | REQ-062, REQ-063, REQ-069 | 1.3, 3.3, 3.4 |  |
| Ch7 | 7 Terminology and semantic contracts | Covered | REQ-030, REQ-032, REQ-035, REQ-036, REQ-038, REQ-039, REQ-040, REQ-041, REQ-042, REQ-043, REQ-044, REQ-045 | 2.2, 3.1 |  |
| Ch7 | 8 Native Standard Mode and FHIR Mode | Covered | REQ-091, REQ-092 | 6.1 | Mapping tables deferred. |
| Ch7 | 8.1 Canonicalization and loss reporting | Covered | REQ-039, REQ-092 | 6.1 |  |
| Ch7 | 8.2 Native-first without being closed | Partial | REQ-091 | 4.2, 6.1 | Publishing implementation guides for external developers is not a requirement (G-13). |
| Ch7 | 9 LLM, GUI and code as three equivalent authoring methods | Covered | REQ-086, REQ-087 | 4.2, 4.3, 4.4 |  |
| Ch7 | 9.1 LLM authoring guardrails | Covered | REQ-008, REQ-054, REQ-087 | 4.3 |  |
| Ch7 | 10 Validation, compilation and conformance | Covered | REQ-064, REQ-065, REQ-088, REQ-089, REQ-090 | 2.1 to 2.4 |  |
| Ch7 | 10.1 Distinct assurance dimensions | Covered | REQ-048 | 2.3, 6.2 |  |
| Ch7 | 10.2 Compile to a canonical runtime representation | Covered | REQ-064, REQ-065 | 2.4 |  |
| Ch7 | 11 Marketplace discovery and compatibility | Covered | REQ-055, REQ-056, REQ-057, REQ-058, REQ-059, REQ-060, REQ-061 | 3.2, 3.6 |  |
| Ch7 | 11.1 Compatibility dimensions | Covered | REQ-055 | 3.2 |  |
| Ch7 | 11.2 Explainable compatibility outcomes | Covered | REQ-056, REQ-057, REQ-058, REQ-059, REQ-060, REQ-061 | 3.2 |  |
| Ch7 | 11.3 Marketplace search sequence | Partial | REQ-055, REQ-060 | 3.2, 3.6, 4.1 | How results are ranked is not specified (G-07). |
| Ch7 | 12 Review, lifecycle and version governance | Covered | REQ-013, REQ-017, REQ-046, REQ-047, REQ-048, REQ-049, REQ-050, REQ-051, REQ-052, REQ-053 | 6.2 | Visibility of deprecation to pinned users: G-14. |
| Ch7 | 12.1 Separate package version from validation record | Covered | REQ-013, REQ-052 | 2.3, 6.2 |  |
| Ch7 | 12.2 Review workflow | Partial | REQ-054 | 6.2 | Independence rule: G-02. Deprecation visibility: G-14. |
| Ch7 | 13 Runtime execution and provenance | Covered | REQ-064, REQ-070, REQ-071, REQ-075, REQ-076, REQ-077, REQ-078 | 3.5 |  |
| Ch7 | 13.1 Runtime sequence | Covered | REQ-064, REQ-070, REQ-071 | 3.5, 3.7 |  |
| Ch7 | 13.2 Execution record | Covered | REQ-075, REQ-076, REQ-077, REQ-078, REQ-079, REQ-080 | 3.5 |  |
| Ch7 | 14 Evolution and migration | Covered | REQ-012, REQ-015, REQ-016, REQ-017, REQ-018, REQ-019 | 2.4, 6.2 |  |
| Ch7 | 15 Worked end-to-end example | No requirement needed | (none) | 4.5 | Second demo (diabetes and CKD). |
| Ch7 | 16 Implementation sequence and relationship to the book | No requirement needed | (none) | (plan section 7) |  |
| Ch7 | 16.1 How Chapters 1 to 10 now fit together | No requirement needed | REQ-053 | (none) | Informational. Distinct responsibilities are REQ-053. |
| Ch8 | 1 Why reusable analytics matter | No requirement needed | (none) | 5.1 |  |
| Ch8 | 2 A library of common analytics templates | Gap | (none) | 5.1, 5.2 | No requirement for templates yet (G-08). |
| Ch8 | 3 Decision-node analytics and the Avinash principle | Partial | REQ-026 | 1.2, 5.3 | Operational definition of the principle is an EMR-side item. Graph rules: G-09. |
| Ch8 | 3.1 A decision node as a contract | Covered | REQ-026 | 1.2 |  |
| Ch8 | 3.2 Decision graph, not a single score | Partial | REQ-026 | 5.3 | Graph checks (dead ends, bounded cycles) not yet requirements (G-09). |
| Ch8 | 4 Composing templates into contextual analytics | Gap | (none) | 4.5, 5.1 | No requirement (G-08). |
| Ch8 | 5 Turning a research paper into an analytics package | Partial | REQ-008, REQ-087 | 5.4 | Traceability of every rule to a source passage is not yet a requirement (G-10). |
| Ch8 | 5.1 What the LLM should extract | Partial | REQ-087 | 5.4 | G-10. |
| Ch8 | 5.2 What it should generate | Partial | REQ-087 | 5.4 | G-10. |
| Ch8 | 6 Patient cohort rules: inclusion, exclusion and time windows | Gap | (none) | 5.5 | No requirement (G-11). |
| Ch8 | 6.1 Cohort rule components | Gap | (none) | 5.5 | G-11. |
| Ch8 | 6.2 Three-valued eligibility | Partial | REQ-066 | 5.5 | General three-valued rule covers logic. Cohort semantics: G-11. |
| Ch8 | 7 The LLM-assisted authoring workflow | Covered | REQ-054, REQ-087 | 4.3, 5.4 |  |
| Ch8 | 8 The CCIS analytics package contract | Covered | REQ-028, REQ-029, REQ-031 | 1.3 |  |
| Ch8 | 9 Running analytics on imported patient data | Covered | REQ-055, REQ-056, REQ-057, REQ-058, REQ-059, REQ-060, REQ-061, REQ-071, REQ-073 | 3.5, 3.9 |  |
| Ch8 | 10 Clinical validation, uncertainty and safe use | Covered | REQ-005, REQ-006, REQ-048, REQ-049, REQ-051, REQ-053 | 2.3, 6.2 |  |
| Ch8 | 11 Implementation sequence and the future cohort exporter | Gap | (none) | 5.5, 6.4 | Cohort export contract: G-11. |
| Ch8 | 12 How this chapter extends the architecture | No requirement needed | (none) | (none) |  |
| Ch9 | 1 The engineering objective | No requirement needed | (none) | 3.11 |  |
| Ch9 | 2 Freeze the first normative specification | Covered | REQ-002, REQ-012, REQ-019 | 0.2, R0, 3.11 | Interpreted as a prototype baseline with numbered amendments; true freeze at 0.1.0. |
| Ch9 | 3 Build machine-readable schemas | Covered | REQ-009, REQ-010, REQ-011, REQ-015, REQ-016, REQ-020 | 1.1 to 1.4 |  |
| Ch9 | 4 Build the conformance toolchain | Covered | REQ-086, REQ-088, REQ-089, REQ-090 | 2.1 to 2.3 |  |
| Ch9 | 5 Publish reference artefacts and fixtures | Partial | REQ-031 | 1.5, 1.6 | Contents of the reference set are a process rule, not a requirement. |
| Ch9 | 6 Implement the smallest end-to-end runtime | Covered | REQ-062, REQ-063, REQ-064, REQ-065, REQ-066, REQ-067, REQ-068, REQ-069, REQ-070 | 3.1 to 3.5 |  |
| Ch9 | 7 Repository and file organisation | No requirement needed | (none) | 0.1 | Decision D-003. |
| Ch9 | 8 Conformance, safety and acceptance tests | Covered | REQ-006, REQ-031, REQ-048 | (see section 3 checklist) | Becomes the checklist in this file. |
| Ch9 | 9 Phased engineering plan | No requirement needed | (none) | (plan section 7) |  |
| Ch9 | 10 Definition of done | Covered | REQ-002, REQ-008, REQ-029, REQ-072 | 3.11 | See checklist D. Includes the decision that any threshold is a disabled parameter. |
| Ch9 | 11 What should follow this chapter | No requirement needed | (none) | Phases 4 to 6 |  |
| Ch10 | 1 From vertical slice to platform | No requirement needed | (none) | Phases 4 to 6 |  |
| Ch10 | 2 Grow the reusable analytics catalogue | Gap | (none) | 5.1, 5.2 | G-08. |
| Ch10 | 3 Make decision graphs authorable and executable | Partial | REQ-026, REQ-066 | 5.3 | G-09. |
| Ch10 | 4 Build the cohort execution engine | Gap | (none) | 5.5, 5.6, 5.7 | G-11. |
| Ch10 | 5 Add the future EMR Enhancer cohort exporter | Gap | (none) | 6.4 | G-11. EMR row D8b. |
| Ch10 | 6 Harden FHIR Mode and interoperability | Covered | REQ-039, REQ-091, REQ-092 | 6.1 |  |
| Ch10 | 7 Establish external review and release governance | Partial | REQ-017, REQ-047, REQ-051, REQ-052, REQ-054 | 6.2 | Independence rule and signing: G-02, G-05. Deprecation visibility: G-14. |
| Ch10 | 8 Evaluate clinical quality and operational reliability | Partial | REQ-006, REQ-067, REQ-077 | 6.3 | Evaluation measures are not requirements (G-12). |
| Ch10 | 9 Use LLMs as governed authoring assistants | Covered | REQ-008, REQ-037, REQ-054, REQ-074, REQ-087 | 4.3 |  |
| Ch10 | 10 Sequence the implementation programme | No requirement needed | (none) | (plan section 7) |  |
| Ch10 | 11 Definition of a mature platform | Partial | REQ-002 | Phases 4 to 6 | Conformance claims need release and test-suite version (REQ-002). Rest is outside this draft. |

Counts: 65 covered, 20 partial, 9 gap, 19 no requirement needed, out of 113 headings.

## 2. Gaps

Concepts the book contains that the specification does not yet require. "When" says when the gap should be decided. Gaps marked "0.1.0 slice" affect the first slice and are best decided at R0 or before the named row. The others can wait for their phase.

| Id | Concept | What is missing | Proposed handling | When |
|----|---------|-----------------|-------------------|------|
| G-01 | Informant source class | A bite time reported by a companion has no source class of its own (raised in docs/USE-CASE-SNAKE.md, question 5). | Closed by amendment A-001 (row 1.4, 2026-11-23). | 0.1.0 slice |
| G-02 | Independence rule | Ch7 s12.2 and plan row 6.2: an author is never the reviewer. Not yet a requirement. | Add with row 6.2. | Phase 6 |
| G-03 | Batch runs | Ch6 s7: several analytics on one context; each keeps its own contract, parameters and result; shared work must not leak between them. Not yet a requirement. | Decide before row 3.5. | 0.1.0 slice |
| G-04 | Result kinds | Ch6 s7.2: values, classifications, tables, series. The spec only says outputs are checked against a declared contract. | Closed by amendment A-002 (row 1.3, 2026-11-23). | 0.1.0 slice |
| G-05 | Package integrity | Checksums, pin verification and signing (Ch6 s3.3; plan rows 2.4, 3.6, 4.1, 6.2). The spec requires pinned versions but not integrity checks. | Decide before row 2.4. | 0.1.0 slice |
| G-06 | Marketplace layout and index | Ch6 s3.2 and s3.3: repository organisation, index, mandatory manifest. | Add with row 3.6 or 4.1. | Phase 3 and 4 |
| G-07 | Result ranking | Ch7 s11.3: how compatible packages are ordered. Must not rely on text similarity (REQ-060). | Add with row 3.2. | Phase 3 |
| G-08 | Analytics templates and composition | Ch8 s2, s4; Ch10 s2. | Add with rows 5.1 and 5.2. | Phase 5 |
| G-09 | Decision-graph static checks | Ch8 s3.2; Ch10 s3: dead ends, bounded cycles, every missing, stale or conflicting input routed. Only the node contract (REQ-026) exists. | Add with row 5.3. | Phase 5 |
| G-10 | Research-to-package traceability | Ch8 s5: every rule traceable to a source passage; human confirms mappings. | Add with row 5.4. | Phase 5 |
| G-11 | Cohorts | Ch8 s6, s11; Ch10 s4, s5: cohort rules, three-valued eligibility, cohort package contract, small-cell masking, access and purpose. | Add with rows 5.5 to 5.7 and 6.4. | Phase 5 and 6 |
| G-12 | Evaluation measures | Ch10 s8: reliability measures kept separate from clinical measures. | Add with row 6.3. | Phase 6 |
| G-13 | Implementation guides | Ch7 s8.2: publish guides and examples for external developers. | Add with row 6.2. | Phase 6 |
| G-14 | Deprecation visibility | Ch7 s12.2: later corrections, deprecation or withdrawal stay visible to users of pinned versions. | Add with row 6.2. | Phase 6 |

## 3. Acceptance checklist

Each item is tickable and names the row(s) that will prove it. Nothing is ticked in Phase 0.

### A. Book Ch9 section 8: conformance, safety and acceptance tests

- [ ] **A-01** Valid examples pass. Malformed or unsupported artefacts fail with actionable diagnostics. *Proven by:* 1.5, 1.6, 2.1, 2.2, 2.3.
- [ ] **A-02** LLM-, GUI- and code-authored versions of the same artefact pass the same validator and have equivalent semantics. *Proven by:* 2.4 (harness), 4.2, 4.3, 4.4.
- [ ] **A-03** All pathway references resolve. Decision graphs have no unintended dead ends or unbounded cycles. *Proven by:* 2.1, 2.2, 5.3.
- [ ] **A-04** Unit mismatches, missing required inputs and unsupported terminology mappings are surfaced. *Proven by:* 2.2, 3.1, 3.2, 3.11.
- [ ] **A-05** Inclusion and exclusion criteria produce the expected included, excluded and indeterminate cohort outcomes. (After 0.1.0.) *Proven by:* 5.5.
- [ ] **A-06** Decision nodes return explicit branches and preserve the rule trace. *Proven by:* 3.4, 5.3.
- [ ] **A-07** Repeated runs with identical pinned inputs, versions and engine configuration are reproducible. *Proven by:* 3.5, 3.11, 6.3.
- [ ] **A-08** Package execution cannot access undeclared network, filesystem or patient-data resources. *Proven by:* 3.3, 3.10, 3.11.
- [ ] **A-09** Marketplace publication contains no patient records or cohort membership data. *Proven by:* 3.6, 3.11, 4.1.
- [ ] **A-10** Every clinical validation claim names the exact version, population, setting and intended use. *Proven by:* 2.3, 5.2, 6.2.
- [ ] **A-11** Clinical safety review stays distinct from software conformance. Passing the validator does not prove a method is correct or safe. *Proven by:* R0, 3.8 (banner), 3.11 (limitations), 6.2.

### B. Gates (plan section 10)

- [ ] **B-01** **R0:** the user approves the SPEC draft, IMPORT-CONTRACT and USE-CASE, and records it in DECISIONS.md. *Proven by:* R0.
- [ ] **B-02** **Gate B:** all schemas compile. *Proven by:* 1.1 to 1.4.
- [ ] **B-03** **Gate B:** every invalid example gives its expected diagnostics. *Proven by:* 1.6, 2.1 to 2.3.
- [ ] **B-04** **Gate B:** the compiler is deterministic. *Proven by:* 2.4.
- [ ] **B-05** **Gate C:** one command reproduces the slice result. *Proven by:* 3.11.
- [ ] **B-06** **Gate C:** the negative tests pass (no undeclared network, file or patient-data access; marketplace lint). *Proven by:* 3.10, 3.11.
- [ ] **B-07** **Gate C:** the user reviews the limitations list before Phase 4. *Proven by:* 3.11.

### C. Before any real patient data (plan section 10)

- [ ] **C-01** Clinical safety sign-off. *Proven by:* (no row; user).
- [ ] **C-02** Security review. *Proven by:* (no row; user).
- [ ] **C-03** Privacy assessment. *Proven by:* (no row; user).
- [ ] **C-04** Terminology licences checked. *Proven by:* (no row; user).
- [ ] **C-05** Device-software and health-data rules checked. *Proven by:* (no row; user).
- [ ] **C-06** Independent clinical review of any package labelled validated. *Proven by:* (no row; user).

### D. Definition of done (book Ch9 section 10)

- [ ] **D-01** First milestone (Ch9 s10): a developer takes a published example package, validates it, imports a synthetic record, resolves compatibility, runs the analytics and inspects a reproducible result with full provenance, with no manual edits and no hidden assumptions. *Proven by:* 3.11.
- [ ] **D-02** Standard milestone (Ch9 s10): specification, schemas, validator, reference examples, test suite, versioning policy and one conformant implementation are published together. Claims name the CCIS release and test-suite version. *Proven by:* 3.11, 6.2, 6.3.

## 4. Stage 2 items intentionally deferred

This matches `CCIS_BUILD_PLAN.md` section 4, plus the items the import contract and the use case also defer. None of these appears in Phase 0 documents.

| Deferred item | Defined in row(s) |
|---------------|-------------------|
| JSON Schema: package manifest | 1.1 |
| JSON Schema: contextual element | 1.1 |
| JSON Schema: terminology binding | 1.1 |
| JSON Schema: pathway | 1.2 |
| JSON Schema: decision node | 1.2 |
| JSON Schema: analytics package | 1.3 |
| JSON Schema: execution manifest | 1.3 |
| JSON Schema: context envelope and import report | 1.4 |
| JSON Schema: validation record | 1.4 |
| JSON Schema: run result | 1.4 |
| JSON Schema: run record | 1.4 |
| Field-level shape of the EMR export (what the contract only states in words) | 1.4, checked by 1.5 fixtures |
| Validator rule catalogue (the CCIS-V-nnn ids and their wording) | 2.1 to 2.3 |
| Compiler canonical form and checksum algorithm | 2.4 |
| Run-record storage format | 3.5 |
| Marketplace-index storage format | 3.6 |
| CLI command surface | 3.7 |
| Exact module APIs | 3.1 to 3.5 |
| FHIR Mode mapping tables | 6.1 |
| Cohort definition schema | 5.5 |
| Cohort package contract | 6.4 |
| Set of observation value kinds (IMPORT-CONTRACT) | 1.4 |
| Full list of terminology verification states (IMPORT-CONTRACT) | 1.1, 1.4 |
| Import integrity mechanism (IMPORT-CONTRACT IMP-014) | 1.4, 3.1 |
| FHIR R4 Bundle import (IMPORT-CONTRACT) | 6.1 |
| Cohort export from the EMR (IMPORT-CONTRACT, EMR row D8b) | 6.4 |
| Terminology bindings and codes for the snake use case (USE-CASE-SNAKE) | 1.5 |
| Parameter values P1 to P6 and the named clinician owner (USE-CASE-SNAKE) | user action; test-only placeholders in 1.5 |

## 5. Import contract and use case

### 5.1 `docs/IMPORT-CONTRACT.md`

| Items | Topic | Rows |
|-------|-------|------|
| IMP-001 to IMP-004 | Principles and boundary | 3.1 |
| IMP-010 to IMP-014 | Envelope version, time, producer, inclusions, integrity | 1.4, 1.5 |
| IMP-020, IMP-021 | Case and references (pseudonymous) | 1.4, 3.1 |
| IMP-030 to IMP-032 | Applied elements and pathways, exact versions | 1.4, 3.1, 3.2 |
| IMP-040 to IMP-051 | Observations | 1.4, 3.1, 3.4 |
| IMP-060, IMP-061 | Clinical events | 1.4, 3.1 |
| IMP-070 to IMP-073 | Terminology codes and verification state | 1.4, 2.2, 3.1 |
| IMP-080, IMP-081 | History and corrections | 1.4, 3.1 |
| Section 3 | Six distinct data states | 3.1, 3.4, 3.11 |
| IMP-090 to IMP-096 | Exclusions by default; future purpose | 3.1, 3.11 |
| IMP-100 to IMP-108 | Import report | 1.4, 3.1 |
| IMP-110 to IMP-117 | Envelope versioning | 1.4, 3.1 |
| IMP-120 to IMP-122 | EMR acceptance through contract and fixtures | 1.5, 6.4 (EMR rows B5, D8b) |

### 5.2 `docs/USE-CASE-SNAKE.md`

| Part | Rows |
|------|------|
| Contextual element (F1 to F9) | 1.1, 1.5 |
| Pathway and two decision nodes | 1.2, 1.5, 3.4 |
| Analytic A (interval) and Analytic B (completeness) | 1.3, 1.5, 3.4 |
| Parameters P1 to P6, disabled by default | 1.3, 3.2, 3.4 |
| Fixture classes (six) | 1.5, 3.11 |
| What the slice will not prove | 3.11 (limitations list) |

## Appendix A. Requirement index

Every requirement in `ccis/SPEC.md`, with the book concepts that justify it and the rows that will implement it.

| Id | Short statement | Book concepts | Rows |
|----|-----------------|---------------|------|
| REQ-001 | Specification suite | Ch7 s1; Ch7 s3; Ch7 s3.1 | 1.1 to 1.4, 3.11, R0 |
| REQ-002 | Proposal status | Ch7 s1; Ch9 s2; Ch9 s10; Ch10 s11 | 0.2, 3.11, Phases 4 to 6, R0 |
| REQ-003 | Separate product | Ch6 s1 | 3.1 |
| REQ-004 | Not a system of record | Ch6 s1 | 3.1 |
| REQ-005 | Descriptive by default | Ch6 s7.3; Ch8 s10 | 2.3, 3.9, 3.11, 6.2 |
| REQ-006 | Conformance is not safety | Ch8 s10; Ch9 s8; Ch10 s8 | 2.3, 6.2, 6.3, (see section 3 checklist) |
| REQ-007 | Synthetic data only | Ch6 s12 | 3.11 |
| REQ-008 | No model-supplied clinical values | Ch6 s12; Ch7 s9.1; Ch8 s5; Ch9 s10; Ch10 s9 | 3.11, 4.3, 5.4 |
| REQ-009 | Stable identity | Ch6 s3.3; Ch9 s3 | 1.1, 1.1 to 1.4 |
| REQ-010 | Identity declaration | Ch6 s3.3; Ch9 s3 | 1.1, 1.1 to 1.4 |
| REQ-011 | Independent versions | Ch6 s3.3; Ch9 s3 | 1.1, 1.1 to 1.4 |
| REQ-012 | Semantic versioning | Ch7 s14; Ch9 s2 | 0.2, 2.4, 3.11, 6.2, R0 |
| REQ-013 | Immutable once published | Ch7 s12; Ch7 s12.1 | 2.3, 6.2 |
| REQ-014 | Exact references | Ch6 s3.3 | 1.1 |
| REQ-015 | Unknown critical content rejected | Ch7 s4.2; Ch7 s14; Ch9 s3 | 1.1, 1.1 to 1.4, 2.2, 2.4, 6.2 |
| REQ-016 | Namespaced extensions | Ch7 s4.2; Ch7 s14; Ch9 s3 | 1.1, 1.1 to 1.4, 2.2, 2.4, 6.2 |
| REQ-017 | Old versions stay addressable | Ch6 s3; Ch7 s12; Ch7 s14; Ch10 s7 | 2.4, 3.6, 4.1, 6.2 |
| REQ-018 | No silent migration | Ch7 s14 | 2.4, 6.2 |
| REQ-019 | Change control for the standard | Ch7 s14; Ch9 s2 | 0.2, 2.4, 3.11, 6.2, R0 |
| REQ-020 | Six families | Ch6 s3.1; Ch7 s3; Ch7 s3.1; Ch7 s3.3; Ch9 s3 | 1.1 to 1.3, 1.1 to 1.4 |
| REQ-021 | Element declarations | Ch7 s4; Ch7 s4.1; Ch7 s4.2 | 1.1, 1.5, 2.2 |
| REQ-022 | Core plus modules | Ch7 s4 | 1.1, 1.5 |
| REQ-023 | Group declarations | Ch7 s5; Ch7 s5.2 | 1.2, 2.2 |
| REQ-024 | No merging by label | Ch7 s5; Ch7 s5.2 | 1.2, 2.2 |
| REQ-025 | Pathway declarations | Ch7 s5; Ch7 s5.1 | 1.2, 2.2 |
| REQ-026 | Decision node declarations | Ch7 s5; Ch7 s5.1; Ch8 s3; Ch8 s3.1; Ch8 s3.2; Ch10 s3 | 1.2, 2.2, 5.3 |
| REQ-027 | Pathways describe, not authorise | Ch7 s5; Ch7 s5.1 | 1.2, 2.2 |
| REQ-028 | Analytics declarations | Ch7 s6; Ch7 s6.1; Ch8 s8 | 1.3 |
| REQ-029 | Parameter declarations | Ch7 s6; Ch7 s6.1; Ch8 s8; Ch9 s10 | 1.3, 3.11 |
| REQ-030 | Terminology package | Ch7 s7 | 2.2, 3.1 |
| REQ-031 | Test package | Ch7 s6.1; Ch8 s8; Ch9 s5; Ch9 s8 | 1.3, 1.5, 1.6, (see section 3 checklist) |
| REQ-032 | Distinct data states | Ch6 s1.1; Ch6 s6.3; Ch7 s7 | 2.2, 3.1, 3.4 |
| REQ-033 | Unknown is never normal | Ch6 s6.3 | 3.1, 3.4 |
| REQ-034 | Entered in error | Ch6 s6.1 | 3.1 |
| REQ-035 | Separate time meanings | Ch6 s1.1; Ch6 s6.3; Ch7 s7 | 2.2, 3.1, 3.4 |
| REQ-036 | Source classes | Ch6 s1.1; Ch6 s6.3; Ch7 s7 | 2.2, 3.1, 3.4 |
| REQ-037 | AI-proposed is not verified | Ch6 s6.3; Ch10 s9 | 3.1, 3.4, 4.3 |
| REQ-038 | Derivation recorded | Ch7 s7 | 2.2, 3.1 |
| REQ-039 | Lossy mappings visible | Ch6 s6.2; Ch7 s7; Ch7 s8.1; Ch10 s6 | 2.2, 3.1, 6.1 |
| REQ-040 | Match by meaning | Ch6 s6.1; Ch7 s7 | 2.2, 3.1 |
| REQ-041 | Versioned bindings | Ch6 s6.1; Ch7 s7 | 2.2, 3.1 |
| REQ-042 | Units declared | Ch7 s4.2; Ch7 s7 | 1.1, 2.2, 3.1 |
| REQ-043 | Explicit conversions | Ch7 s7 | 2.2, 3.1 |
| REQ-044 | Unmapped is visible | Ch6 s6; Ch6 s6.1; Ch7 s7 | 2.2, 3.1 |
| REQ-045 | One resolution behaviour | Ch7 s7 | 2.2, 3.1 |
| REQ-046 | Lifecycle statuses | Ch6 s8; Ch7 s12 | 2.3, 6.2 |
| REQ-047 | Status states its basis | Ch6 s8; Ch7 s12; Ch10 s7 | 2.3, 6.2 |
| REQ-048 | Five assurance dimensions | Ch6 s8; Ch6 s8.1; Ch7 s10.1; Ch7 s12; Ch8 s10; Ch9 s8 | 2.3, 5.2, 6.2, (see section 3 checklist) |
| REQ-049 | Validated carries scope | Ch6 s8; Ch6 s8.1; Ch7 s12; Ch8 s10 | 2.3, 5.2, 6.2 |
| REQ-050 | Conditions are prominent | Ch6 s8; Ch6 s8.1; Ch7 s12 | 2.3, 5.2, 6.2 |
| REQ-051 | Reviewed is not effective | Ch6 s8; Ch6 s8.2; Ch7 s12; Ch8 s10; Ch10 s7 | 2.3, 6.2 |
| REQ-052 | Validation tied to a version | Ch6 s8; Ch6 s8.1; Ch7 s12; Ch7 s12.1; Ch10 s7 | 2.3, 5.2, 6.2 |
| REQ-053 | Distinct responsibilities | Ch6 s8; Ch7 s12; Ch7 s16.1; Ch8 s10 | 2.3, 6.2, (none) |
| REQ-054 | Human accountability | Ch6 s8; Ch6 s8.2; Ch7 s9.1; Ch7 s12.2; Ch8 s7; Ch10 s7 ... | 2.3, 4.3, 5.4, 6.2 |
| REQ-055 | Six checks | Ch6 s4; Ch6 s4.1; Ch6 s4.2; Ch7 s11; Ch7 s11.1; Ch7 s11.3 ... | 3.2, 3.5, 3.6, 3.9, 4.1 |
| REQ-056 | Five outcomes | Ch6 s4; Ch7 s11; Ch7 s11.2; Ch8 s9 | 3.2, 3.5, 3.6, 3.9 |
| REQ-057 | Outcomes are explained | Ch6 s4; Ch6 s4.3; Ch7 s11; Ch7 s11.2; Ch8 s9 | 3.2, 3.5, 3.6, 3.8, 3.9 |
| REQ-058 | Needs data versus incompatible | Ch6 s4; Ch7 s11; Ch7 s11.2; Ch8 s9 | 3.2, 3.5, 3.6, 3.9 |
| REQ-059 | Not eligible | Ch6 s4; Ch7 s11; Ch7 s11.2; Ch8 s9 | 3.2, 3.5, 3.6, 3.9 |
| REQ-060 | No similarity matching | Ch6 s4; Ch6 s4.2; Ch7 s11; Ch7 s11.2; Ch7 s11.3; Ch8 s9 | 3.2, 3.5, 3.6, 3.9, 4.1 |
| REQ-061 | Unevaluable check | Ch6 s4; Ch7 s11; Ch7 s11.2; Ch8 s9 | 3.2, 3.5, 3.6, 3.9 |
| REQ-062 | Declarative only | Ch6 s5; Ch6 s5.3; Ch6 s9; Ch7 s6; Ch7 s6.2; Ch9 s6 | 1.3, 3.1 to 3.5, 3.3, 3.4, 3.5, 3.6, 3.10, 3.11 |
| REQ-063 | Whitelist interpreter | Ch6 s5; Ch6 s5.1; Ch6 s5.2; Ch6 s5.3; Ch6 s9; Ch7 s6 ... | 1.3, 3.1 to 3.5, 3.3, 3.4, 3.5, 3.6, 3.10, 3.11 |
| REQ-064 | Run only the compiled form | Ch6 s5; Ch6 s5.1; Ch6 s7.1; Ch6 s9; Ch7 s3.2; Ch7 s10 ... | 2.1 to 2.4, 2.4, 3.1 to 3.5, 3.3, 3.4, 3.5, 3.6, 3.7, 3.10, 3.11, 4.2 |
| REQ-065 | Compilation fails closed | Ch6 s5; Ch7 s10; Ch7 s10.2; Ch9 s6 | 2.1 to 2.4, 2.4, 3.1 to 3.5, 3.3, 3.4, 3.5 |
| REQ-066 | Three-valued results | Ch6 s5; Ch8 s6.2; Ch9 s6; Ch10 s3 | 3.1 to 3.5, 3.3, 3.4, 3.5, 5.3, 5.5 |
| REQ-067 | Deterministic | Ch6 s5; Ch6 s5.4; Ch6 s9; Ch9 s6; Ch10 s8 | 3.1 to 3.5, 3.3, 3.4, 3.5, 3.6, 3.10, 3.11, 4.3, 6.3 |
| REQ-068 | Pure core | Ch6 s5; Ch6 s5.4; Ch6 s9; Ch9 s6 | 3.1 to 3.5, 3.3, 3.4, 3.5, 3.6, 3.10, 3.11, 4.3 |
| REQ-069 | Resource limits | Ch6 s5; Ch6 s9; Ch7 s6.2; Ch9 s6 | 1.3, 3.1 to 3.5, 3.3, 3.4, 3.5, 3.6, 3.10, 3.11 |
| REQ-070 | Outputs checked | Ch6 s5; Ch6 s5.1; Ch6 s7.1; Ch6 s7.2; Ch7 s13; Ch7 s13.1 ... | 1.4, 3.1 to 3.5, 3.3, 3.4, 3.5, 3.7 |
| REQ-071 | Plan shown before run | Ch6 s7; Ch6 s7.1; Ch7 s13; Ch7 s13.1; Ch8 s9 | 3.5, 3.7, 3.9 |
| REQ-072 | Disabled parameters | Ch9 s10 | 3.11 |
| REQ-073 | Results show their basis | Ch6 s7; Ch6 s7.3; Ch8 s9 | 3.5, 3.9, 3.11 |
| REQ-074 | AI outside the calculation | Ch6 s5.4; Ch10 s9 | 3.3, 3.11, 4.3 |
| REQ-075 | Record contents | Ch6 s5.2; Ch6 s7.1; Ch7 s13; Ch7 s13.2 | 3.4, 3.5 |
| REQ-076 | Immutable record | Ch7 s13; Ch7 s13.2 | 3.5 |
| REQ-077 | Reproducible rerun | Ch7 s13; Ch7 s13.2; Ch10 s8 | 3.5, 6.3 |
| REQ-078 | Snapshot stays local | Ch6 s9; Ch7 s13; Ch7 s13.2 | 3.3, 3.5, 3.6, 3.10, 3.11 |
| REQ-079 | Patient data stays local | Ch6 s3; Ch6 s9; Ch7 s13.2 | 3.3, 3.5, 3.6, 3.10, 3.11, 4.1 |
| REQ-080 | Marketplace content | Ch6 s3; Ch6 s9; Ch7 s13.2 | 3.3, 3.5, 3.6, 3.10, 3.11, 4.1 |
| REQ-081 | Ingestion screening | Ch6 s3; Ch6 s9 | 3.3, 3.6, 3.10, 3.11, 4.1 |
| REQ-082 | Import exclusions | Ch6 s6; Ch6 s6.1 | 3.1 |
| REQ-083 | Pseudonymous case | Ch6 s6; Ch6 s6.1 | 3.1 |
| REQ-084 | Nothing dropped silently | Ch6 s6; Ch6 s6.1 | 3.1 |
| REQ-085 | Network use | Ch6 s9 | 3.3, 3.6, 3.10, 3.11 |
| REQ-086 | Equivalent routes | Ch7 s3.2; Ch7 s9; Ch9 s4 | 2.1 to 2.3, 2.4, 4.2, 4.3, 4.4 |
| REQ-087 | LLM drafts only | Ch7 s9; Ch7 s9.1; Ch8 s5; Ch8 s5.1; Ch8 s5.2; Ch8 s7 ... | 4.2, 4.3, 4.4, 5.4 |
| REQ-088 | Eight validation layers | Ch7 s10; Ch9 s4 | 2.1 to 2.3, 2.1 to 2.4 |
| REQ-089 | Actionable diagnostics | Ch7 s10; Ch9 s4 | 2.1 to 2.3, 2.1 to 2.4 |
| REQ-090 | Reports retained | Ch7 s10; Ch9 s4 | 2.1 to 2.3, 2.1 to 2.4 |
| REQ-091 | FHIR Mode is one route | Ch6 s6.2; Ch7 s2; Ch7 s3.2; Ch7 s8; Ch7 s8.2; Ch10 s6 | 2.4, 4.2, 6.1 |
| REQ-092 | Unsupported FHIR reported | Ch6 s6.2; Ch7 s8; Ch7 s8.1; Ch10 s6 | 6.1 |

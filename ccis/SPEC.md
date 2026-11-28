# CCIS Specification, draft 0.1.0-draft

> **Status:** draft baseline. Prototype. Synthetic data only. Not for clinical use. This document is in words only: it contains no schemas, field-level shapes, storage formats, rule catalogue or algorithms. Those are Stage 2 work.

## 0. How to read this document

- **Normative** text is every requirement in sections 1 to 11. It uses MUST, MUST NOT and MAY in their usual specification sense. Everything else (introductions, rationale lines, notes) is guidance.
- Every requirement has a stable identifier of the form `CCIS-REQ-nnn`. Identifiers are never reused or renumbered. A withdrawn requirement keeps its number and is marked withdrawn in the change log.
- Each requirement has a one-line rationale. Chapter references (for example Ch7 s6) point to the research book; D-nnn references point to `DECISIONS.md`.
- Artefact declarations are described by what they must say, not by field names or layout.
- Validation methods used in the matrix are the eight validator layers (section 11) plus two non-automated methods: **Review** (a named human reads and signs off) and **Inspection** (checked by examining the application or its behaviour).

## 1. Scope and product boundary

What CCIS is, what it is not, and where the product boundary lies.

**CCIS-REQ-001** CCIS MUST be treated as a versioned specification suite for declarative clinical-knowledge artefacts and for the contract between those artefacts, an importing application and a deterministic engine. It is not a single document format.  
*Rationale:* A suite can evolve in parts; one monolithic format cannot (Ch7 s3).

**CCIS-REQ-002** Until a release defines published conformance fixtures, no implementation or artefact may claim conformance to CCIS. Claims MUST name the exact standard version.  
*Rationale:* The standard is a proposal until it is specified, built, tested and governed (Ch7 s2, s16).

**CCIS-REQ-003** The intelligence application MUST be a separate product from the EMR Enhancer. The only thing that crosses between them is a documented export file.  
*Rationale:* Clean privacy boundary and independent development (D-001).

**CCIS-REQ-004** The application MUST NOT act as the system of record for the EMR's data. It holds an imported copy and results derived from it.  
*Rationale:* Prevents divergent sources of truth.

**CCIS-REQ-005** Results MUST be descriptive, not recommendations, unless a package declares an intended decision-support use and that use is governed under the lifecycle and assurance requirements of this specification.  
*Rationale:* Avoids silently turning analytics into advice (Ch6 s7.3).

**CCIS-REQ-006** Software conformance MUST NOT be presented as evidence of clinical safety or effectiveness. The two MUST be recorded separately.  
*Rationale:* Verification and clinical validation answer different questions (Ch7 s10.1).

**CCIS-REQ-007** Until a go-live gate has been passed, all data used with a CCIS implementation, including fixtures and examples, MUST be synthetic.  
*Rationale:* Prototype safety and privacy.

**CCIS-REQ-008** Doses, thresholds, bands and formulas MUST NOT be supplied by a language model. Clinical thresholds MUST be parameters supplied by a named local clinician owner, and MUST arrive disabled.  
*Rationale:* A model must not become the source of clinical numbers (D-008).

## 2. Identity, versioning and compatibility

How artefacts are named, versioned and kept compatible over time.

**CCIS-REQ-009** Every artefact MUST have a canonical identifier that remains stable when its display name changes.  
*Rationale:* Matching must not depend on labels (Ch7 s7).

**CCIS-REQ-010** Every artefact MUST declare its type, its own version, its publisher and the version of the standard it targets.  
*Rationale:* Readers need to know how to interpret an artefact before reading it.

**CCIS-REQ-011** Package version, standard version, engine version and FHIR version MUST be independent and separately declared or recorded. Compatibility resolution MUST consider every dimension that applies.  
*Rationale:* A change in one must not silently change another (Ch5 s7.1, Ch7 s14).

**CCIS-REQ-012** Artefact and standard versions MUST follow semantic versioning. A breaking change MUST be a new major version.  
*Rationale:* Predictable upgrade behaviour.

**CCIS-REQ-013** Published artefact content MUST NOT change. Any change MUST create a new version.  
*Rationale:* Reproducibility and audit (Ch7 s12.1).

**CCIS-REQ-014** References between artefacts MUST name an exact version or a version range. They MUST NOT embed a copy of the referenced artefact.  
*Rationale:* Avoids drift and duplicated definitions (Ch7 s3.3).

**CCIS-REQ-015** An implementation MUST reject an artefact that contains an unrecognised field the standard marks as critical. An unrecognised optional addition within the same major version MAY be ignored but MUST be reported.  
*Rationale:* Safe failure instead of silent misreading (Ch9 s3).

**CCIS-REQ-016** Extensions MUST use the reserved `x-` namespace, MUST be documented and MUST be testable. An unknown mandatory extension MUST cause a safe compatibility failure, not be ignored.  
*Rationale:* Room to grow without breaking readers (Ch7 s4.2).

**CCIS-REQ-017** Superseded versions MUST remain addressable for reproducibility and audit.  
*Rationale:* Pinned users must be able to find what they ran (Ch7 s14).

**CCIS-REQ-018** Migration tooling MAY suggest changes but MUST NOT silently rewrite a published artefact.  
*Rationale:* Published content is immutable.

**CCIS-REQ-019** Changes to the standard MUST be recorded in a change log. After the draft baseline, gaps MUST be handled as numbered amendments approved by the project owner.  
*Rationale:* Controlled evolution of the contract.

## 3. Artefact families

The six artefact families and what each must declare. Declarations are stated in words; their shapes are defined later.

**CCIS-REQ-020** CCIS MUST define six artefact families: contextual element, element group, pathway (with decision nodes), analytics package, terminology package, and test or validation package. Each MUST be independently versionable.  
*Rationale:* Ch7 s3.3.

**CCIS-REQ-021** A contextual element MUST declare its identity, clinical intent (purpose, setting, population, exclusions, rationale), data definitions (types, cardinality, units, precision, constraints), clinical semantics (concepts and terminology bindings), temporal semantics, epistemic semantics, relationships, provenance and tests.  
*Rationale:* A field is more than a label and a type (Ch7 s4).

**CCIS-REQ-022** Elements MUST declare a required core and MAY add conditional modules. They MUST NOT be required to carry every possible property.  
*Rationale:* Keeps elements small and reviewable.

**CCIS-REQ-023** An element group MUST declare its member elements, how shared concepts are identified, how overlaps and version constraints are resolved, and whether each member is mandatory or optional.  
*Rationale:* Composition needs explicit conflict handling (Ch7 s5.2).

**CCIS-REQ-024** Composition MUST identify shared concepts by meaning and MUST NOT merge fields only because their labels are similar.  
*Rationale:* Similar labels hide different meanings.

**CCIS-REQ-025** A pathway MUST declare its scope, intended use, exclusions, the elements it references with version ranges, its stages with entry and exit criteria, decision nodes, transitions, timing constraints, and which analytics are required or optional.  
*Rationale:* Ch7 s5.1.

**CCIS-REQ-026** A decision node MUST declare its question, its typed inputs, its preconditions, an outcome for every possible state including indeterminate, and the next step for each outcome. No outcome may lead nowhere.  
*Rationale:* Dangling or silent branches are unsafe (Ch9 s3).

**CCIS-REQ-027** A pathway MUST describe workflow and the information needed. It MUST NOT authorise treatment or automate a high-impact clinical action.  
*Rationale:* Action logic needs its own governance (Ch7 s5.1).

**CCIS-REQ-028** An analytics package MUST declare its identity and clinical question, intended users, population and limitations; its context requirements; its input contract including missing-data behaviour; its parameters; its computation; its output contract; its interpretation and prohibited interpretations; its execution profile; its evidence; and its provenance.  
*Rationale:* The marketplace must decide whether it can run, and the engine how (Ch7 s6.1).

**CCIS-REQ-029** Every parameter MUST declare its allowed range and units, and whether it is enabled. A parameter that carries a clinical threshold MUST default to disabled.  
*Rationale:* Supports the local-clinician rule.

**CCIS-REQ-030** A terminology package MUST provide versioned value sets, code-system references and mappings, with mapping status and confidence.  
*Rationale:* Ch7 s7.

**CCIS-REQ-031** A test or validation package MUST provide fixtures, expected outputs whose values are hand-calculated, edge cases and the scope the evidence supports.  
*Rationale:* Independent expected results make tests meaningful.

## 4. Epistemic and provenance rules

How missing, uncertain and sourced data are represented and kept apart.

**CCIS-REQ-032** An implementation MUST keep these states distinct and MUST NOT convert one into another: absent, unknown, not collected, not applicable, explicitly negative, and entered in error.  
*Rationale:* They mean different things clinically (Ch6 s6.3, Ch7 s7).

**CCIS-REQ-033** Unknown or absent data MUST NOT be treated as false, zero, negative or normal. Where a result depends on such data, the result MUST be indeterminate or the package MUST declare its explicit missing-data behaviour.  
*Rationale:* Core safety rule (D-007).

**CCIS-REQ-034** Records marked entered in error MUST be excluded by default and MUST NOT be counted as present data.  
*Rationale:* They are retractions, not observations.

**CCIS-REQ-035** Event or effective time and recorded time MUST be kept separate, as MUST collection time where it differs. They MUST NOT be conflated.  
*Rationale:* Different times answer different questions (Ch7 s7).

**CCIS-REQ-036** Every value MUST carry a source class from this set: patient-reported, clinician-entered, clinician-verified, imported, device, derived, or AI-proposed. The source class MUST be preserved through import and execution.  
*Rationale:* Certainty depends on source (Ch7 s7).

**CCIS-REQ-037** An AI-proposed value MUST NOT be treated as clinician-verified unless a clinician has verified it and that act is recorded.  
*Rationale:* Prevents model output hardening into fact.

**CCIS-REQ-038** A derived value MUST record how it was derived and from which inputs.  
*Rationale:* Traceability.

**CCIS-REQ-039** A lossy or low-confidence mapping MUST be visible to the user and in reports. It MUST NOT be applied silently.  
*Rationale:* Ch7 s7, s8.1.

## 5. Terminology and unit rules

Matching by meaning, and handling units without guesswork.

**CCIS-REQ-040** Matching and comparison MUST be based on code-system references and declared semantics. They MUST NOT be based on display labels or text similarity.  
*Rationale:* Ch7 s7.

**CCIS-REQ-041** Code-system and value-set bindings MUST be version-pinned where a version exists. Implementations MUST NOT invent codes.  
*Rationale:* Reproducible meaning.

**CCIS-REQ-042** Every numeric field MUST declare its permitted units. A comparison or calculation across values MUST require identical units or an explicitly declared conversion.  
*Rationale:* Never assume comparability from matching labels (Ch7 s7).

**CCIS-REQ-043** Unit conversions MUST be explicit, versioned and reviewable. Implicit conversion MUST NOT occur.  
*Rationale:* Silent conversion is a hazard.

**CCIS-REQ-044** A concept that cannot be mapped MUST be represented as unmapped and reported. It MUST NOT be dropped or guessed.  
*Rationale:* Nothing disappears silently.

**CCIS-REQ-045** Authoring tools, the marketplace and the runtime MUST resolve terminology and mappings with the same rules, so that an artefact cannot pass one and fail another through a different interpretation.  
*Rationale:* Ch7 s7.

## 6. Lifecycle and assurance

Statuses, and the separate dimensions of assurance.

**CCIS-REQ-046** An artefact version MUST have one lifecycle status from: Draft, Submitted, In Review, Reviewed, Validated, Conditionally Validated, Deprecated, Withdrawn, Rejected.  
*Rationale:* Ch7 s12.

**CCIS-REQ-047** A status beyond Draft MUST state what was assessed, by whom, against which standard and engine versions, for which population and intended use, and on what evidence.  
*Rationale:* A bare status is not auditable.

**CCIS-REQ-048** Assurance MUST be recorded separately for: structural conformance, semantic conformance, clinical review or validation, execution validation, and security and privacy assurance. They MUST NOT be collapsed into one badge.  
*Rationale:* A package can pass one and fail another (Ch7 s10.1).

**CCIS-REQ-049** The word Validated MUST always be accompanied by its scope: the version, population, setting and intended use it covers.  
*Rationale:* Prevents overclaiming.

**CCIS-REQ-050** Conditions attached to Conditionally Validated MUST be displayed prominently wherever the status is shown.  
*Rationale:* Ch7 s12.

**CCIS-REQ-051** Reviewed MUST mean only that a defined review took place. It MUST NOT be presented as proof of clinical effectiveness.  
*Rationale:* Ch7 s12.

**CCIS-REQ-052** A validation record MUST attach to one exact artefact version and declared scope. A new version MUST NOT inherit validation unless governance policy permits it and the rationale is recorded.  
*Rationale:* Ch7 s12.1.

**CCIS-REQ-053** Clinical review, clinical validation, software verification and regulatory assessment MUST be treated as distinct responsibilities with distinct records.  
*Rationale:* Ch7 s16.1.

**CCIS-REQ-054** Publication and any clinical claim MUST require accountable human review and approval. An AI system MUST NOT publish, validate or approve an artefact.  
*Rationale:* Ch7 s9.1.

## 7. Compatibility

How the application decides whether a package can run, and explains the decision.

**CCIS-REQ-055** Compatibility MUST be evaluated through six checks: artefact, semantic, schema, data readiness, runtime, and assurance suitability.  
*Rationale:* Ch7 s11.1.

**CCIS-REQ-056** The result MUST be exactly one of: Compatible, Compatible with limitations, Needs data, Incompatible, Not eligible.  
*Rationale:* Ch7 s11.2.

**CCIS-REQ-057** Every outcome MUST list which requirements were satisfied, which data are missing, and what would be needed to make the package runnable.  
*Rationale:* Users must see why (Ch7 s11.2).

**CCIS-REQ-058** Needs data MUST be used only when the context model matches and patient data is lacking. Incompatible MUST be used when a mandatory concept, field, version, unit or runtime requirement is not met.  
*Rationale:* Separates fixable from structural mismatches.

**CCIS-REQ-059** Not eligible MUST be used when lifecycle status or assurance scope does not permit the requested use.  
*Rationale:* Ch7 s11.2.

**CCIS-REQ-060** Compatibility MUST NOT be inferred from text similarity.  
*Rationale:* Ch7 s11.2.

**CCIS-REQ-061** A check that cannot be evaluated MUST be reported as such, and the outcome MUST NOT be Compatible.  
*Rationale:* Fail closed.

## 8. Execution boundary

What the engine may and may not do.

**CCIS-REQ-062** Packages MUST be declarative data. They MUST NOT carry executable code.  
*Rationale:* Safe execution (D-006).

**CCIS-REQ-063** The engine MUST execute packages only through a fixed set of permitted operations. It MUST NOT use dynamic code evaluation or dynamic loading of code.  
*Rationale:* Ch7 s6.2.

**CCIS-REQ-064** The engine MUST execute only a compiled, version-pinned form. It MUST NOT execute an authoring document or a mutable reference.  
*Rationale:* Ch7 s10.2.

**CCIS-REQ-065** Compilation MUST fail when a mandatory dependency, feature or semantic cannot be resolved.  
*Rationale:* Ch7 s10.2.

**CCIS-REQ-066** Logical results MUST be one of true, false or indeterminate. Indeterminate MUST propagate according to defined rules and MUST NOT be coerced to true or false.  
*Rationale:* D-007.

**CCIS-REQ-067** Identical input, artefact versions and parameters MUST produce byte-identical output.  
*Rationale:* Reproducibility (D-004).

**CCIS-REQ-068** Core modules MUST NOT access the network, files, the clock or randomness. Evaluation time and identifiers MUST be supplied as inputs.  
*Rationale:* Required for determinism.

**CCIS-REQ-069** An execution profile MUST declare resource limits and the engine MUST enforce them. A run that exceeds a limit MUST fail visibly and MUST NOT present a partial result as complete.  
*Rationale:* Ch7 s6.2.

**CCIS-REQ-070** Outputs MUST be checked against the package's declared output contract before they are presented.  
*Rationale:* Ch7 s13.

**CCIS-REQ-071** Before a run, the application MUST show missing data, assumptions and parameter values, including any disabled parameters.  
*Rationale:* Ch7 s13.1.

**CCIS-REQ-072** A computation that depends on a disabled parameter MUST NOT produce a value from it. It MUST report the dependency instead.  
*Rationale:* Thresholds arrive disabled.

**CCIS-REQ-073** Results MUST carry their warnings, limitations and missing-data notes, and MUST remain traceable to the definitions and source data used.  
*Rationale:* Ch7 s13.1.

**CCIS-REQ-074** AI MUST NOT perform any step of the core calculation. (Values with the AI-proposed source class are input data, handled under the source-class rules; they are not AI performing the calculation.) Any AI-generated text MUST be labelled, bounded by source results, and off unless the user enables it.  
*Rationale:* Ch7 s13.2.

## 9. Run record

What every run leaves behind.

**CCIS-REQ-075** Every run MUST produce a record containing: package identifier and version; standard version; engine version; operator versions; the versions of the selected context; the input snapshot; all parameter values and whether each was enabled; the supplied evaluation time; the output contract version; validation messages; result provenance; and warnings and limitations.  
*Rationale:* Ch7 s13.2.

**CCIS-REQ-076** A run record MUST NOT be altered after creation. A correction MUST create a new record that refers to the original.  
*Rationale:* Audit (D-009).

**CCIS-REQ-077** Re-executing from a run record MUST yield byte-identical output.  
*Rationale:* Proves determinism.

**CCIS-REQ-078** The input snapshot MUST remain on the user's device.  
*Rationale:* Privacy boundary.

## 10. Privacy boundary

What may and may not travel with packages, and what is kept from an import.

**CCIS-REQ-079** Patient data MUST NOT leave the user's device.  
*Rationale:* Ch6 s9.

**CCIS-REQ-080** A marketplace MUST hold only definitions, code, documentation and synthetic fixtures. It MUST NOT hold patient records or cohort membership.  
*Rationale:* Ch7 s13.2.

**CCIS-REQ-081** Publication and ingestion MUST screen for patient data and reject artefacts that appear to contain it.  
*Rationale:* Defence in depth.

**CCIS-REQ-082** By default, import MUST exclude personal identity and free-text narrative. Including either MUST require an explicit user action.  
*Rationale:* Data minimisation.

**CCIS-REQ-083** An imported case MUST be referenced by a pseudonymous identifier only.  
*Rationale:* Data minimisation.

**CCIS-REQ-084** Import MUST produce a report listing accepted, rejected, unmapped and ambiguous records. No record may be dropped without appearing in it.  
*Rationale:* Ch6 s6.

**CCIS-REQ-085** In version 0.1.0 the browser application MUST make no network requests. Any later network access MUST be limited to the declared marketplace host and MUST NOT carry patient data.  
*Rationale:* D-010.

## 11. Conformance pipeline and authoring routes

One pipeline for every way of creating an artefact.

**CCIS-REQ-086** LLM-assisted, graphical and code authoring MUST produce the same artefact representation and MUST pass the same pipeline.  
*Rationale:* Ch7 s9.

**CCIS-REQ-087** LLM assistance MUST start from the correct template and standard version, resolve terminology rather than invent it, mark unresolved assumptions, and produce drafts and tests only. It MUST NOT claim clinical validity.  
*Rationale:* Ch7 s9.1.

**CCIS-REQ-088** Validation MUST proceed through eight layers, named in the next section, and the pipeline MUST be the same for authoring, marketplace ingestion and runtime preflight.  
*Rationale:* Ch9 s4.

**CCIS-REQ-089** Every diagnostic MUST carry a severity, a stable rule identifier, the location in the artefact, a message and a remediation hint, in both machine-readable and human-readable form.  
*Rationale:* Ch9 s4.

**CCIS-REQ-090** Validation reports MUST name the exact standard version and validators used and MUST be retained in the artefact's audit history.  
*Rationale:* Ch7 s10.

**CCIS-REQ-091** FHIR Mode MUST be a representation and authoring route into the same canonical model, not a separate engine. Its mapping rules are deferred to a later phase.  
*Rationale:* Ch7 s8.

**CCIS-REQ-092** Unsupported or lossy constructs in a FHIR conversion MUST be reported. A syntactically valid FHIR resource MUST NOT be assumed to be a valid CCIS artefact.  
*Rationale:* Ch7 s8.1.

## 12. The eight validator layers (names only)

A conformant validator works through these layers. What each layer checks, and the rules inside them, are defined in Stage 2.

1. Syntax
2. Structural
3. Reference integrity
4. Semantic
5. Graph and compatibility
6. Executable safety
7. Test verification
8. Governance

## 13. Requirements matrix

Columns: requirement id, short statement (the full normative statement is in the section above), artefact affected, validation method, test, implementation status. The **Test** column is empty until Stage 2 creates test cases. Status values: Not started, In progress, Implemented, Verified.

| ID | Statement | Artefact | Validation method | Test | Status |
|----|-----------|----------|-------------------|------|--------|
| CCIS-REQ-001 | Specification suite | Standard | Review |  | Not started |
| CCIS-REQ-002 | Proposal status | Standard | Review |  | Not started |
| CCIS-REQ-003 | Separate product | Application | Inspection |  | Not started |
| CCIS-REQ-004 | Not a system of record | Application | Inspection |  | Not started |
| CCIS-REQ-005 | Descriptive by default | Analytics package | Governance |  | Not started |
| CCIS-REQ-006 | Conformance is not safety | All artefacts | Governance |  | Not started |
| CCIS-REQ-007 | Synthetic data only | Application | Review |  | Not started |
| CCIS-REQ-008 | No model-supplied clinical values | Analytics package | Governance |  | Not started |
| CCIS-REQ-009 | Stable identity | All artefacts | Structural |  | Not started |
| CCIS-REQ-010 | Identity declaration | All artefacts | Structural |  | Not started |
| CCIS-REQ-011 | Independent versions | All artefacts | Graph and compatibility |  | Not started |
| CCIS-REQ-012 | Semantic versioning | All artefacts | Structural |  | Not started |
| CCIS-REQ-013 | Immutable once published | All artefacts | Governance |  | Not started |
| CCIS-REQ-014 | Exact references | All artefacts | Reference integrity |  | Not started |
| CCIS-REQ-015 | Unknown critical content rejected | All artefacts | Structural |  | Not started |
| CCIS-REQ-016 | Namespaced extensions | All artefacts | Structural |  | Not started |
| CCIS-REQ-017 | Old versions stay addressable | Marketplace | Test verification |  | Not started |
| CCIS-REQ-018 | No silent migration | Tooling | Governance |  | Not started |
| CCIS-REQ-019 | Change control for the standard | Standard | Review |  | Not started |
| CCIS-REQ-020 | Six families | All artefacts | Structural |  | Not started |
| CCIS-REQ-021 | Element declarations | Contextual element | Structural |  | Not started |
| CCIS-REQ-022 | Core plus modules | Contextual element | Structural |  | Not started |
| CCIS-REQ-023 | Group declarations | Element group | Semantic |  | Not started |
| CCIS-REQ-024 | No merging by label | Element group | Semantic |  | Not started |
| CCIS-REQ-025 | Pathway declarations | Pathway | Structural |  | Not started |
| CCIS-REQ-026 | Decision node declarations | Pathway | Graph and compatibility |  | Not started |
| CCIS-REQ-027 | Pathways describe, not authorise | Pathway | Review |  | Not started |
| CCIS-REQ-028 | Analytics declarations | Analytics package | Structural |  | Not started |
| CCIS-REQ-029 | Parameter declarations | Analytics package | Executable safety |  | Not started |
| CCIS-REQ-030 | Terminology package | Terminology package | Semantic |  | Not started |
| CCIS-REQ-031 | Test package | Test package | Test verification |  | Not started |
| CCIS-REQ-032 | Distinct data states | All artefacts | Semantic |  | Not started |
| CCIS-REQ-033 | Unknown is never normal | Engine | Test verification |  | Not started |
| CCIS-REQ-034 | Entered in error | Importer | Test verification |  | Not started |
| CCIS-REQ-035 | Separate time meanings | Contextual element | Semantic |  | Not started |
| CCIS-REQ-036 | Source classes | Importer | Test verification |  | Not started |
| CCIS-REQ-037 | AI-proposed is not verified | Engine | Test verification |  | Not started |
| CCIS-REQ-038 | Derivation recorded | Analytics package | Test verification |  | Not started |
| CCIS-REQ-039 | Lossy mappings visible | Terminology package | Semantic |  | Not started |
| CCIS-REQ-040 | Match by meaning | All artefacts | Semantic |  | Not started |
| CCIS-REQ-041 | Versioned bindings | Contextual element | Semantic |  | Not started |
| CCIS-REQ-042 | Units declared | Contextual element | Semantic |  | Not started |
| CCIS-REQ-043 | Explicit conversions | Terminology package | Semantic |  | Not started |
| CCIS-REQ-044 | Unmapped is visible | Importer | Test verification |  | Not started |
| CCIS-REQ-045 | One resolution behaviour | Tooling | Test verification |  | Not started |
| CCIS-REQ-046 | Lifecycle statuses | All artefacts | Governance |  | Not started |
| CCIS-REQ-047 | Status states its basis | All artefacts | Governance |  | Not started |
| CCIS-REQ-048 | Five assurance dimensions | All artefacts | Governance |  | Not started |
| CCIS-REQ-049 | Validated carries scope | All artefacts | Governance |  | Not started |
| CCIS-REQ-050 | Conditions are prominent | Application | Inspection |  | Not started |
| CCIS-REQ-051 | Reviewed is not effective | All artefacts | Governance |  | Not started |
| CCIS-REQ-052 | Validation tied to a version | All artefacts | Governance |  | Not started |
| CCIS-REQ-053 | Distinct responsibilities | Standard | Review |  | Not started |
| CCIS-REQ-054 | Human accountability | Tooling | Governance |  | Not started |
| CCIS-REQ-055 | Six checks | Compatibility resolver | Graph and compatibility |  | Not started |
| CCIS-REQ-056 | Five outcomes | Compatibility resolver | Test verification |  | Not started |
| CCIS-REQ-057 | Outcomes are explained | Compatibility resolver | Test verification |  | Not started |
| CCIS-REQ-058 | Needs data versus incompatible | Compatibility resolver | Test verification |  | Not started |
| CCIS-REQ-059 | Not eligible | Compatibility resolver | Test verification |  | Not started |
| CCIS-REQ-060 | No similarity matching | Compatibility resolver | Test verification |  | Not started |
| CCIS-REQ-061 | Unevaluable check | Compatibility resolver | Test verification |  | Not started |
| CCIS-REQ-062 | Declarative only | Analytics package | Executable safety |  | Not started |
| CCIS-REQ-063 | Whitelist interpreter | Engine | Executable safety |  | Not started |
| CCIS-REQ-064 | Run only the compiled form | Engine | Test verification |  | Not started |
| CCIS-REQ-065 | Compilation fails closed | Compiler | Test verification |  | Not started |
| CCIS-REQ-066 | Three-valued results | Engine | Test verification |  | Not started |
| CCIS-REQ-067 | Deterministic | Engine | Test verification |  | Not started |
| CCIS-REQ-068 | Pure core | Engine | Executable safety |  | Not started |
| CCIS-REQ-069 | Resource limits | Engine | Executable safety |  | Not started |
| CCIS-REQ-070 | Outputs checked | Engine | Test verification |  | Not started |
| CCIS-REQ-071 | Plan shown before run | Application | Inspection |  | Not started |
| CCIS-REQ-072 | Disabled parameters | Engine | Test verification |  | Not started |
| CCIS-REQ-073 | Results show their basis | Application | Inspection |  | Not started |
| CCIS-REQ-074 | AI outside the calculation | Application | Inspection |  | Not started |
| CCIS-REQ-075 | Record contents | Run record | Test verification |  | Not started |
| CCIS-REQ-076 | Immutable record | Run record | Test verification |  | Not started |
| CCIS-REQ-077 | Reproducible rerun | Run record | Test verification |  | Not started |
| CCIS-REQ-078 | Snapshot stays local | Run record | Inspection |  | Not started |
| CCIS-REQ-079 | Patient data stays local | Application | Inspection |  | Not started |
| CCIS-REQ-080 | Marketplace content | Marketplace | Executable safety |  | Not started |
| CCIS-REQ-081 | Ingestion screening | Marketplace | Test verification |  | Not started |
| CCIS-REQ-082 | Import exclusions | Importer | Test verification |  | Not started |
| CCIS-REQ-083 | Pseudonymous case | Importer | Test verification |  | Not started |
| CCIS-REQ-084 | Nothing dropped silently | Importer | Test verification |  | Not started |
| CCIS-REQ-085 | Network use | Application | Test verification |  | Not started |
| CCIS-REQ-086 | Equivalent routes | Tooling | Test verification |  | Not started |
| CCIS-REQ-087 | LLM drafts only | Tooling | Governance |  | Not started |
| CCIS-REQ-088 | Eight validation layers | Validator | Test verification |  | Not started |
| CCIS-REQ-089 | Actionable diagnostics | Validator | Test verification |  | Not started |
| CCIS-REQ-090 | Reports retained | Validator | Governance |  | Not started |
| CCIS-REQ-091 | FHIR Mode is one route | Tooling | Review |  | Not started |
| CCIS-REQ-092 | Unsupported FHIR reported | Tooling | Semantic |  | Not started |
| CCIS-REQ-095 | Field concept key | Element | Schema | ccis-element-concept-schema.test.js; ccis-validator-concept.test.js | Implemented |
| CCIS-REQ-096 | One owner per concept | Element, element group | Semantic | ccis-validator-owner.test.js; ccis-concept-owners.test.js; ccis-group-owner-schema.test.js | Implemented |
| CCIS-REQ-097 | Second owner refused at publish | Market | Test verification | ccis-market-b15.test.js; ccis-contract-fixtures.test.js | Implemented |
| CCIS-REQ-098 | Local terminology package | Terminology package | Schema, semantic | ccis-terminology-package-schema.test.js; ccis-validator-terminology.test.js | Implemented |
| CCIS-REQ-099 | Entry form is layout only | Pathway | Schema, semantic | ccis-pathway-entryform-schema.test.js; ccis-validator-entryform.test.js | Implemented |
| CCIS-REQ-100 | Pathway contexts | Pathway | Schema, semantic | ccis-validator-contexts.test.js | Implemented |
| CCIS-REQ-101 | Composition by concept key | Element group, pathway | Test verification | ccis-compose-conflicts.test.js; ccis-compose-group.test.js; ccis-compose-pathway.test.js | Implemented |
| CCIS-REQ-102 | Rule pack scope | Rule pack | Schema, semantic | ccis-rule-pack-schema.test.js; ccis-validator-rulepack-shape.test.js | Implemented |
| CCIS-REQ-103 | No number in a rule | Rule pack | Schema, semantic | ccis-rule-pack-rules-schema.test.js; ccis-validator-rulepack-checks.test.js | Implemented |
| CCIS-REQ-104 | Prompt content | Rule pack | Test verification | ccis-rules.test.js; ccis-rules-bind.test.js | Implemented |
| CCIS-REQ-105 | Rule tests required | Rule pack | Semantic | ccis-validator-rulepack-cases.test.js | Implemented |
| CCIS-REQ-106 | Rule pack governance | Rule pack | Governance | ccis-rule-pack-governance-schema.test.js; ccis-validator-rulepack-governance.test.js | Implemented |
| CCIS-REQ-107 | Operators min, max, coalesce | Analytics package | Test verification | ccis-exec-min-max-coalesce.test.js | Implemented |
| CCIS-REQ-108 | Standard 0.2.0 | Standard | Test verification | ccis-standard-0-2-0.test.js | Implemented |

## 14. Not in this draft

Deferred to Stage 2 or later, and deliberately absent here: all schemas; the field-level shape of the EMR export; the validator rule catalogue and rule identifiers; the compiler's canonical form and checksum; run-record and marketplace storage formats; the command-line and module interfaces; FHIR Mode mapping tables; the cohort definition and cohort package contracts.

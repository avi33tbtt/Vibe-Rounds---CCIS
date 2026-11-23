# CCIS Build Plan (final, standalone app)

Repo: https://github.com/avi33tbtt/Vibe-Rounds---CCIS (starts from zero)
Research: https://github.com/avi33tbtt/Vibe-Rounds---EMR-Enhancer-App/tree/main/Research (book, Chapters 1 to 10)
Host app that produces the data: https://github.com/avi33tbtt/Vibe-Rounds---EMR-Enhancer-App/

Prototype. Synthetic data only. Not for clinical use.

---

## 0. The plan in ten lines

1. This repo is a **separate app**: the **Contextual Clinical Intelligence App** plus the **CCIS standard** it runs on (book Ch6 to Ch10). It is not a module of the EMR Enhancer.
2. It never touches the EMR's database or code. It **imports an export file** that the EMR Enhancer produces (the "context envelope"). This repo owns the receiving contract and the synthetic fixtures; the EMR conforms to it later.
3. It is **local-first**: one static browser app plus a Node CLI, pure JavaScript, no server and no database in the first version. Patient data stays on the user's device.
4. The engine is **deterministic and constrained**: a whitelist interpreter over declarative packages. No `eval`, no network, no file access, no clock reads. Unknown never becomes false or normal.
5. Knowledge comes from **packages** (elements, pathways, analytics) validated by one pipeline and pinned by checksum. A local test marketplace comes first, GitHub-hosted releases later.
6. First end-to-end slice: **snake envenomation process metrics** (bite-to-ASV interval and 20-minute clotting-test documentation completeness). No doses, no bands.
7. **Schemas, validator rules, compiler details, storage formats and API/CLI contracts are done at a later stage** (section 4). Phase 0 is documents only.
8. Work is done in small chunks, one per chat, with the EMR app's "do next" protocol.
9. The first release target is **CCIS 0.1.0**: the whole slice runs with one command and reruns byte-identically.
10. Expansion (templates, decision graphs, cohorts, FHIR Mode, authoring routes, governance, EMR cohort exporter) comes only after 0.1.0.

---

## 1. What is being built, and the boundaries

Three things exist in the ecosystem. Only the middle one is this repo.

| | EMR Enhancer (other repo) | **CCIS app + standard (this repo)** | Marketplace (later, own repo) |
|---|---|---|---|
| Job | Create and keep the contextual patient record; export it | Import context, check compatibility, run packages, show results with provenance; define and validate the standard | Distribute versioned knowledge packages |
| Holds patient data | Yes (its database) | Only what the user imports, on their device | **Never** |
| Talks to the others by | An export file | Reads the export file; reads package index and releases | Static index plus immutable releases |

Rules that follow from the book (Ch6 section 1, Ch8 section 11, Ch10 section 5):

- The app must not assume access to the EMR's database or runtime. Only a documented export package crosses the boundary.
- The marketplace holds definitions, code, documentation and **synthetic** fixtures only. Never patient records, never cohort membership.
- The EMR cohort exporter is the last item of the whole programme. The cohort engine is built and tested on synthetic fixtures first.

---

## 2. What this plan is built from

**From the book**
- Ch6: app architecture, import pipeline, compatibility in three levels, engine subsystems, operator library, status lifecycle, privacy boundaries, one-app-with-modules (no microservices).
- Ch7: the standard: artefact families, native mode and FHIR mode, three equal authoring routes, five assurance dimensions, runtime sequence, execution record.
- Ch8: templates, decision-node analytics, research-to-package workflow, cohort rules with three-valued eligibility, the package contract.
- Ch9: schemas, the eight-layer validator, reference artefacts, smallest runtime, acceptance tests, phases 0 to 6.
- Ch10: expansion order and the maturity definition.
- Ch5: the canonical model (observation semantics, effective vs recorded time, provenance classes, three version dimensions). CCIS uses this as the **meaning** of the import contract, without copying the EMR's tables.

**From the EMR repo** (conventions kept)
- Small chunk files, one per chat, each with a size guard; the "do next" tracker; `01-core.md` rules; `DECISIONS.md` (max 3 rows per task); `node --test`; CI on every push; "never mark DONE unless verified"; at most 3 deliberate-breakage checks; synthetic data only; escaping and no-inline-handler (CSP) discipline in the UI; a safety-test pack for rules that must never break.

**Conflicts found and how they are resolved**
| Conflict | Resolution |
|---|---|
| The EMR tracker puts CCIS code inside the EMR repo, run records in the EMR database and `ci.html` in the EMR app. The book says separate app. | Standalone, as you decided. The EMR tracker rows C0 to C9 and D1 to D7 are **moved here**; only the EMR-side exporter rows stay there (section 9). |
| Book Ch6 slice is diabetes + CKD; Ch9 and the EMR decisions use snake envenomation. | Snake envenomation first (decided 2026-11-22; pure timing and completeness, no thresholds). Diabetes + CKD becomes the **second demo** in Phase 4 to prove multi-context and combined analytics. |
| EMR plan says libraries are "pure JS, no DB" but runs them inside Express. | Keep pure JS, but the app itself has no server in v0.1. |
| Book Ch9 says freeze the spec before schemas; schema work always finds spec gaps. | The spec is **prototype-baselined** in Phase 0 (reviewed, approved). Gaps found later are logged as numbered amendments in `ccis/CHANGELOG.md` and need your approval. The real freeze is CCIS 0.1.0. |
| EMR C5a needs the EMR's B5 context service before runtime work can start. | Not needed any more: this repo defines the import contract and fixtures itself, so nothing waits on the EMR. |

---

## 3. Decisions (also copied into `DECISIONS.md`)

| ID | Decision | Why | Alternative not taken |
|---|---|---|---|
| D-001 | Standalone repo and app; integration only through an export file | Book Ch6; independent development; clean privacy boundary | Library inside the EMR repo |
| D-002 | Local-first: static browser app + Node CLI; no server, no database in 0.1 | Patient data stays on the device (Ch6 section 9); GitHub Pages friendly (Ch9 section 7); no auth/DB burden for a first slice | Express + PostgreSQL like the EMR (needed only if multi-user, population-level access control or shared run history is required; revisit in Phase 5) |
| D-003 | JavaScript, ES modules, flat root-level `ccis-*.js` files plus `ccis/` for spec, schemas, examples, fixtures; Node 22 in CI | Same module runs in Node and in the browser with no build step; matches the book's flat layout | TypeScript (can be added later; not needed to prove the contract) |
| D-004 | Core libraries are pure: no network, no file access, no clock reads, no randomness. Evaluation time and ids are **inputs** | Determinism and byte-identical reruns | Reading the clock inside the engine |
| D-005 | Schemas: JSON Schema 2020-12. Validators are generated at development time (Ajv standalone, to be verified in row 1.1) and committed, so the browser app ships no schema compiler and no `eval` | A strict CSP forbids runtime code generation; also the "no eval" rule | Compiling schemas in the browser |
| D-006 | Execution = whitelist interpreter over a declarative expression tree; no `eval`, `Function`, dynamic import | Ch7 section 6, Ch9 section 8 | Packages carrying code |
| D-007 | Results are three-valued (true / false / indeterminate) and absent, unknown, not collected, not applicable, negative and entered-in-error stay distinct | Ch6 section 6.3, Ch8 section 6.2 | Treating missing as zero or normal |
| D-008 | First slice: snake envenomation process metrics; thresholds are parameters supplied by a local clinician and arrive **disabled** | No doses or bands from any model | Diabetes + CKD first |
| D-009 | Run records are immutable, content-addressed and hold the input snapshot, so a rerun from the record is byte-identical | Ch7 section 13.2 | Mutable history |
| D-010 | Browser app makes **no network requests at all** until row 4.1; after that only to the declared marketplace host, never with patient data. Enforced by CSP `connect-src` and a test | Ch6 section 9 | Open network access |
| D-011 | AI is off and absent in 0.1.0. When added (row 4.3) it only drafts, behind an explicit switch, from a whitelist payload, and can never publish or validate | Ch7 section 9.1, Ch10 section 9 | LLM in the loop from the start |
| D-012 | Package lifecycle uses the book's statuses; assurance dimensions are recorded separately and never collapsed into one "validated" badge | Ch7 section 10 and 12 | Single badge |

---

## 4. DEFERRED: schemas and other formal contracts (later stage)

**Schemas, the database/storage design and the other formal contracts are deliberately done at a later stage, not in Phase 0.** Phase 0 produces documents in words only. The following are **not** defined now and must not appear in Phase 0 outputs:

- JSON Schemas for: package manifest, contextual element, terminology binding, pathway, decision node, analytics package, execution manifest, validation record, **context envelope and import report**, run result, run record.
- Field-level shape of the EMR export (Phase 0 states only what it must carry, in words).
- The validator's rule catalogue (the stable CCIS-V-nnn ids and their wording).
- The compiler's canonical form and checksum algorithm.
- Run-record and marketplace-index storage formats (file layout, IndexedDB design).
- CLI command surface and the exact module APIs.
- FHIR Mode mapping tables, the cohort definition schema, the cohort package contract.

They are done in **Stage 2 (Phases 1 to 3)**, which starts only when you say so after approving the Phase 0 documents (gate R0). Nothing in Phase 0 depends on them. If a Phase 0 task seems to need one, stop and add a Stage 2 row instead.

---

## 5. Architecture (modules and data flow)

### 5.1 Data flow (the runtime sequence from Ch7 section 13)

```
EMR export file --> [Importer] --> canonical context + import report
                                        |
 selected elements / pathway  ----------+
                                        v
 local catalogue / marketplace --> [Compatibility resolver] --> compatible / with limitations /
 (pinned, checksummed packages)         |                        needs data / incompatible / not eligible
                                        v  (user selects one or many)
                                   [Planner] --> [Executor: whitelist interpreter + operators]
                                        v
                               [Result validator] --> [Run record: immutable, with snapshot]
                                        v
                           [Results workspace: values, trace, evidence, provenance, limitations]
```

### 5.2 Modules (root-level files; all pure)

| File | Responsibility | Stage |
|---|---|---|
| `ccis-schema.js` (+ generated validators) | Load/compile-time schema access | 2 |
| `ccis-validate.js` | Eight-layer validator, machine-readable diagnostics, CLI | 2 |
| `ccis-compile.js` | Canonical form, checksum, equivalence | 2 |
| `ccis-terminology.js` | Code-system, unit and mapping resolution (shared by authoring, marketplace, runtime) | 2 to 3 |
| `ccis-import.js` | Export file to canonical context + import report | 3 |
| `ccis-compat.js` | Compatibility resolver with explanations | 3 |
| `ccis-exec.js` | Expression interpreter, operator library, decision-node walker, rule trace | 3 |
| `ccis-run.js` | Planner, batch runs, result validation, run records | 3 |
| `ccis-market.js` | Publish, resolve, pin, verify; lint for patient data | 3 (local), 4 (GitHub) |
| `app.js`, `index.html`, `ui-*.js` | Browser app (no inline handlers, shared escaper) | 3 |
| `cli.js` | Node CLI over the same modules | 3 |

### 5.3 Artefact families (Ch7 section 3.3) and lifecycle

Contextual Element, Element Group, Pathway (with Decision Nodes), Analytics Package, Terminology Package, Test/Validation Package. Each independently versioned; references name exact versions or ranges and are never copied in.

Lifecycle statuses: Draft, Submitted, In Review, Reviewed, Validated, Conditionally Validated, Deprecated, Withdrawn, Rejected. Assurance is recorded per dimension (structural, semantic, clinical review, execution, security/privacy), each attached to an exact package version and scope.

### 5.4 Compatibility outcomes (Ch7 section 11)

Compatible; Compatible with limitations; Needs data; Incompatible; Not eligible. Each with reasons. Six checks: artefact, semantic, schema, data readiness, runtime, assurance suitability. Never from text similarity.

### 5.5 What the import contract must carry (in words; shape is deferred)

Case reference (pseudonymous), applied element and pathway ids **with exact versions**, observations with value, unit, effective time, recorded time, status, source class (patient-reported, clinician-entered/verified, imported, device, derived, AI-proposed) and provenance, clinical events, terminology codes with verification state, envelope version, export time. Identity and narrative are **excluded by default**. Entered-in-error is excluded by default. The import report lists accepted, rejected, unmapped and ambiguous records.

---

## 6. Repository layout

At the end of Phase 0 (documents and scaffolding only):

```
README.md
CCIS_BUILD_PLAN.md      this file
CCIS_TASK_TRACKER.md    protocol + task table
DECISIONS.md            decisions log
plan-chunks/            one file per chunk; written just in time; never edited once the row has started
  01-core.md
  chunk-0.*.md
docs/                   IMPORT-CONTRACT.md, USE-CASE-SNAKE.md, TRACEABILITY.md
ccis/                   SPEC.md, CHANGELOG.md, README.md
.github/workflows/ci.yml
package.json  .gitignore  test/
```

Added in Stage 2 and later: `ccis/schemas/ examples/ fixtures/ templates/`, the `ccis-*.js` modules, `index.html`, `app.js`, `cli.js`, `market/` (local test marketplace with the same layout as the future marketplace repo), `test/`.

---

## 7. Phases and chunks

Phases follow Book Ch9 section 9 (0 to 6). IDs are `phase.number`. **"Chunk brief" below is what a chunk file is written from, when the row is reached** (chunk files are written just in time so that earlier findings are not frozen into wrong plans). Phase 0 chunk files already exist in `plan-chunks/`.

### Phase 0: Foundation and specification baseline  (NOW, no schemas)

| ID | Task | Output | Size guard |
|----|------|--------|-----------|
| 0.1 | Repo scaffold and CI | `package.json` (ESM, no dependencies), `.gitignore`, `test/smoke.test.js`, `.github/workflows/ci.yml` (Node 22, `npm test`) | 4 small files |
| 0.2 | Specification draft 0.1 | `ccis/SPEC.md` (requirement ids CCIS-REQ-nnn, scope, security boundary, versioning policy, epistemic and provenance rules, lifecycle, compatibility outcomes, failure behaviour, validator layers by name), `ccis/CHANGELOG.md`, `ccis/README.md` | 3 markdown files |
| 0.3 | Import contract in words | `docs/IMPORT-CONTRACT.md` (section 5.5 expanded; import report semantics; what the EMR must provide; versioning of the envelope) | 1 markdown file |
| 0.4 | Use-case dossier | `docs/USE-CASE-SNAKE.md`: element, pathway, two decision nodes, two analytics in words; disabled parameters; fixture classes; open clinician owner | 1 markdown file |
| 0.5 | Traceability and acceptance checklist | `docs/TRACEABILITY.md`: book concept to requirement id to later row; the Ch9 section 8 acceptance list as a checklist | 1 markdown file |
| R0 | **Review gate**: you read SPEC, IMPORT-CONTRACT, USE-CASE and approve the baseline | decision recorded in `DECISIONS.md` | none |

### Phase 1: Schemas and reference artefacts  (DEFERRED, Stage 2; starts after R0)

| ID | Chunk brief | Needs |
|----|-------------|-------|
| 1.1 | Schemas: manifest, element, terminology binding. Add the single pinned dev dependency (Ajv), a build script that emits committed standalone validators; verify standalone generation works for 2020-12 and needs no runtime `eval`. Good/bad fixtures | R0 |
| 1.2 | Schemas: pathway, decision node (explicit indeterminate and missing-data branches) | 1.1 |
| 1.3 | Schemas: analytics package (inputs, parameters, expression tree, outputs, failure behaviour, evidence), execution manifest | 1.2 |
| 1.4 | Schemas: **context envelope**, import report, validation record, run result, run record | 1.3 |
| 1.5 | Valid reference artefacts (snake element, 2-node pathway, 2 analytics) and synthetic fixtures (normal, boundary, missing, conflicting, out-of-scope, unit-conversion), each with an independently hand-calculated expected result | 1.4 |
| 1.6 | Invalid examples, one per validator layer, with expected diagnostics; a FHIR-Mode example with mapping report and declared limits | 1.5 |

### Phase 2: Validator and compiler  (DEFERRED)

| ID | Chunk brief | Needs |
|----|-------------|-------|
| 2.1 | Validator layers 1 to 3 (syntax, structure, reference integrity), library + CLI, diagnostics with severity, stable rule id, JSON path, message, hint | 1.6 |
| 2.2 | Layers 4 to 5 (semantic: units, types, time, terminology; graph and compatibility: traversable pathways, bounded cycles, no dangling branches) | 2.1 |
| 2.3 | Layers 6 to 8 (executable safety: whitelist only, no code strings; test verification against fixtures; governance claims match exact version and scope) + report writer | 2.2 |
| 2.4 | Compiler: canonical form, checksum, equivalence harness (same artefact from three routes gives identical canonical bytes); fail closed | 2.3 |

### Phase 3: Minimal runtime, app shell and the first vertical slice  (DEFERRED)

| ID | Chunk brief | Needs |
|----|-------------|-------|
| 3.1 | `ccis-import.js`: envelope to canonical context + import report; no silent loss; entered-in-error rejected by default; unit normalisation only through declared conversions | 2.4 |
| 3.2 | `ccis-compat.js`: six checks, five outcomes with reasons, "never guess a mapping"; execution policy v0 (which statuses may run; preview banner) | 3.1 |
| 3.3 | `ccis-exec.js` part 1: expression interpreter, operator whitelist, three-valued logic, step and depth limits, no eval | 3.2 |
| 3.4 | `ccis-exec.js` part 2: operator library v0 (interval between events, presence/completeness, count, first/last/min/max, coalesce) and decision-node walker with rule trace; reference packages reproduce hand-calculated results | 3.3 |
| 3.5 | `ccis-run.js`: planner, batch of several analytics on one context without mutating the source, result validation, immutable content-addressed run records with snapshot, rerun-from-record is byte-identical | 3.4 |
| 3.6 | `ccis-market.js` + `market/` local test marketplace: publish (needs passing validator report and checksum), resolve, pin; lint refuses patient records and cohort data | 2.4 |
| 3.7 | CLI: validate, import, list compatible, run, show | 3.5, 3.6 |
| 3.8 | Browser app 1: import workspace, import report, context and pathway selector, compatibility catalogue with explanations (including the "needs data" and "incompatible" views) | 3.7 |
| 3.9 | Browser app 2: multi-select run, results workspace (values with units, decision path with rule trace, missingness, scope, limitations, provenance), export of run record | 3.8 |
| 3.10 | Browser hardening: strict CSP including `connect-src 'none'`, shared escaper, no inline handlers, jsdom tests plus one real-browser smoke test | 3.9 |
| 3.11 | Slice acceptance and **CCIS 0.1.0**: one-command end-to-end test; removing one required observation changes the analytic to needs data; changing a package version or the input creates a distinct run record; negative tests (no undeclared network/file/patient data access; marketplace lint); freeze 0.1.0, limitations list. **You review the limitations list before Phase 4** | 3.10 |

### Phase 4: Authoring routes and distribution  (after 0.1.0)

| ID | Chunk brief |
|----|-------------|
| 4.1 | GitHub distribution client: fetch index and immutable releases, verify checksum and pin, failed verification blocks use; `connect-src` opened to that host only; test proves no patient data in any request |
| 4.2 | Code-authoring SDK and typed builders; equivalence test across routes |
| 4.3 | Governed LLM drafting (off by default, whitelist payload, drafts only, source references required, cannot publish or validate) |
| 4.4 | Form-based GUI authoring writing the same canonical artefact, with live validator diagnostics, a readable graph preview and a diff against the previous version (visual decision-graph builder stays later) |
| 4.5 | Second demo: diabetes + CKD, multi-context, a combined analytic; proves composition and failure policy |

### Phase 5: Reusable analytics, decision graphs, cohorts  (after 4.x)

| ID | Chunk brief |
|----|-------------|
| 5.1 | Analytics templates 1 to 3 (threshold, trend, score) with all fixture classes; parameters disabled |
| 5.2 | Templates 4 to 6 (monitoring gap, eligibility, follow-up due). Catalogue discovery: filters by clinical concept, decision node, pathway, population, required data, setting, evidence status and compatibility; status labels draft, reviewed, validated, deprecated; `validated` needs a validation record naming exact version, population, setting and use (schema-valid alone never reaches it); deprecation stores a replacement pointer and resolve warns. Medication-safety and staging stay BLOCKED until a named clinician supplies rules |
| 5.3 | Decision graphs: typed nodes and edges, static checks (no dead ends, bounded cycles, every missing/stale/conflicting input routed), executor with path and reasons |
| 5.4 | Research-to-package pipeline (extract, clarify, draft, map, generate, verify): drafts only, every rule traceable to a source passage; a human confirms each mapping; population, setting and intended use are mandatory; the user pastes the text (no paper ingestion yet); an untraceable rule is rejected and the package cannot reach `validated` without a human validation record |
| 5.5 | Cohort definition, three-valued evaluator, manifest with reasons and counts, on a ~30-patient synthetic set |
| 5.6 | Cohort analytics, aggregation, provenance; small-cell masking (default 5, clinical owner to confirm) |
| 5.7 | Access model for population-level work: purpose, separate permissions, audit. **Needs a decision on whether a server is introduced (D-002).** |

### Phase 6: Interoperability, governance, integration  (last)

| ID | Chunk brief |
|----|-------------|
| 6.1 | FHIR Mode: capability matrix, SDC boundary, conversion with loss report, round-trip tests only where claimed |
| 6.2 | Governance: `GOVERNANCE.md` and `CONTRIBUTING.md` (contribution process, reviewer roles, **independence rule: an author is never the reviewer**, review decision record format, release checklist, deprecation policy, security response); scoped validation records, deprecation and withdrawal, signing, migration guides; a small release script (`ccis-release.js`) so a dry-run release is blocked when the conformance suite, a validation record for any `validated` package, a changelog entry or a reviewer decision record is missing |
| 6.3 | Evaluation in CI: conformance as its own CI check; reliability metrics (validation failures, reproducibility of identical reruns, fixture coverage by class, runtime step and time budget, version drift, provenance completeness, every validator rule has a test) kept separate from clinical measures; CI fails on a reproducibility break. Write `ccis/EVALUATION.md`: what is measured, what is NOT measured (clinical correctness), failure modes watched. Before any implementation of it, record the book's "Avinash Principle" (Ch5 B11) as a hypothesis with an operational definition, comparator and failure modes |
| 6.4 | Cohort data package contract + import path + contract test with a stub exporter; then the real EMR exporter is accepted only through this path |

---

## 8. Tests and safety strategy

- **Conformance suite** = valid examples pass; each invalid example fails with its expected diagnostics; three authoring routes give identical canonical bytes; reruns are byte-identical.
- **Safety pack** (built progressively, grows with code): unknown never becomes false/normal; entered-in-error and AI-proposed data never counted as verified fact; no eval/Function/dynamic import anywhere in shipped files (source scan); package execution cannot reach network, filesystem or undeclared inputs; marketplace lint refuses patient data; no clock or randomness in pure modules (source scan); CSP present and `connect-src` as decided; every clinical claim names exact version, population, setting and intended use.
- **Hand-calculated expectations**: every fixture result is calculated independently and recorded beside the fixture.
- **CI**: GitHub Actions, Node 22, one command (`npm test`); real-browser smoke test is required in CI and skipped locally only if no Chrome.
- Software conformance never implies clinical safety; the two are recorded in separate fields.

---

## 9. The interface with the EMR Enhancer (what changes there)

Nothing is built in the EMR from this plan except the exporter, later. Recommended edits to the EMR repo tracker (do when convenient):

1. Mark EMR rows C0 to C9 and D1 to D7 as **MOVED to the CCIS repo** (this plan replaces them).
2. Keep **B5** (context service) and **D8b** (cohort exporter). Re-describe B5's envelope as "must conform to `docs/IMPORT-CONTRACT.md` of the CCIS repo, checked by the CCIS fixtures".
3. Close the EMR open question "where do the CCIS libraries live": answered, separate repo.
4. Until B5 exists, the CCIS app is developed on synthetic exports written by hand from the contract.

---

## 10. Gates

- **R0** (end of Phase 0): you approve SPEC draft, IMPORT-CONTRACT and the use case.
- **Gate B** (end of Phase 2): all schemas compile; every invalid example gives its expected diagnostics; compiler deterministic.
- **Gate C** (3.11, CCIS 0.1.0): one-command slice reproduces its result; negative tests pass; you review the limitations list.
- **Before any real patient data**: clinical safety sign-off, security review, privacy assessment, terminology licences checked, device-software and health-data rules checked, independent clinical review of any package labelled validated. Until then synthetic data only.

---

## 11. Open questions

1. **Clinician owner** for the snake-envenomation parameters (interval target, clotting-test timing). Until named, all parameters stay disabled and the packages are demonstrations of mechanics only.
2. **Stack confirmation (D-002)**: local-first with no server and no database. If you expect multiple users or shared history early, say so now; it changes Phase 3 storage and Phase 5.
3. **Naming**: "CCIS" is a working name (book Ch7 section 3); decide before any public release.
4. **Where the marketplace repo lives** (a third repo, `clinical-intelligence-marketplace` in the book); needed only at row 4.1.
5. **Licence and terminology licensing** (SNOMED, CPT and others have terms): checked before any code system beyond synthetic/local is used.

---

## 12. Main risks

| Risk | Handling |
|---|---|
| Schemas reveal gaps in the spec | Numbered amendments in CHANGELOG with your approval; freeze only at 0.1.0 |
| Import contract drifts from what the EMR will really export | Contract lives here with fixtures; EMR exporter must pass them (row 6.4, and B5 early) |
| Scope creep into LLM, cohorts, FHIR before the slice works | These rows are after 3.11; the tracker forbids starting them |
| Browser storage loss of run records | Run records are exportable files; the UI prompts to export |
| "Validated" misread as clinically safe | Separate assurance fields; UI shows scope; prototype banner everywhere |
| Free-tier session limits | Small chunks, size guards, just-in-time chunk files |

## 13. Demo track (added 2026-11-23)

A small demo runner (rows DS0 to DS7) shows the EMR and CCIS working end to end before the full Phase 2 and 3 runtime exists. Scope and rules: `docs/DEMO-SLICE.md`. Decisions D-038 to D-040. The demo uses the committed validators, the snake reference artefacts (after 1.5b) and the fixtures as the oracle. It is replaced, not extended, by rows 2.x and 3.x. EMR-side rows (B5a, B5b, DM1 to DM4) and the full EMR roadmap (R0 to R8) are tracked in the EMR repo; coordination map: `docs/ROADMAP-COORDINATION.md`.

| Risk | Handling |
|---|---|
| Demo runner hardens into the standard by accident | `ccis-demo-` prefix, header comment, replacement noted on rows 3.x |
| Placeholder parameters mistaken for clinical values | Disabled by default; `--demo-parameters` flag; banner on every view |
| Staged cohort view mistaken for the cohort engine | Persistent "staged" label (D-040) |

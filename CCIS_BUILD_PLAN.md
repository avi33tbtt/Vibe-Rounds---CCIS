# CCIS Build Plan

Repo: https://github.com/avi33tbtt/Vibe-Rounds---CCIS
Based on: https://github.com/avi33tbtt/Vibe-Rounds---EMR-Enhancer-App/ (its tracker, chunk files, conventions and the Track C rows C0 to C9)
Research: https://github.com/avi33tbtt/Vibe-Rounds---EMR-Enhancer-App/tree/main/Research

Prototype. Synthetic data only. Not for clinical use.

---

## 1. What CCIS is, and how this plan relates to the EMR app

CCIS (Clinical Context Intelligence Standard) is the declarative standard for clinical context elements, pathways, decision nodes and analytics packages, plus the toolchain that makes it trustworthy: validator, compiler, constrained runtime, run records and a test marketplace.

The EMR Enhancer app is the **host**: it holds patients, cases, element sets, observations, notes and the server-side context envelope. CCIS is the **standard and engine** that consumes that context and runs reusable packages against it.

What this repo takes from the EMR app, unchanged in spirit:

| From the EMR app | Used here as |
|---|---|
| Small chunk files, one per chat, with a "Size guard" | Same. Plan chunks live in `plan-chunks/` |
| Slim tracker with the **"do next"** protocol | `CCIS_TASK_TRACKER.md` (created in Phase 0) |
| `01-core.md` rules that never change | `plan-chunks/01-core.md` (CCIS version, section 4 below) |
| `DECISIONS.md` archive, max 3 rows per task | Same |
| Node.js (>=20), flat layout, `node --test`, no framework for tests | Same |
| CI on every push (`.github/workflows/ci.yml`) | Same, no database needed for the pure libraries |
| "Never mark DONE unless implemented and verified" | Same |
| Mutation checks (break it, see the test fail, restore) | Same, at most 3 per task |
| Safety-test pack idea (rules that must never break) | A CCIS safety pack, built when there is code to guard |

Decision carried over from the EMR tracker (2026-11-22): **CCIS libraries are pure JS with no database access**, so they can live in this repo, be published separately, and be tested without PostgreSQL. Anything that needs the database (run records, the context service) lives in the EMR app and calls CCIS as a library.

---

## 2. Deferred to a later stage: schema and other formal contracts

**Schemas and related formal artefacts will be done at a later stage, not now.** This plan covers the project, the specification intent, conventions, the first use case and the order of work. It does not define:

- the JSON Schemas (manifest, element, terminology binding, pathway, decision node, analytics package, execution manifest, validation record, run result);
- the database schema and migrations (run records, marketplace index tables, anything stored);
- the validator's rule catalogue (CCIS-V-nnn IDs and their exact wording), because it depends on the schemas;
- the canonical-form and checksum algorithm of the compiler, because it depends on the schemas;
- the API contracts between the EMR app and CCIS (request and response shapes);
- the FHIR Mode mapping tables and the cohort data package contract.

Why: the specification must be written and approved first, and the EMR app's own server-side model (cases, element-set versions, observations, context envelope: its Track B) is not built yet. Freezing schemas now would mean freezing them against a moving target.

Everything below is arranged so that these items slot in at **Stage 2 (section 5)** without changing Stage 0 or Stage 1. Nothing in Stage 0 or Stage 1 may contain a schema, a migration or an API shape. If a task seems to need one, stop and add it as a Stage 2 row instead.

---

## 3. Scope and the first use case

**In scope (eventually):** the eight artefact types (manifest, contextual element, terminology binding, pathway, decision node, analytics package, execution manifest, run result), validation, compilation, a constrained deterministic executor, immutable run records, a local test marketplace and a result viewer.

**Out of scope for the first baseline (CCIS 0.1):** cohort analytics, FHIR Mode round-trip, templates catalogue, LLM drafting, research-to-package, population-level access. These are the later D-series rows in the EMR tracker and come after the baseline.

**First vertical slice (fixed, as in the EMR plan):** snake envenomation process metrics.

- bite-to-ASV interval;
- 20-minute whole-blood clotting test documentation completeness.

Thresholds are **parameters supplied by the local clinician and arrive disabled**. No doses, bands or thresholds come from any model, from this plan or from the example fixtures.

---

## 4. Core rules for this repo (`plan-chunks/01-core.md`)

Copy of the EMR core rules, trimmed to what applies to CCIS.

**Product:** a standard plus toolchain. Not a clinical application. Not a place where patient data lives.

**Architecture**
- Packages are **declarative data only**: no code, no network, no filesystem, no patient data access.
- The executor has no `eval`, no `Function`, no dynamic `require`. Operators are a whitelist.
- Results are three-valued: true, false, indeterminate. **Unknown never becomes false or normal.**
- Same input gives byte-identical output.
- Versioning is semver. A breaking change is a new major. Unknown critical fields are rejected. Extensions use the `x-` namespace.
- The EMR app's own model is the system of record. FHIR R4 is an export boundary only.

**Safety**
- Synthetic data only until the go-live gate.
- No LLM-supplied doses, thresholds or protocol bands. AI only drafts, and drafts are never auto-published.
- Rules and bands arrive disabled until a local clinician enables them.
- Requirements carry stable IDs (CCIS-REQ-nnn). Validator rules carry stable IDs (CCIS-V-nnn) once Stage 2 defines them.

**Data and provenance**
- Run records are immutable. Reruns from a stored snapshot reproduce the same output.
- Approver and author identities come from the host session, never from a package body.

**Process**
- One chunk per chat. Size guard respected. Never mark DONE unless verified.
- Never edit an existing chunk file once written. Add a new row instead.

---

## 5. Stages and chunks

The chunk IDs mirror the EMR tracker (C0 to C9) so the two plans stay comparable. Rows marked **DEFERRED** are Stage 2 and are not started until the specification is approved and the EMR app's Track B prerequisites are done.

### Stage 0: Foundation (do now, no code)

| ID | Task | Output | Size guard |
|----|------|--------|------------|
| P0 | Repo scaffolding: `.gitignore`, `package.json` (no dependencies yet), `plan-chunks/`, CI workflow that runs `node --test` | 4 small files | no source code |
| P1 | Tracker and protocol: `CCIS_TASK_TRACKER.md` with the "do next" protocol adapted from the EMR tracker, `DECISIONS.md` (empty log), `plan-chunks/01-core.md` from section 4 | 3 markdown files | docs only |
| C0 | Specification baseline, **intent level**: `ccis/SPEC.md` (normative core with CCIS-REQ-nnn IDs, versioning policy, security boundary, list of validator layers by name only), `ccis/CHANGELOG.md`, `ccis/README.md`; fix the first use case (section 3); list the eight artefact types and their **required metadata in words**, not as schemas | 3 markdown files | no schemas, no code |
| C0r | Review gate: the user reads the spec, approves freezing it for prototype work | approval recorded in `DECISIONS.md` | none |

### Stage 1: Spec-only scaffolding that does not need schemas (next)

| ID | Task | Output | Size guard |
|----|------|--------|------------|
| S1 | Glossary and traceability: map each chapter (7 to 10) concept to a requirement ID and to a later chunk | 1 markdown file | docs only |
| S2 | Reference-use-case narrative: the snake envenomation example written as prose and a worked example (inputs named, no numeric thresholds), plus the list of synthetic fixture cases to be created later | 1 markdown file | docs only |
| S3 | Host contract **intent**: what CCIS expects from the EMR app (a minimal context envelope, in words), mapped to EMR tracker rows B5 and C5a. No field-level shapes | 1 markdown file | docs only |
| S4 | Conformance and acceptance criteria written as a checklist (the Ch9 definition of done), with no test code | 1 markdown file | docs only |

### Stage 2: Formal contracts and toolchain (**DEFERRED**, schemas etc. are done here)

Starts only when: C0r approved, S1 to S4 done, and the EMR app has its Track B context service (B5) available to design against.

| ID | Task | EMR-tracker equivalent | Needs |
|----|------|------------------------|-------|
| C1a | JSON Schemas: manifest, element, terminology binding (+ Ajv pinned, schema loader, tests) | C1a | C0r |
| C1b | JSON Schemas: pathway, decision node | C1b | C1a |
| C1c | JSON Schemas: analytics package, execution manifest, validation record, run result | C1c | C1b |
| C2a / C2b | Reference artefacts (valid) and invalid examples per validator layer, synthetic fixtures | C2a, C2b | C1c |
| C3a to C3c | Validator, 8 layers, stable CCIS-V-nnn diagnostics, CLI | C3a to C3c | C2b |
| C4 | Compiler: canonical form, checksum, equivalence | C4 | C3c |
| DB1 | Database design for run records and marketplace index (migrations belong in the EMR app, numbered, restricted role, no DELETE/TRUNCATE on clinical data) | part of C6 | C4, EMR B5 |
| API1 | API contracts CCIS to EMR app (context envelope in, run result out) | part of C5a, C6 | C4, EMR B5 |

### Stage 3: Runtime and first vertical slice (**DEFERRED**)

| ID | Task | Needs |
|----|------|-------|
| C5a | Runtime: import the context envelope | EMR B5, C4 |
| C5b | Compatibility resolver | C5a |
| C5c | Constrained deterministic executor and decision path (no `eval`, three-valued, step and depth limits, byte-identical reruns) | C5b |
| C6 | Immutable run records + API (lives in the EMR app, uses the CCIS library) | C5c, EMR B5 |
| C7 | Local test marketplace: publish, resolve, pin | C4 |
| C8 | Result viewer | C6 |
| C9 | Vertical slice: author, validate, publish, import a real server case, resolve, run, store, read back, rerun identical; negative tests for undeclared network, filesystem and patient data; freeze **CCIS 0.1.0** with a known-limitations list the user reviews | C6, C7, C8 |

### Stage 4: Expansion (after the 0.1 baseline)

Same as the EMR tracker's D-series: templates and catalogue (D1), decision graphs and governed LLM drafting (D2), research to package (D3), cohort definition, evaluator, analytics and access (D4), FHIR Mode (D5), governance (D6), evaluation (D7), cohort package contract and exporter (D8). Chunk files are written only when reached.

---

## 6. Repository layout

Created in Stage 0 and Stage 1 (docs and scaffolding only):

```
README.md
CCIS_BUILD_PLAN.md          this file
CCIS_TASK_TRACKER.md        slim tracker + "do next" protocol (P1)
DECISIONS.md                decisions log, max 3 rows per task (P1)
plan-chunks/                one file per chunk, never edited after writing
  01-core.md
  chunk-*.md
ccis/
  SPEC.md                   normative core (C0)
  CHANGELOG.md
  README.md
docs/                       S1 to S4
.github/workflows/ci.yml    runs node --test
package.json
```

Added at Stage 2 and later (not now): `ccis/schemas/`, `ccis-schema.js`, `ccis-validate.js`, `ccis-compile.js`, `ccis-runtime.js`, `ccis-exec.js`, `ccis/reference/`, `ccis/fixtures/`, `test/ccis-*.test.js`.

---

## 7. Working protocol (adapted from the EMR tracker)

Trigger phrase: **"do next"**. One task per trigger, small sessions.

1. Refresh the repo first (`git pull` or a fresh shallow clone). Do not pick a task before this succeeds.
2. Read only `CCIS_TASK_TRACKER.md`, `plan-chunks/01-core.md` and the single chunk file named in the next task.
3. Pick the first row with status `TODO` or `IN PROGRESS`.
4. Size check before building. If the task does not fit its size guard, stop, propose the split, add rows. Do not half-build.
5. **Do not start any Stage 2 row** until its "Needs" are DONE and the spec freeze is approved.
6. Verify lightly: `npm test` once, at most 3 deliberate-breakage checks.
7. Deliver only new or changed files, with the tracker updated (DONE, date, files, one line of notes).
8. Other commands: `status`, `redo <id>`, `skip <id>`, `split <id>`.

---

## 8. Acceptance gates

**Gate A (end of Stage 0):** spec is internally consistent, every requirement has an ID, the user approves the freeze.
**Gate B (end of Stage 2):** every schema compiles; the validator gives the expected diagnostics for every invalid example; the compiler is deterministic.
**Gate C (end of Stage 3, CCIS 0.1.0):** the whole slice runs with one command and reproduces its result; unsafe package behaviour is blocked by negative tests; limitations list reviewed by the user.
**Go-live gate (inherited from the EMR app, unchanged):** clinical safety sign-off, tested encrypted restore, security hardening and CI pass, AI server-side and off by default, device-software and health-data rules checked, terminology licences checked. CCIS is not used on real patient data before this gate.

---

## 9. Open items for the user

1. Confirm the Stage 0 and Stage 1 split, and that everything in section 2 stays deferred.
2. Confirm CCIS libraries stay in this repo (as planned) rather than inside the EMR app repo.
3. Approve (later, at C0r) the frozen specification before any Stage 2 work.

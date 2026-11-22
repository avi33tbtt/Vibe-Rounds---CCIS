# CCIS: Agent Protocol and Task Tracker (slim)

Repo: https://github.com/avi33tbtt/Vibe-Rounds---CCIS
Master plan: `CCIS_BUILD_PLAN.md` (read only when a task says so). Chunk files: `plan-chunks/`. Decisions: `DECISIONS.md`.
Prototype. Synthetic data only. Not for clinical use.

---

## PROTOCOL (instructions for Claude)

Trigger phrase: **"do next"**. Keep the session small (free-tier limit).

1. **Refresh the repo first**: `git clone --depth 1` or `git pull`. Do not pick a task or write anything before this succeeds.
2. **Read only these three things**: this file, `plan-chunks/01-core.md`, and the ONE chunk file named in the next task's row. Do not read other chunk files or the whole master plan.
3. **Pick the next task**: the first row with status `TODO` or `IN PROGRESS`. ONE task per "do next".
4. **Stage 2 lock**: rows from Phase 1 onward are `LOCKED` until the user says **"start stage 2"** (schemas and other formal contracts are deferred). Never start a `LOCKED` row.
5. **No chunk file yet?** Rows after Phase 0 have no chunk file. If the next row has none, the task is to **write that chunk file** (docs only) from its "chunk brief" in `CCIS_BUILD_PLAN.md` section 7, using what earlier rows learned, then stop and ask the user to approve it. The following "do next" builds it.
6. **Size check before building**: if the task cannot be finished within its size guard, STOP, say which part to split off, add it as a new row (`3.5a`). Do not half-build. Do not implement later tasks.
7. **Match the conventions** in `01-core.md`. If the plan is ambiguous, pick the most reasonable option, add max 3 rows to `DECISIONS.md`, mention it in the summary.
8. **Verify lightly**: `npm test` ONCE (all must pass). At most 3 deliberate-breakage checks (undo a fix, see the new test fail, restore).
9. **Deliver as one zip**: only new or changed files, plus the updated tracker (status `DONE`, date, files, ONE line of notes, 200 characters max). **Always** package them in a single `.zip` named `ccis-<task-id>-<date>.zip` (for example `ccis-1.3a-2026-11-24.zip`) whose internal folders are exactly the repo-relative paths (`ccis/schemas/...`, `plan-chunks/...`, `test/...`, `.github/workflows/...`), so extracting it at the repo root puts every file in place. Include `DECISIONS.md` and any changed `CHANGELOG`/`TRACEABILITY` file. List the zip contents (`unzip -l`) to check the structure, then present the zip with `present_files`. Do not present loose files, except a lone file the user asks to see. This also applies to tasks that only write a chunk file. Summary: 2 to 4 sentences: what was built, what needs the user's attention, what the next task is, and one line: "Extract the zip at the repo root, commit, push."
10. **Never** edit a chunk file after its row has started; add a new row instead. Never mark `DONE` unless implemented and verified.
11. If everything reachable is `DONE`, say so and offer a review.

Other commands: `status` (summary only), `redo <id>`, `skip <id>`, `split <id>`, `start stage 2`.

If a chat ends midway, nothing is `DONE` until verified: open a new chat, attach this file and say "do next".

---

## STATUS LEGEND
`TODO` | `IN PROGRESS` | `DONE` | `BLOCKED` | `SKIPPED` | `SPLIT` | `LOCKED` (not startable yet)

## TASK LIST

| ID | Plan file | Task | Status | Date | Size guard | Notes (one line) |
|----|-----------|------|--------|------|------------|------------------|
| 0.0 | (this repo) | Plan, tracker, core rules, decisions, Phase 0 chunk files | DONE | 2026-11-22 |  | Delivered as documents. |
| 0.1 | chunk-0.1-scaffold-ci.md | Repo scaffold and CI | DONE | 2026-11-22 | 4 small files | package.json, .gitignore, test/smoke.test.js, .github/workflows/ci.yml. npm test passes (Node 22); breakage check seen failing. |
| 0.2 | chunk-0.2-spec-draft.md | CCIS specification draft 0.1 (words, requirement ids) | DONE | 2026-11-22 | 3 markdown files | ccis/SPEC.md (92 reqs, matrix), ccis/CHANGELOG.md, ccis/README.md. Words only; book fetched from the EMR repo. |
| 0.3 | chunk-0.3-import-contract.md | Import contract in words | DONE | 2026-11-22 | 1 markdown file | docs/IMPORT-CONTRACT.md: 61 items IMP-nnn, report semantics, versioning, EMR section (B5, D8b). Words only. |
| 0.4 | chunk-0.4-use-case.md | Snake envenomation use-case dossier | DONE | 2026-11-22 | 1 markdown file | docs/USE-CASE-SNAKE.md: 9 facts, 2-node pathway, 2 analytics, 6 disabled parameters, fixture classes. No thresholds. D-013, D-014. |
| 0.5 | chunk-0.5-traceability.md | Traceability and acceptance checklist | DONE | 2026-11-22 | 1 markdown file | docs/TRACEABILITY.md: 113 book headings mapped, 14 gaps (G-01 to G-14), 26-item checklist, 27 deferred items, requirement index. |
| R0 | (user) | Review gate: approve SPEC draft, import contract, use case | DONE | 2026-11-23 |  | Recorded at owner's instruction; no clinician review yet; gaps G-01/03/04/05 deferred to their rows. See DECISIONS.md. |
| 1.1 | chunk-1.1-schemas-core.md | Schemas: manifest, element, terminology binding (chunk file first) | DONE | 2026-11-23 | 1 chunk file | 3 schemas, Ajv standalone validators (no eval), 12 fixtures, 17 tests pass; 3 breakage checks seen failing. D-015 to D-017. CI now runs npm ci. |
| 1.2 | chunk-1.2-schemas-pathway.md | Schemas: pathway, decision node (explicit indeterminate and missing-data branches) | DONE | 2026-11-23 | 1 chunk file | 2 schemas (pathway, decision node), 7 fixtures, 25 tests pass; 3 breakage checks seen failing. D-018, D-019: state tests only, no values. |
| 1.3 | chunk-1.3-schemas-analytics.md | Schemas: analytics package (inputs, parameters, expression tree, outputs, failure behaviour, evidence) | DONE | 2026-11-23 | 1 chunk file | Analytics schema with recursive expression tree (18 ops, no numeric literal), 10 fixtures, 37 tests pass; 3 breakage checks seen failing. A-002 closes G-04. D-020 to D-022. |
| 1.3a | chunk-1.3a-schema-execution-manifest.md | Schema: execution manifest (split from 1.3 for size) | DONE | 2026-11-23 | 1 schema, up to 7 fixtures | Exec-manifest schema (exact pins), 7 fixtures, 46 tests pass; 3 breakage checks seen failing. D-023 to D-025. Next: 1.4 chunk file. |
| 1.4 | chunk-1.4-schemas-envelope-report.md | Schemas: context envelope, import report (decides G-01 as A-001; chunk file written first) | DONE | 2026-11-23 | 2 schemas, up to 14 fixtures | Envelope and report schemas, 14 fixtures, 63 tests pass; 3 breakage checks seen failing. A-001 closes G-01. D-026 to D-028. IMP-014 open (G-05). |
| 1.4a | chunk-1.4a-schemas-validation-run.md | Schemas: validation record, run result, run record (split from 1.4 for size) | DONE | 2026-11-23 | 3 schemas, up to 16 fixtures | 3 schemas, 16 fixtures, 81 tests pass; 3 breakage checks seen failing. D-029 to D-031. Batch (G-03) and integrity (G-05) still open. Next: 1.5 chunk file. |
| 1.5 to 1.6 | (written when reached) | Reference artefacts and invalid examples (rest of Phase 1) | TODO |  |  | Stage 2. Each row unlocks after the one before it. |
| 2.1 to 2.4 | (written when reached) | Validator and compiler | LOCKED |  |  | Stage 2. |
| 3.1 to 3.11 | (written when reached) | Importer, compatibility, executor, run records, local marketplace, CLI, browser app, hardening, slice, CCIS 0.1.0 | LOCKED |  |  | Stage 2. 3.11 ends with the user's limitations review. |
| 4.1 to 4.5 | (written when reached) | GitHub distribution, authoring routes, second demo | LOCKED |  |  | After 0.1.0. |
| 5.1 to 5.7 | (written when reached) | Templates, decision graphs, research-to-package, cohorts, access model | LOCKED |  |  | After Phase 4. 5.7 needs the D-002 server decision. |
| 6.1 to 6.4 | (written when reached) | FHIR Mode, governance, evaluation, cohort package contract | LOCKED |  |  | Last. |

## ITEMS ONLY YOU CAN DO
- Review and approve gate R0.
- Say "start stage 2" when ready for schemas and formal contracts.
- Name a clinician owner for the snake-envenomation parameters.
- Confirm D-002 (local-first, no server/database in 0.1.0).
- Turn on branch protection for `main` and require the CI check once CI exists.
- Review the limitations list at 3.11 before Phase 4.
- Before any real data: safety sign-off, security review, privacy assessment, licence checks.

## OPEN QUESTIONS
See `CCIS_BUILD_PLAN.md` section 11.

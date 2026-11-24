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

**Added 2026-11-23 (demo slice and roadmap coordination).** Rows DS0 to DS7 build a small, clearly labelled demo runner so the EMR and CCIS can be shown end to end (scope: `docs/DEMO-SLICE.md`). They use the `ccis-demo-` file prefix and are replaced by rows 2.x and 3.x, which stay `LOCKED`. The fixtures remain the regression oracle. Global build order across both repos: CCIS 1.5b -> EMR B5a, B5b -> DS1 to DS4 -> EMR DM1, DM2a, DM2b, DM3 -> DS5 to DS7 -> EMR DM4. Roadmap coordination: `docs/ROADMAP-COORDINATION.md`.

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
| 1.5 | chunk-1.5-reference-artefacts.md | Valid snake reference artefacts: element, binding, pathway, 2 nodes, 2 analytics (chunk file first) | DONE | 2026-11-23 | 7 artefacts, 1 test | 7 artefacts, README, 13 tests (94 pass); 3 breakage checks seen failing. D-032 to D-034 (no value-set members; P6 unused). Next: 1.5a chunk file. |
| 1.5a | chunk-1.5a-synthetic-fixtures.md | Synthetic fixtures (six classes) with hand-calculated expected results (split from 1.5 for size) | DONE | 2026-11-23 | ~20 cases, 1 test | 23 cases, 11 tests (105 pass); 3 breakage checks seen failing. Findings F-1 to F-5 (trees vs dossier); hours case deferred. D-035 to D-037. Next: 1.5b chunk file. |
| 1.5b | chunk-1.5b-analytics-corrections.md | Analytics 0.1.1: comparison honours certainty, F7 and F3; declared hour-to-minute conversion; the deferred cases (chunk file first) | DONE | 2026-11-23 | 2 artefact versions, ~10 cases, 1 test | 2 analytics 0.1.1, 9 cases (32 total), 10 new tests (115 pass); 3 breakage checks seen failing. F-1, F-2, F-3 (part) fixed; F-4, F-5 open. D-041 to D-043. Next: DS1 (EMR B5a, B5b come first). |
| DS0 | chunk-DS0-demo-slice-scope.md | Demo slice scope contract + roadmap coordination map (docs only) | DONE | 2026-11-23 | 2 markdown files | docs/DEMO-SLICE.md, docs/ROADMAP-COORDINATION.md. Owner reviews. |
| DS1 | chunk-DS1-demo-loader.md | Demo loader: validate artefacts and envelope, import report, refuse bad input | DONE | 2026-11-23 | 1 module, 1 test file | ccis-demo-loader.js, 13 tests (128 pass); 3 breakage checks seen failing. All 32 fixtures load. D-044 to D-046. Next: DS2a.
| DS2a | chunk-DS2a-demo-executor.md | Demo executor: whitelist interpreter and the interval analytic (completeness split to DS2a-2) | DONE | 2026-11-23 | 1 module, 1 test file | ccis-demo-exec.js, 17 tests (144+1 pass); all 32 cases equal expected on 0.1.1; 3 breakage checks seen failing. Split: completeness to DS2a-2. D-047 to D-049. |
| DS2a-2 | chunk-DS2a-2-demo-executor-completeness.md | Demo executor part 2: select, count, table results; completeness analytic (4 outputs), fixtures as oracle (chunk file first) | DONE | 2026-11-23 | 1 module edit, 1 test file | All 32 cases equal expected, both analytics; 160 tests, 3 breakage checks seen failing. F-6 found (not-collected reads complete). D-050 to D-052. |
| DS2b | chunk-DS2b-demo-pathway.md | Two-node pathway evaluation with explicit indeterminate and missing-data branches | DONE | 2026-11-23 | 1 module, 1 test file | ccis-demo-pathway.js: all 32 routes equal fixtures; 175 tests (1 todo); 3 breakage checks seen failing. D-053 to D-055. Next: DS3. |
| DS3 | chunk-DS3-demo-run-record.md | Run record builder: content-addressed id, snapshot, versions, demo-parameter note | DONE | 2026-11-23 | 1 module, 1 test file | ccis-demo-record.js, 13 tests (187+1 todo pass); 32 fixtures give valid, byte-identical records; 3 breakage checks seen failing. D-056 to D-058. Next: DS4. |
| DS4 | chunk-DS4-demo-cli.md | `ccis-cli.js run` (envelope in, run record out, no network) | DONE | 2026-11-23 | 1 CLI, 1 test file | ccis-cli.js, npm run demo, 9 tests (196+1 todo pass); exit 0/2 rules; 3 breakage checks seen failing. D-059 to D-061. EMR DM3 can call it. Next: DS5 after EMR DM1 to DM3. |
| DS5 | chunk-DS5-demo-viewer.md | Static result viewer with banners (CSP-safe) | DONE | 2026-11-23 | 1 page, 1 test file | ccis-viewer.html (hash CSP, no innerHTML), 10 jsdom tests (206+1 todo pass); 3 breakage checks seen failing. jsdom devDep. D-062 to D-064. Next: DS6 (EMR DM1 to DM3 first). |
| DS6 | chunk-DS6-demo-staged-cohort.md | Staged cohort view (batch of real runner over fixtures) + second-package card | DONE | 2026-11-23 | 1 script, 1 page edit, 1 test | scripts/demo-batch.js, cohort-demo.json (32 cases, counts only), viewer section, 7 tests. npm test NOT run (owner's request); counts checked by hand. D-065 to D-067. Next: DS7. |
| DS7 | chunk-DS7-demo-hardening.md | EMR-export end-to-end test, README "Run the demo", limitations | DONE | 2026-11-24 | 1 test, 1 fixture pair, README | emr-export fixture pair, 6 tests pass; 3 breakage checks seen failing. README run/staged/limits, CI demo step. F-7, F-8. D-068 to D-070. Suite: 2 older failures (DS5/DS6). |
| 1.6 | chunk-1.6-invalid-examples.md | Invalid examples, one per validator layer, with expected diagnostics (FHIR-Mode example split to 1.6a) | DONE | 2026-11-24 | 8 examples, 8 expected files, 1 test | 7 examples (layers 1-6, 8), README, test. Layer 7 gap: A-003 proposed, row 1.6b. npm test NOT run (owner request). D-071 to D-073. |
| 1.6a | chunk-1.6a-fhir-mode-example.md | FHIR-Mode example with mapping report and declared limits (split from 1.6 for size; chunk file first) | DONE | 2026-11-24 | 3 example files, 1 README, 1 test | 3 example files, README, 7 tests. Element passes schema; report counts hand-checked. npm test NOT run (owner request). A-004 proposed. D-074 to D-076. |
| 1.6b | chunk-1.6b-schemas-tests-validation.md | Schema members for A-003: package `tests` (analytics) and manifest `validation` scope, with fixtures (chunk file first; replaces the old 1.6b plan) | DONE | 2026-11-24 | 2 schemas, ~8 fixtures, 1 test | 2 schemas (manifest validation, analytics tests), 8 fixtures, 5 tests; validators rebuilt. npm test NOT run (owner request). 1.6 layer 8 example adjusted. D-077 to D-079. Next: 1.6c chunk file. |
| 1.6c | chunk-1.6c-layer7-layer8-examples.md | Layer 7 invalid example and layer 8 scope example (needs 1.6b) | DONE | 2026-11-24 | 2 examples, 2 expected files, 1 README, 1 test | 2 examples (layer 7; layer 8 scope), 2 expected files, README, test extended. All 8 layers covered. npm test NOT run (owner request). Fixed 1.6b test conflict. D-080, D-081. Next: 2.1 chunk file. |
| 2.1 | chunk-2.1-validator-layers-1-3.md | Validator layers 1 to 3 (syntax, structure, reference integrity), library and CLI, diagnostics | DONE | 2026-11-24 | 1 module, 1 CLI edit, 1 test | ccis-validator.js, `validate` command, test file. npm test NOT run (owner request); a script matched the 3 examples and valid files passed. D-085 to D-087. Next: 2.2 chunk file. |
| 2.2 | (written when reached) | Validator layers 4 to 5 (semantic; graph and compatibility) | TODO |  |  | Needs 2.1 (done). Next "do next" writes the chunk file. |
| 2.3 | (written when reached) | Validator layers 6 to 8 and report writer | LOCKED |  |  | Needs 2.2. |
| 2.4 | (written when reached) | Compiler: canonical form, checksum, equivalence harness, fail closed | LOCKED |  |  | Needs 2.3. |
| 3.1 to 3.11 | (written when reached) | Importer, compatibility, executor, run records, local marketplace, CLI, browser app, hardening, slice, CCIS 0.1.0 | LOCKED |  |  | Stage 2. Replaces the demo runner (DS1 to DS5); keep `ccis-cli.js` interface and fixtures. 3.11 ends with the user's limitations review. |
| 4.1 to 4.5 | (written when reached) | GitHub distribution, authoring routes, second demo | LOCKED |  |  | After 0.1.0. |
| 5.1 to 5.7 | (written when reached) | Templates, decision graphs, research-to-package, cohorts, access model | LOCKED |  |  | After Phase 4. 5.7 needs the D-002 server decision. |
| 6.1 to 6.4 | (written when reached) | FHIR Mode, governance, evaluation, cohort package contract | LOCKED |  |  | Last. |

## ITEMS ONLY YOU CAN DO
- Run `npm test` once for 2.1 (not run at your request; new test `test/ccis-validator.test.js`, plus the `validate` command added to `ccis-cli.js`); if it fails, say "redo 2.1".
- Run `npm test` once for 1.6c (`test/invalid-examples.test.js` was extended); if it fails, say "redo 1.6c".
- Run `npm test` once for 1.6b (`test/schemas-a003.test.js`, plus the rebuilt validators and the changed 1.6 layer 8 example); if it fails, say "redo 1.6b".
- Run `npm test` once for 1.6a (it was not run at your request; the new test is `test/fhir-mode-example.test.js`); if it fails, say "redo 1.6a".
- Run `npm test` once for 1.6 (it was not run at your request); if it fails, say "redo 1.6".
- `npm test` has 2 failures from earlier rows, also on a clean checkout: DS6 `ccis-demo-batch.test.js` test 11 (conflicting `itemStates` counts 2, hand count 1) and DS5 `ccis-viewer.test.js` test 99 (normal-01 snapshot shows 8 observations, record has 9). Say "redo DS6" or "redo DS5" to fix each.
- Findings F-7 and F-8 (`ccis/fixtures/snake/README.md`): decide whether a later package version adds a node 1 outcome for an unknown result and an estimate warning on needs-data intervals.
- Follow `docs/DEMO-RUNBOOK.md` in the EMR repo on a clean machine with this commit (EMR DM4c asks for this).
- Finding F-6 (`ccis/fixtures/snake/README.md`): a not-collected expected item gives overall `complete`. Approve a 0.1.2 fix as a new row (not blocking DS2b).
- Confirm the omission rule D-050 (conflicting inputs: count, overall status and window are left out).
- Run `npm test` once on your machine for DS6 (it was not run here at your request); if it fails, say "redo DS6".
- Review `docs/DEMO-SLICE.md` and `docs/ROADMAP-COORDINATION.md` (rows DS0 and DS-X are drafts).
- Answer findings F-4 and F-5 (`ccis/fixtures/snake/README.md`): by amending the dossier or by accepting the 0.1.0 tree behaviour. Two deferred fixture cases wait on them.
- Confirm D-042: `convert` on a duration parameter is read as "express in the target unit" (identity when already minutes). Phase 2 must define it.
- Decide whether test-only placeholder parameter values may be shown in the demo (labelled), or the demo should show only "not enabled" states.
- Review and approve gate R0.
- Name a clinician owner for the snake-envenomation parameters.
- Confirm D-002 (local-first, no server/database in 0.1.0).
- Turn on branch protection for `main` and require the CI check once CI exists.
- Review the limitations list at 3.11 before Phase 4.
- Before any real data: safety sign-off, security review, privacy assessment, licence checks.

## OPEN QUESTIONS
See `CCIS_BUILD_PLAN.md` section 11.

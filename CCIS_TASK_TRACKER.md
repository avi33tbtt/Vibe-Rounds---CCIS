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
12. **Free-tier budget** (added 2026-11-24; tightened D-151): read at most 5 files in a task, and for any source file over 5 KB read only the line ranges the chunk file names (`sed -n`), never the whole file; a chunk file stays under 5 KB; a test file has at most 8 cases; run only the new test file unless the owner says otherwise; a row creates at most 3 new modules, or 1 module plus 1 test plus small assets; no row adds more than one dependency. If a chunk file would break this, write it narrower and add the remainder as new rows first. Completed rows live in `docs/TRACKER-ARCHIVE.md` and the long owner list in `docs/OWNER-ITEMS.md`: do not read either.

Other commands: `status` (summary only), `redo <id>`, `skip <id>`, `split <id>`, `start stage 2`.

If a chat ends midway, nothing is `DONE` until verified: open a new chat, attach this file and say "do next".

---

**Added 2026-11-23 (demo slice and roadmap coordination).** Rows DS0 to DS7 build a small, clearly labelled demo runner so the EMR and CCIS can be shown end to end (scope: `docs/DEMO-SLICE.md`). They use the `ccis-demo-` file prefix and are replaced by rows 2.x and 3.x, which stay `LOCKED`. The fixtures remain the regression oracle. Global build order across both repos: CCIS 1.5b -> EMR B5a, B5b -> DS1 to DS4 -> EMR DM1, DM2a, DM2b, DM3 -> DS5 to DS7 -> EMR DM4. Roadmap coordination: `docs/ROADMAP-COORDINATION.md`.

**Stage 2 started 2026-11-24 (owner: "start stage 2").** Phase 3 rows 3.1 to 3.11 are `TODO`, one chunk file at a time, in order. Phases 4 to 6 stay `LOCKED` until CCIS 0.1.0 (row 3.11).

---

## STATUS LEGEND
`TODO` | `IN PROGRESS` | `DONE` | `BLOCKED` | `SKIPPED` | `SPLIT` | `LOCKED` (not startable yet)

## TASK LIST

| ID | Plan file | Task | Status | Date | Size guard | Notes (one line) |
|----|-----------|------|--------|------|------------|------------------|
| 0.0 to 3.7 | `docs/TRACKER-ARCHIVE.md` | All completed rows (Phases 0 to 3.7, DS0 to DS7) | DONE | to 2026-11-24 |  | Moved to the archive. Latest: 3.7 CLI over the market. |
| 3.8 | chunk-3.8-app-shell.md | Browser app 1: pure SHA-256 (build only), esbuild pipeline to one hashed inline script, `index.html` shell with banners, `--check` | DONE | 2026-11-24 | 2 new modules, 1 script, 3 small assets, 1 generated page, 2 tests | ccis-sha256.js, build-app.js, index.html (1.2 MB); 14 tests pass in 2 files; 3 breakage checks seen failing. Full npm test NOT run (owner). D-146. Next: 3.8a chunk file. |
| 3.8a | chunk-3.8a-market-loader.md | Browser app 1b: market folder loader (`loadMarket` through the seam), market view, refusal view | DONE | 2026-11-24 | 2 modules, 1 test | ccis-app-market.js, ccis-app-market-view.js, test; 23 tests pass in 3 files; 3 breakages seen failing; full npm test: 1 stale test fixed (D-149). D-147 to D-149. Next: 3.8b chunk file. |
| 3.8b | chunk-3.8b-envelope-import.md | Browser app 1b-i: pure import report view and `heldFromMarket` (no DOM) | DONE | 2026-11-24 | 1 module, 1 test, 0 edits | ccis-app-import-report.js and test; 5 tests pass (new file only); 2 breakages seen failing. Next: 3.8b.1 chunk file. |
| 3.8b.1 | chunk-3.8b.1-import-view.md | Browser app 1b-ii: envelope file input, size cap, parse, import, render, Clear (module and jsdom test only, not wired) | DONE | 2026-11-24 | 1 module, 1 test | ccis-app-import-view.js and test; 7 tests pass (new file only); 2 breakages seen failing. Next: 3.8b.2 chunk file. |
| 3.8b.2 | chunk-3.8b.2-import-wiring.md | Browser app 1b-iii: wire into `ccis-app.js`, template, CSS, market clear resets import, no-storage scan, rebuild `index.html` | DONE | 2026-11-24 | 0 new modules, 1 test, 4 small edits | Import wired; 14 tests pass in 2 files (wire, build); 2 breakages seen failing; index.html rebuilt (1.2 MB). Next: 3.8c chunk file. |
| 3.8c | chunk-3.8c-selector-model.md | Browser app 1c-i: pure context and pathway selector model | DONE | 2026-11-25 | 1 module, 1 test | ccis-app-selector.js and test; 7 tests pass (new file only); 2 breakages seen failing. Next: 3.8c.1 chunk file. |
| 3.8c.1 | chunk-3.8c.1-selector-view.md | Browser app 1c-ii: selector view (module and jsdom test only, not wired) | DONE | 2026-11-25 | 1 module, 1 test | ccis-app-selector-view.js and test; 8 tests pass (new file only); 2 breakages seen failing. Next: 3.8c.2 chunk file. |
| 3.8c.2 | chunk-3.8c.2-selector-wiring.md | Browser app 1c-iii: wire selector into `ccis-app.js`, template; import view passes applied versions; `selectorState()`; rebuild `index.html` | DONE | 2026-11-25 | 0 new modules, 1 test, 4 small edits | Selector wired; 28 tests pass in 4 files; 2 breakages seen failing; index.html rebuilt (1.2 MB). Next: 3.8d chunk file. |
| 3.8d | chunk-3.8d-catalogue-model.md | Browser app 1d-i: pure catalogue model (explanations, Needs data, Incompatible) | DONE | 2026-11-25 | 1 module, 1 test | ccis-app-catalogue.js and test; 8 tests pass (new file only); 2 breakages seen failing. Finding F-12 (see DECISIONS). Next: 3.8d.1 chunk file. |
| 3.8d.1 | chunk-3.8d.1-catalogue-view.md | Browser app 1d-ii: catalogue view (module and jsdom test only, not wired) | DONE | 2026-11-25 | 1 module, 1 test | ccis-app-catalogue-view.js and test; 8 tests pass (new file only); 2 breakages seen failing. Next: 3.8d.2 chunk file. |
| 3.8d.2 | chunk-3.8d.2-catalogue-wiring.md | Browser app 1d-iii: wire catalogue into the page; import view and selector view hand over the imported context and the chosen pathway key (in memory only); rebuild `index.html` | DONE | 2026-11-25 | 0 new modules, 1 test, 5 small edits | Catalogue wired (#compat); 36 tests pass in 5 files; 2 breakages seen failing (one substituted, D-166); index.html rebuilt (1.26 MB). Next: 3.9 chunk file. |
| 3.9 | chunk-3.9-run-adapter.md | Browser app 2-i: in-page run adapter (planner and run through the seam, bundle check, no UI) | DONE | 2026-11-25 | 1 module, 1 test | ccis-app-run.js and test; 8 tests pass (new file only); 2 breakages seen failing; bundle 1.28 MB alone. D-168. Next: 3.9.1 chunk file. |
| 3.9.1 | chunk-3.9.1-run-view.md | Browser app 2-ii: run view (package multi-select, needs-data box, typed evaluation time, Run) and an `only` filter in the adapter (module and jsdom test only, not wired) | DONE | 2026-11-25 | 1 module, 1 test, 1 small edit | ccis-app-run-view.js, test, `only` in ccis-app-run.js; 16 tests pass in 2 files; 2 breakages seen failing. D-170. Next: 3.9.1a chunk file. |
| 3.9.1a | chunk-3.9.1a-run-wiring.md | Browser app 2-iii: wire the run view into the page; import view gains `getResult()`; `runState()`; rebuild `index.html` | DONE | 2026-11-25 | 0 new modules, 1 test, 5 small edits | Run wired (#run); 37 tests pass in 5 files; 2 breakages seen failing (one substituted, D-172); index.html rebuilt (1.33 MB). Next: 3.9a chunk file. |
| 3.9a | chunk-3.9a-results-model.md | Browser app 2b-i: pure results model (values with units, decision path, missingness, scope, limitations, provenance) | DONE | 2026-11-25 | 1 module, 1 test | ccis-app-results.js and test; 8 tests pass (new file only); 2 breakages seen failing. D-174. Next: 3.9a.1 chunk file. |
| 3.9a.1 | chunk-3.9a.1-results-view.md | Browser app 2b-ii: results view (module and jsdom test only, not wired) | DONE | 2026-11-25 | 1 module, 1 test | ccis-app-results-view.js and test; 8 tests pass (new file only); 2 breakages seen failing. Next: 3.9a.2 chunk file. |
| 3.9a.2 | chunk-3.9a.2-results-wiring.md | Browser app 2b-iii: wire the results view into the page (record kept in the closure), `resultsState()`, rebuild `index.html` | DONE | 2026-11-25 | 0 new modules, 1 test, 4 small edits | Results wired (#results); 45 tests pass in 6 files; 2 breakages seen failing; index.html rebuilt (1.34 MB). D-177. Next: 3.9b chunk file. |
| 3.9b | (written when reached) | Browser app 2c-i: pure run record export and verification line (see F-11) | TODO |  | 1 module, 1 test | Needs 3.9a.2. |
| 3.9b.1 | (written when reached) | Browser app 2c-ii: export button and wiring | TODO |  | 1 module, 1 test | Needs 3.9b. |
| 3.10 | (written when reached) | Browser hardening 1: strict CSP, no inline handlers, bundle-wide forbidden-API scan | TODO |  | 1 script or test, 1 test | Needs 3.9b.1. |
| 3.10.1 | (written when reached) | Browser hardening 2: shared escaper, jsdom tests over every view | TODO |  | 1 module, 1 test | Needs 3.10. |
| 3.10a | (written when reached) | One real-browser smoke test (adds one pinned dev dependency; owner approves first) | TODO |  | 1 test, 1 dependency | Needs 3.10.1. |
| 3.11 | (written when reached) | Slice acceptance 1: one-command end-to-end test | TODO |  | 1 test, 1 script | Needs 3.10a. |
| 3.11.1 | (written when reached) | Slice acceptance 2: required-observation removal, version or input change gives a distinct record, negative tests | TODO |  | 1 test | Needs 3.11. |
| 3.11a | (written when reached) | Freeze CCIS 0.1.0, limitations list. Ends with your review before Phase 4 | TODO |  | docs only | Needs 3.11.1. |
| 4.1 to 4.5 | (written when reached) | GitHub distribution, authoring routes, second demo | LOCKED |  |  | After 0.1.0. |
| 5.1 to 5.7 | (written when reached) | Templates, decision graphs, research-to-package, cohorts, access model | LOCKED |  |  | After Phase 4. 5.7 needs the D-002 server decision. |
| 5.8 | chunk-5.8-cohort-context-graph.md | Cohort Context Graph and aggregate Cohort Explorer (synthetic ~30-subject cohort; derived in-memory projection; relationship-map UI). Source brief is over 5 KB: split into narrower chunk files (projection, fixture, map view, timeline, tests) when reached | LOCKED |  | split into 5+ rows when reached | Needs 5.5 and 5.6 (and 3.10 for UI). 5.7 before any shared or real use. Not 5.3 decision nodes. D-178. |
| 6.1 to 6.4 | (written when reached) | FHIR Mode, governance, evaluation, cohort package contract | LOCKED |  |  | Last. |


## ITEMS ONLY YOU CAN DO (short list; full history in `docs/OWNER-ITEMS.md`)
- Row 3.8 took the defaults (D-146): `esbuild` 0.28.2 pinned, pure SHA-256 in the bundle only, `index.html` committed with `--check` in CI. Say so if any should change. Run `npm ci` after you pull (new dependency).
- Run the full `npm test` once on your machine. On a fresh clone at 3.8a it ran 664 tests: all pass except the two known F-6 TODO gaps.
- New F-12 (D-162): with no context the pathway row reads "Compatible with limitations" while its packages need data; the view must show the package rows. Decide F-10, F-11 and D-112 (they affect rows 3.9 to 3.9b).
- Commit `market/` as it is (it holds `.gitattributes` with `* -text`).
- Still open: clinician owner, D-002, F-4 to F-9, D-099, branch protection; before real data: safety, security, privacy, licence checks.

## OPEN QUESTIONS
See `CCIS_BUILD_PLAN.md` section 11.

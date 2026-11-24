# Owner items (moved from the tracker 2026-11-24)

Open items only you can do. 'do next' does not read this file; look here when you want to answer one.

- Approve the 3.8 chunk file (`plan-chunks/chunk-3.8-app-shell.md`) by saying "do next" (defaults apply) or answer its five questions. Most important: question 1 adds `esbuild` as an exact-pinned dev dependency, and question 5 splits the plan's 3.8 into 3.8 and a new 3.8a.
- Row 3.7 took the defaults for its five questions (D-141, D-142): `--market` selects market mode, parameters only from `--params`, `--run-needs-data` is the only F-10 answer, `import --out` writes the context to the named path, `show` never prints the snapshot. Say so if any should change.
- `npm test` was NOT run for 3.7; only `node --test test/ccis-cli-flow.test.js` (15 pass). Run the full `npm test` once on your machine after you push.
- Finding F-11 (D-143): `verifyRecord` does not cover `record.context`, so an altered byte there still verifies. Decide whether a new row fixes it (row 3.5 module). Browser row 3.9 will show the same verification.
- Row 3.6 took the defaults for its five questions (D-137, D-138): pure market value plus one writing script; element, analytics and pathway only (nodes and bindings still wait for D-099); immutable releases, no unpublish; a narrow lint that names rule and path only; highest non-blocked version, pin is `{ id, type, version, checksum }`. Additions: refusal M-013 (a pin to a rejected or withdrawn version blocks use) and lint rule L-008 (not plain JSON). Say so if any should change.
- `npm test` was NOT run for 3.6; only `node --test test/ccis-market.test.js` (32 pass). Run the full `npm test` once on your machine after you push, and `node scripts/market-build.js --check`.
- Commit the `market/` folder as it is (it holds a `.gitattributes` with `* -text` so Windows line endings cannot change the checksummed bytes).
- Row 3.5 took the defaults for its five questions (D-133): one record per request; id includes `corrects`; shared parameter ids declared identically; Needs data items skipped and listed; D-112 left open. One addition: `request.runNeedsData` (opt-in). Say so if any should change.
- Finding F-10 (D-134): by default the completeness analytic is skipped when an input is missing, though its results are real. Decide whether a package may declare it reports on missing data (schema change, new row) or whether callers just pass `runNeedsData`. Row 3.7 (CLI) needs the answer.
- `npm test` was NOT run for 3.5; only `node --test test/ccis-run.test.js` (15 pass). Run the full `npm test` once on your machine after you push.
- Row 3.4b took the defaults for its five questions (D-130, D-131): trace as a separate member, D-053 kept, record ids (not values) in the trace, 33 routes plus demo equality as oracle, wording in the module. Say so if any should change.
- `npm test` was NOT run for 3.4b; only `node --test test/ccis-walk.test.js` (15 pass). Run the full `npm test` once on your machine after you push 3.4a and 3.4b.
- Row 3.4a took the defaults for its five questions (D-126 to D-128): wording table in `ccis-bind.js`; enabled values as a plain `supplied` argument; D-050 and F-6 unchanged; 32 cases plus the EMR export are the oracle; an unreadable time stays quiet. One difference from the demo: a zoneless time now gives `needs-data`, not `indeterminate` (D-127). Say so if any should change.
- `npm test` was NOT run for 3.4a; only `node --test test/ccis-bind.test.js` (17 pass, 1 todo). Run the full `npm test` once on your machine after you push.
- Row 3.4 took the defaults for its five questions (D-122, D-123): D-042 confirmed; no first, last, min, max, coalesce (F-9); split into 3.4, 3.4a, 3.4b; X-002 kept but unreachable. Say so if any should change.
- Row 3.3 took the defaults for its five questions (D-116, D-117): no short-circuit; `is-present` always true or false; pinned checksum required; unimplemented operators refuse the whole analytic; no implicit unit conversion. Say so if any should change. Finding F-9 (D-115): first, last, min, max and coalesce are not in the schema enum; the 3.4 chunk file must choose.
- `npm test` was run once for 3.4 on a fresh clone with the new files: 545 pass, 0 fail, 1 todo (F-6). Earlier: 531 for 3.3, 502 for 3.2, 475 for 3.1, 466 for 2.4. Run it once on your machine after you push.
- 2.4 took the defaults for its four questions: A-005 approved with the chunk file; array order is significant; lone nodes and bindings are refused; no schema for compiled metadata (later, with 3.6). Say so if you want any changed.
- Row 3.2 took the defaults for its five questions (D-110, D-111): one outcome per package plus the pathway; an unevaluable check gives Incompatible (now on all six checks); Needs data does not run; preview/governed rules; missing means no observation or only absent, unknown or not-collected. Say so if any should change.
- Decide how a clinician's enabled parameter values reach the compatibility check (D-112): until then every snake package is at best "Compatible with limitations". Row 3.5 needs the answer.
- Row 3.1 took the defaults for its five questions (D-106): whole-envelope refusal kept, no unit conversion at import, `ambiguous` always 0, optional `expectedChecksum`, all `x-` members ignorable. Say so if any should change. Whether the EMR can supply `expectedChecksum` is an EMR-repo item.
- Decide whether decision nodes and terminology bindings should get a manifest (or another way to name their version) so they can have validation records (D-099).
- Findings F-7 and F-8 (`ccis/fixtures/snake/README.md`): decide whether a later package version adds a node 1 outcome for an unknown result and an estimate warning on needs-data intervals.
- Follow `docs/DEMO-RUNBOOK.md` in the EMR repo on a clean machine with this commit (EMR DM4c asks for this).
- Finding F-6 (`ccis/fixtures/snake/README.md`): a not-collected expected item gives overall `complete`. Approve a 0.1.2 fix as a new row (not blocking DS2b).
- Confirm the omission rule D-050 (conflicting inputs: count, overall status and window are left out).
- Review `docs/DEMO-SLICE.md` and `docs/ROADMAP-COORDINATION.md` (rows DS0 and DS-X are drafts).
- Answer findings F-4 and F-5 (`ccis/fixtures/snake/README.md`): by amending the dossier or by accepting the 0.1.0 tree behaviour. Two deferred fixture cases wait on them.
- Decide whether test-only placeholder parameter values may be shown in the demo (labelled), or the demo should show only "not enabled" states.
- Review and approve gate R0.
- Name a clinician owner for the snake-envenomation parameters.
- Confirm D-002 (local-first, no server/database in 0.1.0).
- Turn on branch protection for `main` and require the CI check once CI exists.
- Review the limitations list at 3.11 before Phase 4.
- Before any real data: safety sign-off, security review, privacy assessment, licence checks.

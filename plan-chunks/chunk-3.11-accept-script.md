# Chunk 3.11: slice acceptance 1: one command runs the whole slice and checks it

_Phase 3, Stage 2. Needs: 3.10a (done). No source change to any `ccis-*.js` module, no schema change. Part of Gate C: "one-command slice reproduces its result"._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-cli-flow.js` lines 36-50 (usage lines); `test/ccis-cli-flow.test.js` lines 68-92 (case a: a working market-mode `run`) and 312-343 (case e: `--params` built from an expected file, and the hand-calculated outputs); `package.json`; `.github/workflows/ci.yml`. Do not read other tests.

## What this row is for

Today the slice is proved by many tests, but there is no single command a stranger can run and read. This row adds `npm run accept`: it drives the **real CLI as child processes** over the committed `market/`, the way a user would, and checks the result against the hand-calculated fixture, not against the code under test. 3.11.1 adds the removal, version-change and negative proofs; do not start them here.

## Build (1 script, 1 test of at most 4 cases, 3 one-line edits)

1. New `scripts/accept.js` (at most 120 lines, no new dependency, no clock read, no network). It uses `spawnSync(process.execPath, ['ccis-cli.js', ...])` and a temp folder removed at the end. Optional `--market <dir>` (default `market`). Steps, one line each, `ok  <name>` or `FAIL <name>: <reason>`:
   - `app-page`: `node scripts/build-app.js --check` exits 0.
   - `import`: `import --json` on `boundary-01-edge-inside.envelope.json` exits 0 and its counts equal the in-process `importEnvelope` plus `importReportView` counts.
   - `compat`: `compat` for `snake.documentation-path` exits 0 and lists every package.
   - `run-oracle`: `run --params` (built from the fixture's expected `parameters`, as case e does) exits 0; the record's analytic outputs equal the fixture's hand-calculated expected outputs, and `status` is `completed`.
   - `rerun`: the same `run` in a second process writes a **byte-identical** record file.
   - `show`: `show` on the record exits 0 and reports it verified.
   Fixed `--at 2026-11-24T12:00:00Z`. The output never prints a temp path, an observation value or the time. Last line: `ACCEPTANCE: PASS (6/6)` or `ACCEPTANCE: FAIL (n/6)`; exit 0 or 1; stop at the first failed step.
2. New `test/ccis-accept.test.js` (at most 4 cases, no jsdom, no Chrome): (1) the script exits 0, lists the six step names once each and ends with the PASS line; (2) two runs in two processes give identical output; (3) against a copy of `market/` with one byte changed in one artefact, it exits 1 with a `FAIL` line and no `PASS` line (so the script can fail); (4) the script's source has no `fetch`, `http`, `eval`, `Function`, `Date.now` or `Math.random`.
3. Three one-line edits: `package.json` gets `"accept": "node scripts/accept.js"`; `ci.yml` gets a step `npm run accept` after `npm test`; `README.md` line 13 area gets one line naming the command.
4. `DECISIONS.md`: one row. Tracker: 3.11 done; next is 3.11.1 (chunk file first).

If a step needs more than 120 lines in total, STOP, keep the first four steps, add the rest as `3.11a1`. If the expected-file outputs cannot be matched to the record without new code in a module, STOP and report: that is a real finding.

**Not in this row:** removal of a required observation, version or input change, marketplace lint, no-undeclared-access proofs (3.11.1); the browser (3.10a already runs in `npm test`); freezing 0.1.0 (3.11a).

**Done when:** `node --test test/ccis-accept.test.js` and `npm run accept` pass; two breakages are each seen failing, then restored: (a) one expected output changed in a copy of the fixture the script reads (`run-oracle` fails); (b) the `rerun` step made to write a time-stamped field (it fails, or the byte comparison does).

**Size guard:** 1 script (at most 120 lines), 1 test (at most 4 cases), 3 one-line edits.

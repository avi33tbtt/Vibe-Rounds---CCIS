# Chunk 3.7-cli: the command line over the market (`ccis-cli-flow.js`)

_Phase 3, Stage 2 (written 2026-11-24). Needs: 3.5 (done), 3.6 (done). This chunk file is docs only; the module is built at the next "do next" after the owner approves it. No schema change and no spec amendment is proposed._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-cli.js` (`main`, `validateMain`, `compileMain`, the `Usage` pattern, exit codes, `canonicalJson` use); `ccis-market.js` (`loadMarket`, `resolve`, `heldFrom`, `pin`, `verifyPin`, `M_REFUSALS`); `ccis-import.js` (`importEnvelope` options and result); `ccis-compat.js` (`resolveCompatibility` result, `OUTCOMES`, `PREVIEW_BANNER`); `ccis-run.js` (`planRun`, `executeRun`, `verifyRecord`, `RUN_REFUSALS`, the runtime object in `test/ccis-run.test.js`); `test/ccis-run.test.js` (how a scenario is wired); `scripts/market-build.js` (how a market folder is read); decisions D-112, D-128, D-133 to D-135, D-137 to D-139; finding F-10.

## What this row is for

Five commands that take a market folder and an export file all the way to a run record on disk, with no browser and no network: **validate** and **compile** (already there), **import**, **compat** (list compatible) and **run** (market mode), and **show**. It proves the whole slice from the terminal and is the contract the browser app (3.8, 3.9) repeats. The demo `run` (the EMR bridge, `--demo-parameters`, fixed example artefacts) keeps its interface and its tests untouched.

## What earlier rows found (the build must handle each)

1. **`run` already exists as the demo.** The EMR bridge and the DS rows call it. Market mode must not change a byte of the demo's behaviour: it is chosen only when `--market` is given.
2. **Nothing is trusted from a folder until `loadMarket` accepts it** (3.6). Every package used is a pin that `verifyPin` accepted; the checksums go to `planRun` from the pins, never recalculated from a file the CLI read itself.
3. **Parameters arrive disabled** (core rules). Market mode has no placeholder values built in. Enabled values come only from a file the clinician-side user supplies (`--params`, the fixture shape `{ id: { value } }`, D-128). The CLI never invents one.
4. **D-112:** enabled values still do not reach the compatibility check, so a package with parameters shows at best "Compatible with limitations". The CLI prints that as it is and does not work around it.
5. **F-10 (D-134):** by default the completeness analytic is skipped when an input is missing. The CLI exposes the existing opt-in as `--run-needs-data` and prints what was skipped and why. It does not decide F-10.
6. **A context is patient data on a device.** `import` may write the context only to a path the user names; it never prints observation values, and refusals print rule ids and paths, never values (3.6 pattern).
7. **Run records are immutable** (demo rule kept): the same bytes again are fine; a different record is never written over a file.
8. **No clock.** `--at` is required and checked, as in the demo.

## The design (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

New module `ccis-cli-flow.js`: `flowMain(argv, io)` returns the exit code. It is the only new file that reads or writes disk (a small `readMarketDir` like the build script's; a `readJson` with the same `Usage` errors). `ccis-cli.js` gains one dispatch line for `import`, `compat`, `show`, and for `run` when `--market` is present. All logic is calls to the committed pure modules.

- `import --envelope <file> --market <dir> [--out <file>] [--json]`: load market, hold the artefacts the pathways need (all held entries), `importEnvelope`; print the import report (accepted counts, rejected items by code, nothing silently lost). Exit 0 accepted, 1 refused, 2 usage.
- `compat --envelope <file> --market <dir> --pathway <id> [--range <range>] [--json]`: resolve the pathway, import, `resolveCompatibility`; print one line per package: outcome, the first reasons by id, the preview banner. Exit 0 whatever the outcomes (they are results), 1 when the import or resolution is refused, 2 usage.
- `run --market <dir> --pathway <id> --envelope <file> --out <file> --at <time> [--params <file>] [--run-needs-data] [--range <range>]`: resolve, pin and `verifyPin` the pathway and every analytics package it lists, import, `planRun`, `executeRun`, write the canonical record. Prints the record id, status, what ran and what was skipped. Exit 0 a record was written (a `failed` record counts), 1 refused with a `M-`, `R-` or import id and no file, 2 usage.
- `show <record> [--json]`: `verifyRecord`, then print id, status, packages with checksums, each result with its state and value, the decision route, skipped items, the test-only note when present, and the limitation line. A record that fails verification is shown as such and exits 1. Never prints the snapshot.
- Output is plain text by default (REQ-089 style), `--json` prints the same data; sorted, no timestamps.

## Build

1. New `ccis-cli-flow.js` (about 300 lines) and a dispatch edit in `ccis-cli.js` (about 6 lines).
2. New `test/ccis-cli-flow.test.js`:
   - (a) **Oracle:** market mode over all 33 envelopes gives records byte-identical to calling `planRun` and `executeRun` directly on the example files, and the same route as the 3.4b oracle.
   - (b) **The demo is untouched:** the existing demo `run` output for the EMR export is byte-identical before and after; `run` without `--market` takes the old path.
   - (c) **Commands:** `import` report for a clean, a rejected (entered-in-error) and a refused envelope; `compat` lists the three outcome kinds; `show` round-trips a record and flags one altered byte.
   - (d) **Refusals:** each of these gives its exit code and no file: unreadable or altered market (`M-010`), unknown pathway (`M-007`), bad `--at`, missing flag, existing different record, params naming an undeclared id. Output never contains an observation value (sentinel) or a parameter value that was not supplied.
   - (e) **Parameters:** without `--params` every parameter is disabled; with the fixture values the results match the 3.5 oracle; no built-in placeholder appears in market mode.
   - (f) **Purity and scope:** the module has no network, clock, randomness or `eval`; only `ccis-cli-flow.js` and `ccis-cli.js` import `node:fs`.
3. `README.md` (one paragraph, a four-line example using `market/`), `DECISIONS.md` (at most three rows), tracker (3.7 as built; 3.8 next, chunk file first).

**Not in this row:** any change to the demo run, the schemas or the spec; a `publish` command (the market is built by `scripts/market-build.js`); signing; network; a browser view; storing parameters or records anywhere but the path given; deciding F-10 or D-112.

## Questions for the owner (defaults apply if you only say "approve")

1. Market mode is chosen by `--market` on the existing `run`, and the demo `run` stays exactly as it is? Default: yes.
2. Parameters come only from `--params <file>` (no built-in placeholders in market mode), and results needing one say `parameter-not-enabled` without it? Default: yes.
3. `--run-needs-data` is the CLI's only answer to F-10 for now (default off, skipped items listed)? Default: yes.
4. `import --out` may write the context to a named path (patient data stays on the device, never printed)? Default: yes.
5. `show` verifies the record and prints results, route and provenance but never the input snapshot? Default: yes.

**Done when:** all four new commands work on the committed `market/` and the 33 envelopes, the demo run is byte-identical, every refusal path gives its exit code and writes nothing, and three deliberate breakages (market mode ignores `verifyPin`; `--params` values enabled when the flag is absent; `show` prints the snapshot) are each seen failing a test. The owner runs or skips the full `npm test` as instructed in that session.

**Size guard:** one new module, one dispatch edit, one new test file, README, DECISIONS, tracker. If the module passes about 400 lines, split `show` into row `3.7a`.

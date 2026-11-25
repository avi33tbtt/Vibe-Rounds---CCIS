# Chunk 3.11.1: slice acceptance 2: removal, distinct records, negative proofs

_Phase 3, Stage 2. Needs: 3.11 (done). Tests only: no change to any `ccis-*.js` module, no schema change. Part of Gate C: "negative tests pass"._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `scripts/accept.js` lines 1-33 (setup and the `node` helper to copy); `ccis-market.js` lines 58-122 (lint rules) and 144-150 (publish refusal); `ccis/fixtures/snake/missing/missing-01-no-bite-time.expected.json`; the observation `o1` of `normal/normal-01-all-enabled.envelope.json` (use `node -e`, not a full read); `ls market/artefacts/*`. Do not read other tests.

## What this row is for

3.11 proved the happy path. This row proves the slice **fails safely and changes visibly**: a missing required observation becomes needs data (never zero or false), a changed input or package version gives a different run record, the market lint can say no, and the core modules still hold their purity promises.

## Build (1 test file, at most 8 cases, 0 modules, 0 edits)

New `test/ccis-accept-negative.test.js`. No jsdom, no Chrome, no dependency. Each case drives the real CLI with `spawnSync` over a temp copy (removed after), fixed `--at 2026-11-24T12:00:00Z`, params built from the `normal-01` expected `parameters`.

1. **Removal.** Copy the `normal-01` envelope, delete observation `o1` (bite time), run. Both outputs (`interval`, `comparison`) are state `needs-data`, carry no `value`, and the bite-time missing note is present. The record `show`s as verified.
2. **Removal matches the oracle.** The output states of case 1 equal the `results[].state` in `missing-01` expected (hand-calculated, not derived by the code).
3. **Input change.** Move `o1`'s effective time by one minute (stay valid). The run id and `x-checksums.envelope` differ from the unchanged run, and `interval.value.amount` equals the hand-calculated new amount (write the arithmetic in a comment).
4. **Version change.** Copy `market/`, drop the two `0.1.1` analytics entries (index rows and files). The run still completes, the record names `0.1.0` for both, and its id differs from the run on the full market.
5. **Lint accepts.** `lintArtefact` returns `ok` for every committed artefact file under `market/artefacts/`.
6. **Lint refuses.** A copy of one artefact with a planted identity-like member fails `lintArtefact` with an `L-` id, and `publishArtefact` refuses it with `M-004`; the refusal text does not contain the planted value.
7. **Purity scan.** Over every root `ccis-*.js` file: no `fetch`, `XMLHttpRequest`, `WebSocket`, `eval`, `new Function`, `Date.now`, `new Date()` (no argument), `Math.random`, `node:http(s)`, `node:net`, `node:child_process`. Files that import `node:fs` must equal an allowlist written in the test (expected: the CLI and loader files only; find them with grep, do not guess). A new importer fails the test.
8. **The scan can fail.** The scan function, fed a one-line string containing `Date.now()`, reports a finding (so case 7 is not vacuous).

If cases 1-4 need a helper longer than 40 lines, STOP and split cases 5-8 into `3.11.1a`. If case 4 cannot resolve to `0.1.0` without a code change, STOP and report: that is a real finding (F-13). Do not weaken a case to pass.

**Not in this row:** freezing 0.1.0, the limitations list (3.11a); a patient-data proof beyond the lint (import exclusion is already tested); browser checks.

**Done when:** `node --test test/ccis-accept-negative.test.js` passes (run only this file). Three breakages are each seen failing, then restored: (a) keep `o1` in case 1 (it fails); (b) do not drop the `0.1.1` entries in case 4 (it fails); (c) add `Date.now()` to a temp copy of one core module read by the scan (case 7 fails).

**Size guard:** 1 test (at most 8 cases), 0 modules. Tracker: 3.11.1 done; next is 3.11a (chunk file first, docs only).

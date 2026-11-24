# Chunk 3.5-run: the run planner and run records (`ccis-run.js`)

_Phase 3, Stage 2 (written 2026-11-24). Needs: 3.4b (done). This chunk file is docs only; the module is built at the next "do next" after the owner approves it. No schema change and no spec amendment is proposed._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-bind.js` (`runAnalytic`, `bindParameters`, `readSupplied`: how `supplied` is shaped); `ccis-walk.js` (`walkPathway`: route, results, trace); `ccis-exec.js` (`prepareAnalytic`, `ENGINE`, `OPERATOR_SET`); `ccis-compat.js` (`resolveCompatibility`, `executionPolicy`, `PREVIEW_BANNER`); `ccis-import.js` (the context, `contextChecksum`, `envelopeChecksum`, `STANDARD_VERSION`); `ccis-compile.js` (`canonicalize`, `checksumOf`); `ccis-demo-record.js` and the DS3/DS4 parts of `ccis-cli.js` (prior art: replaced, not copied); `ccis/schemas/run-record.schema.json` and `run-result.schema.json`; `ccis/SPEC.md` CCIS-REQ-075 to 078; decisions D-009, D-044, D-050, D-056 to D-058, D-061, D-112, D-128, D-131.

## What this row is for

Turn one request (a pathway, the analytics chosen with it, one context, parameter values, an evaluation time) into **one immutable run record** that holds everything needed to repeat the run and get the same bytes (REQ-075 to 077). It plans which items may run (using 3.2), runs them (3.4a, 3.4b), checks every result, and writes the record. It does not store records anywhere, read files, parse the command line, or draw anything (3.7 to 3.9). It does not change compatibility rules (3.2) or any analytic, node or schema.

## What earlier rows found (the build must handle each)

1. **The record's `package` is the pathway** and the analytics go in `x-analytics` (D-056). Several analytics on one context are one record, results in a fixed order: node results in route order, then analytic results by analytic id, then output order.
2. **Two snake analytics share parameter ids** (`edgeRule`, `populationScope`). The schema lists each parameter id once, and a shared id must mean the same thing in both. The build compares the declarations; equal declarations take one supplied value; unequal ones refuse the whole request. `populationScope` is a `criteria` parameter the record cannot hold (D-058): it stays disabled and is listed so.
3. **D-112 is still open:** compat has no input for a clinician's enabled values, so every snake package is at best "Compatible with limitations", which `executionPolicy` already lets run. This row does not change compat. Enabled values go to the binder only (D-128: the planner filters `supplied` per analytic and refuses ids no analytic in the batch declares).
4. **"Needs data" does not run** (D-110) and "Incompatible" does not run. The planner never runs an item compat did not allow, and says so in the record.
5. **A refused import or a binder/walker refusal is a `failed` record, not an exception** (REQ-075 needs a record for every run; D-044 keeps the message free of input). A failed record has no results, never partial ones.
6. **Time and ids are inputs.** The module reads no clock and makes no randomness. The record id is the address of the run's inputs (D-009), not a random id.
7. **The run-record schema has no checksum member** (G-05 was closed for packages by A-005, not for records). The id carries the address; any other digest goes in an `x-` member. No schema change.
8. **The snapshot holds case, observations and events only.** A rerun must rebuild a 3.1-shaped context from the snapshot, the record's applied references and the held artefacts. If the walker or binder reads a context member the snapshot lacks, the build says so and splits the rerun (see size guard).
9. **Findings F-6, F-7, F-8 stay open.** Nothing here fixes them.

## The design (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

`ccis-run.js` is a pure module (no clock, file, network, randomness, eval, dynamic import). It imports only the committed modules named above and the validators.

- `planRun({ pathway, analytics, held, context, runtime, request })` returns `{ ok: true, plan }` or `{ ok: false, refusal }`. `analytics` is a list of `{ analytic, checksum }` (the checksum comes from 2.4 and is pinned, D-116). The plan lists the pathway walk and each analytic with `run` or `skip` and the compat outcome and reason codes. Order is fixed (pathway, then analytics by id).
- `executeRun({ plan, context, importReport, contextChecksum, supplied, evaluationTime, corrects? })` returns `{ ok: true, record }`. The record validates against `run-record.schema.json` (a defect throws). It holds: package (the pathway), standard, engine and operator-set versions, the applied context versions, the snapshot, every declared parameter once with `enabled`, the evaluation time, the output contract version (a constant owned by this module), the import report, results, warnings (the preview banner text from compat; test-only parameter note as D-057), limitations, and `x-analytics`, `x-plan` (which items ran or were skipped and why), `x-trace` (the walker's trace, states and counts only), `x-checksums` (envelope and context checksums). The record is deep-frozen.
- `runId(...)`: `run-` plus the SHA-256 of the canonical JSON of the run's inputs (package refs and checksums, standard, engine, output contract, snapshot, parameters, evaluation time, `corrects` if any). Same inputs give the same id, so a re-run is recognised and a changed version, input, parameter or time gives a distinct id.
- `verifyRecord(record)` recomputes the id from the record's own members and reports a mismatch; it detects an altered record, it does not prevent one (storage is 3.7).
- `rerunFromRecord({ record, pathway, analytics })` rebuilds the context from the record, runs again, and returns the new record. `compareRerun(a, b)` returns ok or the first differing JSON path. A correct rerun is **byte-identical** in canonical JSON, including the id.
- A correction is a new record whose `corrects` names the earlier id; the earlier record is never touched (REQ-076).
- Refusal ids `R-001` and up, fixed sentences that never quote the input: request not shaped as expected; analytic checksum missing or not matching; shared parameter id declared differently; a supplied id nobody declares; nothing in the request may run; pathway or context refused by the walker (this becomes a failed record, not a refusal, once a context exists); a held artefact missing on rerun; record fails verification.
- The source context, pathway and analytics are never mutated (tests deep-freeze them).

## Build

1. New file `ccis-run.js` (about 300 to 350 lines).
2. New `test/ccis-run.test.js`:
   - (a) **The oracle: 32 cases plus the EMR export.** Each envelope goes through `importEnvelope`, `planRun`, `executeRun` with both analytics on 0.1.1; the results must equal what `runAnalytic` and `walkPathway` give on their own; the route must equal `pathwayRoute`; every record validates against the schema.
   - (b) **Addressing:** a hand-calculated `sha256` of one small canonical string (checked outside the module); same inputs give the same id and the same bytes; a changed package version, one changed observation, a changed parameter, a changed evaluation time and a `corrects` link each give a distinct id.
   - (c) **Planning:** a "Needs data" analytic is skipped and listed in `x-plan`, the rest run; nothing runnable is refused; a shared parameter declared differently is refused; an undeclared supplied id is refused; output order is fixed whatever order the request lists the analytics.
   - (d) **Failed runs:** a refused import and a walker refusal give `failed` records with no results and a message with no input in it.
   - (e) **Rerun and immutability:** `rerunFromRecord` is byte-identical for all 33 cases; `verifyRecord` catches one altered member; the record is frozen; the context, pathway and analytics are not mutated.
   - (f) **Purity:** the pure-library scan covers the new file; two runs give identical bytes.
3. `README.md` (one paragraph: the run record and the rerun), `DECISIONS.md` (at most three rows), tracker (3.5 as built; 3.6 next).

**Not in this row:** storing or listing records, the marketplace and pin checks (3.6), CLI and browser (3.7 to 3.9), changing compat or D-112, fixing F-6 to F-8, cohort or batch runs over many patients (Phase 5), signing, and any schema or spec change.

## Questions for the owner (defaults apply if you only say "approve")

1. One record per request, with the pathway as `package` and the analytics in `x-analytics` (D-056 kept)? Default: yes.
2. Is the record id the SHA-256 address of the run's inputs, including `corrects`, so a correction never collides with the original? Default: yes.
3. A parameter id shared by two analytics in a batch takes one supplied value and must be declared identically, otherwise the request is refused? Default: yes.
4. An analytic that compat says may not run is skipped and listed in `x-plan` while the others run; if nothing may run there is no record, only a refusal? Default: yes.
5. D-112: leave compat unchanged for now, and give enabled parameter values to the binder only? Default: yes (the snake packages stay "Compatible with limitations").

**Done when:** all 33 cases give valid records whose results and routes match the existing oracles, the addressing, planning, failed-run and rerun tests pass, every `R-` id is reached once, and three deliberate breakages (hash the record without the evaluation time; run a skipped "Needs data" analytic; let a rerun use the current clock) are each seen failing a test. The owner runs or skips the full `npm test` as instructed in that session.

**Size guard:** one new module, one new test file, README, DECISIONS, tracker. If the module passes about 400 lines, split `verifyRecord`, `rerunFromRecord` and `compareRerun` into row `3.5a`.

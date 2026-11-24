# Chunk 3.4a-bind: the binder and result mapper (`ccis-bind.js`)

_Phase 3, Stage 2 (written 2026-11-24). Needs: 3.4 (done). This chunk file is docs only; the module is built at the next "do next" after the owner approves it. No schema change and no spec amendment is proposed._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-exec.js` (`prepareAnalytic`, `evaluateOutput`, the value model, `bindInputs`, `bindParameters`); `ccis-import.js` (the context it returns); `ccis-demo-exec.js` (prior art for input reading and the wording tables: replaced, not copied); `ccis/schemas/run-result.schema.json`, `analytics.schema.json` (`inputs`, `parameters`, `outputs`); `ccis/SPEC.md` CCIS-REQ-066, 069, 070, 075; `ccis/fixtures/snake/index.json` plus the expected files; the four snake analytics in `ccis/examples/snake/`; decisions D-042, D-047, D-048, D-050 to D-052, D-054, D-112, D-124.

## What this row is for

Connect the three finished pieces: a 3.1 **context** goes in, a 3.3/3.4 **prepared analytic** evaluates it, and **run results** come out that match the package's output contract. This is the first row where a whole analytic runs on a whole patient context. It does not walk decision nodes (3.4b), plan batches or write run records (3.5), or touch the CLI or the browser.

## What earlier rows found (the build must handle each)

1. **Record order must not matter.** 3.1 sorts observations and events by id, so the binder finds a field's records by concept, never by position.
2. **More than one record for a field is `conflicting`, even if the records agree** (D-048). Entered-in-error records are already out of the context (3.1); the binder never sees them.
3. **A time with no stated zone, or an impossible date, is unknown** (never a guess), and arrives at the interpreter as an unreadable input. Valid times become integer UTC milliseconds here and nowhere else.
4. **The package format has no place for warning and missing-data wording** (D-047, D-124). The binder owns fixed wording tables, chosen by what the evaluation actually did (for example "certainty compared and found estimated"). The tables are labelled, versioned, and never carry a clinical value.
5. **Parameters arrive disabled** (core rules). A disabled parameter gives state `parameter-not-enabled` with `dependsOnParameters`. How a clinician's enabled values reach a run is open (D-112); this row takes them as a plain argument and invents no storage.
6. **The omission rule (D-050)** for the completeness analytic with a `conflicting` input is kept: outputs the dossier and trees do not define are left out of `results` and listed in `omitted`; never filled.
7. **F-6 (D-052) is not patched:** an expected item recorded `not-collected` still falls through to `complete` under 0.1.0 and 0.1.1. The oracle keeps the `todo` for that case.

## The design (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

`ccis-bind.js` is a pure module (no clock, file, network, randomness, eval, dynamic import). It imports only `./ccis-exec.js`, `./ccis-compile.js` and the committed validators.

- `bindContext({ prepared, context })` returns `{ inputs, readings }`. `inputs` is the map the interpreter takes (states, values with units, instants). `readings` records per input what was found (none, one, several, unreadable time) for the wording and the missing-data notes. An input the context does not mention is `absent`, not unknown.
- `bindParameters({ prepared, supplied })` returns the parameter map: each declared parameter is disabled unless `supplied` enables it with a value that fits its declared kind. A malformed value is refused (never read as disabled, D-048). Supplied ids the package does not declare are refused.
- `runAnalytic({ prepared, context, supplied, evaluationTime })` evaluates every output once and returns `{ ok: true, results, omitted }` or `{ ok: false, refusal }`. `evaluationTime` is an input (core rule: no clock). Each result is mapped to the output contract: `value` (number with unit), `classification` (label), or `table` (rows); an unknown result becomes `indeterminate` if the output declares it, else the whole analytic is refused (REQ-070). Every result is checked against `run-result.schema.json`; a defect throws.
- Refusals use fixed sentences and never echo context content (IMP-091, D-044).
- Same input, versions and parameters give byte-identical results (canonical JSON).

## Build

1. New file `ccis-bind.js` (about 300 to 350 lines).
2. New `test/ccis-bind.test.js`:
   - (a) **The oracle: all 32 fixture cases.** Each envelope goes through `importEnvelope` then `runAnalytic` for both analytics on 0.1.1 (and the 0.1.0 expectations where the expected file names 0.1.0); the results must equal the expected files, including `notSpecified` and `noValueOutputs`. The EMR export case is one of the 32. The F-6 case stays `todo`; F-4 and F-5 stay `deferred`.
   - (b) **Hand-written unit tests:** one record, none (absent), two agreeing (conflicting), shuffled record order (same bytes), a zoneless time (unknown, never zero), parameter disabled, parameter enabled, malformed parameter, undeclared supplied id.
   - (c) **Output contract:** an undeclared state, a missing output, an unknown result with no `indeterminate` declared (refusal, no partial results).
   - (d) **Purity and determinism:** the pure-library scan covers the new file; two runs give identical bytes; the context is not mutated.
3. `README.md` (one paragraph under "Executor": the binder), `DECISIONS.md` (at most three rows), tracker (3.4a as built; 3.4b next).

**Not in this row:** decision-node walking (3.4b); planning several analytics, run records, content addresses (3.5); how a clinician's enabled values are stored (D-112); the F-6 fix; first, last, min, max, coalesce; any schema or spec change; the CLI.

## Questions for the owner (defaults apply if you only say "approve")

1. The wording tables live in `ccis-bind.js` as labelled, versioned data, and are the only place warning and missing-data text comes from? Default: yes.
2. Enabled parameter values enter as a plain `supplied` argument in this row, with storage deferred to 3.5 (D-112)? Default: yes.
3. Keep the D-050 omission rule and the F-6 `todo` exactly as in the demo? Default: yes.
4. Is the 32-case fixture set, with the 0.1.1 expectations, the full oracle (no new cases added here)? Default: yes.
5. Should an unreadable time stay a quiet `unknown` with a missing-data note, as in the demo? Default: yes.

**Done when:** all 32 fixture cases reproduce their expected files (F-6 `todo` and F-4/F-5 `deferred` as before), the unit tests pass, and three deliberate breakages (read records by position instead of concept; let a zoneless time become a number; map an unknown result to `false`) are each seen failing a test. The owner runs or skips `npm test` as instructed in that session.

**Size guard:** one new module, one new test file, README, DECISIONS, tracker. If more is needed, split the parameter binder into row `3.4a2`.

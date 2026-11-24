# Chunk 3.4b-walk: the decision-node walker (`ccis-walk.js`)

_Phase 3, Stage 2 (written 2026-11-24). Needs: 3.4a (done). This chunk file is docs only; the module is built at the next "do next" after the owner approves it. No schema change and no spec amendment is proposed._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-demo-pathway.js` (prior art: replaced, not copied); `test/ccis-demo-pathway.test.js`; `ccis/schemas/pathway.schema.json` and `decision-node.schema.json`; `ccis/schemas/run-result.schema.json`; `ccis-import.js` (the context shape); `ccis/SPEC.md` CCIS-REQ-073 and 075; the pathway and two node files in `ccis/examples/snake/`; `ccis/fixtures/snake/index.json` and the `pathwayRoute` member of the expected files; decisions D-018, D-048, D-053 to D-055, D-069.

## What this row is for

Walk a pathway over a 3.1 **context**: at each stage that names a decision node, pick the one outcome that matches the recorded states, follow it, and say **why** (the rule trace, which the demo walker lacks). It reads the record only (D-018): "present" means a record exists and says nothing about the value. It does not run analytics (3.4a), plan batches or write run records (3.5), or touch the CLI or the browser.

## What earlier rows found (the build must handle each)

1. **Record order must not matter.** 3.1 sorts observations by id, so the walker finds a field's records by concept, never by position.
2. **More than one record for a field is `conflicting`, even if they agree** (D-048). No record is `absent`. A record with an explicit state gives that state; otherwise `present`. Entered-in-error records are ignored (3.1 already removed them; ignored again here).
3. **No outcome matches (D-053):** result `indeterminate`, `x-outcome` null, the route stops at the report stage and the next node is not evaluated. **Two outcomes match:** the whole pathway is refused. Never a continuation as if documented.
4. **Node results are classification run results (D-054):** camelCase output id from the node id, extensions `x-node`, `x-outcome`, `x-pathway`. `answer` gives a label, or `not-applicable` when the record explicitly says the step did not happen (out of scope, not missing); `missing-data` gives `needs-data` with the outcome note; `conflicting` gives `conflict`; `indeterminate` gives `indeterminate`. The wording comes from a table in the module (the schema has no node kind).
5. **The pathway embeds its nodes** (D-055); a test keeps them equal to the node files. The walker reads the embedded nodes.
6. **Findings F-7 and F-8 (D-069) are not fixed here.** They need a new package version.
7. **The node schema requires an `indeterminate` outcome, but a record state no outcome covers still happens** (a state the author did not list). The walker handles it as item 3, so the schema's rule is no guarantee of coverage.

## The design (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

`ccis-walk.js` is a pure module (no clock, file, network, randomness, eval, dynamic import). It imports only the committed validators.

- `walkPathway({ pathway, context })` returns `{ ok: true, route, results, trace }` or `{ ok: false, refusal }` (no route, no results, no trace on refusal).
- `route` has the demo's shape (`{ stage }`, `{ stage, node, outcome }`, `{ end: true }`), so the 32 expected `pathwayRoute` members are the oracle.
- `results` are the node run results of item 4, checked against `run-result.schema.json` (a defect throws).
- **`trace` is new.** One entry per node visited: the node id; per node input the key, the state found and the number of records (never a value; record ids are listed because REQ-073 needs traceability); every outcome considered, in package order, with each test (`input`, wanted state, found state, passed or not) and whether it matched; and the outcome taken or null. It is deterministic and canonical-JSON safe, and it carries no clinical value. The run-result schema is not changed: the trace is a separate member that row 3.5 puts in the run record.
- Refusal ids `W-001` and up, fixed sentences that never quote the input: pathway not conforming to its schema; context not `ccis-context/1`; two nodes or stages sharing an id; a transition, outcome or node input naming something the pathway does not declare; a stage mixing plain and node transitions or using two nodes; stages that loop; two outcomes matching; an outcome leading to a stage no transition allows.
- Same input gives byte-identical output.

## Build

1. New file `ccis-walk.js` (about 200 to 250 lines).
2. New `test/ccis-walk.test.js`:
   - (a) **The oracle: 32 cases plus the EMR export.** Each envelope goes through `importEnvelope` then `walkPathway`; the route must equal `pathwayRoute`; the results must equal the results of the demo walker on the same accepted records (the demo module still exists); every result validates.
   - (b) **Hand-written unit tests:** each epistemic state of a node input takes its own outcome; no match gives indeterminate with outcome null and the route stopping at the report stage; two matching outcomes refuse; a conflict is seen through two agreeing records; shuffled record order gives the same bytes; an explicit out-of-scope state gives `not-applicable`, not a value.
   - (c) **The trace:** hand-written expected trace for one normal, one missing and one conflicting case; trace holds states and counts only (a sentinel value in a record never appears); every outcome considered is listed in package order.
   - (d) **Refusals:** each `W-` id reached once; a refusal carries no route, results or trace.
   - (e) **Purity and determinism:** the pure-library scan covers the new file (imports only the validators); two runs give identical bytes; the context and pathway are not mutated; the nodes embedded in the pathway equal the node files.
3. `README.md` (one paragraph: the walker and its trace), `DECISIONS.md` (at most three rows), tracker (3.4b as built; 3.5 next).

**Not in this row:** planning several analytics or pathways, run records, content addresses (3.5); compatibility of a pathway with a context (3.2); fixing F-7, F-8 or F-6; decision graphs beyond the stage and node model (5.3); the CLI; any schema or spec change.

## Questions for the owner (defaults apply if you only say "approve")

1. Add the rule trace as a separate returned member, with the run-result schema unchanged? Default: yes.
2. Keep D-053 exactly: no match stops the route at the report stage (indeterminate), two matches refuse the whole pathway? Default: yes.
3. List record ids (not values) in the trace for REQ-073 traceability? Default: yes.
4. Is "the same results as the demo walker, plus the 33 routes" the full oracle (no new cases added here)? Default: yes.
5. Keep the node wording table inside `ccis-walk.js` (as D-054 did for the demo)? Default: yes.

**Done when:** all 33 routes and all node results reproduce, the unit and trace tests pass, every `W-` id is reached once, and three deliberate breakages (read a field's record by position; treat no match as the first outcome; let two matching outcomes pick the first) are each seen failing a test. The owner runs or skips the full `npm test` as instructed in that session.

**Size guard:** one new module, one new test file, README, DECISIONS, tracker. If more is needed, split the trace into row `3.4b2`.

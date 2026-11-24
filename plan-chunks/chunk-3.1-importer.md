# Chunk 3.1-importer: Importer (envelope to canonical context and import report)

_Phase 3, Stage 2 (written 2026-11-24, after "start stage 2"). Needs: 2.4 (done). This chunk file is docs only; the importer is built at the next "do next" after the owner approves it. No schema change, no spec amendment is proposed._

**Core rules:** attach `01-core.md` too.

**Read only:** `docs/IMPORT-CONTRACT.md` (IMP-001 to IMP-117); `ccis/schemas/context-envelope.schema.json` and `import-report.schema.json` (committed validators in `ccis/validators/ccis-validators.js`: `contextEnvelope`, `importReport`); `ccis-demo-loader.js` (the demo importer, DS1: its checks and report building are the behaviour to keep); `ccis-compile.js` (`canonicalize`, `checksumOf`); `ccis/examples/snake/snake-envenomation.element.json` (field members `type`, `units`, `epistemic`, `sourceClasses`, `cardinality`); `ccis/fixtures/snake/index.json` and the 32 case folders plus `emr-export/` (the regression oracle); `ccis/SPEC.md` REQ-032 to 044, 082 to 084.

## What this row is for

The trust boundary (IMP-001): turn one EMR export file into (a) a **canonical context**, holding only what was accepted, in a fixed order, with a checksum, and (b) an **import report** in which every record is in exactly one of four categories (IMP-100, 105). Pure functions: no file access, no network, no clock, no randomness. Same input, held artefacts and options give byte-identical output. It **replaces the demo loader's role** but does not touch `ccis-demo-loader.js` (the demo and its tests keep working until the switch in 3.7 and 3.11).

## What earlier rows found (the build must handle each)

1. **Unit conversion is not the importer's job.** Conversions are declared in analytics packages (`conversions`, used by the `convert` operator, REQ-043). The brief's "unit normalisation only through declared conversions" is therefore met by **doing none at import**: a quantity whose unit is not in the field's permitted `units` is **rejected** (`unit-not-allowed`, IMP-102), never converted or assumed (IMP-108). Conversion stays in the executor (3.4).
2. **Closed objects refuse the whole envelope.** The schema has no member for identity or narrative, so such content makes the file fail as an unrecognised critical field. IMP-091 says "reject those records with a reason", but a closed schema cannot tell which record carried it. The demo already refuses the whole envelope; 3.1 keeps that (fail closed). The refusal reason names no path and no member name (a member name could itself be content).
3. **Conflicting observations are the executor's concern.** The demo fixtures class `conflicting` is handled by the omission rule D-050 at execution. The importer therefore **does not** turn conflicts into `ambiguous`; it keeps every non-rejected observation. A later amendment may change that. So in 3.1 the `ambiguous` count is always 0 for the snake package (the report schema still allows it), and this is stated in the README, not hidden.
4. **IMP-014 (corruption check) was open until G-05; A-005 closed it.** No schema field is added. The importer accepts an optional `expectedChecksum` (a `sha256:` value supplied beside the file) and refuses on mismatch. It also returns the checksum of the envelope's canonical bytes. Whether the EMR offers that value is an EMR-repo item (noted in `docs/ROADMAP-COORDINATION.md` by the owner if wanted).
5. **Array order is significant in the canonical form** (2.4). The context therefore sorts observations and events by `id` (code-unit order), so two envelopes that differ only in record order give the same context bytes. The executor must not rely on array order (finding for 3.4; the demo executor may, so the oracle compares categories and ids, not execution).
6. **A lone observation can reach a concept the binding does not verify.** The snake binding is one thin demo mapping. 3.1 keeps the demo rule (concept id must be a field of an applied element, else `unmapped`) and does not invent a code-verification rule.

## Decisions this chunk proposes (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

- **Input and output.** `importEnvelope(envelope, options)`; `options` = `{ held, supportedEnvelopeMajors = [0], expectedChecksum }`, where `held` is a list of artefact documents the app holds (read by manifest `id`, `type`, `version`; the importer does not re-validate them, the pipeline does). Result: `{ ok, outcome, context, contextChecksum, envelopeChecksum, report }`; on refusal `context` is null, no checksums beyond the envelope's if computable, and the report has no records (IMP-113, 114).
- **The canonical context** (`ccis-context/1`): `{ contextForm, envelope: { version, exportedAt, producer }, case, applied, inclusions, observations, events }` where observations and events are the **accepted** ones, **unchanged** (no coercion, IMP-108), sorted by `id`. Rejected, unmapped and ambiguous records are not in it; the report keeps their `ref`, kind and reasons only, never their content (IMP-091, 103). `contextChecksum` is `checksumOf` of its canonical bytes (2.4); the same for `envelopeChecksum` over the input.
- **Order of checks for each observation (the first that applies decides; each record lands in exactly one category):** (1) status `entered-in-error` -> rejected, `excluded-by-policy`, category `entered-in-error`; (2) concept not a field of an applied element -> unmapped, `concept-not-in-applied-element`; (3) source class not in the field's `sourceClasses` -> rejected, `source-class-not-allowed`; (4) `state` not in the field's `epistemic` list -> rejected, `state-not-allowed`; (5) `kind` differs from the field `type` -> rejected, `kind-mismatch`; (6) quantity unit not in the field's `units` -> rejected, `unit-not-allowed`; (7) `correctionOf` names an id not in the envelope -> rejected, `correction-target-missing`; otherwise accepted, with notes `recorded-time-unknown` and `time-zone-unknown` where those states apply (IMP-044, 046; no time is ever rejected or filled in: unknown stays unknown). Events: entered-in-error rejected, otherwise accepted. If a fixture trips checks 3 to 7 in a way the demo accepted, the row **records a finding and turns that check into an accepted-with-note**; it does not change the fixture.
- **Whole-envelope refusals** (report `outcome: refused`, no records, reason in words): not an object; envelope major not supported (checked before the schema, IMP-114, 115); fails the schema or carries an unrecognised critical field (IMP-113); a held artefact missing for an applied reference (the report lists every applied version with `held` true or false, IMP-107); a held element without readable `fields`; a record id used twice (IMP-105 cannot hold); `expectedChecksum` given and not equal (IMP-014). Optional `x-` members are never used and are listed in `report.ignored` by JSON pointer at any depth (IMP-112); an unknown **mandatory** extension cannot be told from an optional one because no schema member marks it, so all `x-` members are ignorable (a finding, IMP-116).
- **Constants.** Importer version `0.1.0` and standard version `0.1.0`, equal (a test) to the validator and record constants. Counts are checked to add up (IMP-105); a mismatch is a defect and throws.

## Build

1. `ccis-import.js` (pure; imports only the committed validators bundle and `./ccis-compile.js`). Exports `importEnvelope`, `IMPORTER_VERSION`, `CONTEXT_FORM`, `REJECTION_CODES` (the reason codes above, as a catalogue with a one-line meaning each).
2. `test/ccis-import.test.js`, with these checks:
   - (a) **Oracle.** For all 32 fixture envelopes and the `emr-export` envelope: `importEnvelope` gives the same outcome, the same counts per category and the same set of accepted ids as `loadDemo`; every report passes `importReport`; counts add up.
   - (b) Each refusal reached once with its reason, and no records, no context.
   - (c) Each rejection code reached once by mutating a good envelope (the unit case uses a synthetic element with a quantity field, as the 2.2b tests do); one record in exactly one category.
   - (d) **States never merged.** For each of the five states and for `entered-in-error`, the record keeps its state in the context (or is rejected for the policy), never a value, zero or empty text; an absent value stays absent.
   - (e) **No coercion and no leak.** Accepted records equal the input records field for field; the report holds no observation value, unit or code text (a sentinel value in the input never appears in the report); no input mutation (frozen).
   - (f) **Determinism.** Same bytes on two runs; shuffled record order gives the same `contextChecksum`; the checksums equal `checksumOf(canonicalize(...).text)`; `expectedChecksum` accepted when right and refused when wrong.
   - (g) Constants equal; the pure-library scan (imports: the validators bundle and `./ccis-compile.js` only).
3. `README.md` (a short "Import" paragraph: what is accepted, the four categories, `ambiguous` is always 0 for the snake package, no unit conversion at import, whole-envelope refusal), `DECISIONS.md`, tracker.

**Not in this row:** the CLI `import` command (row 3.7); compatibility checks (3.2); executing anything (3.3 to 3.5); a user decision flow for ambiguous records (3.8); any schema or spec change; reading files.

## Questions for the owner (defaults apply if you only say "approve")

1. Keep refusing the whole envelope when identity or narrative arrives (instead of per-record rejection)? Default: keep.
2. No unit conversion at import; conversion only through an analytics package's declared `convert`? Default: accept.
3. `ambiguous` is not produced yet (count 0), because conflicts stay with the executor? Default: accept.
4. Optional `expectedChecksum` as the corruption check (IMP-014), with the EMR side left to its own repo? Default: accept.
5. All `x-` members are ignorable until a schema member can mark one mandatory? Default: accept.

**Done when:** the oracle passes on all 33 envelopes, every refusal and rejection code is reached once, the states and no-leak checks pass, and three deliberate breakages (let an entered-in-error record through; convert or default a missing unit; let a record fall in no category) are each seen failing a test. The owner runs or skips `npm test` as instructed in that session.

**Size guard:** 1 new module, 1 test file, README, DECISIONS, tracker; no CLI, no schema change. If more is needed, split checks 3 to 7 of the observation order into row `3.1a`.

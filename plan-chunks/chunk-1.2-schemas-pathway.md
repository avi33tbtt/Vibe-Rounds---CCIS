# Chunk 1.2-schemas-pathway: Schemas for pathway and decision node

_Phase 1, Stage 2. Needs: 1.1 (done). Written just in time from the plan brief for 1.2 and what 1.1 learned._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/SPEC.md` (REQ-025 to 027, 032, 033, 066); `docs/USE-CASE-SNAKE.md` section 3 (the pathway and its two nodes); `ccis/schemas/manifest.schema.json` and `ccis/schemas/README.md`; `scripts/build-validators.js`.

## Lessons from 1.1 to follow

- Closed objects (`additionalProperties: false`) with `patternProperties: {"^x-": {}}`; `$id` values are `https://ccis.invalid/schemas/<name>.schema.json`.
- Ajv strict mode needs an explicit `"type": "object"` beside `properties` inside `if`, `allOf` and `then`. `strictRequired` stays off (D-016).
- Do not use `uniqueItems`, `format`, or `minLength` with non-ASCII: these pull in Ajv runtime helpers, and the no-runtime-import test would fail. Use patterns and `minItems`.
- Reuse the manifest's `reference` definition by `$ref`; never copy it.

## Design to build (owner approves this chunk file before building)

1. **`ccis/schemas/decision-node.schema.json`** (REQ-026):
   - `id`, `question` (text), `inputs`: typed list, each `{key, element, field}` pointing at an element id and field key (resolution is Phase 2), plus `preconditions` (list of text).
   - `outcomes`: `minItems` 2, each `{id, kind, when, next, note?}`.
     - `kind`: `answer` | `missing-data` | `conflicting` | `indeterminate`.
     - `next` is **required** on every outcome: `{stage: <id>}` or `{end: true}`. This is how "no outcome leads nowhere" is enforced in the schema.
     - The outcomes array must **contain** at least one `indeterminate` outcome (JSON Schema `contains`). Indeterminate never shares an outcome with a "no" answer.
   - `when` is a **closed state test**, not an expression: a list of `{input, is}` where `is` is one of `present`, `absent`, `unknown`, `not-collected`, `not-applicable`, `explicitly-negative`, `entered-in-error`, `conflicting`. No value comparisons and no numbers: value tests need the expression tree from row 1.3. Record this limit as a decision (D-018) and in `ccis/schemas/README.md`.
2. **`ccis/schemas/pathway.schema.json`** (REQ-025, 027):
   - Embedded manifest with `type` fixed to `pathway`; `scope`, `intendedUse`, `exclusions` (text, list).
   - `elements`: references with **ranges** (reuse `reference`, element type only).
   - `stages`: each `{id, label, entry, exit, needs}` where `entry` and `exit` are lists of criteria in words and `needs` lists element field keys. Stage `kind` is limited to `information` and `report`; nothing else.
   - `nodes`: the decision nodes (`$ref` to the decision-node schema), `transitions` between stages (`{from, to, via?}`).
   - `timing`: constraints that name the two things they relate and the **parameter id** that will carry the number (`{id, between: {from, to}, parameter}`). No numeric value, no unit, no threshold in a pathway: parameters belong to analytics packages (row 1.3).
   - `analytics`: references, each marked `required` or `optional`.
   - **No authorisation:** there is no field for an action, order, treatment, dose or recommendation, and objects are closed, so such a key is rejected (REQ-027). A bad fixture proves it.
3. **Build script**: add `decisionNode` and `pathway` to the exports of `ccis/validators/ccis-validators.js`; regenerate and commit. Nothing else changes in the script.
4. **Stays for the Phase 2 validator** (list in `ccis/schemas/README.md`): every `next.stage` and transition target exists; every outcome `input` is one of the node's inputs; outcomes cover every state a node input can be in; no unreachable stage; every `needs` key exists in the referenced element; timing `parameter` ids exist in the required analytics. Graph-wide checks (dead ends, bounded cycles) are gap G-09, row 5.3.

## Fixtures (`ccis/fixtures/schemas/`, add to `index.json`)

Synthetic only; no clinical wording beyond the snake dossier's documentation questions.
- `pathway-good-minimal`: one stage, no nodes.
- `pathway-good-full`: the dossier's 4 stages and 2 nodes (each with an indeterminate outcome going to the gap-report stage), one timing constraint naming a parameter id, one required and one optional analytics reference.
- `decision-node-bad-no-indeterminate`: all outcomes present but none of kind `indeterminate`.
- `decision-node-bad-outcome-no-next`: an outcome with no `next`.
- `pathway-bad-action-field`: a stage carrying an `action` or `treatment` key.
- `pathway-bad-stage-no-exit`: a stage without exit criteria.
- `pathway-bad-timing-number`: a timing constraint carrying a numeric value.
Inline mutations in the test (not files): element reference without a range; unknown outcome kind; unknown `is` state; node with one outcome; stage kind other than `information` or `report`.

## Do not

- No analytics, parameter, expression-tree, envelope or run-record schemas (rows 1.3 and 1.4). No value comparisons in `when`.
- No edits to `ccis/SPEC.md`. If REQ-025 to 027 cannot be expressed, propose an amendment in `ccis/CHANGELOG.md` and stop on that point.
- No clinical numbers, thresholds or actions anywhere.

## Done when

`npm test` passes once; `npm run build` leaves no diff; at most 3 deliberate-breakage checks (for example drop the `contains` rule, allow an unknown key on a stage, make `next` optional), each seen failing then restored.

## Size guard

2 schemas, the build script's export list, up to 7 new fixtures plus the index edit, test additions, README update, regenerated validators, 1 to 3 decision rows. If it does not fit, split into `1.2a` (decision node) and `1.2b` (pathway).

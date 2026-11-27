# Chunk 4.3: governed AI drafting, part 1: the gate (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.2d.3 (done). Pure governance module `ccis-draft.js`: it decides what may be sent to an AI model and what may be accepted back. **No model call, no network, no UI** (those are 4.3a and 4.3b). Rules it enforces: CCIS-REQ-054 (AI never publishes, validates or approves), 074 (off unless enabled, labelled, no part of the calculation), 086 (same artefact, same pipeline), 087 (drafts only, terminology resolved not invented, unresolved assumptions marked, no claim of clinical validity). Pure: no file, clock, randomness or network; the model is an injected function in 4.3a, never called here._

**Core rules:** attach `01-core.md`. Rule 12: a NEW test file `test/ccis-draft.test.js` (at most 8 cases); 1 new module of at most 80 lines.

**Read only (4 files):** `ccis/SPEC.md` lines 196, 264, 312-315 (`sed -n`); `ccis-sdk.js` lines 134-160 (`ARTEFACT_TYPES`, `manifest`); `ccis-sdk-element.js`, `ccis-sdk-pathway.js` and `ccis-sdk-analytics.js`: `grep -n '^export'` only; `test/ccis-sdk-analytics-whole.test.js` lines 1-20 (helpers to copy).

## Build: `ccis-draft.js`
1. `export const AI_ENABLED_DEFAULT = false`. Fixed-sentence refusals `AI-001` to `AI-006`, class `DraftError { code, path }`, a message never holds a value (same pattern as `SdkError`).
2. `draftRequest({ enabled, artefactType, standardVersion, sources, terminology, instruction })` returns a frozen payload `{ artefactType, standardVersion, sources, terminology, instruction }`. `AI-001` unless `enabled === true` (absent or any other value is off). Whitelist, closed: any other member (a context, a run record, an envelope, a patient field, a name) is `AI-002` at that member. `artefactType` one of `contextual-element`, `pathway`, `analytics-package`. `sources`: 1 to 20 items `{ id, kind, citation, passage }`, `kind` as the analytics evidence kinds, `passage` and `instruction` at most 2000 characters each (`AI-003`). `terminology`: 0 to 50 items `{ system, code, display }` supplied by the caller (the model resolves nothing and invents nothing).
3. `acceptDraft(response, { artefactType, sources })` takes the model's reply as plain JSON `{ artefact, trace, assumptions }` and returns a frozen `{ artefact, label: 'AI-drafted, unreviewed. Not clinically validated.', status: 'draft', sourceClass: 'AI-proposed', assumptions }`:
   - `artefact` goes through the SDK builder for its type (`element`, `pathway` or `analytics`): the same pipeline as every route; a refusal becomes `AI-006` with the SDK code and path (never the value). So a number literal, a valued parameter or an unknown member is already refused;
   - `artefact.manifest.status` must be `draft` and there must be no `validation` member (`AI-004`): a draft can never be published, validated or approved, and the module exports nothing that publishes;
   - `trace`: list of `{ member, source }`; every top-level member except `manifest` needs at least one trace entry naming a supplied `sources[].id`, or must be named in `assumptions` (a list of `{ member, note }`); otherwise `AI-005`. A trace naming an unsupplied source is `AI-005`;
   - nothing is stored, sent or defaulted.

## Test: `test/ccis-draft.test.js` (at most 8 cases)
1. off by default: no `enabled`, `false`, `'true'`, `1` all `AI-001`; `true` builds, frozen;
2. whitelist: `context`, `runRecord`, `patient`, an `x-` member each `AI-002` at the member; an unknown `artefactType` refused;
3. bounds: 0 or 21 sources, a 2001-character passage and instruction `AI-003`;
4. a valid analytics draft (the snake interval file as the reply, every member traced to a source) is accepted with the label, `status: 'draft'`, `sourceClass: 'AI-proposed'`;
5. `manifest.status: 'validated'` and a `validation` member `AI-004`;
6. a member with no trace and no assumption `AI-005`; with an assumption it passes and the assumption is kept; a trace naming an unsupplied source `AI-005`;
7. SDK refusals pass through: `{ literal: 30 }` in a computation `AI-006` carrying `S-003` and the path;
8. hostile string never in a message; purity scan of `ccis-draft.js` (no network, file, clock, `eval`) passes, and the module exports no `publish`, `validate` or `approve`.

**Done when:** `node --test test/ccis-draft.test.js` passes. Two breakages each seen failing, then restored: (a) treat a missing `enabled` as on; (b) accept `status: 'validated'`.

**Size guard:** 1 module (80 lines), 1 test, tracker and DECISIONS only. If the SDK builders cannot be called with a plain object, STOP and report.

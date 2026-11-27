# Chunk 4.3b.1: governed AI drafting, part 4: the draft view (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.3b (done). New module `ccis-app-draft-view.js`: `mountDraftView({ document, root, onState, draft, types, kinds, onDraft })`, in the style of `ccis-app-run-view.js`. Module and jsdom test only; **not wired** (4.3b.2 wires it). `draft` is an injected async function `({ enabled, key, model, request }) -> draftForPage result`, so the view never sees a client, a fetch or an address; the test passes a stub. `types` (artefact type names) and `kinds` (source kinds) are arrays the page supplies, so the view imports only `makeDom` and `draftModel`._

**Core rules:** attach `01-core.md`. Rule 12: 1 module of at most 110 lines, a NEW test `test/ccis-app-draft-view.test.js` (at most 8 cases), plus one small edit to the `COVERED` table (below).

**Read only (5 files):** `ccis-app-dom.js` lines 6-29 (allowed tags: no textarea, no img); `ccis-app-run-view.js` lines 14-100 (mount pattern, `say`, `refresh`, `forget`, handlers); `test/ccis-app-run-view.test.js` lines 15-40 (the jsdom `mount` helper to copy); `test/ccis-app-hostile-sweep.test.js` lines 17-22 (`COVERED`); `ccis-app-draft.js` lines 36-59 (`draftModel` shape).

## Build: `ccis-app-draft-view.js`
1. Elements (createElement and textContent only, no inline handlers, no storage, no network): heading "Draft (AI)"; a fixed notice "Off by default. It only drafts. A human must review every draft. Nothing here publishes or validates."; a checkbox "Allow AI drafting" (unchecked at mount); a **password-type** key input (`autocomplete` off, label "API key (kept in this page only)"); a model text input defaulting to `claude-sonnet-5-5`; a select of `types`; ONE source: a select of `kinds`, a citation input, a passage input (the source id is the fixed `src-1`; more sources are a later row); an instruction input; **Draft** and **Clear** buttons; a polite status line; a result area. **No publish, validate, approve, save or copy control, no link.**
2. Draft is disabled until the switch is on and the key, model, instruction, citation and passage are non-empty. On click it calls `draft({ enabled: switch.checked, key, model, request })` with `request = { artefactType, standardVersion: '0.1.0', instruction, sources: [{ id: 'src-1', kind, citation, passage }], terminology: [] }`, awaits it, **then clears the key input** whatever the outcome.
3. On `{ ok: true, draft }`: show `draftModel(draft)` as the label, the fixed headline, a table (member, basis) and the notes line, all as text; call `onDraft(draft)` once. On `{ ok: false, sentence }`: show the sentence only (plus `code` and `path` words if present). A stub that throws shows one fixed sentence, never the message.
4. Switching off or Clear empties the key, the result area and the status. Editing any field clears a stale result.
5. `onState` gets booleans and counts only: `{ enabled, hasKey, ready, drafted, refused, rows }`. **Never the key, the instruction, a source or a sentence.** The key lives only in the input's value and is read at the click.

## Small edit
In `test/ccis-app-hostile-sweep.test.js`, add `'ccis-app-draft-view.js': 'ccis-app-draft-view.test.js'` to `COVERED` (the test only checks the keys). The full hostile-string sweep is 4.3b.3.

## Test: `test/ccis-app-draft-view.test.js` (at most 8 cases, jsdom, stub `draft`)
1. mount: switch off, Draft disabled, key input type `password`, no `a`, `img`, `script`, `textarea` or button named publish, validate, approve, save;
2. Draft stays disabled until the switch and every field are filled; the stub sees `enabled: true` and the exact `request` shape;
3. a good stub result shows label, headline, one row per member, notes; `onDraft` once; frozen input not changed;
4. the key input is empty after a good run, a refusal and a throwing stub;
5. a refusal shows its sentence (and `code`, `path`); a throw shows the fixed sentence without its message;
6. `onState` over a whole session never contains the key, instruction, citation or passage (JSON search);
7. switching off or Clear empties key, result and status; an edit clears a stale result;
8. hostile strings (`<img src=x onerror=1>`, `javascript:1`, `"><script>`) in member, basis and sentence appear only as text: no `img`, `script`, `a` or `on*` attribute in the root.

**Done when:** `node --test test/ccis-app-draft-view.test.js` passes. Two breakages each seen failing, then restored: (a) skip the key clearing after a refusal; (b) put the key into `onState`.

**Size guard:** 1 module (110 lines), 1 test, the one `COVERED` line, tracker and DECISIONS. If the view needs a tag outside `ALLOWED_TAGS`, STOP and report (do not widen the list).

# Chunk 4.3b.2: governed AI drafting, part 5: wire the draft view into the page (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.3b, 4.3b.1 (done). The hostile-string sweep, the limitations entry and the real-Chrome "committed page sends no request" test stay in 4.3b.3. The committed `index.html` keeps `connect-src 'none'`: there the draft view shows, but a request is blocked by the CSP and ends in the fixed `AIC-002` sentence (D-250). Only a build with `--ai-origin` can reach the model._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `ccis-app.js` lines 1-30 and the last 22 lines (imports, state objects, `window.ccisApp`); `ccis-app.template.html` (whole, 24 lines); `test/ccis-app-remote-wire.test.js` lines 1-52 (jsdom helpers, fake `fetch` in `beforeParse`); `test/ccis-app-build-ai.test.js` lines 1-25 (how `buildApp({ aiOrigin })` is used); `ccis-draft.js` lines 26-34 (`BUILDERS`). Edit the five key-list lines named below by line number; read nothing else in those tests.

## Build (0 new modules, 1 test, small edits, rebuild)
1. `ccis-draft.js`: add `export const DRAFT_TYPES = Object.freeze(Object.keys(BUILDERS));` under `BUILDERS` (one line; the page must not keep its own list of types). `SOURCE_KINDS` is already exported by `ccis-sdk-analytics.js`.
2. `ccis-app.template.html`: `<section id="draft"></section>` after `#export`.
3. `ccis-app.js` (about 20 lines): import `mountDraftView`, `draftForPage`, `makeAiClient`, `DRAFT_TYPES`, `SOURCE_KINDS`. State object `const drafted = { enabled: false, hasKey: false, ready: false, drafted: false, refused: false, rows: 0 }`. Mount last, if `#draft` exists: `client = typeof window.fetch === 'function' ? makeAiClient(window.fetch.bind(window)) : undefined`; `mountDraftView({ document, root, onState: copy the keys, types: DRAFT_TYPES, kinds: SOURCE_KINDS, draft: (a) => draftForPage({ ...a, client }) })`. No `onDraft`: the page keeps no draft, and nothing reads one. The key passes through the closure only: never on `window`, never in a variable that outlives the call. The draft view never sets the status line and never touches the market, import, selector, catalogue, run, results or export state.
4. `window.ccisApp` gains `draftState: () => ({ ...drafted })`.
5. Key lists (sorted, `draftState` after `checksumOf`): `catalogue-wire.test.js:135`, `export-wire.test.js:126`, `import-wire.test.js:91`, `results-wire.test.js:113`, `run-wire.test.js:100`. Nothing else in them changes.
6. `node scripts/build-app.js`, commit the rebuilt `index.html`. STOP and report if a `node:` import appears, the page grows by more than 100 KB (now 1.48 MB), or `test/ccis-app-bundle-scan.test.js` fails (its allowance is 4.3b.3, not this row).

## Test: `test/ccis-app-draft-wire.test.js` (at most 8 cases)
jsdom, scripts run, `window.fetch` injected in `beforeParse` with a recording fake. Two pages: the committed `index.html`, and `buildApp({ aiOrigin: 'https://api.anthropic.com' })` written to a temp file. A fake reply is `{ ok: true, status: 200, redirected: false, text: async () => JSON.stringify({ content: [{ type: 'text', text: <JSON reply> }] }) }`; the reply is the snake interval analytics with every member traced to `src-1`.
1. Committed page: the section shows, switch off, Draft disabled, key field type `password`, `draftState()` is the initial object, the status line is unchanged, the fake saw nothing.
2. Switch on and every field filled on the committed page, Draft clicked: the fake is called once and throws `'secret-token'`; the fixed `AIC-002` sentence shows; the page text holds no `secret-token`.
3. Distribution page, good reply: label, headline and one row per member show; `draftState()` is `drafted: true` with the row count.
4. The one request: URL exactly `https://api.anthropic.com/v1/messages`, method POST, the user message holds exactly the five payload members (no market, context, import or run record), the `x-api-key` header is the typed key, no cookie or credentials.
5. The key is empty in the input after the run and absent from `innerHTML`, every seam JSON and the jsdom storage.
6. A reply with `status: 'validated'` shows the `AI-004` sentence and no table.
7. Seams: sorted keys of `window.ccisApp` include `draftState`; `draftState()` holds booleans and counts only; no `on*` attribute; typing in the draft view changes none of the other seams.
8. Source scan of `ccis-app.js`: no `fetch(` of its own, no timer, storage or `innerHTML`, and no `window.` assignment of a key, model or client.

**Done when:** the new test and the five edited wire tests pass, `ccis-app-bundle-scan` and `ccis-app-build` pass, `node scripts/build-app.js --check` matches. Two breakages each seen failing, then restored: (a) store the key on `window` inside the draft wrapper; (b) skip the key copy into `drafted`.

**Size guard:** about 25 changed lines in `ccis-app.js` plus one-line edits, 1 test (8 cases), 1 rebuild. If the bundle scan needs an allowance, STOP and say so: that is 4.3b.3.

# Chunk 4.3b.4: governed AI drafting, part 7: real-Chrome test of the draft view's network behaviour (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.3b.2 (done; 4.3b.3 done). One new test file, no module, no edit to any existing file, no rebuild of `index.html`. The model API is faked by request interception (no real network, no real key). jsdom cannot show this: only Chrome enforces the CSP and sends real requests._

**Core rules:** attach `01-core.md` too.

**Read only (4 files):** `test/ccis-app-remote-browser.test.js` lines 1-98 (Chrome lookup, skip rule, `openPage`, `pick`; copy, do not import); `test/ccis-app-draft-wire.test.js` lines 14-15 and 39-45 (`doc`, `reply` and the `fill` steps: labels of the fields); `ccis-app-ai.js` lines 37-48 (headers and body); `ccis-app-draft.js` lines 20-24 (the `AIC-002` sentence).

## What this row proves
The committed page, with the draft view fully used, sends no request at all: the CSP blocks the model call and the fixed `AIC-002` sentence shows. A `buildApp({ aiOrigin: 'https://api.anthropic.com' })` page sends exactly one request, to exactly that endpoint, with no patient data in it, and nothing else may be reached.

## Build: `test/ccis-app-draft-browser.test.js` (1 new test, at most 6 cases, real Chrome)
Same skip rule as 4.1c.1 (no Chrome: skipped locally, fails when `CI` is set). `openPage` as there, with `API = 'https://api.anthropic.com/v1/messages'`. The interceptor answers `API` with a 200 JSON reply (`content: [{ type: 'text', text: JSON.stringify(reply()) }]`, header `access-control-allow-origin: *`, and for an `OPTIONS` preflight also `access-control-allow-headers: *` and `204`), records method, headers and `postData`, and answers any other non-file request 500 and records it as a leak. The key typed is `sk-test-KEY-123`.
1. **Committed page, draft used:** switch on, all fields filled, Draft clicked: zero non-file requests, the page shows the `AIC-002` sentence, a `connect-src` violation was recorded, the key input is empty, `draftState()` has `refused: true`.
2. **Committed page, quiet:** boot, toggle the switch on and off, Clear: zero non-file requests and no error.
3. **`--ai-origin` page, quiet:** boot and toggling: zero requests until Draft is clicked.
4. **One request:** import the envelope and run first (as 4.1c.1 case 3), then Draft. Exactly one non-file request: POST to `API`; headers include `x-api-key` equal to the typed key and no `cookie` or `authorization`; the body's user message holds exactly the five payload members and none of the envelope's markers. `draftState().drafted` is true.
5. **Other origins refused:** in that page, `fetch('https://other.example/')` and `fetch('https://market.example/m/index.json')` are refused with a `connect-src` violation and never reach the interceptor.
6. **Key hygiene:** after case 4's draft: the key input is empty, the page text and `JSON.stringify(draftState())` hold no key, `localStorage` and `sessionStorage` are empty, and the key appears in exactly one request (the API call).

**Done when:** `node --test test/ccis-app-draft-browser.test.js` passes with Chrome (run once with `CHROME_PATH` if skipped). Two breakages each seen failing, then restored: (a) in `ccis-app-draft-view.js` skip `key.input.value = ''` after the call (case 6 fails); (b) in `scripts/build-app.js` add `https:` to the `connect` list of a distribution build (case 5 fails).

**Size guard:** 1 test file (about 120 lines), 0 modules, 0 edits. If Chrome gives the interceptor no preflight for the `x-api-key` header, or will not let it answer one, STOP and report instead of weakening a case.

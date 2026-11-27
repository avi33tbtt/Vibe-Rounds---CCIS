# Chunk 4.3a: governed AI drafting, part 2: the model-call adapter (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.3 (done) and your decision (2026-11-27): the user pastes their own API key into the page; the key lives in memory only and is never stored. New pure module `ccis-app-ai.js`: it turns a `draftRequest` payload into one request to the Anthropic Messages API and returns the model's reply as a plain object. **Pure like `ccis-app-fetch.js`: it never names the global `fetch`; the caller injects it.** Not wired, no UI, no CSP change (4.3a.1 opens `connect-src`, 4.3b is the UI). The reply is NOT judged here: `acceptDraft` (4.3) judges it, so a bad or hostile reply is refused there. Patient data cannot ride along: the only input is the whitelisted payload (CCIS-REQ-074, core privacy rules)._

**Core rules:** attach `01-core.md`. Rule 12: 1 module of at most 80 lines, a NEW test `test/ccis-app-ai.test.js` (at most 8 cases).

**Read only (3 files):** `ccis-app-fetch.js` (25 lines: the injected-fetch pattern, fixed options, fixed failure sentences); `ccis-draft.js` lines 1-30 (the payload members and refusal pattern); `test/ccis-app-fetch.test.js` lines 1-16 (fake response helper).

## Build: `ccis-app-ai.js`
1. `export const AI_ENDPOINT = 'https://api.anthropic.com/v1/messages'` (a constant; no address is ever an input), `AI_ORIGIN` (its origin, for 4.3a.1), `MAX_REPLY_CHARS = 200000`, `MAX_TOKENS = 4000`.
2. `export function makeAiClient(fetchFn)` (a non-function is refused) returns `async function draftWithModel({ payload, model, key })`:
   - `AIC-001` unless `key` is a string of 1 to 200 characters with no whitespace; `model` must match `^claude-[a-z0-9-]+$` (no default, the caller chooses);
   - `AIC-004` unless `payload` has exactly `artefactType`, `standardVersion`, `instruction`, `sources`, `terminology` (the members `draftRequest` returns); nothing else is ever sent;
   - one POST to `AI_ENDPOINT` with fixed options: `credentials: 'omit'`, `cache: 'no-store'`, `redirect: 'error'`, `referrerPolicy: 'no-referrer'`, `mode: 'cors'`; headers `content-type: application/json`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true` and `x-api-key: <key>`; body `{ model, max_tokens, system, messages: [one user message holding the payload as JSON text] }`. `system` is a fixed constant sentence list: draft only, reply with one JSON object `{ artefact, trace, assumptions }` and nothing else, no numeric literal in an expression, thresholds only as declared parameters, mark every unsupported member an assumption, never claim clinical validity;
   - any throw, non-200, redirect or unreadable body is `AIC-002` (one fixed sentence that never quotes the status, body, address or key); a reply text over `MAX_REPLY_CHARS`, no text block, text that is not one JSON object (after stripping one code fence) or an object with members other than `artefact`, `trace`, `assumptions` is `AIC-003`;
   - returns the parsed plain object, frozen. Nothing is stored, logged or defaulted; no timer.
3. `AiError { code, path }`, fixed sentences `AIC-001` to `AIC-004`.

## Test: `test/ccis-app-ai.test.js` (at most 8 cases; fake fetch, no network)
1. a good call: URL equals `AI_ENDPOINT`, fixed options, the four headers, the body holds exactly the payload text and fixed `max_tokens`, and the result equals the reply object, frozen;
2. key: empty, with a space, 201 characters, a number are `AIC-001`; a bad `model` is `AIC-001`; non-function fetch refused;
3. payload with an extra member (`context`, `runRecord`, `patient`), a missing member `AIC-004`, and the fake fetch was never called;
4. a thrown error, status 401, `ok: false`, `redirected: true` are `AIC-002`; the message holds no status, no body, no key, no address (the fake error text carries the key and is searched for);
5. replies: JSON in a code fence parses; prose, two objects, an array, a 200001-character text, no text block, an extra member are `AIC-003`;
6. the key appears only in the `x-api-key` header of the one call, never in the body, the result or any error;
7. the system text holds each safety sentence (comparison against the list in the module, exported as `SYSTEM_RULES`);
8. purity scan of `ccis-app-ai.js`: no `fetch(` call, no `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, timer, `eval`, `Function`.

**Done when:** `node --test test/ccis-app-ai.test.js` passes. Two breakages each seen failing, then restored: (a) put the key in the body too; (b) accept a payload with an extra member.

**Size guard:** 1 module (80 lines), 1 test, tracker and DECISIONS only. If the purity scan of the page build complains about the new module name, STOP and report (it is not wired yet).

# Chunk 4.1b: distribution 3: the browser fetch adapter (written 2026-11-26, docs only; build after owner approval)

_Phase 4. Needs 4.1 and 4.1a (done). The tracker row 4.1b held an adapter AND a view; split (rule 12): this row is the adapter only, the view is 4.1b.1, wiring stays 4.1c. No view, no wiring, no change to `index.html`._

**Core rules:** attach `01-core.md` too.

**Read only (3 files):** `ccis-remote.js` lines 45-62 (how `fetchText` is called and what a failure means); `test/ccis-remote.test.js` lines 1-30 (reuse any helper that serves the repo `market/` folder through a fake `fetchText`; if there is none, write about 8 lines); `test/ccis-app-bundle-scan.test.js` lines 13-20 (the forbidden patterns). Nothing else.

## What this row is for
`loadRemoteMarket` takes a `fetchText(url)` that returns text. This row writes the one small function that turns a browser `fetch` into that `fetchText`, with every request option fixed, so patient data cannot ride along and a redirect, a cached copy or a cookie cannot change what is loaded.

## Build (1 new module, 1 test of at most 8 cases)
New `ccis-app-fetch.js` (pure: it never names the global `fetch`; the caller injects it):

`export function makeFetchText(fetchFn)`. If `fetchFn` is not a function it throws `Error('fetch function is not acceptable')` (fixed text). It returns `async (url) => text`, which:
1. rejects a `url` that is not a string, with the fixed text `request is not acceptable`;
2. calls `fetchFn(url, OPTIONS)` with exactly ONE string and ONE frozen options object: `{ method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', mode: 'cors' }`. No `body`, no `headers`, no `signal`, no `keepalive`;
3. throws the fixed text `request failed` (never quoting the url, status text or the underlying error) unless the response has `ok === true`, `status === 200`, `redirected !== true`, and `type` is `basic` or `cors` (not `opaque`);
4. returns `await response.text()`; if that rejects or is not a string, throws the same fixed text.

The module must not contain the text `fetch(` (the bundle scan forbids it; `fetchFn(` is fine), nor any timer, clock, storage, `eval` or import other than none. It imports nothing. Say in DECISIONS that no timeout is set (the browser default applies; a timer is forbidden in the bundle); loading never changes the page until the whole market verifies, so a hang is only a wait.

## Test: `test/ccis-app-fetch.test.js` (at most 8 cases, a fake `fetchFn`, no network)
1. the fake receives exactly two arguments, a string and an object deeply equal to the options above; the object is frozen and has no `body`, `headers`, `signal`;
2. a 200 `ok` response gives its text;
3. status 404, 500, 204, `ok:false`, `redirected:true` and `type:'opaque'` each throw the fixed text, and the message contains no url;
4. a `fetchFn` that throws a message containing a secret string gives the fixed text, never that string;
5. `response.text()` rejecting or returning a number gives the fixed text;
6. a non-function `fetchFn` and a non-string url give their fixed texts;
7. end to end: `loadRemoteMarket({ base: 'https://example.test/market/', fetchText: makeFetchText(fakeServingMarket) })` loads the repo `market/` and `requests` has no query or fragment; and with one served file changed by one byte it refuses `R-006`;
8. source scan: the module text has no `fetch(`, `XMLHttpRequest`, `setTimeout`, `Date`, `localStorage`, `eval`, `import(`.

## Default answers (say so if any should change)
1. `redirect: 'error'` makes any redirect a failure, as 4.1a assumed. 2. `mode: 'cors'` needs the market host to send CORS headers (GitHub Pages does); noted for the deploy step. 3. The page finds its market address from the CSP in 4.1c (D-220), not from this row.

**Done when:** `node --test test/ccis-app-fetch.test.js test/ccis-remote.test.js` passes. Three breakages each seen failing, then restored: (a) change `credentials` to `'include'`; (b) drop the `redirected` check; (c) put the url in the failure message.

**Size guard:** 1 module (at most 40 lines), 1 test (at most 8 cases), 0 edits elsewhere, 0 rebuilds of `index.html` (the module is not imported by the page until 4.1c).

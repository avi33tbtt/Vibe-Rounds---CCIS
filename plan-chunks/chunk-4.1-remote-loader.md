# Chunk 4.1: distribution 1: a pure remote market loader (no real network, no UI)

_Phase 4. Needs: 3.11b (done). New module and test only; no change to any existing module, CSP or page. First slice of plan row 4.1, split narrower on purpose (rule 12)._

**Core rules:** attach `01-core.md` too.

**Read only (4 files):** `ccis-market.js` lines 39-56 (`M_REFUSALS`) and 235-300 (`pin`, `verifyPin`, `loadMarket`); `ccis-app-market.js` lines 26-62 (how files become `loadMarket` input); `test/ccis-market.test.js` lines 1-30 (style only). Do not read other tests.

## What this row is for

Today a market is read from a local folder. Distribution means reading the same folder from a web address and **refusing anything that does not verify**. This row builds only the logic, with the network injected as a function, so it can be proved without a server, a browser or a CSP change. 4.1a (CSP and host), 4.1b (browser adapter and view) and 4.1c (wiring and browser proof) follow as separate rows.

## Build (1 module of at most 150 lines, 1 test of at most 8 cases)

New `ccis-remote.js`: pure, no `fetch`, no file access, no clock, no randomness, no dynamic import. It imports only `loadMarket`.

`loadRemoteMarket({ base, fetchText, limits })` returns `Promise<{ ok: true, market, requests } | { ok: false, refusal }>`.
- `fetchText(url)` takes **one string argument and nothing else** (no body, no headers). So no input of this module can reach a request: patient data cannot be sent by construction.
- `base` must be `https:`, end in `/`, with no userinfo, query or hash (R-001). Requests are `base + 'index.json'` first, then each listed path in sorted order, one at a time.
- Each listed path must be relative, under `artefacts/`, with no `..`, no backslash, no scheme, no empty segment (R-004), checked **before** any file is requested.
- Defaults: index at most 256 KB (R-003), each file at most 512 KB (R-005), at most 200 entries (R-004). `limits` may only lower them.
- A thrown or rejected `fetchText`, or a non-string result, gives R-002; the refusal never quotes the URL or the error text.
- After all files arrive, call `loadMarket({ indexText, files })` once. If it refuses, return R-006 carrying the `M-` id only. All or nothing: no market, no partial files.
- `requests` lists the URLs asked for, in order, so a view can show the count.
- Export `REMOTE_REFUSALS` (fixed sentences, ids R-001 to R-006).

## Default answers (say so if any should change)

1. The host is not chosen here; `base` is an input. 4.1a asks you for it (plan question 4).
2. Strict all-or-nothing, as `loadMarket` already is. 3. Sequential requests: slower, but the request order is deterministic. 4. Nothing is cached or stored. 5. A passing check proves the same bytes, not who published them (signing is row 6.2); the sentence in `ccis-market.js` stays true.

## Test: `test/ccis-remote.test.js`, at most 8 cases, no jsdom

A fake `fetchText` serves the committed `market/` folder from memory and logs calls.
1. Happy path: the market equals `loadMarket` on the folder; `resolve` finds the snake pathway.
2. Every URL starts with `base`, has no query or hash, is the index plus each indexed path in sorted order; `fetchText` was always called with one argument.
3. One byte changed in one artefact: R-006 with an `M-` id, no `market` key.
4. Bad bases (`http:`, userinfo, query, no trailing slash): R-001 and zero calls.
5. Hostile index paths (`../x`, `/abs`, `https://evil.example/x`, `a\b`, not under `artefacts/`): R-004 and no file request.
6. Caps: an oversize index gives R-003; an oversize file gives R-005.
7. The third file request throws: R-002; the refusal text has no URL and no error message.
8. Source scan of `ccis-remote.js`: no `fetch(`, `XMLHttpRequest`, `WebSocket`, `Date`, `Math.random`, `eval`, `import(`.

**Done when:** `node --test test/ccis-remote.test.js` passes (only this file). Three breakages are each seen failing, then restored: (a) skip the path check (case 5); (b) return the files without `loadMarket` (case 3); (c) append `?v=1` to each URL (case 2).

**Not in this row:** a real `fetch`, CSP, any UI, a host, caching, retries, timeouts, signing.

**Size guard:** 1 module (at most 150 lines), 1 test (at most 8 cases), 0 edits to existing modules. If the module needs more than 150 lines, STOP and split the caps into `4.1.1`.

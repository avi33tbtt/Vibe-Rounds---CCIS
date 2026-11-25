# Chunk 4.1b.1: distribution 3b: the "Load from marketplace" view (written 2026-11-26, docs only; build after owner approval)

_Phase 4. Needs 4.1, 4.1a, 4.1b (done). A module and a jsdom test only: not wired, no change to any existing module, so `index.html` is NOT rebuilt (it does not import the new module until 4.1c). The address comes in as a parameter; reading it from the CSP is 4.1c (D-220)._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `ccis-app-market.js` lines 64-82 (`marketView` rows and counts); `ccis-app-market-view.js` (whole, 4 KB: the pattern to copy; do not edit it); `ccis-remote.js` lines 14-24 (`REMOTE_REFUSALS`) and 45 (the call); `ccis-app-dom.js` lines 1-30 (allowed tags); `test/ccis-app-market.test.js` lines 1-25 (jsdom setup, reuse). Nothing else.

## Build (1 new module, 1 test of at most 8 cases)
New `ccis-app-remote-view.js`: `export function mountRemoteView({ document, root, base, fetchText, onState })`.
- Text only through `makeDom` (`textContent`), one `click` listener per button via `addEventListener`, no inline handler, no `innerHTML`, no `fetch(`, no timer, no storage. It imports `loadRemoteMarket`, `REMOTE_REFUSALS`, `goodBase` from `ccis-remote.js`, `marketView` from `ccis-app-market.js` and `makeDom`.
- If `goodBase(base)` is false or `fetchText` is not a function: show heading "Marketplace" and one line "No marketplace address is set in this build." and NOTHING else (no button). `onState` is not called.
- Otherwise: heading, the address as text, one fixed notice: "Loading makes one request per market file to this address. Each request is only a web address: no patient data, case or run record is ever sent." and two buttons, "Load from marketplace" and "Clear".
- Click Load: the button is disabled while loading and a status line says "Loading. Nothing is used until every file has been checked." Call `loadRemoteMarket({ base, fetchText })`. A ticket counter discards a reply that arrives after Clear or after a newer load.
- Success: table built the same way as the folder view (copy its column list and about 12 lines; a shared helper would edit a bundled module and force a page rebuild, so the copy is recorded as a known duplicate in DECISIONS), the same "a loaded market is not a trusted market" sentence, and "N requests were made." (`requests.length`). `onState({ loaded: true, entries, refused: false, message, market, source: 'remote' })`.
- Refusal: `role="alert"` box with `Market refused (R-00x)` and that id's sentence from `REMOTE_REFUSALS`, then "Nothing was loaded and nothing has been run." Never any detail, address, file name or error text. An unknown id shows "Unrecognised refusal." `onState({ loaded: false, entries: 0, refused: true, message, source: 'remote' })` with no market.
- Clear: ticket + 1, empties the result, re-enables Load, `onState` with `loaded:false`, message "Ready. No market is loaded and nothing has been run."
- Keeps nothing: no cache, no storage; the market lives only in the `onState` receiver.

## Test: `test/ccis-app-remote-view.test.js` (at most 8 cases, jsdom, a fake `fetchText` serving `market/` as in `test/ccis-remote.test.js`)
1. a bad base (`http:`, no trailing slash) or no `fetchText` renders the one line and no button, and `onState` is never called;
2. Load fills the table with as many rows as `marketView` gives, shows the request count, calls `onState` once with `loaded:true`, `source:'remote'` and a `market`;
3. every URL the fake saw starts with the base and has no query or fragment;
4. a fake that throws `new Error('secret-token')` gives an alert with the R-002 sentence; the page text contains neither the secret nor the address path; `onState` has `refused:true` and no `market`;
5. one served byte changed gives R-006 and no table;
6. the button is disabled during loading and a second click makes no second request;
7. Clear during a pending load: the late reply is discarded (no table, `onState` not called with `loaded:true`); Clear after success empties the view;
8. hostile base text cannot reach the DOM as markup: a base containing `<img onerror=x>` is refused by `goodBase` and shows only the fixed line; source scan: no `innerHTML`, `fetch(`, `setTimeout`, `localStorage`, `eval`, `import(`, `onclick`.

**Done when:** `node --test test/ccis-app-remote-view.test.js` passes. Two breakages each seen failing, then restored: (a) drop the ticket check; (b) quote `r.refusal.detail` in the alert.

**Size guard:** 1 module (about 90 lines), 1 test (at most 8 cases), 0 edits elsewhere, 0 rebuilds. If the module passes 110 lines, STOP and split the table into its own module.

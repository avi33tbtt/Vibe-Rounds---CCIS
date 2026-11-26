# Chunk 4.1c: distribution 4: wire the marketplace view into the page (written 2026-11-26, docs only; build after owner approval)

_Phase 4. Needs 4.1a, 4.1b, 4.1b.1 (done). The real-browser "no request carries patient data" test is split off as row 4.1c.1 (a jsdom wiring test plus a Chrome test is two sessions, rule 12)._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `ccis-app.js` lines 14-66 (closure state) and 139-170 (market mount, seam); `ccis-app-market-view.js` lines 80-95 (Clear handler, end of mount); `ccis-app-remote-view.js` lines 15-30 and the last 12 lines; `test/ccis-app-run-wire.test.js` lines 1-52 (jsdom helpers). Decisions D-220 to D-224 only. Do not read `scripts/build-app.js` (`buildApp({ marketBase })` is already known).

## What this row is for
The committed `index.html` keeps `connect-src 'none'` and shows one line "No marketplace address is set in this build." A distribution build (`--market-base`) shows the "Load from marketplace" view. The page learns its address only from its own CSP (D-220), so there is one source.

## Build (0 new modules, 1 test, 6 small edits, rebuild)
1. `ccis-app.js`: a local `marketBaseFromCsp()` (about 8 lines): read the `connect-src` value from the `Content-Security-Policy` meta tag; `'none'` or absent returns `undefined`; anything `goodBase` refuses returns `undefined`. Import `mountRemoteView`, `goodBase` (from `./ccis-remote.js`) and `makeFetchText`; `makeFetchText(window.fetch.bind(window))` only when `window.fetch` is a function.
2. Both views return `{ reset }` (market view: what its Clear click does; remote view: what its Clear does, without calling `onState`). Two small edits, no behaviour change when unused.
3. `ccis-app.js`: ONE shared `onMarket(s)` (the current folder `onState` body). The folder view uses it; the remote view uses it too, passing its own `onState`. Whichever view loads, the OTHER is reset first, so only one table is ever on screen and only one market is live. `app.source` is `'folder'`, `'remote'` or `'none'`.
4. `ccis-app.template.html`: `<section id="remote"></section>` after `#market`. `window.ccisApp` gains `remoteState: () => ({ ...remote })`: booleans, `'none'|'folder'|'remote'` and counts only; never the address, a file name or a market.
5. The stale key lists in `test/ccis-app-import-wire.test.js`, `ccis-app-catalogue-wire.test.js`, `ccis-app-run-wire.test.js`, `ccis-app-results-wire.test.js` gain `remoteState` (sorted, after `importState`); nothing else in them changes.
6. `node scripts/build-app.js`, commit the rebuilt `index.html`. STOP and report if a `node:` import appears or the page grows by more than 100 KB (now 1.35 MB).

## Test: `test/ccis-app-remote-wire.test.js` (at most 8 cases)
jsdom, scripts run, `window.fetch` injected in `beforeParse` with a fake serving `market/` (as `test/ccis-remote.test.js`), two pages: the committed `index.html` and `buildApp({ marketBase: 'https://market.example/m/' })` written to a temp file.
1. Committed page: the one fixed line, no "Load from marketplace" button, `remoteState()` empty.
2. Distribution page: the address shows as text, the button shows.
3. Load: table rows equal the folder view's for the same `market/`, `state().marketLoaded` true, `remoteState().source` is `'remote'`.
4. Every URL the fake saw starts with the base, has no query or fragment, and no body or header was given.
5. Loading from the folder afterwards resets the remote table (one table on screen, `source` `'folder'`); remote Clear clears the market, selector and import as the folder Clear does.
6. A refused load (a fake that throws `'secret-token'`) shows the fixed refusal; page text holds neither the secret nor the address path.
7. Seams: sorted keys of `window.ccisApp` now include `remoteState`; no state seam JSON holds the address or a checksum; no `on*` attribute.
8. Source scan of `ccis-app.js`: no `fetch(` call of its own (only the injected adapter), no timer, storage, `innerHTML`.

**Done when:** the new test and the four edited wire tests pass (5 files). Two breakages each seen failing, then restored: (a) do not reset the other view on load; (b) let `marketBaseFromCsp` return the raw CSP text without `goodBase`.

**Size guard:** about 35 changed lines across the page and views, 1 test (8 cases), 1 rebuild. If the two-view reset needs more than the two `{ reset }` returns, STOP and split the folder view part off.

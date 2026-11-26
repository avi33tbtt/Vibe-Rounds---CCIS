# Chunk 4.1c.1: distribution 5: real-Chrome test that no request carries patient data (written 2026-11-26, docs only; build after owner approval)

_Phase 4. Needs 4.1c (done). One new test file, no module, no edit to any existing file, no rebuild of `index.html`._

**Core rules:** attach `01-core.md` too.

**Read only (4 files):** `test/ccis-app-browser.test.js` lines 1-65 and 98-125 (Chrome lookup, `openPage`, `pick`, `api`; copy, do not import: the file is not a module of helpers); `scripts/build-app.js` lines 40-50 (`buildApp({ marketBase })`, already known); `ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json` (find its case ref and one distinctive id with `grep -o`, do not read whole); D-217, D-221 in `DECISIONS.md`.

## What this row proves
Under a real Chrome and the real CSP of a distribution build, the page asks the marketplace host for market files and for nothing else, and nothing from the imported envelope, the case, the run or the export ever leaves the page. jsdom cannot show this: only the browser enforces the CSP and sends real requests.

## Build: `test/ccis-app-remote-browser.test.js` (1 new test, at most 6 cases, real Chrome)
Same skip rule as 3.10a (no Chrome: skipped locally, fails when `CI` is set). The test builds a distribution page with `buildApp({ marketBase: 'https://market.example/m/' })`, writes it to a temp folder under `os.tmpdir()` and opens it over `file://`. `page.setRequestInterception(true)`: a request to the base is answered from `market/` with `access-control-allow-origin: *` (no real network); a `file:` request continues; anything else is answered 500 and recorded as a leak.
1. Boot: no console error, no CSP violation, and every request is `file:` or under the base; the Load button shows.
2. Load from marketplace: the table has one row per index entry, `state().marketLoaded` is true, `remoteState().source` is `'remote'`; every non-file request is a GET with no `postData`, no query, no fragment, and none of `cookie`, `authorization`, `x-*` request headers.
3. Full flow: after the market loads, record the request count; import the envelope through the real file chooser, choose the pathway, run, export. The count of non-file requests has NOT increased, and no recorded request URL, header or `postData` contains the envelope's case ref or distinctive id.
4. The CSP is the last gate: in the page, `fetch('https://other.example/')` and `fetch('https://market.example/other')` are refused with a `connect-src` violation and neither request reaches the interceptor.
5. One served byte changed (the interceptor tampers one file): the alert shows the R-006 sentence, `state().marketLoaded` is false, and the page text holds neither the address nor the file path.
6. Committed `index.html` in Chrome: no Load button and zero non-file requests, even after clicking around (Clear on the folder view).

**Done when:** `node --test test/ccis-app-remote-browser.test.js` passes with Chrome (run it once with `CHROME_PATH` if it is skipped). Two breakages each seen failing, then restored: (a) give `OPTIONS` in `ccis-app-fetch.js` a header such as `{ 'x-case': 'marker' }` (case 2 fails); (b) make the build put `*` in `connect-src` for a distribution build (case 4 fails).

**Size guard:** 1 test file (about 110 lines), 0 modules, 0 edits. If Chrome cannot serve `https:` interception under `file://`, STOP and report instead of weakening a case.

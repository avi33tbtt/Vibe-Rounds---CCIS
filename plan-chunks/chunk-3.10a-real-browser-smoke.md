# Chunk 3.10a: one real-browser smoke test (the only row that adds a dev dependency)

_Phase 3, Stage 2. Needs: 3.10.1c (done). No source change, no schema change, no new module. Owner approves the dependency before this row is built (D-193)._

**Core rules:** attach `01-core.md` too.

**Read only:** `scripts/build-app.js` lines 36-50 (the CSP string); `ccis-app.js` lines 100-165 (wiring, `window.ccisApp`); `ccis-app-market-view.js` lines 13-23 (the folder input); `.github/workflows/ci.yml`. Do not read other views: jsdom already covers them.

## What this row is for

jsdom cannot show three things: that a real browser enforces the page's CSP, that the real `File`, `crypto` and `Blob` paths work, and that the page makes no request except loading itself. This row proves those with one real Chrome, loading the committed `index.html` over `file://` (no server, no network). The plan requires it in CI and allows a local skip only when no Chrome is installed.

## Dependency decision (owner approves first)

- **Default: `puppeteer-core`**, exact version (the latest stable at build time, `--save-exact`), licence Apache-2.0. It downloads no browser, so it uses the Chrome already on `ubuntu-latest` runners and on the owner's machine. Record the version and the count from `npm ls --all` in the D- row.
- Alternative: `@playwright/test` (bigger, downloads browsers in CI). Not recommended.
- Dev dependency only; never in the bundle. `build-app.js --check` and the bundle scan must still pass.

## Build (1 test file of at most 4 cases, 1 dependency, 0 modules)

New `test/ccis-app-browser.test.js` (Node 22, `node --test`):

0. **Chrome lookup**: `CHROME_PATH`, else `/usr/bin/google-chrome`, the macOS and Windows default paths. None found: skip every case with one clear message when `CI` is unset; **fail** when `CI` is set. Launch headless, add `--no-sandbox` only when `CI` is set, close the browser in `after`. Per-case timeout 20 s. No clock reads in assertions.
1. **Boots under the real CSP**: open `file://<abs path>/index.html`; no console error, no `securitypolicyviolation`, `#status` no longer reads "Loading.", `window.ccisApp.state()` exists; every request the page made starts with `file:` (collect with `page.on('request')`).
2. **The CSP holds**: in the page, inject an inline `<script>`, set an inline `onerror` on a new `img`, and call `fetch('http://127.0.0.1:9/')`; assert none ran (a marker stays undefined), the fetch rejected, at least 3 violations were reported, and still only `file:` requests were made.
3. **Market through the real input**: feed the committed `market/` folder to the real folder input (use the least brittle seam: Chrome file-chooser with the folder path, else `File` objects whose `webkitRelativePath` is defined before assignment); assert `state()` says loaded with 6 entries and the table has 6 rows, so real `File.text()` and in-browser SHA-256 agree with every index checksum.
4. **Import and run**: feed `ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json` to the import input, then read `importState()`, `selectorState()`, `runState()`, `resultsState()` through `window.ccisApp`; assert the same counts the jsdom wire tests assert (copy numbers from `test/ccis-app-run-wire.test.js` only if needed; at most one extra file read).

No CI edit is needed: `npm test` already runs every test file and GitHub sets `CI=true`.

If cases 3 or 4 need a feeding helper over 40 lines, **STOP**, keep cases 1 and 2, and add the rest as `3.10a.1`. If Chrome cannot load `file://` pages in the environment, STOP and report.

**Not in this row:** a server, screenshots, visual checks, other browsers, any source change.

**Done when:** `node --test test/ccis-app-browser.test.js` passes with Chrome; two breakages are each seen failing, then restored and `index.html` rebuilt: (a) `connect-src 'none'` loosened in `build-app.js` (case 2 fails); (b) a view id misspelled in `ccis-app.js` (case 1 fails). `node scripts/build-app.js --check` and `test/ccis-app-bundle-scan.test.js` pass.

**Size guard:** 1 test (at most 4 cases), 1 pinned dev dependency (`package.json` and lock only).

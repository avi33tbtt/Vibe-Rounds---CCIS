# Chunk 3.10: stricter CSP and a bundle-wide forbidden-API scan (no new module)

_Phase 3, Stage 2. Needs: 3.9b.2 (done). No schema change, no core module change. The shared escaper and the jsdom sweep are row 3.10.1; the real browser is 3.10a._

**Core rules:** attach `01-core.md` too.

**Read only:** `scripts/build-app.js` lines 16-20 and 38-47 (`CSP_DIRECTIVES`, the CSP string), `test/ccis-app-build.test.js` lines 1-30 and 50-70 (helpers, CSP and handler tests). Decisions D-063, D-146, D-168, D-182.

## What this row is for

The page already has a hash-only meta CSP with `connect-src 'none'` (rows 3.8 and DS5). This row closes the directives that fall back to hashes or `default-src` less obviously, and proves by scanning the built page, not the sources, that the one inline script holds no network, storage, clock, eval or HTML-injection API. The single allowed exception is the local file save of `savePage` (D-182).

## Build (0 new modules, 1 new test, 2 small edits, rebuild)

1. `scripts/build-app.js`: `CSP_DIRECTIVES` gains `worker-src`, `media-src`, `manifest-src`, `child-src` (each `'none'`). After that join, append `script-src-attr 'none'` and `style-src-attr 'none'` (the page has no `style=` attribute, checked). Do not add `unsafe-*`, `*`, `blob:`, `data:` or a trusted-types directive (3.10a tries those in a real browser).
2. `test/ccis-app-build.test.js`: the CSP list test gains the four new directives and the two attribute directives. Nothing else changes.
3. Run `node scripts/build-app.js` and commit the rebuilt `index.html`. If the page grows by more than 1 MB, STOP and report.
4. New `test/ccis-app-bundle-scan.test.js`, at most 8 cases, over the committed `index.html` parsed with jsdom (scripts not run):
   - exactly one `script` and one `style` element, none with `src`, no `link`, `img`, `iframe`, `form`, `object`, `embed`, `base`, `a[href]` in the static page.
   - no `on*` attribute, no `style` attribute, no `javascript:` string in any attribute.
   - the CSP has every directive above, each `'none'`, except `script-src` and `style-src` (one sha256 hash each); no `unsafe-`, `*`, `blob:`, `data:`.
   - the inline script, scanned as text, has zero hits for each pattern in a labelled table at the top of the test: `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts`, `new Worker`, `new SharedWorker`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `eval(`, `new Function`, dynamic `import(`, `.innerHTML`, `.outerHTML`, `insertAdjacentHTML`, `document.write`, `Date.now(`, `new Date()` (no argument), `Math.random`, `crypto.getRandomValues`, `window.open`, `location.assign`, `location.href =`, `navigator.sendBeacon`.
   - an ALLOW table of labelled exceptions with exact expected counts: `createObjectURL` 1, `revokeObjectURL` 1, `new Blob` 1. A different count fails and names the pattern and the count only.
   - every `addEventListener` target is found only in `ccis-app-*.js` view code (count the calls, assert at least one per view file name list), proving handlers are attached, not inline.
   - a failure message names the pattern and its count, never a matching snippet.
   - the scan table is data: adding a pattern needs no code change.
   If a pattern hits inside embedded data or a dependency (for example a schema description), STOP and report which pattern and how many; do not weaken the table. That is a split point.
5. `DECISIONS.md`: one row at most. Tracker: 3.10 done; next is 3.10.1 (chunk file first).

**Not in this row:** the shared escaper (3.10.1), a real browser (3.10a), any change to a view, the adapter or `ccis-app.js`.

**Done when:** the new test, `ccis-app-build.test.js` and `ccis-app-export-wire.test.js` pass, and two breakages are each seen failing (a `fetch('x')` call added to `ccis-app.js` and rebuilt; `worker-src` removed from `CSP_DIRECTIVES` and rebuilt). Run only those three files.

**Size guard:** 0 new modules, 1 test, 2 small edits, 1 generated page. If it will not fit, split the scan test into 3.10.0 (page and CSP) and 3.10 (bundle patterns).

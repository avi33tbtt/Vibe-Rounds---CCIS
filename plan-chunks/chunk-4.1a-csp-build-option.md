# Chunk 4.1a: distribution 2: open `connect-src` to one market address, only in an opt-in build

_Phase 4. Needs: 4.1 (done). No change to any view, the page logic or the committed `index.html`. The browser adapter is 4.1b, wiring is 4.1c._

**Core rules:** attach `01-core.md` too.

**Read only (4 files):** `scripts/build-app.js` lines 14-20 and 38-66 (`CSP_DIRECTIVES`, `buildApp`, `main`); `ccis-remote.js` lines 33-39 (`goodBase`); `test/ccis-app-build.test.js` lines 1-30 and 50-56 (helpers and the `directive()` helper); `test/ccis-app-bundle-scan.test.js` lines 51-58 (to confirm it reads the committed page only). Do not read other tests.

## What this row is for

The page must keep making no network request unless someone deliberately builds a distribution page. So the committed `index.html` stays exactly as it is (`connect-src 'none'`), and a new opt-in build option writes a **different** file whose CSP allows requests to **one** market address and nothing else.

## Build (1 script edit, 1 one-line edit, 1 test of at most 8 cases)

1. `ccis-remote.js`: change `function goodBase` to `export function goodBase` (nothing else). One rule for what a market address is, used by the loader and the build.
2. `scripts/build-app.js`:
   - `buildApp({ marketBase } = {})`: with no option, byte-identical to today. With `marketBase`, it must pass `goodBase` or throw `Error('market base is not acceptable')` (fixed text, never quoting the input). The only change to the CSP is `connect-src 'none'` becoming `connect-src <marketBase>` (the full address with its path, which CSP treats as a prefix). The script, style, hashes and page are unchanged.
   - `main`: `--market-base <url>` is accepted only together with `--out <file>`; without `--out` print `a distribution build needs --out` and return 1, writing nothing, so the committed page can never be overwritten by accident. `--check` works with both options (compares the named file with a fresh build). A bad base prints the fixed text and returns 1, writing nothing.
3. New `test/ccis-app-build-base.test.js`, at most 8 cases, in memory or in a temp folder:
   1. the default `buildApp()` equals the committed `index.html`, and its `connect-src` is `'none'`.
   2. with a base, `connect-src` is exactly that base and appears once; every other directive equals the default build's.
   3. replacing that one directive back to `'none'` makes the distribution build byte-identical to the default build (the script and style are untouched).
   4. these bases throw the fixed text: `http:`, userinfo, query, fragment, no trailing slash, `*`, `https://*.example.test/`, `https://a.test/; script-src *`, a space inside.
   5. `main(['--market-base', X])` without `--out` returns 1 and writes nothing; with `--out <temp>` returns 0 and the file holds the base.
   6. `--check` with the same two options returns 0; after one byte of the file changes it returns 1.
   7. the distribution CSP has no `*`, no `unsafe-`, no `data:`, no `blob:`, and `default-src 'none'` is kept.
   8. the committed page is never touched: its bytes are equal before and after cases 5 and 6.

## Default answers (say so if any should change)

1. **No host is baked in.** The address is a build argument. Example only, in docs: `https://avi33tbtt.github.io/clinical-intelligence-marketplace/` (a third repo on your GitHub Pages, plan question 4). You decide the real one at deploy time.
2. The committed page stays zero-network; the distribution page is a separate build you publish. 3. The CSP uses the full address with its path, the tightest the browser allows. 4. CI keeps checking only the default page. 5. Redirects are not followed by the CSP path rule; row 4.1b sets `redirect: 'error'` on the request.

**Not in this row:** any fetch call, adapter, view or wiring (4.1b, 4.1c); changing `index.html`; choosing a host; hosting a market.

**Done when:** `node --test test/ccis-app-build-base.test.js test/ccis-app-build.test.js test/ccis-app-bundle-scan.test.js test/ccis-remote.test.js` passes and `node scripts/build-app.js --check` still passes. Two breakages are each seen failing, then restored: (a) let `buildApp` ignore `goodBase` (case 4); (b) make `main` default `--out` to the committed page when a base is given (case 5).

**Size guard:** 1 script edit (at most 25 lines), 1 one-line edit, 1 test (at most 8 cases), 0 rebuilds of `index.html`.

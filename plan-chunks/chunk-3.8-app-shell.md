# Chunk 3.8-app-shell: build pipeline and page shell (`index.html`)

_Phase 3, Stage 2. Needs: 3.7 (done). Narrowed 2026-11-24 for the free-tier budget: the market loader, import view, selectors and catalogue moved to rows 3.8a to 3.8d. Docs only until approved. No schema change, no spec amendment._

**Core rules:** attach `01-core.md` too.

**Read only (five files):** `ccis-compile.js` (the one `node:crypto` import, `checksumOf`); `ccis-viewer.html` (CSP and banner wording); `scripts/market-build.js` (the generated-file-with-`--check` pattern); `package.json`; decisions D-063, D-144.

## What this row is for

Make the repeatable way to turn the pure ES modules into one page that the strict CSP allows, and ship an `index.html` that shows only the banners. Nothing is loaded or run yet. Later rows add one small module each to the same pipeline.

## Findings the build must handle

1. The only Node-specific line in the core is `import { createHash } from 'node:crypto'` in `ccis-compile.js`; `checksumOf` is synchronous and called synchronously by the importer, market, compiler and run modules, so Web Crypto (async) is not usable without a large ripple.
2. The page cannot load modules or fetch (CSP `default-src 'none'`, scripts and styles by SHA-256 hash only, D-063). So the app is one inline classic script with its hash in the CSP.
3. The validators file is about 815 KB; the built page will be about 1 MB. Accepted for the prototype.

## Design (at most one row in `DECISIONS.md`)

- `ccis-sha256.js`: pure synchronous SHA-256 of a string as UTF-8, exporting `createHash` with `update(text, 'utf8').digest('hex')`. Used only by the build to replace `node:crypto` in the bundle. `ccis-compile.js` is not edited; no committed checksum changes.
- `scripts/build-app.js`: bundles `ccis-app.js` (this row: a stub that writes a "ready" line into the page and exposes `window.ccisApp = { state() }`, counts only) into one classic IIFE with esbuild (not minified, `node:crypto` mapped to `ccis-sha256.js`); inlines it and `ccis-app.css` into `ccis-app.template.html`; computes both SHA-256 hashes into the CSP; writes `index.html`. `--check` rebuilds in memory and fails if the committed file differs. No network, no clock.
- The page: banners "Synthetic data, prototype, not for clinical use" and "reads files on this device only, no network requests". No inline handlers, no `innerHTML`.

## Build

1. New: `ccis-sha256.js`, `scripts/build-app.js`, `ccis-app.js` (stub), `ccis-app.css`, `ccis-app.template.html`; generated and committed `index.html`; `package.json` and `package-lock.json` gain `esbuild` (exact pin, release at least two weeks old).
2. New `test/ccis-sha256.test.js` and `test/ccis-app-build.test.js`:
   - SHA-256 equals `node:crypto` for: empty, one byte, lengths 55, 56, 63, 64, 65, 119 to 121, multi-byte UTF-8 with a surrogate pair, a 1 MB string.
   - The bundle in jsdom: the stub runs, `window.ccisApp.state()` returns counts only, and the bundled `checksumOf` equals the Node one on all six committed market entries.
   - CSP: both hashes match the inline script and style; `default-src`, `connect-src`, `img-src`, `object-src`, `base-uri`, `form-action` are `'none'`; no `unsafe-inline`, `unsafe-eval`, `*`; one script; no inline handler attributes.
   - `node scripts/build-app.js --check` passes on the committed file and fails on a one-byte change.
   - `ccis-sha256.js` imports nothing from Node; only `scripts/build-app.js` touches the disk; the demo viewer is unchanged.
3. `README.md` (two lines: build and open), `DECISIONS.md` (one row), tracker (3.8 done; 3.8a next, chunk file first).

**Not in this row:** loading a market or envelope, any view model, selectors, running anything, a real-browser test, changes to any core module.

## Questions (defaults apply if you only say "do next")

1. Use `esbuild` (one exact-pinned dev dependency)? Default: yes.
2. Substitute the pure SHA-256 in the bundle only, leaving `ccis-compile.js` untouched? Default: yes.
3. Generated `index.html` committed, with `--check` in CI, demo viewer left alone until 3.10/3.11? Default: yes.

**Done when:** `index.html` matches a fresh build, CSP hashes match, bundled checksums equal Node's, and three breakages (stale CSP hash after a script edit; a wrong SHA-256 padding case; `node:crypto` left in the bundle) are each seen failing a test.

**Size guard:** 2 new modules, 1 script, 3 small assets, 1 generated page, 2 tests. If a module passes about 250 lines or a second dependency is needed, STOP and split.

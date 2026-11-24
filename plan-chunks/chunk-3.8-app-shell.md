# Chunk 3.8-app-shell: the browser app shell, market loader and import report (`index.html`)

_Phase 3, Stage 2 (written 2026-11-24). Needs: 3.7 (done). This chunk file is docs only; the app is built at the next "do next" after the owner approves it. No schema change and no spec amendment is proposed. It narrows row 3.8: the context and pathway selector and the compatibility catalogue move to a new row **3.8a** (the plan's 3.8 is more than one chat; see question 5)._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-import.js` (`importEnvelope`, `REJECTION_CODES`, the report shape); `ccis-market.js` (`loadMarket`, `M_REFUSALS`, the entry members); `ccis-compile.js` (the one `node:crypto` import and `checksumOf`); `ccis-viewer.html` and `test/ccis-viewer.test.js` (the CSP, the hash check, the shared escaper `txt`/`el`, the `window.ccisViewer` test seam); `ccis-cli-flow.js` (`reportLines`, `heldAll`: what the browser repeats); `scripts/market-build.js` (the generated-file-with-`--check` pattern); `package.json`; decisions D-063, D-066, D-010, D-137, D-142.

## What this row is for

The first screen of the real app, replacing nothing yet (the demo viewer `ccis-viewer.html` stays until 3.10/3.11): open a **market folder** from the device, open an **export file**, and see the **import report**. Everything stays in the page's memory on this device. It also builds the one thing every later browser row needs: a repeatable way to turn the pure ES modules into a single page that the strict CSP allows.

## What earlier rows found (the build must handle each)

1. **The core modules are browser-clean except one import.** A scan of the import, compat, market, compile, validator and validators modules finds no `process`, `Buffer`, `require`, `import.meta` or file access. The only Node-specific line is `import { createHash } from 'node:crypto'` in `ccis-compile.js`, used by the synchronous `checksumOf`. Its header says Web Crypto, but Web Crypto is asynchronous and `checksumOf` is called synchronously by the importer, market, compiler and run modules. Changing them all to async is a large ripple.
2. **The page cannot load modules.** The viewer's CSP is `default-src 'none'` with the script and style allowed by SHA-256 hash only (D-063). A `file://` page also cannot load ES modules. So the app is **one inline classic script**, built from the modules, with its hash written into the CSP, as the viewer does by hand.
3. **The page cannot fetch** (`connect-src 'none'`, D-010, D-066). The market arrives through a file picker. A folder picker (`webkitdirectory`) gives every file with a relative path.
4. **The validators file is 815 KB** (Ajv standalone, self-contained, no eval). The built page will be about 1 MB. That is accepted for a prototype; tree-shaking it is not in this row.
5. **A market from disk is untrusted until `loadMarket` accepts it** (3.6). All or nothing, exactly as the CLI does.
6. **The import report holds no values** (3.1, IMP-091) but record ids are shown. The browser must not show more than the report does: no observation values, no snapshot, no raw file text.
7. **Patient data stays on the device.** No storage API, no network, no download in this row. A "Clear" button drops the envelope, context and report from memory.
8. **The CLI's report text lives inside `ccis-cli-flow.js`**, which reads the disk. The browser must not import that file. The view code is new and pure; unifying the two is a later row.

## The design (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

- **`ccis-sha256.js`**: pure synchronous SHA-256 of a string as UTF-8, exporting `createHash` with `update(text, 'utf8').digest('hex')`, the only shape `ccis-compile.js` uses. It is used **only by the build**, which substitutes it for `node:crypto` in the bundle. In Node nothing changes: `ccis-compile.js` is not edited and every committed checksum stays as it is.
- **`scripts/build-app.js`**: bundles `ccis-app.js` and everything it imports into one classic IIFE script (the `node:crypto` import mapped to `ccis-sha256.js`), inlines it and `ccis-app.css` into `ccis-app.template.html`, computes both SHA-256 hashes and writes them into the CSP, and writes `index.html`. `--check` rebuilds in memory and fails if the committed `index.html` differs (writes nothing), like `market-build.js`. No network, no clock.
- **`ccis-app-dom.js`**: the shared escaper (`txt`, `el`) from the viewer, the only place that makes text nodes. No `innerHTML`, no inline handlers; events by `addEventListener` only.
- **`ccis-app-view.js`**: pure view models, testable in Node with no DOM: `marketView(market)` (entries sorted: id, type, version, status, short checksum, warning count; the line that a checksum proves the same bytes, not who published them), `marketRefusalView(refusal)` (id, fixed sentence, detail ids only), `importView(report)` (outcome, header, applied versions with held flag, inclusions, counts, rejected and unmapped records grouped by code with the code's meaning, ignored extensions). It holds no values because the report holds none.
- **`ccis-app.js`**: the wiring. Market folder input: read each file's text, key by path with the chosen folder's name stripped, `loadMarket`; on success show `marketView`, on refusal show `marketRefusalView` and keep no market. Envelope input: needs a loaded market (otherwise a fixed message), reads the text, `JSON.parse` (a fixed sentence on failure), `importEnvelope(envelope, { held })` with every non-blocked entry held (as `ccis-cli-flow.js`), shows `importView`. A **Clear** button empties the envelope, context and report. State is plain variables; nothing is stored. A test seam `window.ccisApp = { loadMarketFiles(entries), importText(text), clear(), state() }` takes already-read `{ path, text }` entries, so jsdom can drive the page without a real file picker; the thin `File` to `{ path, text }` glue is what 3.10's real-browser smoke test covers. `state()` returns counts and flags only, never a value.
- Banners as in the viewer: "Synthetic data, prototype, not for clinical use", and a line that the page reads files on this device only and makes no network requests.

## Build

1. New: `ccis-sha256.js`, `scripts/build-app.js`, `ccis-app-dom.js`, `ccis-app-view.js`, `ccis-app.js`, `ccis-app.css`, `ccis-app.template.html`; generated and committed: `index.html`. If question 1 is answered "esbuild": `package.json` gains one exact-pinned dev dependency (a release at least two weeks old) and `package-lock.json` changes; the bundle is not minified.
2. New `test/ccis-app.test.js` and `test/ccis-sha256.test.js`:
   - (a) **SHA-256:** equals `node:crypto` for the empty string, one byte, lengths 55, 56, 63, 64, 65 and 119 to 121, multi-byte UTF-8 (including a surrogate pair), and a 1 MB string. A 64-hex check on all six committed market checksums.
   - (b) **Bundle checksums:** in jsdom, `window.ccisApp.loadMarketFiles` with the committed `market/` accepts it, and the page recomputes each entry's checksum through the bundle with no refusal. An altered file, an unlisted file and a missing file are each refused with `M-010` or `M-011`, and the app holds no market afterwards.
   - (c) **View models:** `importView` for all 33 envelopes agrees with `importEnvelope`'s own counts; the entered-in-error case lists one rejected record with `excluded-by-policy`; a refused envelope shows its fixed reason; a sentinel placed in an observation value appears nowhere in the page text.
   - (d) **The page:** envelope before market gives the fixed message; bad JSON gives the fixed sentence; Clear empties the page and `state()`; no `localStorage`, `sessionStorage`, `indexedDB`, `fetch`, `XMLHttpRequest`, `WebSocket`, `innerHTML`, `eval` or `new Function` in the app source files (comments stripped).
   - (e) **CSP and build:** both hashes in the CSP match the inline script and style; `default-src`, `connect-src`, `img-src`, `object-src`, `base-uri` and `form-action` are `'none'`; no `unsafe-inline`, `unsafe-eval` or `*`; one script; no inline handler attributes; `node scripts/build-app.js --check` passes on the committed file and fails on a one-byte change to the script.
   - (f) **Purity and scope:** `ccis-app-view.js` and `ccis-sha256.js` import nothing from Node and touch no DOM; only `scripts/build-app.js` reads or writes the disk; the demo viewer and its tests are unchanged.
3. `README.md` (one short paragraph: build, open `index.html`, what it does and does not do), `DECISIONS.md` (at most three rows), tracker (3.8 as built; 3.8a next, chunk file first).

**Not in this row:** the context and pathway selector, the compatibility catalogue and its explanations (row 3.8a); running anything (3.9); exporting or storing a record (3.9); the bundle-wide forbidden-API scan and the real-browser smoke test (3.10); changing `ccis-compile.js` or any core module; replacing `ccis-viewer.html`; any network request; deciding F-10, F-11 or D-112.

## Questions for the owner (defaults apply if you only say "approve")

1. **Bundler.** Use `esbuild`, one exact-pinned dev dependency, to produce the single script? Default: yes. The alternative is a hand-written concatenation script with no new dependency, which is fragile with `import`/`export` and which I would not recommend.
2. **Checksums in the browser.** Substitute a pure synchronous SHA-256 module for `node:crypto` in the bundle only, leaving `ccis-compile.js` untouched? Default: yes. The alternative (async Web Crypto) changes the importer, market, compiler and run modules.
3. **Getting the market into the page.** A folder picker, all-or-nothing through `loadMarket`, with no market embedded in the page? Default: yes. (Browsers that lack folder pickers cannot open a market; that is a stated limitation.)
4. **The page.** A generated `index.html`, committed, with `--check` in CI, and the demo viewer left alone until 3.10/3.11? Default: yes.
5. **Split.** Take selectors and the compatibility catalogue out as new row 3.8a (its own chunk file), so this row stays one chat? Default: yes. Row 3.9 then needs 3.8a.

**Done when:** the committed `market/` loads in the built page through the seam, a tampered one is refused, the import report view agrees with the importer on all 33 envelopes and holds no value, `index.html` matches a fresh build and its CSP hashes match, and three deliberate breakages (the CSP script hash left stale after a script edit; `importView` printing an observation value; the loader keeping a market that `loadMarket` refused) are each seen failing a test. The owner runs or skips the full `npm test` as instructed in that session.

**Size guard:** four new modules, one script, one stylesheet, one template, the generated page, two tests, README, DECISIONS, tracker. If any new module passes about 400 lines, or the bundler needs more than the one dependency, STOP and split.

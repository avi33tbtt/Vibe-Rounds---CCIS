# Chunk 3.10.1a: the seven views use the shared DOM helper (edits and a rebuild, no new module, no new test)

_Phase 3, Stage 2. Needs: 3.10.1 (done: `ccis-app-dom.js`). No schema change, no core module change. The hostile-string sweep over every view is row 3.10.1b (D-185)._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app-dom.js` (whole, 1.3 KB), and in each view only the line ranges in the table below (`sed -n`). Decisions D-063, D-186.

## What this row is for

Each of the seven views carries its own copy of `el(tag, content, cls)`. Replace each copy with the shared helper, so every view gets the allowed-tag list and the class pattern, and the copies stop drifting apart. Behaviour must not change: every existing view test passes unedited. Every class name in the views is a literal today (`muted`, `refusal`, `small`, `table-wrap`; checked), so nothing is refused.

## Build (0 new modules, 0 new tests, 7 small edits, rebuild)

For each file: (a) add `import { makeDom } from './ccis-app-dom.js';` after the last import (run view: before the first `const`); (b) replace the whole local `el` block (the range below, 6 lines) with the one line `  const { el, text } = makeDom(document);` (drop `text` from the destructuring where the view has no text node); (c) replace each `document.createTextNode(` with `text(`.

| View | `el` block lines | Last import line | `createTextNode` calls |
|---|---|---|---|
| ccis-app-catalogue-view.js | 16-21 | 8 | 0 |
| ccis-app-export-view.js | 15-20 | 8 | 0 |
| ccis-app-import-view.js | 18-23 | 8 | 1 |
| ccis-app-market-view.js | 13-18 | 7 | 1 |
| ccis-app-results-view.js | 14-19 | 7 | 0 |
| ccis-app-run-view.js | 13-18 | none | 3 |
| ccis-app-selector-view.js | 16-21 | 7 | 1 |

Line numbers shift by one after step (a): do (b) and (c) first, then (a), or re-check with `grep -n`.

Other steps:
1. Header comments that say "createElement and textContent only" stay true; leave them.
2. `status.className = cls ?? 'muted'` in the run view stays (a literal or `refusal` from the view's own code, never data).
3. `ccis-app.js` is not touched (its one `createElement('a')` is the file save, D-182).
4. Run `node scripts/build-app.js` and commit the rebuilt `index.html`. If it grows by more than 20 KB, STOP and report.
5. `DECISIONS.md`: one row at most. Tracker: 3.10.1a done; next is 3.10.1b (chunk file first).

**Not in this row:** a new test (3.10.1b), any change to a model module, the adapter, the build script or the CSP.

**Done when:** these existing files pass unedited: the six `test/ccis-app-*-view.test.js` that exist (catalogue, export, import, results, run, selector; the market view has no view test and is covered by `ccis-app-market.test.js`), `ccis-app-build.test.js`, `ccis-app-bundle-scan.test.js` and `ccis-app-dom.test.js`; and one breakage is seen failing (a view passing a class with a capital letter, rebuilt). Run only those files.

**Size guard:** 0 modules, 0 tests, 7 views edited mechanically, 1 generated page. If any view test needs editing, STOP and report which, since that means behaviour changed.

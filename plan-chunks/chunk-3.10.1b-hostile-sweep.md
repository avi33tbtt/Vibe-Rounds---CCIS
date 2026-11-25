# Chunk 3.10.1b: hostile-string sweep over the five model-fed views (one test, no module, no edit)

_Phase 3, Stage 2. Needs: 3.10.1a (done: every view builds nodes through `ccis-app-dom.js`). No schema change, no core module change, no view change. The two file-fed views (market and import) are the new row 3.10.1c (D-189)._

**Core rules:** attach `01-core.md` too.

**Read only** (copy setup patterns, do not import test files): `test/ccis-app-catalogue-view.test.js` lines 1-30 and 86-93; `test/ccis-app-results-view.test.js` lines 1-30 and 69-76; `test/ccis-app-export-view.test.js` lines 1-25; `test/ccis-app-run-view.test.js` lines 1-40; `test/ccis-app-selector-view.test.js` lines 1-30 and 88-96. Decisions D-063, D-186, D-187.

## What this row is for

Three views already have one `<img src=x onerror=1>` test. Nothing yet proves, for every view with one shared rule, that a hostile string put in any string field the view displays ends as text and nothing else. This row adds that proof for the five views whose input is a plain value handed to the view (catalogue, results, export, run, selector).

## Build (0 modules, 1 new test of at most 8 cases, 0 edits)

New `test/ccis-app-hostile-sweep.test.js`, jsdom, scripts not run:

- `HOSTILE` table at the top: `<img src=x onerror=1>`, `</p><script>alert(1)</script>`, `"><svg onload=1>`, `javascript:alert(1)`, `<a href="javascript:1">x</a>`, and one 3,000-character string of `<`. Data, so adding a string needs no code change.
- `inert(document, root)`: after a view renders, fails (naming the element or attribute kind and a count, never the string) if the page holds any `script style iframe img svg math form object embed link base a` element, any `on*` attribute, any `style` attribute, any `href` or `src` attribute, or any attribute value containing `javascript:`.
- One case per view (5 cases). Each loops over `HOSTILE`, puts the string into every string field the view displays through its public entry point (catalogue `showResult` and `showSentence`; results `show` with ids, labels, scope and notes; export `show` with a model whose file name, checksum and notices hold it; run `setChoices` with id, version and label; selector `setMarket` with id and version, then a pick), and after each renders asserts `inert`. Where the view shows the field, also assert `textContent` contains the exact string.
- Case 6: every `ccis-app-*-view.js` in the repo root is named in a `COVERED` table (five here; market and import marked `row 3.10.1c`). A view file not in the table fails and names the file.
- Failure messages never include a hostile string.

If a view refuses a hostile value through its model before rendering (for example, an id with a space), the case asserts the refusal sentence is fixed text and `inert` still holds; it does not weaken `inert`. If a view cannot be fed a given field without a new test helper over 40 lines, STOP and report which; that is a split point.

**Not in this row:** the market and import views (3.10.1c), any change to a view, the helper or the build, a real browser (3.10a).

**Done when:** the new test passes, and two breakages are each seen failing (in `ccis-app-dom.js` `textContent` changed to `innerHTML`; in `ccis-app-results-view.js` an `onclick` attribute set on one element). Run only the new test file; restore both.

**Size guard:** 0 modules, 1 test (at most 8 cases), 0 edits. Tracker: 3.10.1b done; next is 3.10.1c (chunk file first).

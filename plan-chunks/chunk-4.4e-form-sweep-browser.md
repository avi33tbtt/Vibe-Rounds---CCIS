# Chunk 4.4e: form authoring, part 6: hostile sweep, real-Chrome test, limitations entry (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.4d (done). Tests and one doc line only: no module, page or `index.html` change. If a test finds a real defect, STOP and report it as a new row (do not fix it here)._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `test/ccis-app-form-wire.test.js` lines 1-45 (the `FORM`, `page` and `fill` helpers to copy); `test/ccis-app-draft-browser.test.js` lines 1-75 (the Chrome finder, skip rule, `openPage`, `api`); `test/ccis-app-draft-sweep.test.js` lines 1-12 (header and failure-message rule); `docs/LIMITATIONS.md` lines 44-50 (the LIM format); `test/hostile-kit.js` (`HOSTILE`, `inert`; already known, signature only).

## Test 1: `test/ccis-app-form-sweep.test.js` (jsdom; at most 8 cases)
Both views are mounted over a bare div and joined with the REAL models, as the page does: `draftFromForm`, `previewModel`, `diffArtefacts` (no stubs). Hostile text must reach the DOM as text only, through every route, including the accepted routes (hostile values that the validator still accepts, not only refusals). Failure messages name a string number, never the string.
1. Hostile `name`, `purpose`, `setting`, `population`, `rationale`, `origin`, `basis`, `publisher` in an otherwise valid form: built or refused, never thrown; `inert(root)` passes; accepted text appears unchanged in the preview title or is absent.
2. Hostile field `label`, `units`, `constraints`, `key`: same (preview field rows, validator rows, refusal row).
3. Hostile values given to the kept version and then changed: diff rows carry the text unchanged and `inert` passes.
4. Hostile `types` and `lists` entries (selects and hints) with the results view shown: `inert` passes.
5. A 3000-character string in every input: no throw; row caps hold; `inert` passes.
6. 50 fields of hostile keys: no throw; at most 100 rows per list; Add stays disabled at 50.
7. Neither view ever creates a script, style, iframe, img, svg, form, link or anchor element (count over the whole run).
8. Source of both view files: no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `Function(`.

## Test 2: `test/ccis-app-form-browser.test.js` (real Chrome; at most 6 cases; same skip rule as 4.3b.4)
Open the committed `index.html` (file URL) with `openPage`-style interception: any request other than the file itself is a leak.
1. Type a minimal valid form (as in 4.4c) with real keyboard input; `formState()` becomes `built: true`; the page shows `Built from the form. Status: draft.`
2. The checksum shown equals the one `draftFromForm` gives in Node for the same form (the pure SHA-256 in the bundle matches).
3. Keep, rename, see the `changed manifest.name` row; Forget clears it; reload loses the kept version (`kept: false`).
4. Over the whole run: no leak, no API request, no CSP violation, no console error, no storage keys written (`localStorage.length` and `sessionStorage.length` stay 0).
5. Hostile strings typed into every input: no script ran (a `window.__pwned` flag stays undefined), no dialog opened.
6. A `--ai-origin` build: using only the form sends no request at all (zero API calls and zero preflights).

## Doc edit: `docs/LIMITATIONS.md`
Add **LIM-31** under the same heading as LIM-30 (one short paragraph): a form-built element is a draft, never validated by the form; the validator rows are structural findings, not clinical ones; the kept version is memory only and lost on reload; a form cannot make a `code` field or set a status; diff values show JSON quotes (D-268). Next free number is checked first (`grep -c "LIM-31" docs/LIMITATIONS.md` must be 0).

**Done when:** `node --test test/ccis-app-form-sweep.test.js test/ccis-app-form-browser.test.js` passes (the browser file may skip locally without Chrome, never in CI). Two breakages each seen failing, then restored: (a) draw one hostile label through `innerHTML` in a temporary copy of the results view source (test 1 case 8 fails); (b) make the page write the kept version to `sessionStorage` (browser case 4 fails; Chrome needed, else say it was not run).

**Size guard:** 2 tests (8 and 6 cases), 1 doc edit, no module or page change. If a real defect appears, STOP and add a row.

# Chunk 3.10.1: the shared DOM helper (one module and its test, not wired)

_Phase 3, Stage 2. Needs: 3.10 (done). No schema change, no core module change, no view change. Swapping the seven views onto it is row 3.10.1a; the hostile-string sweep over every view is row 3.10.1b (D-185)._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app-results-view.js` lines 10-35 (the `el` and `list` helpers every view repeats), `test/ccis-app-catalogue-view.test.js` lines 1-20 (jsdom setup). Decisions D-063, D-183.

## What this row is for

Seven views each carry their own copy of `el(tag, content, cls)`. The plan (section 7, row 3.10) calls for one shared escaper. In this app "escaping" means one thing: text only ever reaches the page through `textContent`, never as markup. This row makes that one function, with two guards the copies lack: an allowed-tag list, and a class-name pattern so a string from a run record can never become a tag or a class.

## Build (1 new module, 1 new test, 0 edits, no rebuild)

1. New `ccis-app-dom.js`, pure apart from the `document` it is given (no global lookup), exporting:
   - `ALLOWED_TAGS`: a frozen list of exactly the tags the views use today: `a br button details div h2 h3 h4 input label li option p select span strong summary table tbody td th thead tr ul`.
   - `makeDom(document)` returning `{ el, text }`.
   - `el(tag, content, cls)`: refuses a tag not in `ALLOWED_TAGS` (throws `Error('dom-tag-refused')`, no tag name in the message); creates the element; if `content !== undefined` sets `textContent = String(content)`; if `cls` is given it must match `/^[a-z][a-z0-9-]{0,30}$/` (words joined by single spaces allowed, at most 3), otherwise throws `Error('dom-class-refused')`; sets no other attribute.
   - `text(content)`: a text node of `String(content)`.
   - `refuseNames`: the two error messages, exported so tests do not retype them.
2. New `test/ccis-app-dom.test.js`, at most 8 cases, jsdom, scripts not run:
   - hostile strings (`<img src=x onerror=1>`, `</p><script>`, `"><svg onload=1>`, `javascript:alert(1)`) come back as one text node, zero child elements, and `innerHTML` of the parent re-escaped shows `&lt;`.
   - non-string content (number, null, object with `toString`) is stringified; `undefined` leaves the element empty.
   - every tag in `ALLOWED_TAGS` is created; `script`, `style`, `iframe`, `img`, `form`, `object`, `embed`, `link`, `base`, `svg`, `math` are refused.
   - a class that is hostile (`x onclick=1`, `A`, a 40-character name, an empty string with a space, four words) is refused; `muted`, `refusal`, `needs-data` pass.
   - the element has no attributes except `class` when one was asked for.
   - source scan of `ccis-app-dom.js`: no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `setAttribute`, `eval`, `Function`, `import(`, `fetch`; a failure names the pattern and count only.
3. `DECISIONS.md`: at most one row. Tracker: 3.10.1 done; next is 3.10.1a (chunk file first).

**Not in this row:** touching any view or `ccis-app.js` (3.10.1a), a real browser (3.10a), a trusted-types directive.

**Done when:** `test/ccis-app-dom.test.js` passes and two breakages are each seen failing (`script` added to `ALLOWED_TAGS`; the class pattern loosened to `/./`). Run only the new test file.

**Size guard:** 1 module (about 1 KB), 1 test, 0 edits. If the class rule needs more than the pattern above, stop and report.

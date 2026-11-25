# Chunk 3.10.1c: hostile-string sweep over the two file-fed views (market and import)

_Phase 3, Stage 2. Needs: 3.10.1b (done: `test/ccis-app-hostile-sweep.test.js`). No schema change, no core module change, no view change (D-189)._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-app-market-view.js` lines 13-79; `ccis-app-market.js` lines 22-100 (`marketInputFromFiles`, `loadFromFiles`, `marketView`, `refusalView`); `ccis-app-import-view.js` lines 18-100; `test/ccis-app-hostile-sweep.test.js` lines 1-55 (`HOSTILE`, `COVERED`, `inert`). Do not read `ccis-market.js` or the import report: the test is black box.

## What this row is for

The market and import views read files, so hostile strings reach them as file text, file names, index members and envelope members rather than as plain values. This row proves the same rule for them (hostile input ends as text, nothing else) and the stricter one the plan sets for imports: a refused envelope never quotes what it refused. The market view has no view test of its own yet, so this is also its first jsdom test.

## Build (1 new test helper, 1 new test of at most 8 cases, 1 small edit)

1. New `test/hostile-kit.js` (test support, no logic beyond these): exports `HOSTILE` and `inert(root, where)` moved verbatim from `test/ccis-app-hostile-sweep.test.js`, plus `feedFiles(w, input, files)` which sets `input.files` with `Object.defineProperty` to fake File objects (`{ name, size, webkitRelativePath, text: async () => ... }`), dispatches `change` and waits one `setTimeout(0)` for the view's async handler.
2. Small edit to `test/ccis-app-hostile-sweep.test.js`: import `HOSTILE` and `inert` from the kit instead of defining them, and change the two `COVERED` notes `'row 3.10.1c'` to `'ccis-app-hostile-sweep-files.test.js'`. Its 7 cases stay and must pass.
3. New `test/ccis-app-hostile-sweep-files.test.js`, jsdom, scripts not run, at most 8 cases:
   - market, loaded: take the committed `market/` folder as file items (`market/index.json` plus each file, paths prefixed `market/`), set every index entry's `status` and `validation.outcome` to each `HOSTILE` string (neither is in a file's checksum, and canonical order is unchanged), feed it; assert the table loaded, `inert`, and that short hostile strings appear as cell text.
   - market, refused with a hostile id and version: an index entry whose `id` and `version` are hostile and whose file is missing; assert the refusal shows, `inert`, and the `id:` and `version:` detail lines appear as text, cut at 120 characters (this is artefact metadata the plan allows `refusalView` to show; D-191 records it).
   - market, hostile paths: `webkitRelativePath` values from `HOSTILE` give a refusal with only the fixed `code: bad-path` line; assert the path string is never echoed and `inert` holds.
   - import, hostile members: the committed fixture `ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json` with `x-` member names built from each `HOSTILE` string added at the top level and inside one record; feed it with the committed market held; the outcome is read or refused; assert `inert` either way, and that a refusal sentence never contains any hostile string.
   - import, hostile values: the same fixture with each `HOSTILE` string set in `producer.system`, `producer.version`, `exportedAt` and one record id; read or refused, assert `inert` either way and no echo in a refusal.
   - import, not JSON: a file whose text is each `HOSTILE` string gives the fixed "not valid JSON" sentence and never echoes the text.
   - the coverage case from 3.10.1b still passes with the new notes.
   - failure messages never include a hostile string.
4. `DECISIONS.md`: one row (D-191 or the next free number). Tracker: 3.10.1c done; next is 3.10a (chunk file first, owner approves the dependency).

If the committed market cannot be fed through `input.files` in jsdom without a helper over 40 lines, STOP and report. If a hostile string reaches the page as an attribute or element in any case, STOP and report the view and field: that is a real finding, not a test to weaken.

**Not in this row:** any change to a view or the helper, a real browser (3.10a).

**Done when:** the two sweep test files and `ccis-app-dom.test.js` pass, and two breakages are each seen failing (in `ccis-app-market-view.js` one table cell set through `innerHTML`; in `ccis-app-import-view.js` the refusal path made to echo `parsed`). Run only those files. Restore both.

**Size guard:** 1 test helper, 1 test (at most 8 cases), 1 small edit to an existing test.

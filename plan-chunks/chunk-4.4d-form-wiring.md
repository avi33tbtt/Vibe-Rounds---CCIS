# Chunk 4.4d: form authoring, part 5: wire the form into the page (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.4 to 4.4c.1 (all done). No new module: the page joins the two views to the pure models, keeps one previous version in memory only, exposes `formState()`, and `index.html` is rebuilt. Same shape as row 4.3b.2._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `ccis-app.js` lines 14-34 (imports, seam objects) and 176-205 (the draft wiring and `window.ccisApp`); `ccis-app.template.html` lines 18-28 (the sections); `test/ccis-app-draft-wire.test.js` lines 1-45 (a page test that loads `index.html` in jsdom); `ccis-app-form.js` lines 13-14 and the export line of `draftFromForm` (signature only).

## Edits
1. `ccis-app.template.html`: add `<section id="form"></section>` after `draft`, and inside it nothing else. The keep control is made by the page script from `makeDom`-style code in `ccis-app.js`: one button `Keep this version for comparison` and one button `Forget kept version` (type button, no handlers in markup).
2. `ccis-app.js`:
   - Imports: `mountFormView`, `mountFormResultsView`, `draftFromForm`, `previewModel`, `diffArtefacts`, `FORM_TYPES`, `EPISTEMIC_STATES`, `SOURCE_CLASSES`, `TIME_SEMANTICS`.
   - Seam: `const formed = { fields: 1, touched: false, built: false, refused: false, rows: 0, kept: false }` (booleans and whole numbers only).
   - Mount both views into `#form` (results view in its own `div` made by the page). `onForm(form)`: `draft = draftFromForm(form)`; `preview = draft.ok ? previewModel(draft.spec) : null`; `diff = draft.ok && keptCanonical ? diffArtefacts(keptCanonical, draft.canonical) : null`; `results.show({ draft, preview, diff })`. Wrap in try/catch: on any thrown error show a refused draft `{ ok: false, sdk: { code: 'page', path: '', sentence: 'The form could not be processed.' } }`.
   - `keptCanonical` is a module variable (a string, or `null`). Keep stores `draft.canonical` of the last accepted build; Forget sets `null`; both re-run the comparison. Nothing is written to storage and no timer is used; Reload loses it (said in the section hint line).
   - `onState` of both views feeds `formed`: `fields`, `touched` from the form view; `built`, `refused`, `rows` from the results view; `kept` is `keptCanonical !== null`.
   - `window.ccisApp.formState = () => ({ ...formed })`. The page never calls a publish, export, save or network function for the form.
3. The five existing wire tests that list the `ccisApp` keys (`catalogue`, `export`, `import`, `results`, `run`) each gain `'formState'` (sorted position). One word each.
4. Rebuild: `node scripts/build-app.js`, then `--check` must match.

## Test: `test/ccis-app-form-wire.test.js` (at most 8 cases; jsdom loads `index.html`)
1. `#form` mounts: one field card, fixed status line, `formState()` is `{ fields: 1, touched: false, built: false, refused: false, rows: 0, kept: false }` shape (only booleans and whole numbers).
2. A blank form shows the refused line and `refused: true`; no checksum.
3. Filling a minimal valid form (as in 4.4c) shows `Built from the form. Status: draft.`, a checksum equal to `ccisApp.checksumOf`-compatible output of `draftFromForm` run in the test, and `built: true`.
4. Keep, edit the name, see a `changed manifest.name` row and `kept: true`; Forget returns `No previous version kept.`
5. Same form typed twice gives the same checksum (determinism).
6. Hostile strings typed into every input: `inert(root)` passes; the page does not throw; `formState` holds no string.
7. No request is made while the form is used (stub `window.fetch`; zero calls) and no `localStorage` or `sessionStorage` write (spy).
8. `Object.keys(w.ccisApp)` includes `formState`; no `on*` attribute anywhere in the page.

**Done when:** `node --test test/ccis-app-form-wire.test.js` and the five edited wire tests pass; `ccis-app-bundle-scan` passes; `build-app.js --check` matches. Two breakages each seen failing, then restored: (a) store the kept version in `localStorage` (case 7 fails); (b) diff against the current build instead of the kept one (case 4 fails).

**Size guard:** 0 new modules, 1 test (8 cases), edits to `ccis-app.js` (about +30 lines), the template and 5 tests, plus the rebuild. If `ccis-app.js` grows past 260 lines, STOP and move the form wiring into a new `ccis-app-form-wire.js`.

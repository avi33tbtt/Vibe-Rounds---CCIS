# Chunk 4.3b.3: governed AI drafting, part 6: hostile-string sweep of the draft view and the limitations entry (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.3b.1 and 4.3b.2 (done). The real-Chrome test that the committed page sends no request is split off as row 4.3b.4 (rule 12). The brief's "bundle scan allowance" is not needed: `test/ccis-app-bundle-scan.test.js` already passes with the draft view in the bundle (the client takes an injected `fetch`, so no `fetch(` appears). That test stays unchanged (D-256)._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `ccis-app-draft-view.js` lines 60-109 (the handlers and `show`); `ccis-app-draft.js` lines 49-59 (`draftModel` and the draft shape it reads); `test/ccis-app-draft-view.test.js` lines 1-40 (jsdom rig and the stub `draft`); `test/hostile-kit.js` (whole, 38 lines: `HOSTILE`, `inert`); `test/ccis-app-hostile-sweep.test.js` line 22 (the `COVERED` entry).

## Build (0 modules, 1 test, 1 one-word edit, 1 doc edit)
1. `test/ccis-app-draft-sweep.test.js` (new, at most 8 cases, jsdom over a bare div, `mountDraftView` with a stub `draft` and fixed `types` and `kinds`). Failure messages name a string number, never the string.
2. `test/ccis-app-hostile-sweep.test.js` line 22: point `'ccis-app-draft-view.js'` at `'ccis-app-draft-sweep.test.js'` (was `ccis-app-draft-view.test.js`). Nothing else in that file changes.
3. `docs/LIMITATIONS.md`: one new entry `LIM-30` in the first (limits) list, after LIM-23 (see the text below).

## Test cases
For every `HOSTILE` string `h` (loop, string number in the message):
1. **Reply text:** the stub returns `ok: true` with a draft whose `label`, one member name and one trace source or assumption note are `h`. The view ends as text: `inert(root)` passes, and the hostile string appears only inside `td` or `p` text.
2. **Typed fields:** `h` typed into instruction, citation, passage and model. The stub records them unchanged; `inert(root)` passes; the output and status hold none of them.
3. **Refusal members:** the stub returns `ok: false` with `sentence`, `code` and `path` equal to `h`. `inert(root)` passes and the status holds them as text only (the view does not cut or filter them; see D-257).
4. **Throwing stub:** the stub throws `h` plus the typed key. The fixed defect sentence shows; the page text holds neither `h` nor the key.
5. **Option text:** `h` as a `types` entry and as a `kinds` entry: option text and values stay text, `inert(root)` passes, the view still mounts.
6. **Long input:** a 3000-character instruction and passage: Draft works, no throw, the rows are unchanged.
7. **Seam:** after cases 1 to 6 every `onState` value is a boolean or a whole number; no key, instruction, passage or sentence appears in any of them.
8. **Key hygiene:** the key input is empty after a good reply, a refusal and a throw; the key is absent from `innerHTML`.

## LIM-30 text (one entry, three sentences at most)
"AI drafting (row 4.3): you paste your own model key into the page. It sits in a password field until the click, then is cleared, but a browser extension or a hostile page script could read it, so use a key with a small spending limit. A draft's source trace names the source and citation only, not the passage span, and a refusal may quote a member path taken from the model reply."

**Done when:** `node --test test/ccis-app-draft-sweep.test.js` passes (new file only); the `COVERED` check in `ccis-app-hostile-sweep.test.js` passes. Two breakages each seen failing, then restored: (a) render `m.label` with an HTML-parsing call in the view (case 1 fails); (b) skip `key.input.value = ''` after the throw path (case 8 fails).

**Size guard:** 1 test file (about 110 lines), 0 modules, 1 one-word edit, 1 doc edit. If a module change looks needed (for example to cut the quoted `path`), STOP and add it as a new row instead.

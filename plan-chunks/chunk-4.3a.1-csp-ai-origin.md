# Chunk 4.3a.1: governed AI drafting, part 2b: open `connect-src` to the model API origin, only in an opt-in build (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.3a (done) and 4.1a (done). Same idea as 4.1a: the committed `index.html` keeps `connect-src 'none'` and is never touched; a **different**, deliberately built file may allow requests to the one origin the AI adapter calls. No view, no page logic and no UI change (4.3b). Decision D-248: the user pastes their own key; the key can then only ever be sent to the one allowed origin, because the CSP blocks every other request._

**Core rules:** attach `01-core.md`. Rule 12: 1 script edit of at most 12 lines, a NEW test `test/ccis-app-build-ai.test.js` (at most 8 cases). No new module, no new dependency.

**Read only (4 files):** `scripts/build-app.js` lines 1-8 and 38-66 (`buildApp`, `main`, the usage comment); `ccis-app-ai.js` lines 8-10 (`AI_ORIGIN`); `test/ccis-app-build-base.test.js` lines 1-30 (helpers, `directive()` to copy); `test/ccis-app-bundle-scan.test.js` lines 51-58 (reads the committed page only). Do not read other tests.

## Build (1 script edit)
In `scripts/build-app.js`:
1. `import { AI_ORIGIN } from '../ccis-app-ai.js'` (a pure module; it is not in the page bundle until 4.3b).
2. `buildApp({ marketBase, aiOrigin } = {})`: with no option, byte-identical to today. `aiOrigin` must equal `AI_ORIGIN` exactly (any other value, a path, a trailing slash or a different host throws `Error('ai origin is not acceptable')`, fixed text, never quoting the input). The `connect-src` value becomes the list of what was asked, in this order and space-separated: `marketBase` (if given), then `aiOrigin` (if given); with neither it stays `'none'`. Nothing else in the CSP, the script, the style or their hashes changes.
3. `main`: `--ai-origin <url>` is accepted only together with `--out <file>` (same rule and same message as `--market-base`: `a distribution build needs --out`, return 1, write nothing). It may be combined with `--market-base`. `--check` works with every combination. A bad origin prints the fixed text and returns 1, writing nothing. Update the usage comment in the file header.

## Test: `test/ccis-app-build-ai.test.js` (at most 8 cases)
1. the default `buildApp()` equals the committed `index.html` and its `connect-src` is `'none'`;
2. with `aiOrigin: AI_ORIGIN`, `connect-src` is exactly that origin, once; every other directive equals the default build's; putting `'none'` back gives a page byte-identical to the default build;
3. with both options, `connect-src` is `<marketBase> <AI_ORIGIN>` in that order; with only `marketBase` it equals the 4.1a result;
4. these origins throw the fixed text: `http://api.anthropic.com`, `https://api.anthropic.com/`, `https://api.anthropic.com/v1/messages`, `https://api.anthropic.com.evil.test`, `https://*.anthropic.com`, `*`, an empty string, a space inside, `https://api.anthropic.com; script-src *`;
5. `main(['--ai-origin', X])` without `--out` returns 1 and writes nothing; with `--out <temp>` returns 0 and the file holds the origin; a bad origin returns 1 and writes nothing;
6. `--check` with the same options returns 0; after one byte of the file changes it returns 1;
7. the distribution CSP has no `*`, no `unsafe-`, no `data:`, no `blob:`; `default-src 'none'`, `script-src 'sha256-...'` and `object-src 'none'` are kept; the page's script and style are byte-equal to the default build's;
8. the committed page's bytes are equal before and after cases 5 and 6.

**Done when:** `node --test test/ccis-app-build-ai.test.js test/ccis-app-build-base.test.js` passes and `node scripts/build-app.js --check` still matches. Two breakages each seen failing, then restored: (a) let `aiOrigin` accept any `https:` origin; (b) let `--ai-origin` write the committed page without `--out`.

**Known limit (add to D-248 notes):** a CSP allows an origin, not one function. In a distribution build any script that is in the page could send to that origin; the strict script rule, the hash and the hostile-string sweeps are what keep other code out.

**Size guard:** 1 script edit, 1 test, tracker and DECISIONS only. If the existing `buildApp` signature cannot take a second option without changing its default output, STOP and report.

# Chunk 3.9b: pure run record export and verification line (no DOM, not wired)

_Phase 3, Stage 2. Needs: 3.9a.2 (done). No schema change, no core module change. F-11 stays open (D-143)._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-run.js` lines 278-288 (`verifyRecord`), `ccis-cli-flow.js` lines 113-125 (`canon`, `writeOnce`) and the `run` command lines that write the record (grep `writeOnce(o['--out']`), `ccis-compile.js` lines 203-221 (`canonicalize`, `checksumOf`). Decisions D-134, D-143, D-173.

## What this row is for

One pure function turns a run record into the exact file text the person can save, a file name, a checksum of that text and a verification line. Nothing is downloaded or drawn here. Row 3.9b.1 adds the button.

## Build (1 new module, 1 test, 0 edits)

`ccis-app-export.js`, pure ES module (no DOM, clock, network, storage, randomness). Imports `canonicalize` and `checksumOf` from `./ccis-compile.js` and `verifyRecord` from `./ccis-run.js` (both already in the bundle). Exports frozen `EXPORT_SENTENCES` and `exportModel(record)`.

`exportModel(record)` returns `{ ok: false, sentence }` or `{ ok: true, filename, text, bytes, checksum, verification, notices }`:

1. Not an object, or `canonicalize` refuses: `{ ok: false, sentence }` with "No run to export." or "The record could not be put in canonical form." (never echo an error message).
2. `text` is `` `${canonicalize(record).text}\n` ``: the same bytes the CLI `run --out` writes, so `node ccis-cli.js show` reads it. `bytes` is the UTF-8 length (`TextEncoder`). `checksum` is `checksumOf(text)`.
3. `filename` is `<record.id>.json` when `id` matches `^run-[0-9a-f]{64}$`, else `ccis-run-record.json`. A failed record exports too (it holds its reason).
4. `verification` is `{ ok, line }`, computed on the exported text, not the object: parse `text`, run `verifyRecord`. Lines, exactly: "Verified: id and results checksum match." or "Not verified: " followed by the problem words (`schema`, `id`, `results`, `unreadable`) joined by ", ". The ok line never says "context", "snapshot", "all" or "intact", because F-11 means a changed `context` byte still verifies. Parse failure gives "Not verified: unreadable."
5. `notices`: always "This file holds the input snapshot. Synthetic data only. Not for clinical use." and, when `record['x-testOnly'] === true`, "Test-only parameters. Not clinical values."

The input is never mutated; the same record gives byte-identical output.

**Not in this row:** any download, button, DOM or wiring (3.9b.1, which will probably split into a view row and a wiring row), a fix for F-11, a change to the model, run view or adapter.

**Test (`test/ccis-app-export.test.js`, at most 8 cases):** real `market/`, `boundary-01-edge-inside.envelope.json` and `runForPage`, as the 3.9a test does.
- text equals `` `${canonicalize(record).text}\n` ``; `JSON.parse(text)` passes `verifyRecord`; `bytes` equals the UTF-8 length; `checksum` starts `sha256:`.
- filename is `<id>.json`; a hostile id (`../x`) gives `ccis-run-record.json`.
- the verified line is exactly the fixed sentence; a copy with one changed result value gives "Not verified: results" (the id is recomputed from inputs, so also check "id" is not listed when only results changed).
- F-11 honesty: a copy with one changed `context` byte still verifies, and the line contains none of "context", "snapshot", "intact", "all".
- a failed record exports; `null`, `undefined` and `{}` give the fixed sentences.
- the notices hold the snapshot line; a test-only copy adds the second.
- determinism: two calls give identical JSON; the input is deep-equal before and after.
- source scan: no `document`, `window`, `fetch`, `localStorage`, `Date`, `Math.random`, `innerHTML`, `eval`.

**Done when:** the new test passes (run only that file) and two breakages are each seen failing (verification run on the object instead of the parsed text with a changed result; the ok line reworded to say "all fields verified").

**Size guard:** 1 module, 1 test, 0 edits. If it will not fit, split the verification line into 3.9b.0.

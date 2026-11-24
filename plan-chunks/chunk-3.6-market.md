# Chunk 3.6-market: the local test marketplace (`ccis-market.js`)

_Phase 3, Stage 2 (written 2026-11-24). Needs: 2.4 (done). This chunk file is docs only; the module is built at the next "do next" after the owner approves it. No schema change and no spec amendment is proposed (REQ-080, 081, 093, 094 already say what is needed)._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-compile.js` (`compileArtefact`, `canonicalize`, `checksumOf`, `verifyChecksum`, `CANONICAL_FORM`); `ccis-validation-record.js` (`buildValidationRecord`); `ccis-validator.js` (`validateArtefact` options `known` and `fixtures`, `satisfiesRange`, `compareSemver`); `ccis-compat.js` (what `held` documents look like, `executionPolicy` statuses); `ccis/schemas/manifest.schema.json` (`status` list); `ccis/SPEC.md` CCIS-REQ-064, 065, 080, 081, 093, 094 and amendment A-005; `scripts/demo-batch.js` (style of a script that writes files); the snake artefacts in `ccis/examples/snake/`; decisions D-002, D-010, D-099, D-102, D-103 and the 2.4 answers (lone nodes and bindings refused).

## What this row is for

A place where validated, checksummed packages are **published**, **resolved** by id and version range, and **pinned** by checksum, and where anything that looks like patient data is refused. It is local: no server, no network (D-002, D-010). It is the same shape the later GitHub-hosted marketplace will have (row 4.1), so the client code does not change. It does not run packages (3.5), find compatible packages for a context (3.2 does that over what this row resolves), or have a command line or a browser view (3.7, 3.8).

## What earlier rows found (the build must handle each)

1. **Only artefacts with a manifest can be published.** The compiler refuses lone decision nodes and terminology bindings (2.4, D-099). So the publishable types are the contextual element, the analytics package and the pathway (which embeds its nodes). Bindings and nodes wait for the owner's D-099 decision.
2. **Reference integrity needs the other artefacts.** Layer 3 checks references against `known`, and layer 7 (test verification) needs `fixtures` (case names). Publishing therefore compiles with `known` taken from what is already published plus the one being published, so an analytics package cannot be published before its element, nor a pathway before its analytics.
3. **A checksum proves the same bytes, not who published them or that they are safe** (A-005). Signing stays with row 6.2; nothing here may be worded as "trusted" or "verified safe".
4. **"Pin with no checksum where one is required blocks use" (REQ-094).** A pin without a checksum is refused, not defaulted to the latest.
5. **The validator warns about things the author should see** (compile `warnings`). They are kept in the index entry, not dropped.
6. **Free text and extension members are where patient data would hide**, because the schemas already refuse unknown members elsewhere. The lint must look inside `x-` members and every string.
7. **Patient data never leaves the device** (REQ-079, 085): the index and artefacts hold definitions only, and no function here takes a context, an envelope or a run record.
8. **No clock.** The index records no publication time. Order is by id and version.

## The design (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

`ccis-market.js` is a pure module (no file, clock, network, randomness, eval, dynamic import). It imports only the committed modules named above. A **market** is a plain value, `{ index, files }`: `index` lists entries and `files` maps a relative path to the exact canonical text. Functions return a new market and never change the one given. Reading and writing the folder is done only by a small script (see Build), so the core stays testable and the browser can reuse it.

- **Layout** (`market/`, the same as the future marketplace repo): `market/index.json` (entries sorted by id then version) and `market/artefacts/<id>/<version>.json` (the canonical bytes, no trailing newline, so `sha256sum` of the file equals the checksum).
- **Index entry:** `id`, `type`, `version`, `checksum`, `canonicalForm`, `compiler`, `standard`, `status` (the manifest's own, never upgraded), `path`, `warnings` (rule ids and paths), `validation` (outcome per layer, validator name and version: the 2.3a record, without any clinical claim), `references` (the exact id, type and range each artefact names). No author prose, no timestamps.
- `publishArtefact({ market, artefact, fixtures })` returns `{ ok: true, market, entry }` or `{ ok: false, refusal }`. In order: lint (below); compile with all eight layers using `known` from the market plus this artefact; the type must be element, analytics or pathway; the manifest status must not be `rejected` or `withdrawn` (a withdrawn version is published as a new version, not by deleting); then add. **Releases are immutable:** the same id and version with the same checksum is a no-op that returns the existing entry; with different bytes it is refused.
- `lintArtefact(artefact)` returns `{ ok, findings }`; each finding is `{ id, path }` and never contains the offending value. Rules `L-001` and up: a member named like a patient record (patient, mrn, date of birth, address, phone, email, nhs or national id, and the like), a member named like a cohort or its membership, an envelope-shaped object (`observations` and `events`, or a `case` with a `ref`), a string that looks like an email, a phone number, a long digit run (8 or more) or a date of birth phrase, an `x-` member holding any of these. The lint is a screen, not a proof: it can miss data and can refuse a harmless string; a refusal names the rule and path so the author can reword.
- `resolve({ market, ref })`: `ref` is `{ id, type, range }` or `{ id, type, version }`. Returns the highest satisfying version whose status is not `rejected` or `withdrawn`; `deprecated` is returned and flagged (3.2 reports it); no match is a refusal with a fixed sentence. It also returns the parsed artefact.
- `heldFrom({ market, refs })` returns the parsed artefacts for `resolveCompatibility` and `planRun` (their `held` argument).
- `pin({ market, ref })` returns `{ id, type, version, checksum }`. `verifyPin({ market, pin })` re-hashes the stored text and checks it against the pin and against the index: a missing checksum, an unknown version, a changed byte or an index that disagrees with its file each block use (`M-` ids), with fixed sentences and no echo of file content.
- `loadMarket({ indexText, files })` verifies every file against its index entry on load; any mismatch or an unlisted file refuses the whole market (nothing partial is used). Same input gives byte-identical `index.json` text.
- Refusal ids `M-001` and up (shape, type not publishable, status not allowed, lint refused, compile refused with the layer, version already published with different bytes, no version satisfies the reference, pin has no checksum, checksum mismatch, index and file disagree, unlisted file).

## Build

1. New file `ccis-market.js` (about 300 to 350 lines).
2. New `scripts/market-build.js` (about 50 lines): the only file here that touches disk. `node scripts/market-build.js` publishes the snake element, the analytics (both versions) and the pathway, in dependency order, into `market/`; `--check` rebuilds in memory and fails if the folder differs. No network.
3. New `market/` (generated by the script and committed): `index.json` and the artefact files.
4. New `test/ccis-market.test.js`:
   - (a) **The real market:** the committed `market/` loads; every entry's checksum equals the independently calculated checksum in `ccis/fixtures/compile/expected-checksums.json` for the files it has; `--check` passes; the packages resolve and feed `resolveCompatibility` and `planRun` (3.2 and 3.5), giving the same compatibility outcomes as when given the example files directly.
   - (b) **Publish:** dependency order enforced (analytics before its element is refused with the layer named); same bytes twice is a no-op; same id and version with different bytes is refused; `rejected` and `withdrawn` refused; a bad artefact (one of the 1.6 invalid examples) is refused and nothing is added; an artefact that is not an object, a lone node and a lone binding are refused; the input market is not changed.
   - (c) **Lint:** each `L-` rule reached once, in a member name, in an `x-` member and in free text; findings carry paths, never values (a sentinel string never appears in any refusal); the 9 snake artefacts all pass (no false positive).
   - (d) **Resolve and pin:** highest version in range; `deprecated` flagged; `rejected` and `withdrawn` skipped; no match refused; a pin names an exact checksum; every `M-` pin and load refusal reached once, including one changed byte in a stored file and an index entry edited to match a different checksum.
   - (e) **Purity and determinism:** the pure-library scan covers `ccis-market.js` (imports only the committed modules); two builds give identical bytes; nothing passed in is mutated (inputs deep-frozen); no function accepts a context, envelope or run record.
5. `README.md` (one paragraph: the local marketplace), `DECISIONS.md` (at most three rows), tracker (3.6 as built; 3.7 next).

**Not in this row:** signing and publisher identity (6.2); a GitHub client, network access or releases (4.1); publishing nodes, bindings, fixtures or run records; unpublish or delete; search, ranking or a catalogue view (3.8); the CLI (3.7); any schema or spec change.

## Questions for the owner (defaults apply if you only say "approve")

1. Keep the core pure (a market is a value) with one script that writes `market/`, and this layout (`index.json` plus `artefacts/<id>/<version>.json` in canonical bytes)? Default: yes.
2. Publishable types are element, analytics and pathway only; nodes, bindings and fixtures stay out of the marketplace in 0.1.0 (D-099 stays open)? Default: yes.
3. Releases are immutable: same bytes again is a no-op, different bytes under the same id and version is refused, and there is no unpublish (a withdrawal is a new version with status `withdrawn`)? Default: yes.
4. The patient-data lint is a structural and narrow-pattern screen that names rule and path and never the value, refuses on any finding, and says in its own documentation that it cannot prove the absence of patient data? Default: yes.
5. `resolve` takes the highest satisfying version that is not `rejected` or `withdrawn`, shows `deprecated` with a flag, and a pin is exactly `{ id, type, version, checksum }` where a missing checksum blocks use? Default: yes.

**Done when:** the committed `market/` loads and `--check` passes, the 9 snake artefacts publish and pass lint, every `M-` and `L-` id is reached once, and three deliberate breakages (skip the checksum check in `verifyPin`; let a second publish of the same id and version overwrite; make the lint ignore `x-` members) are each seen failing a test. The owner runs or skips the full `npm test` as instructed in that session.

**Size guard:** one new module, one script, the generated `market/` folder, one new test file, README, DECISIONS, tracker. If the module passes about 400 lines, split the lint into row `3.6a` (`ccis-lint.js`).

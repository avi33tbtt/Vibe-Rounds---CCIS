# Chunk 2.4-compiler: Compiler (canonical form, checksum, equivalence harness, fail closed)

_Phase 2, Stage 2 (written 2026-11-24). Needs: 2.3 and 2.3a (done). This chunk file is docs only; the compiler is built at the next "do next" after the owner approves this file. It also proposes amendment A-005 (gap G-05), approved by approving this file, as A-001 and A-002 were._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-validator.js` (`validateArtefact`, `options`: `schema`, `known`, `fixtures`; result `outcome`, `layers`); `ccis-validation-record.js` (`buildValidationRecord`, refusal reasons); `ccis-demo-record.js` (`canonicalJson`, only to compare bytes, not to import); `ccis-cli.js` (`validateMain`, exit codes); `ccis/schemas/manifest.schema.json` (`artefactId`, `artefactType`, `reference`); `ccis/examples/snake/` (the 9 valid files); `ccis/SPEC.md` REQ-009, 014, 064, 065, 067, 086, 088; `docs/TRACEABILITY.md` (G-05 and the lines for REQ-064, 065); `ccis/CHANGELOG.md` (amendment format).

## What this row is for

Turn one validated artefact into its **canonical bytes** and a **checksum** over them, so that (a) the same artefact reached by any authoring route gives identical bytes (REQ-086, 067), (b) a pin can later name an exact artefact (REQ-064), and (c) nothing is produced when the artefact is not sound (REQ-065, fail closed). Pure functions: no network, no file access, no clock, no randomness. The same input gives byte-identical output.

## What earlier rows found (the build must handle each)

1. **One route exists today.** Authoring is hand-written JSON. The code SDK is row 4.2, the form GUI 4.4, FHIR Mode 6.1. So this row builds the **harness** and proves it on stand-ins (below), and says plainly that they are stand-ins. Real routes plug into the same harness later.
2. **Nodes and bindings have no manifest** (D-099): a decision node has `id` but no version; a terminology binding has neither. They cannot be named by version, so a lone node or binding is **refused** (C-008), as 2.3a refuses to write a record for them. Whether they get a manifest is the owner's open item from D-099, not decided here. 6 of the 9 valid snake files can compile.
3. **Artefacts reference each other, never embed** (REQ-014). A compiled pathway is therefore not yet runnable alone. This row compiles **one artefact at a time**; a bundle of pinned artefacts is for the executor's rows (3.x). Dependencies are checked through the validator (`options.known`, layer 3 and 5), which is how REQ-065 is met here.
4. **Layer 1 does not detect duplicate member names.** `JSON.parse` keeps the last one silently, so two routes could differ unseen. The compiler's text route detects them itself (C-002). Adding a validator rule for it is a possible later row (`2.4a`), not done here.
5. **`ccis-demo-record.js` `canonicalJson`** sorts keys but accepts anything. The compiler writes its own strict version and a test proves its text equals `canonicalJson` on every valid example, so old run-record bytes stay valid. The demo module is not imported (it is replaced in Phase 3).

## Decisions this chunk proposes (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

- **Canonical form `ccis-canonical-json/1`.** UTF-8 JSON text, no insignificant whitespace, member names sorted in code-unit order, **array order kept** (never sorted), numbers written as JavaScript writes them (`-0` as `0`; `1.0`, `1e0` as `1`), strings as `JSON.stringify` writes them, `x-` members **kept and covered**, no defaults filled in, no trailing newline. Any change to this form is a new form id.
- **Checksum.** `sha256:` followed by 64 lower-case hex characters, over the canonical bytes. The checksum is **never stored inside the artefact** it covers (a self-reference cannot be computed). It lives in the compiled metadata and later in index entries and pins. It proves the bytes are the same bytes; it says nothing about who published them or whether they are clinically safe (signing is row 6.2).
- **Compile = validate, then canonicalise, then checksum, all or nothing.** `compileArtefact(input, options)` runs the existing pipeline with the same options, requires all eight layers `passed`, then canonicalises. Any failure returns `{ ok: false, reason, code, diagnostics }` and **no bytes, no checksum**. Warnings do not block; they are carried (rule ids, counts) so that a marketplace row can choose to demand none. A missing `fixtures` option stays the layer 7 "not checked" warning (unknown is not a pass).
- **Amendment A-005 (gap G-05, package integrity; words for the owner).** Two requirements are added, numbered with the next free numbers: **CCIS-REQ-093** a compiled artefact MUST carry a checksum computed over its canonical bytes, naming the algorithm and the canonical-form version; the checksum is not held inside the artefact. **CCIS-REQ-094** a consumer (importer, marketplace client, engine preflight) MUST verify a pinned checksum before use; a mismatch, or a pin with no checksum where one is required, blocks use. Signing and publisher identity are deferred to row 6.2. `ccis/SPEC.md` text is not edited; the amendment entry in `ccis/CHANGELOG.md` is the amendment, and `docs/TRACEABILITY.md` G-05 is marked closed.

## Build

1. `ccis-compile.js` (pure; the only import is `createHash` from `node:crypto`, which is deterministic; row 3.7 must give the same bytes in the browser through Web Crypto, using the vectors below). Exports:
   - `CANONICAL_FORM` (`ccis-canonical-json/1`), `COMPILER` (`{ name: 'ccis-compile', version: '0.1.0' }`).
   - `canonicalize(input)` -> `{ ok: true, text }` or `{ ok: false, code, reason, path }`. Accepts JSON text or an in-memory value. For text it first scans for duplicate member names, unsafe numbers and bad Unicode; for in-memory values it refuses non-JSON values.
   - `checksumOf(text)` -> `sha256:<hex>`; `verifyChecksum(text, checksum)` -> `{ ok, reason }` (length, prefix, case and hex checked; unknown algorithm refused).
   - `compileArtefact(input, options)` -> `{ ok: true, compiled }` or `{ ok: false, code, reason, diagnostics }`, where `compiled` is `{ subject: { id, type, version }, canonicalForm, compiler, checksum, canonical, warnings }`.
   - `compareRoutes(routes)` where `routes` is `[{ name, input }]` -> `{ identical, routes: [{ name, ok, checksum }], firstDifference: { path, kind } | null }`. It canonicalises every route (never validates), and reports the first differing JSON pointer. It shows paths and value kinds, never the values.
2. **Refusal catalogue (8 ids, separate from validator rule ids):** `CCIS-C-001` not JSON (text route); `CCIS-C-002` duplicate member name in one object; `CCIS-C-003` number not safely representable (not finite; integer beyond 2^53 - 1; more than 17 significant digits); `CCIS-C-004` not plain JSON (undefined, function, symbol, bigint, class instance, Map, Date, sparse array) or a cycle; `CCIS-C-005` lone surrogate in a string or member name; `CCIS-C-006` member name `__proto__`; `CCIS-C-007` validation did not pass all eight layers (carries the diagnostics; unresolved dependency lands here); `CCIS-C-008` no subject (no manifest with id, type and version). Messages are plain prose, with no clinical code, threshold or value.
3. `ccis-cli.js`: `compile <file> --out <dir> [--known <dir>] [--fixtures <dir>]` writes `<name>.canonical.json` (the exact checked bytes, **no trailing newline**, so `sha256sum` of the file equals the checksum) and `<name>.compiled.json` (the metadata without `canonical`, in canonical JSON plus a newline). All targets are checked before any is written; an existing different file gives exit 2 (D-061, D-100); a refusal prints code and reason and writes nothing. Drop this item first if the size guard bites (the library alone meets the row).
4. `ccis/fixtures/compile/expected-checksums.json`: the 6 compilable snake files and their checksums, as a regression oracle (a changed example forces a deliberate update). The values are **not** taken from the module under test: they come from an independent calculation (a short Python script using `json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=False)` and `hashlib`), cross-checked against `sha256sum` of the written canonical file in the CLI test.
5. `test/ccis-compile.test.js`, with these checks:
   - (a) **Vectors by hand.** `{"b":1,"a":[true,null]}` canonicalises to `{"a":[true,null],"b":1}` with checksum `sha256:51705a2c9eb3e7e410a58f696a770c3ac3885a0cf43eb7fc88f5e47c11d4d30d`; SHA-256 of `abc` is `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
   - (b) **Equivalence harness on stand-ins.** For each of the 6 files, three representations: the committed text; the parsed value rebuilt with members in reverse order (a "code route" stand-in); the text re-serialised with 4-space indent, CRLF and reversed members (a "form route" stand-in). `compareRoutes` says identical and all three checksums equal the expected one. Test names and README say these are stand-ins for one route, not three real routes.
   - (c) **Negative controls, so the harness is not vacuous.** Swapping two array items, changing one number, and dropping one member each give `identical: false` with the right `firstDifference.path`.
   - (d) Each refusal id is reached once (C-001 to C-008), with no output on refusal. C-007 uses a layer 3 failure (an unresolved reference through `options.known`) to show REQ-065; C-008 uses a lone node.
   - (e) **Old bytes stay valid.** On every valid snake file the canonical text equals `canonicalJson` from `ccis-demo-record.js`.
   - (f) Byte-identical output on two runs; the input (frozen) is unchanged; warnings are carried (the layer 7 "not checked" case); the checksum is not inside the artefact; `verifyChecksum` accepts the right value and refuses a changed byte, a wrong prefix, upper-case hex, a short value and an unknown algorithm.
   - (g) The pure-library scan (no file, network, clock or randomness; the only import is `node:crypto`).
   - (h) CLI: writes both files, `sha256sum` of the canonical file equals the metadata checksum, refuses a different existing file, prints code and reason and writes nothing on refusal.
6. `ccis/CHANGELOG.md` (A-005), `docs/TRACEABILITY.md` (G-05 closed; REQ-064, 065 and 093, 094 pointed at 2.4), `README.md` (a short "Compile and checksum" paragraph with the stand-in note), `DECISIONS.md`, tracker.

## Not in this row

A bundle of pinned artefacts; pin shape (id, version, checksum) and its schema change; checksum verification inside the marketplace (3.6) or GitHub client (4.1); a schema for the compiled metadata (proposed with 3.6); signing (6.2); a validator rule for duplicate member names; running anything (the engine only executes a compiled form, REQ-064, from rows 3.x on); the real second and third authoring routes (4.2, 4.4, 6.1).

## Questions for the owner (defaults apply if you only say "approve")

1. A-005 as worded above (checksum required, verification required, signing later). Default: approve.
2. Array order is significant, so two routes that list the same elements in a different order give different bytes. Default: accept for 0.1.0 and say so in the README; a later amendment may declare which arrays are sets.
3. Lone nodes and bindings are refused (no manifest to name them). Default: accept; the manifest decision stays with D-099.
4. Compiled metadata gets no schema in this row. Default: later, with 3.6.

**Done when:** all 6 compilable snake files give three equal checksums that match the independent expected values, every refusal id is reached with no output, the negative controls fail as they should, and three deliberate breakages (stop sorting member names; let a duplicate member name through; let `compileArtefact` continue after a failed layer) are each seen failing a test. The owner runs or skips `npm test` as instructed in that session.

**Size guard:** 1 new module, 1 test file, 1 CLI edit, 1 fixture file, ~8 refusal ids, small doc edits. If more is needed, drop the CLI item first, then split the text-route scanner (C-002, C-003, C-005, C-006) to row `2.4a`.

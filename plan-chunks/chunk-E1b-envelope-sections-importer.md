# Chunk E1b: importer reads the envelope 0.2.0 sections (written 2026-11-26, docs only; build after owner approval)

**Why:** E1a let the schema carry `problems`, `allergies`, `orders`, `results`. Today `importEnvelope` ignores them silently. This row teaches the importer, so a section is either read and reported or the envelope is refused. Needs E1a `DONE`.

**Read only (rule 12):** `ccis-import.js` lines 22-34, 50-84, 99-121, 122-215 (`sed -n`); `ccis/schemas/import-report.schema.json` lines 140-165; `test/ccis-import.test.js` lines 1-25. Do not read the generated validators.

**Change 1 (`ccis/schemas/import-report.schema.json`, one enum):** `recordKind` gains `problem`, `allergy`, `order`, `result`. Run `npm run build` and ship the regenerated `ccis/validators/ccis-validators.js` (D-209). Reason `code` is already a free pattern, so no other schema edit.

**Change 2 (`ccis-import.js`, about 40 lines, no new module):**
1. `REJECTION_CODES` gains `concept-unclassified`: the item has the reserved concept `unclassified`; it is reported `unmapped` and kept out of the context (never guessed).
2. New `judgeItem(item, kind, idsInEnvelope)`: `entered-in-error` -> `rejected`, `excluded-by-policy`, category `entered-in-error`; `unclassified` -> `unmapped`; `correctionOf` not an id in the envelope -> `rejected`, `correction-target-missing`; else `accepted`, with `time-zone-unknown` / `recorded-time-unknown` notes from `effective`, `recorded`, `period.start`, `period.end` (reuse the `timeNotes` logic, do not duplicate it).
3. `results` go through the existing `judgeObservation` unchanged, then the record is relabelled `recordKind: 'result'`. They are matched against applied-element fields like observations.
4. The duplicate-id check (IMP-105) covers every record in all six arrays; one clash refuses the whole envelope, reason names no id.
5. The context gains each section ONLY when the envelope has it (accepted records only, sorted by id, cloned). A 0.1.0 envelope therefore gives a byte-identical context and checksum. `contextForm` stays `ccis-context/1`. Do not bump `IMPORTER_VERSION` here (E1c decides; reports embed it).
6. Unknown shapes already refuse the whole envelope through the schema; add no best-effort path.

**Out of scope (say so in DECISIONS, do not build):** `ccis-bind.js`, `ccis-walk.js`, `ccis-compat.js`, `ccis-run.js` and the run snapshot read `observations` and `events` only, so accepted `results` and items do NOT reach analytics or run records yet. A later row decides that (new row only if the owner wants it). The demo loader is untouched.

**Test (one new file `test/ccis-import-sections.test.js`, at most 8 cases, run only this file):**
- a 0.1.0 fixture envelope gives the same context checksum as before (compare with a fresh import of the same file, plus no section keys in the context);
- a 0.2.0 envelope with one item per section: items accepted, sorted by id, counts add up (IMP-105), report validates with `importReport`;
- entered-in-error item rejected; entered-in-error result rejected;
- `unclassified` item reported `unmapped` and absent from the context;
- `correctionOf` pointing nowhere rejected; one id reused across `problems` and `orders` refuses the envelope;
- a result whose concept is in an applied element is accepted and relabelled `result`; one that is not is `unmapped`;
- a zone-unknown `effective` on an item adds the note.
At most 3 breakage checks (drop the entered-in-error check for items; let the context always carry empty sections; skip the cross-array duplicate check).

**Size guard:** 1 module edit, 1 schema enum, 1 generated file, 1 test, DECISIONS (max 3 rows), tracker. No dependency. If the edit passes about 60 lines, STOP and split results from items (`E1b.1`).

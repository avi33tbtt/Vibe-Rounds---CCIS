# Chunk E1a: envelope schema, optional sections for the EMR (written 2026-11-26, docs only; build after owner approval)

**Why:** EMR rows R3i (problems, allergies) and R4j (orders, results) are blocked until the context-envelope schema can carry them. This row is the schema half only; the importer is E1b, docs and fixture are E1c.

**Change (file: `ccis/schemas/context-envelope.schema.json` only):**
1. Four OPTIONAL top-level arrays, in this order after `events`: `problems`, `allergies`, `orders` (items `#/$defs/contextItem`) and `results` (items `#/$defs/observation`, reused unchanged: a result is an observation of a test, so analytics bind as before). The root `required` list does NOT change, so every 0.1.0 envelope and fixture stays valid.
2. New `$defs/contextItem` (`additionalProperties:false`, `^x-` allowed, like its neighbours). Required: `id` (localId), `concept` (same shape as an observation concept: `id` artefactId, `codes` array of `#/$defs/code`; the reserved id `unclassified` is allowed for free-text items, and then no text travels), `lifecycle`, `status` (existing record-status enum), `sourceClass`, `provenance`, `recorded` (recordedTime). Optional: `effective` (time), `period` (start required, end optional, as in `event`), `correctionOf` (localId).
   `lifecycle` enum: `active`, `resolved`, `stopped`, `cancelled`, `replaced`, `unknown`.
3. NO free-text member anywhere in the new items (no label, note, reason, dose, destination or name). Meaning travels only as a classified concept id. `inclusions` stays fixed (identity, narrative, enteredInError all false); entered-in-error items are never sent.
4. Version gate with `allOf`: if any of the four sections is present, `envelope.version` must be 0.2.0 or later (pattern `^0\.(?:[2-9]|[1-9]\d+)\.\d+` or a major of 1+). An envelope declaring 0.1.0 with a new section is refused.
5. Do not change `ccis-import.js`, `ccis-compat.js`, the validator or any fixture in this row. Until E1b, the importer has not been taught the sections, so do NOT tell the EMR the import path is ready. Before editing, `grep -n "observations" ccis-*.js` once to list modules that enumerate envelope members; report them, do not edit them. If more than the schema needs editing, STOP and split.

**Known limitation (decide in E1b):** a date-only onset (EMR problems and allergies) has no representation in `time`; the exporter maps it to `effective` at 00:00 with zone `unknown`.

**Test (one new file `test/schemas-envelope-sections.test.js`, at most 8 cases; load the schema the way `test/schemas-a003.test.js` does, read its first 30 lines only):**
- all existing snake fixture envelopes still validate (reuse the fixtures index);
- a minimal 0.2.0 envelope with one item in each section validates;
- an item with an unknown member, a missing required member, a bad lifecycle or a free-text member (`label`) is refused;
- a new section with `envelope.version` 0.1.0 is refused; a 0.1.0 envelope without sections still validates;
- `results` with a malformed observation is refused (proves the reuse).
Run only this file. At most 3 deliberate-breakage checks (remove the version gate; make `lifecycle` optional; drop `additionalProperties:false`).

**Size guard:** 1 JSON edit (about 60 lines), 1 test file, DECISIONS, tracker. No new dependency.

**Context impact for the EMR:** none until E1b and E1c are `DONE`. EMR rows R3i and R4j then build the exporter side against envelope version 0.2.0.

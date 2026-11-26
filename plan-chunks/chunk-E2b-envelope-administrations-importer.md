# Chunk E2b: importer reads the envelope 0.3.0 section `administrations` (written 2026-11-26, docs only; built the same session at the owner's request)

**Why:** E2a let the schema carry `administrations`. Today `importEnvelope` would ignore it silently. This row teaches the importer, mirroring E1b. Needs E2a `DONE`.

**Change 1 (`ccis/schemas/import-report.schema.json`, one enum):** `recordKind` gains `administration`. Run `npm run build` (regenerates validators, D-209) and `node scripts/build-app.js` (the app bundles the importer, D-218).

**Change 2 (`ccis-import.js`, a few lines, no new module):** `administrations` joins the existing `SECTIONS` list with kind `administration`, so it reuses `judgeItem` unchanged: entered-in-error is rejected, the reserved concept `unclassified` is reported `unmapped`, a `correctionOf` pointing nowhere is rejected, time notes come from `effective` and `recorded`. The duplicate-id check (IMP-105) and the `correctionOf` id set therefore cover administrations too. The context gains `administrations` only when the envelope has it (accepted records only, sorted by id, cloned), so 0.1.0 and 0.2.0 contexts stay byte-identical. Do not bump `IMPORTER_VERSION` (E2c decides).

**Decision:** `orderRef` is carried as given and NOT checked: the order it names may be unmapped, excluded as entered-in-error or sent in a later export, so a dangling reference is not a reason to drop a record of a dose. No new rejection code is added.

**Out of scope:** `ccis-bind.js`, `ccis-walk.js`, `ccis-compat.js`, `ccis-run.js` and the run snapshot read `observations` and `events` only, so accepted administrations do NOT reach analytics or run records yet (same as E1b).

**Test (one new file `test/ccis-import-administrations.test.js`, at most 8 cases, run only this file):** 0.1.0 and 0.2.0 fixtures give the same context checksum as before and no `administrations` key; a 0.3.0 envelope with three administrations: accepted, sorted by id, report validates with `importReport`, outcomes kept (held and refused stay as recorded); entered-in-error rejected; `unclassified` unmapped and absent; `correctionOf` pointing nowhere rejected; an id reused across `orders` and `administrations` refuses the envelope; a dangling `orderRef` is still accepted; a zone-unknown `effective` adds the note. At most 3 breakages (drop the entered-in-error check; add administrations to the context always; leave them out of the duplicate-id check).

**Size guard:** 1 module edit (under 10 lines), 1 schema enum, 2 generated files, 1 test, DECISIONS (max 3 rows), tracker.

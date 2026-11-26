# Chunk E2a: envelope schema, optional section `administrations` (written 2026-11-26, docs only; built the same session at the owner's request)

**Why:** EMR row R5h (medication administration record) is blocked until the context-envelope schema can carry administrations. Envelope 0.2.0 (E1a to E1c) has no such section. This row is the schema half only; the importer is E2b, docs and fixture are E2c. Same three-step pattern as E1a to E1c.

**Change (file: `ccis/schemas/context-envelope.schema.json` only, then regenerate validators):**
1. ONE optional top-level array `administrations` after `results` (items `#/$defs/administrationItem`). The root `required` list does NOT change, so every 0.1.0 and 0.2.0 envelope and fixture stays valid.
2. New `$defs/administrationItem` (`additionalProperties:false`, `^x-` allowed). Required: `id` (localId), `concept` (same shape as `contextItem`; `unclassified` allowed, then no text travels), `outcome`, `status`, `sourceClass`, `provenance`, `recorded`. Optional: `effective` (time of the administration), `orderRef` (localId of an item in `orders`), `correctionOf` (localId).
   `outcome` enum: `given`, `held`, `refused`, `unknown`. Held and refused are NOT given and never count as a dose.
3. NO free-text member (no dose, reason, note, route or site). Meaning travels only as a classified concept id; the dose text stays in the EMR. Entered-in-error entries are never sent. `inclusions` is unchanged.
4. Version gate (second `allOf` entry): if `administrations` is present, `envelope.version` must be 0.3.0 or later (pattern `^(?:0\.(?:[3-9]|[1-9]\d+)\.\d+|[1-9]\d*\.\d+\.\d+)`). The existing 0.2.0 gate is not changed.
5. Do not change the importer, compat module or any fixture. Until E2b the importer does not know the section: do NOT tell the EMR the path is ready. Regenerate `ccis/validators/ccis-validators.js` (`npm run build`) and the app bundle if its `--check` fails (D-209, D-218).

**Test (one new file `test/schemas-envelope-administrations.test.js`, at most 8 cases; run only this file):** existing fixtures still validate; minimal 0.3.0 envelope with `orders` and `administrations` validates; 0.2.0 or 0.1.0 with the section refused; free-text and unknown members refused, `x-` passes; required members; bad outcome refused and all four accepted; optional `effective`, `orderRef`, `correctionOf` checked; section must be an array. At most 3 breakages (remove the gate; make `outcome` optional; drop `additionalProperties:false`).

**Size guard:** 1 JSON edit (about 50 lines), 1 test file, DECISIONS, tracker, regenerated generated files. No new dependency.

**Context impact for the EMR:** none until E2b and E2c are `DONE`. Then EMR R5h builds the exporter against envelope 0.3.0.

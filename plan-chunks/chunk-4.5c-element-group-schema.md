# Chunk 4.5c: second demo, part 3: the element-group schema (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Owner chose "group" for D-274 (2026-11-27). Needs 4.5b (done). Implements CCIS-REQ-023 as a **new artefact type** `element-group` (a minor, additive schema change: no existing schema field changes meaning). This row is the schema only. Validator wiring and the REQ-024 checks are 4.5c.1; the diabetes and CKD group file is 4.5c.2 (D-279)._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `ccis/schemas/element.schema.json` (the style to copy: view the head, `$defs.key`, and `relationships`); `ccis/schemas/manifest.schema.json` (`artefactType` enum only); `scripts/build-validators.js` (line 10, the `names` map); `test/ccis-diabetes-element.test.js` (test style, all); `ccis/SPEC.md` lines 91 to 95 (REQ-023 and REQ-024).

## Build
1. `ccis/schemas/element-group.schema.json` (draft 2020-12 like the others, `$id` `https://ccis.invalid/schemas/element-group.schema.json`, `additionalProperties: false`, `^x-` allowed). Top-level members, all required except `provenance`-style optional ones copied from the element schema:
   - `manifest`: the shared manifest with `type` const `element-group`.
   - `intent`: the same intent shape the element uses (reuse by copying the `$defs`, not by editing the element schema).
   - `members`: array, min 1. Each: `element` (a reference as in the element schema: `id` plus `range`), `required` (boolean, mandatory or optional member), no other members.
   - `sharedConcepts`: array. Each: `concept` (a key), `meaning` (non-empty string, the meaning in words, required), `fields` (array, min 2, each `{ element, field }` where `element` is a member element id and `field` a field key), `resolution` (enum `same-concept`, `related-not-merged`). A concept is never identified by label: there is **no** label member.
   - `versionPolicy`: `{ conflict }` with enum `refuse`, `prefer-listed-order` (how overlaps and version constraints are resolved, REQ-023).
   - `provenance`: as in the element schema.
2. `ccis/schemas/manifest.schema.json`: add `element-group` to the `artefactType` enum (one word edit).
3. `scripts/build-validators.js`: add `elementGroup: 'element-group'` to `names`; run it to regenerate the committed validator and, if `index.html` changes, rebuild it (`node scripts/build-app.js`, then `--check`).
4. `ccis/schemas/README.md`: one row for the new schema.

## Test: `test/ccis-element-group-schema.test.js` (at most 8 cases)
1. A minimal valid group (inline object) passes the generated validator.
2. A `sharedConcepts` entry without `meaning` fails; an empty `meaning` fails.
3. A `sharedConcepts` entry with a `label` member fails (identification by label is not expressible).
4. `fields` with one entry fails (a shared concept needs two or more).
5. `resolution` outside the two values fails; `versionPolicy.conflict` outside its two values fails.
6. A member without `required` (mandatory or optional) fails; an unknown member key fails; an `x-` member passes.
7. `type` other than `element-group` fails.
8. Existing artefacts are unaffected: the diabetes and CKD element files still validate with no new rows (the `artefactType` enum only grew).

**Done when:** `node --test test/ccis-element-group-schema.test.js test/ccis-diabetes-element.test.js test/ccis-ckd-element.test.js` passes and `node scripts/build-app.js --check` matches. Two breakages each seen failing, then restored: (a) delete `meaning` from the required list (case 2 fails); (b) remove `minItems` on `fields` (case 4 fails).

**Size guard:** 1 JSON schema (expect under 4 KB), 1 test (8 cases), 3 one-line or small edits, regenerated validators and page. No module. The validator `TYPE_TO_SCHEMA` map is NOT touched here (4.5c.1).

# Chunk 4.5c.1: second demo, part 3b: validate an element group (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.5c (done: `element-group` schema and generated validator). Wires the type into the validator and adds the REQ-023 and REQ-024 checks. No group file yet (4.5c.2). Rules live in a new catalogue so the pinned count in `test/ccis-validator-semantic.test.js` (19 ids) is untouched (D-282)._

**Core rules:** attach `01-core.md` too.

**Read only (5 files; for the two big files use `sed -n` on the named lines only):** `ccis-validator.js` lines 29 to 51 (imports, rule list), 281 to 288 (`SCHEMAS`, `TYPE_TO_SCHEMA`, `TYPES_WITHOUT_SCHEMA`), 400 to 409 (`collectRefs`), 576 to 590 (layer 5 call); `ccis-validator-semantic.js` lines 577 to 583 (`graphLayer`); `ccis/schemas/element-group.schema.json`; `test/ccis-element-group-schema.test.js` (its `base()` group, to reuse); `test/ccis-validator-element.test.js` lines 1 to 30 (how a test calls `validateArtefact` with `known`).

## Build
1. **New module `ccis-validator-group.js`** (pure, under 90 lines). Exports `GROUP_RULES` (rule rows like `SEMANTIC_RULES`) and `groupChecks(doc, ctx, out)` where `ctx.resolve(ref)` returns `{ state, doc }` as in `resolve`. Layer 5 error rules, all at paths into the group:
   - `CCIS-V5-009` a shared concept names an element that is not one of the group's `members`.
   - `CCIS-V5-010` a shared concept names a field key that its member element does not have (checked only when that element resolved with state `ok`; a member that did not resolve is skipped, never assumed).
   - `CCIS-V5-011` a `same-concept` entry lists fields whose `type` differ, or whose `units` lists differ (REQ-024: same meaning needs the same shape). `related-not-merged` is exempt.
   - `CCIS-V5-012` two member elements declare the same field key and no shared concept lists both fields. The group must say what each overlap is (REQ-023). Resolution is never inferred from the key or the label.
   - `CCIS-V5-013` the same field of the same member appears in two shared concepts.
2. **Wire** (small edits): in `ccis-validator.js` import the module, add `elementGroup: vElementGroup` to `SCHEMAS` (import it from the generated file beside the others), add `'element-group': 'elementGroup'` to `TYPE_TO_SCHEMA`, remove `'element-group'` from `TYPES_WITHOUT_SCHEMA`, add `...GROUP_RULES` after `...SEMANTIC_RULES`, make `collectRefs` return the `/members/i/element` references for kind `element-group` (the existing V3 rules then check them), and call `groupChecks` from the layer 5 line. In `graphLayer` nothing changes unless a call there is simpler: choose the smaller edit and record it in `DECISIONS.md`.
3. **Plan note:** one line in `ccis/schemas/README.md` under the element-group row: which checks sit in layer 5.

## Test: `test/ccis-validator-group.test.js` (at most 8 cases)
Build a valid group over the real diabetes and CKD element files (`known` list) with `diagnosisDate` as `related-not-merged` and the follow-up and treatment-plan fields unlisted as concepts (they have different keys).
1. A valid group passes every layer with no error row.
2. Missing member in `known` gives the V3 missing-reference error (never assumed).
3. V5-009: a concept names a non-member element.
4. V5-010: a concept names a field the element lacks.
5. V5-011: a `same-concept` over `diagnosisDate` of both elements is accepted by the schema but fails on V5-011 only if types or units differ; use `creatinineValue` against `glucoseValue` (units differ) to fail, and a same-shape pair to pass.
6. V5-012: remove the `diagnosisDate` concept; the undeclared overlap is reported.
7. V5-013: a field in two concepts.
8. Unresolved member: V5-010 is skipped for it, no crash, no guess.

**Done when:** the new test passes, plus `ccis-validator-semantic`, `ccis-validator-element` and `ccis-element-group-schema` tests (run only those four), and `node scripts/build-app.js --check` matches (rebuild if the bundle holds the validator). Two breakages each seen failing, then restored: (a) delete the V5-012 call (case 6 fails); (b) compare only `type` in V5-011, not `units` (case 5 fails).

**Size guard:** 1 module (under 90 lines), 1 test (8 cases), about 7 small edits in one file, 1 doc line. If the catalogue-count test or the "every rule has a case" test fails because of the new ids, add one line to that list and say so; do not edit anything else. If more is needed, stop and split (V5-012 and V5-013 are the first to split off as 4.5c.1a).

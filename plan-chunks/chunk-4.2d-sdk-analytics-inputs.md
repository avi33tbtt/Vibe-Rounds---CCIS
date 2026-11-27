# Chunk 4.2d: code-authoring SDK, part 5: analytics inputs, parameters, conversions and context entries (written 2026-11-27, docs only; build after owner approval)

_Phase 4. Needs 4.2c (done). The analytics schema is 13 KB and the examples 19 to 44 KB, so the analytics builder is split: this row builds the four **member** builders for the declared-data parts only; the expression tree is 4.2d.1, the outputs and the closing members 4.2d.2, the whole `analytics()` plus the README section 4.2d.3. Each member builder is proved on its own: the member of every snake analytics example is built and compared with `compareRoutes` (as 4.2b did for the manifest). Same rules as 4.2: pure, plain frozen JSON, no invented content, fixed-sentence errors with a path, same validator as the file route._

**Core rules:** attach `01-core.md` too. Rule 12: a NEW test file `test/ccis-sdk-analytics-inputs.test.js` (at most 8 cases).

**Read only (5 files):** `ccis/schemas/analytics.schema.json` lines 33-98 and 99-136 only (`sed -n`: context, inputs, parameters, conversions); `ccis-sdk-pathway.js` lines 1-20 (the `pinned` and `element` helpers); `ccis-sdk-element.js` lines 1-20 (`FIELD_TYPES`, `oneOf`, `int`); `test/ccis-sdk-pathway.test.js` lines 1-30 (helpers to copy); for each of the 4 snake analytics examples print only counts and one member, with `node -e` (never read a file whole).

## Build (1 new module of at most 70 lines, 1 word edit, 1 new test of at most 8 cases)
1. `ccis-sdk-pathway.js`: `const element` becomes `export const elementRange` (rename, same code; the pathway uses the new name).
2. New `ccis-sdk-analytics.js`, exporting `analyticsInput`, `parameter`, `conversion`, `contextEntry`, and the enums `PARAMETER_KINDS`, `NON_VALUE_STATES`, `CONVERSION_KINDS` (the test compares each with the schema):
   - `analyticsInput`: required `key`, `field` (keyText), `element` (artefact id), `type` (the 7 field types), `onMissing` (non-value state); optional `units` (list of at least 1 non-space string); `S-004` when `quantity` or `integer` has no `units`;
   - `parameter`: required `id` (key), `label`, `kind`, `suppliedBy` (text), `enabledByDefault` which must be exactly `false` (`S-003` otherwise; never defaulted); optional `units`, `allowedRange` (`{ min, max }` numbers, both required, closed), `allowedChoices` (list of at least 2 text), `allowedMembers` (list of at least 1 key), `note`; `S-004` for the three schema rules (`duration` needs `units` and `allowedRange`; `choice` needs `allowedChoices`; `set` needs `allowedMembers`). There is no `value`, `default` or `suggested` member: giving one is `S-001` (CCIS-REQ-029);
   - `conversion`: required `id` (key), `version` (semver), `from`, `to` (non-space), `kind`; optional `factor`, `offset` (numbers); `S-004` when `linear` has no `factor`;
   - `contextEntry`: required `ref` (`elementRange`) and `fields` (list of at least 1 key);
   - `x-` passes on all four except inside `allowedRange`.
   - NOT added (validator): a `key` clash, an input whose element is not in `context`, a parameter never used.

## Test: `test/ccis-sdk-analytics-inputs.test.js` (at most 8 cases)
1. every `inputs`, `parameters`, `conversions` and `context` member of the four snake analytics examples is `identical` on the code route (member JSON text vs builder output), same checksum, and at least one of each kind was seen;
2. `analyticsInput`: minimal builds frozen, nothing added; missing member `S-002` with path; `quantity` without `units` `S-004`; enums equal the schema;
3. `parameter` valueless: `enabledByDefault: true` `S-003`, a `value`, `default` or `suggested` member `S-001`;
4. `parameter` kinds: the three `S-004` rules, each satisfied form passes, `allowedChoices` with one item `S-003`, `allowedRange` closed;
5. `conversion`: `linear` needs `factor`, `time-zone` does not, `from` with a space `S-003`, enums equal the schema;
6. `contextEntry`: version instead of range `S-004`, another type `S-003` at `ref.type`, empty `fields` `S-003`;
7. list order kept in `units`, `allowedChoices`, `allowedMembers`, `fields`; `x-` passes where allowed;
8. hostile string never in a message; purity scan of `ccis-sdk-analytics.js` passes.

**Done when:** `node --test test/ccis-sdk-analytics-inputs.test.js test/ccis-sdk-pathway.test.js` passes. Two breakages each seen failing, then restored: (a) accept `enabledByDefault: true`; (b) drop the `duration` needs `allowedRange` rule.

**Size guard:** 1 new module (70 lines at most), 1 rename, 1 new test file, tracker and DECISIONS only otherwise. If a member of these four schema blocks is not listed here, STOP and report.

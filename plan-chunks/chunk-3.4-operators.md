# Chunk 3.4-operators: Executor part 2, the remaining operators (the operator library v0)

_Phase 3, Stage 2 (written 2026-11-24). Needs: 3.3 (done). This chunk file is docs only; the operators are built at the next "do next" after the owner approves it. No schema change and no spec amendment is proposed._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-exec.js` and `test/ccis-exec.test.js` (the 3.3 interpreter and its value model); `ccis/schemas/analytics.schema.json` (`conversions`, `outputs`, `parameters`, `$defs.expr`); `ccis/SPEC.md` CCIS-REQ-041 to 043, 066, 069, 072; `ccis-demo-exec.js` lines for `time-diff`, `convert`, `select`, `count` and `toBase` (prior art: replaced, not copied); the four snake analytics in `ccis/examples/snake/`; decisions D-042, D-050, D-051, D-090, D-115, D-117, D-118.

## What this row is for

Finish the **operator library v0**: implement the six whitelisted operators 3.3 refuses (`add sub time-diff convert count select`) in `ccis-exec.js`, so that all 18 whitelisted operators run and the four snake analytics **prepare**. It stays an expression-level row: values in, one value out. It does not read the context, build run results, write warning wording or walk decision nodes; those are rows 3.4a and 3.4b (split below).

## The split (decided here, size guard)

The plan's old 3.4 holds three separable jobs. They become three rows, in order:
- **3.4 (this row):** the six operators, new value types, new refusal ids, hand-calculated tests. Edits `ccis-exec.js`, its test file, README, DECISIONS, tracker.
- **3.4a (chunk file first):** `ccis-bind.js`: bind a 3.1 context and supplied parameters to inputs and parameters (not relying on record order; entered-in-error already removed); map expression values to run results against the output contract (states, labels, quantities with units, tables; schema check; REQ-070); the warning and missing-data wording that the package format cannot carry (D-047); **the 32 fixture cases plus the EMR export are the oracle**: results must equal the expected files for both analytics on 0.1.1.
- **3.4b (chunk file first):** `ccis-walk.js`: the decision-node walker with rule trace (REQ-075 needs the path), oracle: the 32 routes.
Row 3.5 now needs 3.4b.

## What earlier rows found (the build must handle each)

1. **The four snake analytics fail at prepare today only because of these operators** (3.3 test (e) names them: `time-diff` in all four, `convert` in the two 0.1.1 files, `count` and `select` in the two completeness files). After this row all four prepare with no refusal.
2. **Finding F-9 (D-115): first, last, min, max and coalesce are not in the schema enum.** Default for this row: **do not add them.** No package needs them; `first` and `last` presuppose several observations per input, which the input model does not have (more than one record is `conflicting`, D-048); `min`, `max` and `coalesce` have no user yet (the second demo, row 4.5, is the likely first). They are listed as deferred, to come with a schema amendment (A-006) in the row that needs them.
3. **D-042 awaits confirmation:** `convert` is read as "express in the conversion's target unit": identity when the value is already in `to`, the factor when it is in `from`, anything else an error. The whitelist has no unit-testing operator, so this is the only reading under which a duration parameter that arrives in hours or minutes can be compared. The owner confirms it by approving this chunk file.
4. **Time is exact or unknown.** An instant is integer UTC milliseconds produced by the binder (3.4a); a time with no stated zone or an impossible date reaches the interpreter as an unreadable input, which is already unknown. `time-diff` never sees a guess.
5. **The 3.3 value model has no table row and no set.** `select` needs both (D-051: membership when the first argument is a set parameter, else one table row). Two value types are added (below).
6. **Static checks for `select` depend on the output** (a row's width must equal the table's column count; a membership literal must be a declared member). 3.3's walk knows the output id; it gains the output declaration.
7. **3.3 tests that must change (test-only, as D-104):** the X-002 assertions (`add` in the static-check test; the real-package test (e)); the catalogue assertion `IMPLEMENTED_OPS.length === 12`. After this row no whitelisted operator is unimplemented, so **X-002 stays in the catalogue but cannot be reached**; the catalogue test says so.

## The design (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

`IMPLEMENTED_OPS` becomes the full whitelist of 18. All rules keep 3.3's: every argument is evaluated (no short-circuit), an unknown argument gives unknown with merged reasons (never a value), no implicit conversion, same unit required, a type or unit mismatch is X-010, a non-finite or unwritable number is X-013.

**New value types.** `{ t: 'row', cells: [text, ...] }` (cells are text only) and `{ t: 'set', members: [string, ...] }` (a bound set parameter value; members sorted, unique, strings). The binder (3.4a) produces them; this module validates them on binding (X-014 when malformed).

**Operators.**
- `time-diff(start, end)`: both instants gives a number in `min`: `(end.ms - start.ms) / 60000` (may be fractional, may be negative; never rounded). Unknown in gives unknown. Any other type X-010. (Same argument order as the demo: `time-diff(biteTime, antivenomStartTime)` is the interval from bite to start.)
- `add(a, b, ...)` (two or more) and `sub(a, b)` (exactly two): numbers of the same unit only; the result keeps the unit. Instants, text and booleans X-010. No instant plus duration in this version (no package needs it).
- `convert(value, conversion)`: the second argument is a declared `linear` conversion. Value in the conversion's `to` unit: returned as is. Value in `from`: `value * factor`, unit `to`. Any other unit X-010. A conversion whose kind is not `linear` (the `time-zone` kind) is refused at prepare (X-015): the time-zone kind is handled when times are read, not here. A non-number value X-010. Unknown in gives unknown.
- `count(a, b, ...)`: each argument true or false or unknown; the result is a number in unit `1` equal to the number of true arguments. **Any unknown argument makes the count unknown** (a count of an unknown is never a number, D-051); a non-boolean argument is X-010.
- `select`, two shapes, chosen statically:
  - **Membership:** first argument is a `set` parameter reference, second a text literal that the package declares in `allowedMembers` (else X-016). Result: true or false; a disabled set parameter gives unknown (`parameter-not-enabled`).
  - **Table row:** the output must be of kind `table` and the argument count must equal its column count (else X-016). Each argument is text (an epistemic state or label); any unknown cell makes the row unknown (the demo rule); a non-text cell X-010. Result: a `row`.
  `select` is never partially evaluated: a row with an unknown cell is unknown, not a row with a hole.

**Static checks added to prepare.** X-015 a `convert` conversion of a kind other than `linear`; X-016 a `select` that is neither a valid membership test nor a row matching its output's columns. Arity: `add` 2 or more, `sub` 2, `time-diff` 2, `convert` 2, `count` 1 or more, `select` 1 or more. `convert`'s second argument must be a conversion reference and a conversion reference may appear nowhere else (3.3's X-005 rule, now live). Catalogue: X-015 "A conversion of a kind this engine does not apply in `convert` is used."; X-016 "A `select` is not a valid membership test or table row for its output." The catalogue grows from 14 to 16 ids; existing ids keep their meaning.

**Output size** counts the canonical bytes of the new value types as for the others.

## Build

1. Edit `ccis-exec.js`: the six operators, the two value types, the two refusals, the output-aware walk. Nothing else imports a new module (still `./ccis-compile.js` only).
2. `test/ccis-exec.test.js` extended and the 3.3 assertions listed above changed; checks:
   - (a) **Hand-calculated operator tests.** `time-diff` (60 000 ms apart gives 1 min; 90 000 gives 1.5; reversed gives a negative; unknown in gives unknown with reasons; a number in gives X-010); `add`/`sub` (same unit, unlike unit X-010, three-argument `add`); `convert` (h to min: 2 h gives 120 min; already min unchanged; a `d` value X-010; a `time-zone` conversion X-015 at prepare); `count` (0, 1, 3 trues; one unknown gives unknown even with trues present; a text argument X-010); `select` membership (member true, other member false, disabled parameter unknown, undeclared literal X-016) and rows (width mismatch X-016, a non-table output X-016, an unknown cell gives unknown, a non-text cell X-010).
   - (b) **The real packages.** All four snake analytics prepare (checksums from 2.4); the interval 0.1.1 `interval` output evaluated for hand-calculated inputs: bite to start 3 h 5 min gives 185 min, with the hours-valued target compared through `convert` in `comparison` (within, exactly at, one minute over, under each edge rule); the same rows as 3.3's stubbed-tree test now with `time-diff` live; completeness 0.1.1 `expectedDocumentedCount` (0 to 4) and `itemStates` row for hand-written bound inputs, including an unknown input making the count unknown and the row unknown.
   - (c) Unknown stays unknown through every new operator; no short-circuit still holds; steps counted per node for the new operators; limits (step, output bytes) still refuse with no partial value.
   - (d) Determinism, no input mutation, the pure-library scan, unchanged.
   - (e) Every refusal id X-001, X-003 to X-016 reached once; X-002 asserted unreachable (catalogue only).
3. `README.md` ("Executor" paragraph: 18 of 18 operators, the snake packages prepare, what 3.4a and 3.4b add), `DECISIONS.md`, tracker (3.4 row as built; new rows 3.4a, 3.4b; 3.5 now needs 3.4b).

**Not in this row:** binding a context; parameter values from a clinician (D-112); building run results, output-contract checks, warning wording; any decision-node walking; first, last, min, max, coalesce; instant arithmetic; time-zone conversion; any schema or spec change; the CLI.

## Questions for the owner (defaults apply if you only say "approve")

1. The operator meanings above (especially `time-diff` as end minus start in minutes, `count` unknown if any argument is unknown, `select` row unknown if any cell is unknown)? Default: yes.
2. Confirm D-042: `convert` means "express in the target unit" (identity when already there)? Default: yes.
3. F-9: do **not** add first, last, min, max, coalesce now; add them with a schema amendment in the row that first needs them? Default: yes.
4. The split into 3.4 (operators), 3.4a (binder, result mapper, wording, fixture oracle) and 3.4b (decision-node walker), with 3.5 needing 3.4b? Default: yes.
5. After this row X-002 remains in the catalogue but cannot be reached, and the 3.3 tests that named it change (test-only)? Default: yes.

**Done when:** every operator test and the four-package prepare test pass, the interval and completeness hand-calculated values match, every refusal id other than X-002 is reached once, and three deliberate breakages (return `end - start` reversed in `time-diff`; let `count` ignore an unknown argument; let `convert` pass an unlisted unit through unchanged) are each seen failing a test. The owner runs or skips `npm test` as instructed in that session.

**Size guard:** one module edit, one test file, README, DECISIONS, tracker; no new module, no schema change, no CLI. If more is needed, split `select` and `count` into row `3.4c`.

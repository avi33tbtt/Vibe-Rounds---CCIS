# Chunk DS2a-2-demo-executor-completeness: select, count, tables and the completeness analytic

_Needs: DS2a (done), D-047 to D-049. Split from DS2a for size._ **Core rules:** attach `01-core.md`.
**Read only:** `ccis-demo-exec.js` (the whole file, it is the thing being extended); `ccis/examples/snake/snake-completeness.analytics.0.1.1.json` (computation, outputs, parameters); `ccis/fixtures/snake/README.md` (findings F-3 to F-5); D-032, D-036, D-042, D-047 to D-049.

**Facts found while writing this chunk**
- The completeness analytic uses two operators the executor does not have: `select` and `count`. `select` has two meanings: with a parameter of kind `set` as first argument it is **membership** (true or false); with anything else it builds **one table row** from its arguments (`itemStates`).
- Result shapes in the expected files: table `{columns: [four field keys], rows: [[four item states]]}`; count `{amount: n, unit: "1"}`; classification `{label}`.
- 31 of 32 cases have completeness results. `conflicting-03` has none (0.1.0 tree has no conflict branch). `conflicting-04` has only `itemStates` (state `conflict`); its other three outputs are listed under `notSpecifiedOutputs` and have **no result at all** (finding F-3, remainder).
- Two cases stay deferred (F-4, F-5) and are not built here.
- Wording seen in the expected files for this analytic: warnings "Two records disagree about the clotting test status." (itemStates conflict) and "Result read time is earlier than the test start time." (readTimeInWindow conflict); missing-data notes "Result read time is not documented.", "Test start time and result read time are not documented." and "Clotting test status is not documented, so the test start time cannot be read as the start of a performed test."

**Build**
1. In `ccis-demo-exec.js`: add `select` and `count` to the whitelist with the static checks the other operators have (membership: first argument a `set` parameter reference, exactly two arguments, second a string literal; row: no set argument, one argument per declared column). `count` counts true arguments; an unknown argument makes the count unknown, and an unknown result with no declared `indeterminate` refuses the analytic (never a number from unknown).
2. Parameter kind `set`: value is an array of strings, each one of `allowedMembers`, no duplicates, not empty; anything else is refused. A supplied `criteria` parameter stays refused.
3. Results: table value from the row and the output's column keys; integer value `{amount, unit}` only when whole and equal to the output unit; classification as before. Every result still validates against `run-result.schema.json`.
4. Wording for this analytic from a table, as in D-047, using the strings above. Missing-data notes for `readTimeInWindow` follow the same pattern as the interval: one sentence per input that is not present (combined into the one sentence above when both times are missing), plus the F3 sentence when F3 is not documented. Remove the interval-only id gate; the demo still runs the two snake analytics only.
5. **Omission rule (confirm at approval):** when any input of the completeness analytic is `conflicting`, the outputs `expectedDocumentedCount`, `overallStatus` and `readTimeInWindow` are omitted from `results`, because neither the dossier nor the trees define them (F-3 remainder) and the expected files write none. `itemStates` still reports `conflict`. The omitted ids are listed in a labelled demo table in the module. Never fill an omitted output with a value.
6. Header comment and the "interval analytic only" sentences updated.

**Tests (new file `test/ccis-demo-exec-completeness.test.js`)**
- Oracle: every case with completeness results equals its expected results, on the version in `x-analyticVersion` (0.1.0 trees for the 23 older cases, 0.1.1 for the nine newer), through the loader. `conflicting-03` has no completeness results on 0.1.0 and is skipped there; on 0.1.1 it must give `itemStates` `conflict` and the three outputs omitted.
- Both analytics together: concatenated results equal the expected `results` array in order for all 32 cases except the two skips above.
- Set parameter: non-array, unknown member, duplicate, empty, wrong type are refused; `__proto__` member names are refused.
- Misused `select` and `count` trees (membership with a non-set, wrong row length, count of non-booleans) refuse the whole analytic.
- Unknown never counted: an expected item recorded as unknown or not-collected is not counted and gives `indeterminate` overall, never `complete`.
- The two deferred cases (F-4, F-5) are not built; a test keeps them in `index.json` `deferred`.
- Source purity check from DS2a still passes for the grown module.

**Done when:** all 32 cases give the expected results for both analytics (with the omission rule); an unknown never becomes a count, a label or a value.
**Size guard:** 1 module edit (about 100 added lines), 1 test file. If the module passes ~400 lines, move the wording tables to `ccis-demo-notes.js` and say so in `DECISIONS.md`.

**For the owner at approval:** the omission rule (5), and that an empty expected-items set is refused rather than read as "nothing expected".

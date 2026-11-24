# Snake envenomation synthetic fixtures (row 1.5a)

Prototype. Synthetic data only. Not for clinical use. Nothing here has had clinical review, no clinician owner is named, and no number in these files is a clinical value.

Each case is two files: `<case>.envelope.json` (a synthetic export, valid against the context-envelope schema) and `<case>.expected.json` (the result worked out **by hand** from `docs/USE-CASE-SNAKE.md`, not read out of the expression trees). `index.json` lists every case and the cases that could not be built yet. Nothing runs these cases: the executor is row 3.4. The test `test/snake-fixtures.test.js` proves the data is well formed and that the hand calculation agrees with a second, plain-arithmetic calculation made from the envelope.

## Classes (23 cases)

| Folder | Cases | What it tests |
|--------|-------|---------------|
| `normal` | 2 | Complete consistent record, with the placeholder parameters enabled and with none enabled. |
| `boundary` | 3 | A value exactly on a limit, with the edge rule inside and then outside; one minute inside a limit. |
| `missing` | 8 | One fact removed at a time (F1, F1 certainty, F7, F8, F3, F5, F6) and F3 unknown. Never zero, false or complete. |
| `conflicting` | 3 | Administration before the bite, read time before test start, two records disagreeing about F3. |
| `out-of-scope` | 2 | Administration explicitly not given; clotting test explicitly not performed. Not applicable, not a value, not missing. |
| `unit-conversion` | 2 | The same instants written with different offsets give the same interval. |
| `estimated` | 3 | Estimated bite time with the certainty choice accept, flag-only and not enabled. The estimate stays visible. |

The `estimated` folder is a supplementary class named in the chunk brief. A population-scope case is not built: the scope filter is a pre-filter for the executor (row 3.4, D-034).

## The expected file

`case`, `class`, `tests`, `parameters` (the test-only placeholders used, or `"none"`), `evaluationTime`, `results`, `workings`, `pathwayRoute`, `noValueOutputs`, `notSpecified`.

- `results`: one object per output of each analytic, each valid against `run-result.schema.json`. The analytic is named by the extension member `x-analytic`. `limitations` holds the analytic's own statement. `dependsOnParameters` lists the disabled parameters the result needed, in declared order (a convention for row 3.4 to confirm).
- `workings`: the arithmetic in words and numbers, each line naming the dossier section it follows. These sit outside the result objects.
- `pathwayRoute`: the stages in order, with the node and outcome id taken at each node, ending at `end` or at the gap report. The pathway tests whether records exist (D-018), so it does not see a time conflict; the analytics do.
- `noValueOutputs`: outputs that must carry a declared state and no value.
- `notSpecified`: outputs for which neither the dossier nor the tree defines a result (finding F-3). No value is written for them.

## Test-only placeholders (D-013)

Parameter values appear **only** in `<case>.expected.json` under `parameters`, each marked `"testOnly": true` with the note "test-only placeholder, not a clinical value". Values are whole minutes chosen for easy arithmetic. They are never written into `ccis/examples/`, and the test fails if they are. They are not clinical suggestions and appear in no real run record.

## Concept id convention

The envelope's `concept.id` must be a lower-case dotted id, while element field keys are camelCase. The rule is one-to-one: the element id, a dot, then the field key with each capital letter turned into a hyphen and a lower-case letter. A test keeps the table below one-to-one and checks every envelope against it. Code-valued observations carry the element's own demonstration binding as the concept code. Their values (for example `performed`, `given`, `exact`, `estimated`) are demonstration labels in the system `ccis-demo` and cannot be checked against a value set until member lists exist (D-032).

| Fact | Field key | Concept id |
|------|-----------|------------|
| F1 | `biteTime` | `snake.envenomation-timing.bite-time` |
| F1 (certainty) | `biteTimeCertainty` | `snake.envenomation-timing.bite-time-certainty` |
| F2 | `arrivalTime` | `snake.envenomation-timing.arrival-time` |
| F3 | `clottingTestStatus` | `snake.envenomation-timing.clotting-test-status` |
| F4 | `clottingTestStartTime` | `snake.envenomation-timing.clotting-test-start-time` |
| F5 | `clottingResultReadTime` | `snake.envenomation-timing.clotting-result-read-time` |
| F6 | `clottingResult` | `snake.envenomation-timing.clotting-result` |
| F7 | `antivenomStatus` | `snake.envenomation-timing.antivenom-status` |
| F8 | `antivenomStartTime` | `snake.envenomation-timing.antivenom-start-time` |
| F9 | `antivenomNotGivenReason` | `snake.envenomation-timing.antivenom-not-given-reason` |

`antivenomNotGivenReason` (F9) is optional and is not used by any case.

## Findings to resolve before the executor (decision D-036)

The hand calculation was made from the dossier. Where the expression trees in `ccis/examples/snake/` would give a different answer, no case was built on the difference. These need a corrected artefact version (never an edit of 1.5): row 1.5b.

- **F-1. The comparison ignores the certainty choice and F7.** In Analytic A the `comparison` tree does not read `acceptedCertainty`, the certainty of the bite time, or whether `antivenomStatus` is present. With a target enabled it could give within-target from an estimated bite time, or from a start time whose status is missing or unknown, while the `interval` says needs-data or indeterminate. The dossier (4.1, section 5 P2) says the analytic needs F1 with its certainty, F7 and F8. The `comparison` output also declares no indeterminate state. Cases `missing-02`, `missing-03` and the `estimated` cases leave the target disabled so tree and dossier agree.
- **F-2. The read-time window ignores whether F3 says performed.** The dossier (section 2, F4) says the start time is only meaningful when F3 says performed. The `readTimeInWindow` tree computes from the two times whatever F3 holds, except when it is explicitly not performed. `missing-05` leaves the window disabled.
- **F-3. No per-item state for a conflicting record.** The dossier (4.2) lists five item states and the tree has no conflict branch for Analytic B, so `conflicting-03` writes no completeness result (`notSpecified`).
- **F-4. Which wins: not-applicable or not-enabled.** If F7 says not given and the target is disabled, the dossier does not say whether the comparison is not-applicable or parameter-not-enabled. The tree says parameter-not-enabled. `out-of-scope-01` enables the target.
- **F-5. Overall status when an expected F3 is explicitly not performed.** The tree gives complete with a count of 0. The dossier (4.2) does not cover it. `out-of-scope-02` leaves the expected-items set disabled, and the test refuses a case that depends on this.

- **F-6. Not-collected expected item reads as complete (found in row DS2a-2).** In the completeness trees (0.1.0 and 0.1.1) an expected item recorded as not-collected is not counted, but the overall status has no branch for it and gives `complete`. It should be `indeterminate`, as for unknown. Needs a new version (0.1.2). No case depends on it; a todo test in `test/ccis-demo-exec-completeness.test.js` keeps it visible.

## Not built

_Update (row 1.5b): the three items below are now built. See "Resolved in 0.1.1" further down. The text is kept as written in 1.5a._

- **A parameter given in hours** (unit-conversion). Parameter units are minutes only (D-034) and no versioned conversion is declared. It needs a new artefact version (row 1.5b), so the case is listed under `deferred` in `index.json`.
- **Estimated bite time with the target enabled**, because of F-1 (also `deferred`).
- The certainty choice `needs-data` is not exercised.

## Resolved in 0.1.1 (row 1.5b)

New versions 0.1.1 of the two analytics (`ccis/examples/snake/snake-interval.analytics.0.1.1.json` and `snake-completeness.analytics.0.1.1.json`) agree with the dossier on the points below. The 0.1.0 files and the 23 cases above are unchanged and still apply to 0.1.0 (no executor yet, row 3.4, so nothing re-runs them against 0.1.1). Nine new cases apply to 0.1.1; their expected files say so in `x-analyticVersion`. Total: 32 cases.

- **F-1 resolved.** The comparison now honours the certainty choice and F7 exactly as the interval does, and declares `indeterminate`. An estimated bite time with the target enabled gives the result, `needs-data` or `parameter-not-enabled` (naming the choice) according to the choice; an absent or unknown F7 gives `indeterminate`.
- **F-2 resolved.** The read-time window gives `needs-data` unless F3 is documented as present. F3 explicitly not performed stays `not-applicable`.
- **F-3 resolved in part.** The per-item table (`itemStates`) declares and gives `conflict` when an item's record conflicts. The count, the overall status and the read-time window on a conflicting record are still not specified: `conflicting-04` writes no value for them (`notSpecifiedOutputs`).
- **Hours.** Both analytics declare the conversion `hoursToMinutes` 0.1.0 (hours to minutes, linear, factor 60, a definition of units and not a clinical value). The two duration parameters list `min` and `h`, and the trees reach the factor only through `convert`. Two cases give a duration in whole hours as a test-only placeholder; the allowed range is read in minutes after the declared conversion.
- **Certainty choice `needs-data`** is now exercised (`estimated-05`).

**Still open:** F-4 (not-applicable or not-enabled when F7 says not given and the target is disabled) and F-5 (overall status when an expected F3 is explicitly not performed). The 0.1.1 trees keep the 0.1.0 behaviour for both. They are owner questions: answer them by amending the dossier or by accepting the tree behaviour in a later row. Two cases wait for the answers and are listed under `deferred` in `index.json`.

| Case | Class | What it tests |
|------|-------|---------------|
| `unit-conversion-03-target-in-hours` | unit-conversion | Target given as 2 h; 90 min is within 120 min only through the declared conversion. |
| `unit-conversion-04-window-in-hours` | unit-conversion | Window given as 1 h; a read time 20 min after the start is in time only through the declared conversion. |
| `estimated-04-target-accept` | estimated | Estimated bite time, target enabled, choice accept: result given, estimate visible on both outputs. |
| `estimated-05-target-needs-data` | estimated | Same, choice needs-data: interval and comparison both needs-data. |
| `estimated-06-target-choice-not-enabled` | estimated | Same, choice not enabled: both name the choice as not enabled. |
| `missing-09-no-antivenom-status-target-enabled` | missing | F7 absent with the target enabled: interval and comparison both indeterminate. |
| `missing-10-antivenom-status-unknown` | missing | F7 unknown with the target enabled: both indeterminate. |
| `missing-11-no-clotting-status-window-enabled` | missing | F3 absent with the window enabled: needs-data, no in-time statement. |
| `conflicting-04-two-status-records-conflict` | conflicting | Two F3 records disagree: the per-item table reports `conflict`. |

## What is not proved

Nothing here is clinical. The cases show that the hand calculation is consistent with the dossier and the data is well formed, not that any threshold, interval or completeness rule is right for care. The placeholders are arbitrary.

## What the later rows add

Row 3.4 runs these envelopes through the executor and compares the output with the expected files. Row 1.6 adds invalid examples, one per validator layer.

## EMR export case (row DS7)

`emr-export/` holds one case that is **not** part of `index.json` and not one of the 32 cases: the EMR Enhancer's own export of its seeded demo case, as the bridge hands it to the CLI (built with the EMR's pure envelope builder and its demo mapper, at fixed times). `emr-demo-case.expected.json` is worked out by hand from the dossier, with the demo placeholder parameters. `test/ccis-demo-emr-export.test.js` runs it through the CLI.

Two findings came out of it (both described in D-069; neither is fixed here):

- **F-7. Node 1 has no outcome for a performed test whose result is explicitly unknown.** The dossier table covers a result that is present, absent, or not performed, not one recorded as unknown. The route stops at indeterminate with no outcome and goes to the gap report (D-053), so the pathway never says "documented". It also never reaches node 2.
- **F-8. An estimated bite time leaves no warning on an interval that is needs-data for another reason.** When the start time is missing the output has no value to mislead, so the executor adds no estimate warning. The dossier does not say whether it should.


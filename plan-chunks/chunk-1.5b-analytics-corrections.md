# Chunk 1.5b-analytics-corrections: Analytics version 0.1.1 and the deferred fixture cases

_Phase 1, Stage 2. Needs: 1.5 and 1.5a (done). Written just in time from findings F-1 to F-5 in `ccis/fixtures/snake/README.md` and decisions D-036 and D-037. This chunk file is docs only; the build happens at the next "do next" after the owner approves it._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/fixtures/snake/README.md` (findings and "Not built"); `docs/USE-CASE-SNAKE.md` sections 4 and 5; the two analytics files in `ccis/examples/snake/`; `ccis/schemas/analytics.schema.json` (`conversions`, `parameters`, `outputs`); `ccis/SPEC.md` CCIS-REQ-013, 042, 043, 072; `ccis/fixtures/snake/index.json` and `normal/normal-01-all-enabled.*`.

## What this row delivers

New **versions 0.1.1** of the two analytics packages, so the trees agree with the dossier, plus the two fixture cases that were deferred. Published content never changes (CCIS-REQ-013): the 0.1.0 files stay exactly as they are and keep their tests and fixtures.

## Decisions this chunk proposes (owner approves the chunk file; builder logs them, max 3 rows)

- **Location and names.** New files `ccis/examples/snake/snake-interval.analytics.0.1.1.json` and `snake-completeness.analytics.0.1.1.json`. Same ids, `version` `0.1.1`, `status` `draft`. Existing 0.1.0 files, the pathway and the element are not touched. (The pathway's `analytics` references use `^0.1.0`, which accepts 0.1.1.)
- **Per finding.**
  - **F-1 (interval comparison).** The `comparison` tree honours the certainty choice and F7 exactly as the `interval` tree does: an estimated bite time with the choice not enabled gives `parameter-not-enabled` (listing the choice), with the choice `needs-data` gives `needs-data`; a missing certainty gives `needs-data`; an absent or unknown F7 gives a declared state. Because `comparison` declares no `indeterminate`, add `indeterminate` to its declared states and use it for an absent or unknown F7, matching `interval`.
  - **F-2 (read-time window).** The `readTimeInWindow` tree gives `needs-data` (not an in-time statement) unless F3 is documented as present, since F4 is only meaningful when F3 says performed. F3 explicitly not performed stays `not-applicable`. F3 unknown or absent gives `needs-data`.
  - **F-3 (conflicting record).** Analytic B declares a `conflict` state on `itemStates` and gives it when an item's input is in conflict; the per-item table itself is not produced in that case. Output states are extended accordingly.
  - **F-4 and F-5 (dossier silent).** The builder does **not** choose. It lists each as an owner question in the chunk's report and in `DECISIONS.md` as an open item, keeps the 0.1.0 behaviour in 0.1.1, and builds no fixture that depends on it. The owner answers by amending the dossier (or accepting the tree behaviour) in a later row.
- **Hours conversion.** Declare one conversion in each analytic that needs one: `id` `hoursToMinutes`, `version` `0.1.0`, `from` `h`, `to` `min`, `kind` `linear`, `factor` `60`. The two duration parameters then list `units` `["min", "h"]`, and the trees apply the conversion only through the `convert` operator and a `conversion` reference, never a literal. The factor is a definition of units, not a clinical value, and is stated as such in a note. If the schema or operator whitelist cannot express this, the builder **stops on this item**, reports the point, and builds the rest.

## Build

1. **The two 0.1.1 files**, validated by `analytics.schema.json`. Everything not named above is copied unchanged from 0.1.0. A `provenance` note says what changed and why (F-1 to F-3, hours).
2. **Fixtures, new cases only** (existing cases and their files are not edited), in the existing class folders, with envelope and expected files made as in 1.5a:
   - `unit-conversion`: the parameter `targetIntervalDuration` given in hours (a test-only placeholder, whole hours, marked `testOnly`), with the comparison worked out by hand through the declared conversion; and the same for `readTimeWindow`.
   - `estimated`: estimated bite time with the target enabled and the certainty choice `accept`, then `needs-data`, then not enabled (the three combinations F-1 hid). The `needs-data` choice, never exercised in 1.5a, is covered here.
   - `missing`: F7 absent and F7 unknown with the target enabled (interval and comparison both `indeterminate`); F3 absent with the window enabled (`needs-data`).
   - `conflicting`: two F3 records disagreeing, now with the expected completeness result `conflict` for `itemStates`.
   Expected results are again derived from the dossier wording and arithmetic, not from the trees. Where tree and dossier still disagree, stop and report.
3. **Versioning of fixtures.** Expected files for the new cases name the analytic version they apply to (`x-analyticVersion`). Existing cases keep applying to 0.1.0 and are not re-run against 0.1.1 (no executor yet, row 3.4).
4. **Index and README.** Add the new cases to `ccis/fixtures/snake/index.json`, remove the two items from `deferred`, and update the fixtures README by adding a short "Resolved in 0.1.1" list and keeping F-4 and F-5 open. Do not rewrite 1.5a text beyond that.
5. **Tests.** `test/snake-fixtures.test.js` is extended (not weakened) to cover the new cases. A new `test/snake-analytics-0.1.1.test.js` checks: both files validate; every field not named above is identical to 0.1.0 (deep compare of the untouched parts); the 0.1.0 files are byte-identical to what is committed; the declared conversion is the only place the factor appears and no numeric literal exists in any tree; the new output states are declared; references and parameter ids resolve.
6. **Logging.** Max 3 rows in `DECISIONS.md`.

## Do not

- Do not edit any 0.1.0 artefact, any earlier fixture, any schema, `ccis/SPEC.md` or earlier chunk files; a needed change is a numbered amendment or a new row.
- Do not run or implement the trees (row 3.4). No real data, no real codes, no clinical meaning for any number.
- Do not decide F-4 or F-5.
- No invalid examples (row 1.6).

## Done when

`npm test` passes once; at most 3 deliberate-breakage checks (for example edit a 0.1.0 file and see the identity test fail; remove the `testOnly` mark from an hours placeholder; change an expected comparison for the hours case), each seen failing then restored.

## Size guard

2 artefact files, about 10 new cases (20 files), 1 new test file plus additions to one, README and index updates, up to 3 decision rows. If it does not fit, split into `1.5c`: the two artefact versions first; the new cases second.

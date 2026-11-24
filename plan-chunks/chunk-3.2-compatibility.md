# Chunk 3.2-compatibility: Compatibility resolver and execution policy v0

_Phase 3, Stage 2 (written 2026-11-24). Needs: 3.1 (done). This chunk file is docs only; the resolver is built at the next "do next" after the owner approves it. No schema change and no spec amendment is proposed._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/SPEC.md` section 7 (CCIS-REQ-055 to 061) and REQ-011, 016, 025, 029, 042, 046 to 052; `ccis-import.js` (`importEnvelope` result: `context`, constants); `ccis-validator-semantic.js` (the `^x.y.z` range rule and `SUPPORTED_*` constants, to reuse the same behaviour: REQ-045); `ccis/schemas/manifest.schema.json` (`status`, `requires`, `validation`, `mandatoryExtensions`); `ccis/schemas/analytics.schema.json` (`context`, `inputs`, `onMissing`, `parameters`, `operatorSet`, `executionProfile`); the snake pathway, element and two analytics files in `ccis/examples/snake/`; the 32 fixture envelopes (as contexts, through 3.1).

## What this row is for

Decide, for one pathway and each analytics package it lists, whether the package **can run on this context, and say why** (REQ-055 to 061). Pure functions: no file access, no network, no clock. Same input gives byte-identical output. Matching is only by declared ids, exact versions and declared ranges, **never by text similarity or a guessed mapping** (REQ-060). Plus **execution policy v0**: which outcomes and statuses may run, and which banner shows.

## What earlier rows found (the build must handle each)

1. **The runnable unit is the analytics package.** In the snake pathway both packages are `optional`, so a pathway-level outcome alone would hide "needs data". The resolver therefore returns one outcome for the pathway and one per listed package (3.5 plans runs from the per-package ones).
2. **`onMissing` says how a package handles a missing input** (`needs-data`, `indeterminate`, `not-applicable`, `conflict`, `parameter-not-enabled`). Only `needs-data` inputs can make a package "Needs data"; the others become limitations, because the executor (3.4) handles them with a declared result.
3. **3.1 sorted records and removed rejected and unmapped ones.** Data readiness reads the context only, so rejected, unmapped and entered-in-error records are never counted as present data (REQ-034).
4. **Parameters are `enabledByDefault: false`.** A disabled parameter does not stop a package running (its results say "not enabled"), so it is a **limitation**, not a refusal. Every snake package therefore resolves at best to "Compatible with limitations" until a clinician enables parameters.
5. **No validation data exists yet** beyond `manifest.status` and optional `manifest.validation` (A-003). The assurance check uses those two only. Validation records (2.3a) and pins (3.6) are not inputs here.
6. **Conflicting observations are not detected here** (3.1 keeps them; the executor omits conflicted inputs, D-050). A finding, not a gap to fill.
7. **Terminology binding resolution is not part of this row.** Code fields are matched by declared concept ids only. Recorded as a finding for 3.4 or later.

## The design (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

**Call.** `resolveCompatibility({ pathway, held, context, runtime, request })` returns the result below.
- `held`: artefact documents the app holds (elements, analytics packages, decision nodes), looked up by manifest `id`, `type`, `version`; not re-validated here.
- `context`: the 3.1 canonical context, or `null` (catalogue view before any import).
- `runtime`: `{ standardMajors, engine: { version }, operatorSet: { name, majors }, limits: { maxSteps, maxDepth, maxOutputBytes }, fhir: absent, understoodExtensions: [] }`, passed in (constants live in the caller, as in 2.x).
- `request`: `{ mode }`, `mode` is `preview` (default) or `governed`.

**The six checks** (each returns a state: `met`, `not-met`, `limited`, `needs-data`, `not-evaluable`; and lists, in words and ids, what was satisfied, what is missing, what would be needed; REQ-057):
1. **Artefact:** pathway references and element ranges resolve to held artefacts of the right type and a version in range; required analytics held and in range; every pathway node present; `mandatoryExtensions` all understood (REQ-016); standard major supported. Optional analytics not held: `limited`.
2. **Semantic:** each analytics `context` ref and `inputs` entry names an element field that exists in the held element, with the same `type`; input `units` are a subset of the field's permitted units, else a declared `conversions` entry covers the difference (REQ-042); the context's applied versions are exactly the held ones (REQ-025). Exact ids only.
3. **Schema:** every held document passes its committed validator; the context form is `ccis-context/1`; no artefact has an unsupported standard major.
4. **Data readiness:** only if checks 1 to 3 are met and a context exists. An input is **missing** when the context has no observation of its concept id, or the only observations have state `absent`, `unknown` or `not-collected`. `not-applicable` and `explicitly-negative` are documented answers, not missing. A required package with a missing `needs-data` input: `needs-data`. Missing inputs with other `onMissing` values, any missing input of an optional package, and disabled parameters: `limited`. No context: `needs-data` for every package (nothing has been imported).
5. **Runtime:** `requires.engine` satisfied by the engine version; operator set name and a supported major; `executionProfile` limits not above the runtime ceilings; `requires.fhir` present and no FHIR support: `not-met`.
6. **Assurance suitability** (execution policy v0, below): from `manifest.status` and `manifest.validation` only.

**Outcome rules (exactly one, REQ-056; first that applies):**
1. **Not eligible:** check 6 is `not-met`.
2. **Incompatible:** any of checks 1, 2, 3, 5 is `not-met`, **or `not-evaluable`** (fail closed: unknown never becomes compatible, REQ-061; the reason code says it could not be evaluated, not that it failed).
3. **Needs data:** check 4 is `needs-data` (REQ-058: the model matches and data is lacking).
4. **Compatible with limitations:** any check is `limited`.
5. **Compatible:** all six `met`.

Every result lists all six checks whatever the outcome. The pathway's outcome is the worst outcome of its **required** packages, then the pathway's own checks; optional packages can only lower it to "with limitations". Reason codes are a frozen catalogue `COMPAT_REASONS` (id, check, one-line meaning), exported.

**Execution policy v0** (`executionPolicy(result, request)` -> `{ mayRun, banners }`):
- `mayRun` is true only for Compatible and Compatible with limitations. Needs data, Incompatible and Not eligible do not run.
- **Preview mode (default):** any status except `rejected` and `withdrawn` may run (`draft`, `submitted`, `in-review`, `reviewed`, `deprecated` included). `deprecated` adds a limitation. Banner `preview-not-validated` ("Preview. Prototype, synthetic data only, not validated, not for clinical use.") on every status except `validated` and `conditionally-validated`; those two show their `validation` scope (version, population, setting, intended use; REQ-049) and, for conditional, a notice that conditions must be shown (REQ-050). `reviewed` never reads as validated (REQ-051).
- **Governed mode:** only `validated` or `conditionally-validated`, with `manifest.validation.version` equal to the package version (REQ-052). Anything else: Not eligible, with the reason.
- Results are descriptive. Nothing here makes a recommendation or claims clinical safety (core rules).

## Build

1. `ccis-compat.js` (pure; imports only the committed validators bundle and `./ccis-import.js` for the context-form constant). Exports `resolveCompatibility`, `executionPolicy`, `COMPAT_REASONS`, `OUTCOMES`, `PREVIEW_BANNER`.
2. `test/ccis-compat.test.js`, with these checks:
   - (a) **Snake oracle.** The snake pathway and packages against the 33 envelopes (imported through 3.1) with hand-calculated outcomes for named cases (complete record, missing bite time, unknown clotting status, conflicting, out-of-scope, EMR export); the five outcomes each reached once.
   - (b) Each check reaches `met`, `not-met`, `limited`, `needs-data` or `not-evaluable` where it can, by mutating one held document or the runtime.
   - (c) Precedence: several failures at once give the outcome the rules name, and all six checks are still listed.
   - (d) **No guessing:** a field with a similar name, a case-changed id, or a near version never matches; the unit rule rejects a different unit and accepts a declared conversion only.
   - (e) **Unknown stays unknown:** `unknown`, `absent`, `not-collected` observations count as missing; `entered-in-error` is not in the context and counts as missing; a documented `not-applicable` does not.
   - (f) Policy: each status in both modes; banners; `governed` refuses `draft`, `reviewed` and a validation of another version.
   - (g) Determinism (same bytes twice, held order and context record order irrelevant), no input mutation (frozen), the pure-library scan (imports: the validators bundle and `./ccis-import.js` only).
3. `README.md` ("Compatibility" paragraph: six checks, five outcomes, `not-evaluable` means Incompatible, policy v0, what is not checked), `DECISIONS.md`, tracker.

**Not in this row:** CLI `list compatible` (3.7); running anything (3.3 to 3.5); the catalogue UI (3.8); pins and published checksums (3.6); terminology binding resolution; conflict detection; any schema or spec change; reading files.

## Questions for the owner (defaults apply if you only say "approve")

1. One outcome per analytics package plus one for the pathway (the pathway's is the worst of its required packages)? Default: yes.
2. A check that cannot be evaluated gives **Incompatible** with a reason that says so (fail closed)? Default: yes.
3. **Needs data** does not run in policy v0 (it is listed with what is missing, not executed)? Default: yes.
4. Preview mode lets every status except `rejected` and `withdrawn` run with the banner; governed mode needs a validated status whose scope names the exact version? Default: yes.
5. An input is missing only when there is no observation, or only `absent`, `unknown` or `not-collected`; `not-applicable` and `explicitly-negative` count as answered? Default: yes.

**Done when:** the snake oracle gives the hand-calculated outcomes, all five outcomes and every reason code are reached once, the no-guessing, unknown-stays-unknown and policy checks pass, and three deliberate breakages (count `unknown` as present; match a field by case-folded name; let a `not-evaluable` check give Compatible) are each seen failing a test. The owner runs or skips `npm test` as instructed in that session.

**Size guard:** 1 new module, 1 test file, README, DECISIONS, tracker; no CLI, no schema change. If more is needed, split checks 5 and 6 and the policy into row `3.2a`.

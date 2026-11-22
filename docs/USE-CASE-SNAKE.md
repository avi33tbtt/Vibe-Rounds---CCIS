# Use-case dossier: snake envenomation process metrics (first slice)

> **Status:** draft for clinician review at gate R0. Prototype. Synthetic data only. Not for clinical use.
> This dossier names the facts, questions and measures of the first slice. It contains **no thresholds, no doses, no bands and no formulas**. Every number that would act as a threshold is a **parameter** that arrives **disabled** and is supplied only by a named local clinician (CCIS-REQ-008, CCIS-REQ-029). No value in this document comes from any language model.

**Clinician owner:** *not yet named.* The parameters in section 5 stay disabled until a named local clinician owns them. Naming that person is a user action (see the tracker).

**What a clinician is asked to judge here:** whether the facts (section 2) and the questions (section 3) are the right ones, and whether each measure (section 4) is described in a way they would recognise. Section 8 lists specific questions.

The name "20-minute clotting test" is used only as the name of a test, as it appears in the plan. This dossier states nothing about how that test is read or when.

## 1. Scope and intended use

- **Population (in words):** people presenting to a care setting with a suspected snake bite. Any narrower scope (age groups, bite type, setting) is the local clinician's to declare. None is assumed here.
- **Intended use:** descriptive process measures for local review: how long things took, and how completely they were documented. This is **not** decision support (CCIS-REQ-005). Results describe the record; they do not say what care should have been given.
- **Out of scope for this slice:** diagnosis, severity grading, treatment choice, products, quantities and doses, and any recommendation or alert.
- **Why this case first:** time and documentation questions can be asked without any clinical threshold, which lets the whole CCIS chain be proven without a model supplying clinical numbers (D-008).

## 2. The contextual element

One element, "snake envenomation: timing and documentation". It records the facts below. Each fact has a kind of value and time meaning, in words. Field names and code values are not defined here. Terminology bindings are supplied later through a terminology package and no code is invented (CCIS-REQ-041).

| # | Fact | Kind of value | Time meaning | Usual source class | Notes on missing data |
|---|------|---------------|--------------|--------------------|-----------------------|
| F1 | Time of the bite | A date and time, plus how certain it is (exact, estimated, or not known) | Effective time is when the bite happened. Recorded time is when it was entered. | Patient-reported | Often only an estimate. "Estimated" must stay visible. Unknown is not the same as absent. |
| F2 | Time of arrival at the facility | A date and time | Effective time is the arrival itself. | Clinician-entered, or imported from a registration system | If absent, nothing downstream may assume it. |
| F3 | Whether the clotting test was performed | A coded status: performed, explicitly not performed, or unknown | Effective time is when the status was true. | Clinician-entered | "Explicitly not performed" and "no entry at all" are different states. |
| F4 | Time the clotting test was started | A date and time | Effective time is the start of the test. | Clinician-entered | Only meaningful when F3 says performed. Otherwise it is not applicable. |
| F5 | Time the clotting test result was read | A date and time | Effective time is when the result was read. This is **not** the time it was typed in. | Clinician-entered | Keep separate from the recorded time below. |
| F6 | Result of the clotting test | A coded result from a small set supplied by the terminology package | Same effective time as F5. | Clinician-entered or clinician-verified | A result that was not read is a missing-data state, never a result value. |
| F7 | Whether anti-snake-venom was administered | A coded status: given, explicitly not given, or unknown | Effective time is when the status was true. | Clinician-entered | "Not given" is a recorded fact. "No entry" is not. |
| F8 | Time anti-snake-venom administration began | A date and time | Effective time is the start of the first administration. | Clinician-entered | Only meaningful when F7 says given. Otherwise it is not applicable. |
| F9 | Reason anti-snake-venom was not given | A coded reason, optional | Effective time as for F7. | Clinician-entered | Optional. Only meaningful when F7 says not given. |

**Rules that apply to every fact above** (from `ccis/SPEC.md`):

- Every time carries an explicit time zone or offset, and records both effective and recorded time (CCIS-REQ-035; IMP-043 to IMP-046 in `docs/IMPORT-CONTRACT.md`).
- Every value carries a source class and provenance (CCIS-REQ-036).
- The six data states stay distinct: absent, unknown, not collected, not applicable, explicitly negative, entered in error (CCIS-REQ-032, CCIS-REQ-033).
- Records entered in error are excluded by default (CCIS-REQ-034).
- The element does **not** record the product, quantity or dose of anything. That is deliberate.

## 3. The pathway

One short pathway, "snake envenomation: documentation path". It **describes information needed**. It does not authorise or direct any treatment (CCIS-REQ-027).

**Stages** (workflow stages for information, not clinical actions):

1. Presentation (needs F1 and F2).
2. Clotting-test documentation (needs F3 to F6).
3. Anti-snake-venom documentation (needs F7 to F9).
4. Gap report (a place for cases whose record cannot answer a question).

**Two decision nodes.** Each is a question about the record. Each has an outcome for **every** state, including an explicit indeterminate one, and no outcome leads nowhere (CCIS-REQ-026).

**Node 1: "Is the clotting test documented as performed, and is its result documented?"**

| Outcome | Meaning | Goes to |
|---------|---------|---------|
| Documented with result | Performed, and a result with its read time is present. | Stage 3 |
| Documented without result | Performed, but no result or read time is present. | Stage 3, flagged |
| Documented as not performed | The record explicitly says it was not performed. | Stage 3 |
| **Indeterminate** | The record does not say either way, or two records conflict. | Stage 4 |

**Node 2: "Is anti-snake-venom administration documented, with its time?"**

| Outcome | Meaning | Goes to |
|---------|---------|---------|
| Given, time documented | Status is given and a start time is present. | End of pathway |
| Given, time not documented | Status is given but no start time is present. | Stage 4 |
| Documented as not given | The record explicitly says it was not given. | End of pathway |
| **Indeterminate** | The record does not say either way, or two records conflict. | Stage 4 |

Indeterminate is never folded into "no" or "not performed". It leads to a report that the record cannot answer the question (CCIS-REQ-033, CCIS-REQ-066).

## 4. The two analytics

Both are **descriptive** (CCIS-REQ-005). Both are deterministic and produce a three-valued or typed result, never a guessed one (CCIS-REQ-066, CCIS-REQ-067).

### 4.1 Analytic A: bite-to-anti-snake-venom interval

- **Question:** for this case, how much time passed between the bite and the start of anti-snake-venom administration?
- **Needs:** F1 (with its certainty), F7 and F8.
- **Result:** the elapsed time between F1 and F8, in the unit the user displays it in, together with the certainty of F1 (so an estimated bite time is visibly an estimate).
- **When it cannot be computed:** the result says why, and no value is given. A missing F1 or F8 is **needs data**. F7 "not given" is **not applicable**. F7 unknown is **indeterminate**. A missing value is never treated as zero.
- **Conflicts:** if F8 is earlier than F1, the result reports a conflict and gives no interval.
- **Comparison to a target:** only if a target is supplied and enabled by the local clinician (section 5). While it is disabled, the analytic reports the interval and **says the comparison is not enabled**. It does not produce a comparison value (CCIS-REQ-072).
- **Time units:** any conversion between units or time zones is explicit (CCIS-REQ-042, CCIS-REQ-043).

### 4.2 Analytic B: documentation completeness of the clotting test

- **Question:** for this case, which parts of the clotting-test documentation are present, and which are not?
- **Items considered:** F3 (performed status), F4 (start time), F5 (read time), F6 (result).
- **Result:** for each item, one of: documented; not documented (nothing recorded); explicitly recorded as not performed; unknown; not applicable. Plus a count of how many items are documented out of those currently expected.
- **What "expected" means:** which items count as expected is a clinician's decision and is a parameter (section 5). Until it is supplied and enabled, no item is counted as expected, and the analytic reports the per-item states only.
- **Overall status when expected items are set:** complete (all expected items documented); incomplete (at least one expected item is not documented, meaning nothing was recorded); indeterminate (some expected items are unknown and none is known to be missing).
- **Important distinction:** this analytic measures the **record**. A "not documented" item means nothing was recorded. It does **not** mean the test was not done, and the result never says so. The record cannot tell "not done" from "done but not written down". The analytic states this in its output.
- **Declared missing-data behaviour:** this paragraph and the two before it are the explicit missing-data behaviour this analytic declares (CCIS-REQ-033). Nothing recorded is reported as "not documented", a typed item state, never as a false or a zero.
- **Not applicable items:** if F3 says explicitly not performed, F4 to F6 are not applicable and are not counted as missing.

## 5. Parameters (all disabled by default)

Every parameter below arrives **disabled**, is supplied by the named local clinician, and carries its units and allowed range (CCIS-REQ-029). **No default value is proposed.** The plan, the book and any model are not sources for these values.

| # | Parameter | What it controls | Kind | Used by |
|---|-----------|------------------|------|---------|
| P1 | Target bite-to-anti-snake-venom interval | Enables the comparison in Analytic A. Without it, the interval is reported with no comparison. | A duration, with its unit | A |
| P2 | Acceptable certainty of bite time | Whether an estimated bite time is accepted, flagged only, or leads to needs data. | A choice | A |
| P3 | Expected clotting-test documentation items | Which of F3 to F6 count as expected in Analytic B. | A set of items | B |
| P4 | Window for the result read time | Whether, and how long after the test start, a result read time counts as in time. Enables an "in time" statement. | A duration, with its unit | B |
| P5 | Edge rule for boundaries | Whether a value exactly on a limit counts as inside or outside. Recorded with each limit. | A choice | A, B |
| P6 | Population scope | Any narrowing of who the measures apply to (see section 1). None is assumed. | Clinician-defined criteria | A, B |

While a parameter is disabled, a computation that depends on it **does not produce a value from it**. It reports that the parameter is not enabled (CCIS-REQ-072).

**Fixtures and parameters.** A fixture that needs an enabled parameter will use a clearly labelled **test-only placeholder** that is never a clinical recommendation and never ships enabled. This is a design decision (D-013).

## 6. Fixture classes to be built later

No data appears in this dossier. Each class below will be built in Stage 2 as synthetic cases with independently hand-calculated expected results, for both analytics and for the pathway.

| Class | What it tests |
|-------|---------------|
| Normal | A complete, consistent record gives the expected interval, completeness states and pathway route. |
| Boundary | A value sitting exactly on an enabled limit follows the declared edge rule (P5), in both directions. |
| Missing | Removing each required fact in turn changes the result to needs data or indeterminate, never to zero, false or complete. |
| Conflicting | Records that contradict each other (for example two different bite times, or an administration before the bite) produce a reported conflict and no computed value. |
| Out-of-scope | A case outside the declared population, or one where administration is explicitly not given, gives not applicable and not a value. |
| Unit-conversion | Times given in different time zones and a parameter given in a different unit give the same result only through explicit, declared conversion. |

## 7. What the slice will NOT prove

- That the measures are clinically meaningful, or that any target is the right one.
- That faster or more complete documentation means better care or better outcomes.
- That anti-snake-venom was appropriate, timely or correctly dosed, or that the clotting test was done or read correctly.
- That the software is clinically safe. Conformance and clinical safety are recorded separately (CCIS-REQ-006).
- That the approach works for other conditions, settings or populations. A second demo (diabetes and CKD) is planned separately.
- Anything about real patients. Only synthetic data is used (CCIS-REQ-007).
- Anything about FHIR Mode, cohorts, AI assistance, authoring routes or the marketplace beyond the local catalogue.
- That the facts are the right ones. That is the clinician's review.

## 8. Questions for the clinician reviewer

1. Are F1 to F9 the right facts? What is missing, and what is unnecessary?
2. Is "start of the first administration" the right moment for F8, or is another moment used locally?
3. Is "time the result was read" (F5) distinct from other times your setting records? Is the distinction between read time and the time it is entered clear and usable?
4. Are the two decision-node questions the right documentation questions? Are the outcomes exhaustive?
5. Can a bite time reported by a companion be treated as patient-reported, or does your setting need to distinguish them? (The source-class list in the specification has no separate class for an informant. If this matters, it becomes a numbered amendment.)
6. Is it acceptable that Analytic B reports "not documented" and never "not done"?
7. Which parameters (P1 to P6) would your setting want, and who would own each one?
8. Is anything in this dossier worded as a recommendation, a threshold or a dose? If so, mark it.

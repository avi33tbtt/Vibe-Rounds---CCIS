# Use-case note: diabetes and chronic kidney disease (second demo)

> **Status:** demonstration only. Prototype. Synthetic data only. Not for clinical use. No clinical review has happened and no clinician owner is named.
> This note contains **no threshold, target, band, dose or drug**. It names only what can be recorded, and when.

## 1. Why a second demo
The first demo (snake envenomation, `docs/USE-CASE-SNAKE.md`) has one context. This one has two contexts that share concepts (kidney function and glucose control are recorded in both care settings), so it can prove **composition** (shared concepts identified by meaning, REQ-023, REQ-024) and **failure policy** (a missing or unknown context gives `indeterminate`, never false or normal).

## 2. Facts of the diabetes context (element `diabetes.glycaemia-documentation`)
| Id | Field | What is recorded |
|----|-------|------------------|
| D1 | `diabetesTypeStatement` | The type as the record words it. Never classified or inferred. |
| D2 | `diagnosisDate` | The date diabetes was recorded as diagnosed (often only a year). |
| D3 | `hba1cValue` | An HbA1c value with its unit (`mmol/mol` or `%`). No conversion, no judgement. |
| D4 | `hba1cResultTime` | When the sample was collected. |
| D5 | `glucoseValue` | A glucose value with its unit (`mmol/L` or `mg/dL`). No conversion, no judgement. |
| D6 | `glucoseResultTime` | When the sample was collected. |
| D7 | `glucoseFastingStatus` | The fasting status as recorded. Never inferred from the time of day. |
| D8 | `treatmentPlanDocumented` | Only that a plan is written down, never what it says. |

Every field keeps the six epistemic states apart (absent, unknown, not collected, not applicable, explicitly negative, entered in error).

## 2b. Facts of the kidney context (element `ckd.kidney-function-documentation`)
| Id | Field | What is recorded |
|----|-------|------------------|
| K1 | `kidneyDiseaseStatement` | The condition as the record words it. Never classified or graded. |
| K2 | `diagnosisDate` | The date chronic kidney disease was recorded as diagnosed. |
| K3 | `creatinineValue` | A creatinine value with its unit (`umol/L` or `mg/dL`). No conversion, no judgement. |
| K4 | `creatinineResultTime` | When the sample was collected. |
| K5 | `egfrValue` | An eGFR value as reported (`mL/min/1.73m2`). Never calculated here. |
| K6 | `egfrResultTime` | When the sample was collected. |
| K7 | `egfrMethodStatement` | The method as the result states it. No formula named as a rule. |
| K8 | `kidneyFollowUpDocumented` | Only that a follow-up arrangement is written down, never what it is. |

Two near-collisions are deliberate for row 4.5c: K2 shares its key with D2 but means a different diagnosis, and K8 reads like D8 but is a different fact; neither may be merged by label (REQ-024).

## 2c. The group (`diabetes-ckd.group.json`)
The group lists both elements at exact version `0.1.0`. The diabetes element is mandatory and the kidney element optional, so a missing kidney context can later be reported as indeterminate (row 4.5f). It declares two shared concepts and both are `related-not-merged`: the two `diagnosisDate` fields (different dates that share a key) and the two follow-up fields (different facts that read alike). No pair is `same-concept`, because the demo has no two fields that mean the same thing. Every key that both elements define must be listed by a concept; the validator refuses an undeclared overlap (CCIS-V5-012). Unit conversion for glucose and creatinine is still left to row 4.5d.

## 2d. The combined analytic (`diabetes-ckd.sample-gap.analytics.json`)
It reads one fact from each context, the HbA1c and the creatinine collection times, and gives the signed gap in minutes and which came first. It uses no clock, no parameter and no number, and says nothing about any value. A missing diabetes time is `needs-data`; a missing kidney time is `indeterminate`, because the kidney context is optional in the group and its absence must never read as normal (tested in row 4.5f).

Version 0.1.1 (row 4.5d.1) adds `sampleWithinWindow`: were the two recorded collection times within a window a local clinician supplies. The window and the edge rule are disabled parameters with no value, so the output reads `parameter-not-enabled`; the 0.1.0 file is unchanged.
Why not "how recent is a result": the operator whitelist has no evaluation-time reference (finding F-13, D-287), so recency is asked between the two recorded times, not against now.

Version 0.1.2 (row 4.5d.1a) adds `documentedFactCount`: how many of four listed facts (the statement and the collection time, in each context) are recorded. A missing kidney context reads `indeterminate`, never a low count.
It only counts: a complete label needs an expected number or set, which is a local clinician's choice, so nothing here reads as complete.

Version 0.1.3 (row 4.5d.2) declares two unit conversions (creatinine mg/dL to umol/L, glucose mmol/L to mg/dL) and shows converted values. The factors are unit definitions with no reviewed clinical source (D-292); a value is shown, never judged.
A value in an unexpected unit is refused, never guessed, and a missing value is `indeterminate` or `needs-data`, never zero.

## 3. Rows
| Row | What it adds |
|-----|--------------|
| 4.5a | This note and the diabetes element |
| 4.5b | The kidney element |
| 4.5c | Composition (needs the owner's decision on groups, D-274) |
| 4.5d | One combined analytic across both contexts |
| 4.5e | Fixtures with hand-calculated expected results |
| 4.5f | Failure-policy fixtures |
| 4.5g | Market entry, page selection, browser smoke |

## 4. Not in scope
Diagnosis, classification, targets, treatment choice, any drug or dose, and any interpretation of a value. Every parameter that could act as a threshold stays disabled until a named local clinician owns it.

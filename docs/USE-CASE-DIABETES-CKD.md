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

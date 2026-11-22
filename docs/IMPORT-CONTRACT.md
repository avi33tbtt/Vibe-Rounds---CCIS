# CCIS Import Contract, draft 0.1 (in words)

> **Status:** draft for review at gate R0. Prototype. Synthetic data only. Not for clinical use.
> This document says **what** the EMR Enhancer export must carry and **how** the CCIS app must treat it. It fixes no field names, no file layout and no JSON shape. Those are defined in Stage 2 (after gate R0 and "start stage 2") and will be checked by fixtures that CCIS builds.

The export is called the **context envelope**. Items below have ids `IMP-nnn` so later rows can trace them. Where an item implements a specification requirement, the requirement id from `ccis/SPEC.md` is given. MUST and MUST NOT carry their usual specification meaning.

## 1. Purpose and principles

The import is the trust boundary between the EMR Enhancer and the CCIS engine. A file that merely parses is not enough: the app must establish what the data mean, which versions produced them, and whether they satisfy a package's needs.

- **IMP-001** The envelope MUST be the only thing that crosses from the EMR Enhancer to the CCIS app. The app MUST NOT read the EMR's database or code. (CCIS-REQ-003)
- **IMP-002** The envelope MUST be minimal: it carries what packages need to run and nothing more.
- **IMP-003** Nothing is silently lost or coerced. Every record is either used, or reported with a reason (section 5). (CCIS-REQ-084)
- **IMP-004** The imported data is a copy. The EMR remains the system of record. (CCIS-REQ-004)

## 2. What the envelope must carry

### 2.1 About the envelope itself

- **IMP-010** The version of the envelope contract it follows.
- **IMP-011** The time the export was made, with an explicit time zone or offset.
- **IMP-012** Which system produced it and that system's version.
- **IMP-013** A declaration of which categories of content are included (see section 4), so the reader can tell "excluded" from "absent".
- **IMP-014** A means for the reader to detect that the file was corrupted or truncated. The mechanism is defined in Stage 2.

### 2.2 The case

- **IMP-020** One case, referred to by a **pseudonymous reference only**. The reference MUST NOT be, contain, or be trivially derived from a name, record number or other direct identifier. (CCIS-REQ-083)
- **IMP-021** Encounter and other internal references MUST be resolvable inside the envelope without exposing identifiers the app does not need.

### 2.3 Applied knowledge

- **IMP-030** The identifier of every contextual element and element group applied to the case, **each with its exact version**. A range or "latest" is not acceptable. (CCIS-REQ-014)
- **IMP-031** The identifier of every pathway applied to the case, with its exact version.
- **IMP-032** The envelope MUST record the versions that were applied to the case, not the versions that are newest at export time. Updating a library definition in the EMR never changes an existing case unless someone does so explicitly.

### 2.4 Observations

Each observation is a measurement or finding about the case. An observation MUST carry:

- **IMP-040** Which clinical concept it is about, identified by stable identifiers and, where available, terminology codes. (CCIS-REQ-040)
- **IMP-041** Its value and the **kind** of value it is (for example a quantity, a coded value, a yes/no value, a date or time). The exact set of kinds is fixed in Stage 2. A value MUST NOT be reduced to untyped text.
- **IMP-042** For a quantity, its **unit**, stated explicitly. A number with no unit is not a quantity. (CCIS-REQ-042)
- **IMP-043** Its **effective time**: when it was measured, reported, or clinically true.
- **IMP-044** Its **recorded time**: when the EMR learned of it, where known. If unknown, the envelope says so. It MUST NOT copy the effective time into its place. (CCIS-REQ-035)
- **IMP-045** Collection time, where it differs from the other two and matters.
- **IMP-046** Time values MUST state their time zone or offset, or state that it is unknown.
- **IMP-047** Its **status** (for example preliminary, final, corrected, entered in error).
- **IMP-048** Its **source class**: patient-reported, clinician-entered, clinician-verified, imported, device, derived, or AI-proposed. (CCIS-REQ-036)
- **IMP-049** Its **provenance**: the kind of system or role that supplied it, the originating source or definition, whether it was verified, and whether it has been corrected. Provenance, certainty and any model confidence MUST be kept separate and MUST NOT be merged into one number.
- **IMP-050** For a derived value: how it was derived (formula and version) and which source observations it came from. (CCIS-REQ-038)
- **IMP-051** The state of any value that is not present, using the distinct states in section 3.

Personal names of authors or performers are identity and are excluded by default (section 4). Provenance therefore names the **role or system class**, not the person.

### 2.5 Clinical events

- **IMP-060** Each event (for example a procedure, an encounter milestone, an administration) MUST carry its type, classified by meaning before export; its time or period with explicit time zone; its status; its source class; and its provenance.
- **IMP-061** An event whose meaning has not been classified MUST NOT be exported as if it were. It is either left out with a declared reason, or exported as clearly unclassified.

### 2.6 Terminology codes

- **IMP-070** Every code MUST carry its code system, the version of that system where one exists, and the code itself.
- **IMP-071** Every code MUST carry a **verification state**. There are at least two: verified and unverified. Further states are defined in Stage 2.
- **IMP-072** An unverified code MUST NOT be presented as verified, in the envelope or after import. The importer resolves meaning only through explicit, verified mappings. (CCIS-REQ-040, CCIS-REQ-041)
- **IMP-073** A concept that has no code MUST be exported as having none. A code MUST NOT be invented to fill the gap.

### 2.7 History and corrections

- **IMP-080** Repeated measurements are append-only: a new value is a new observation, and an earlier value is never overwritten.
- **IMP-081** A correction MUST preserve the original and link to it, so that analyses can order by effective time and an audit can see when the app learned each value.

## 3. Distinct states that must never be merged

The envelope and the importer MUST keep these states separate and MUST NOT convert one into another. An empty text, a zero or a blank is never an acceptable stand-in for any of them. (CCIS-REQ-032, CCIS-REQ-033)

| State | Meaning in words |
|-------|------------------|
| Absent | Nothing is recorded, and nothing is stated about why. |
| Unknown | It was asked or looked for, and the answer is not known. |
| Not collected | It was never measured or asked. |
| Not applicable | The question does not apply to this case. |
| Explicitly negative | A recorded finding that it is not present. |
| Entered in error | It was recorded by mistake and retracted. |

Also kept distinct, by source class (IMP-048): patient-reported, clinician-confirmed, imported, device and machine-generated values. An AI-proposed value stays AI-proposed unless a clinician has verified it and that act is recorded in the envelope. (CCIS-REQ-037)

## 4. What is excluded by default, and how that could change

By default the envelope MUST exclude three things. (CCIS-REQ-082, CCIS-REQ-034)

1. **Personal identity.** Names, direct identifiers, contact details and the like.
2. **Narrative.** Free-text notes and other prose.
3. **Entered-in-error records.**

- **IMP-090** The envelope MUST declare these exclusions (IMP-013), so a reader can tell the content was withheld, not forgotten.
- **IMP-091** If excluded content arrives anyway, the importer MUST NOT keep or show it. It rejects those records with a reason that names the category, not the content (section 5).

**How a purpose could change this later.** This is a rule for future design, not a feature of 0.1.0.

- **IMP-092** Inclusion of any excluded category is allowed only for a stated purpose, and only through an explicit user action at export and again at import. Neither side may enable it by default or by configuration alone.
- **IMP-093** The purpose and the categories included MUST be recorded in the envelope and in the import report, and carried into the run record.
- **IMP-094** Narrative, when included, MUST stay distinct from concepts extracted or inferred from it.
- **IMP-095** Entered-in-error records, when included, MUST be marked as such and MUST never be counted as present data.
- **IMP-096** In 0.1.0 no purpose is defined that allows personal identity to be included. Adding one would be a specification amendment (see `ccis/CHANGELOG.md`).

## 5. The import report

Every import MUST produce a report. (CCIS-REQ-084, CCIS-REQ-044)

- **IMP-100** Every incoming record falls into **exactly one** of four categories. A record here means each observation, each clinical event, and each reference to an applied element, group or pathway.
- **IMP-101** **Accepted:** understood and usable. It MAY carry notes or warnings, for example a missing recorded time.
- **IMP-102** **Rejected:** not used, with a reason. Examples: required content missing, a unit that is not allowed, a category that is excluded by policy, a time that cannot be established.
- **IMP-103** **Unmapped:** structurally fine, but its concept or code cannot be mapped to a verified meaning. It is kept and shown as unmapped. It is not used for matching and not guessed.
- **IMP-104** **Ambiguous:** more than one meaning is possible. It is not resolved by guessing. It stays unresolved until the user decides, and any decision is recorded.
- **IMP-105** The category counts MUST add up to the number of records in the envelope. A record that appears in none of the four is a defect in the importer.
- **IMP-106** The report MUST state the envelope version, the export time, the producing system, the declared inclusions, and the importer and standard versions used.
- **IMP-107** For each applied element or pathway, the report MUST say whether the app holds that exact version. A missing version is reported, not replaced by a different one.
- **IMP-108** Coercion is forbidden. The importer MUST NOT turn text into numbers, assume a unit, assume a time zone, fill a missing value with zero or "normal", or merge two states. Where it cannot establish meaning it reports (rejected or ambiguous) instead.

The report is for the user and for audit. It is retained with the run record, so a later reader can see exactly what was accepted. (CCIS-REQ-075)

## 6. Versioning of the envelope

- **IMP-110** The envelope version follows semantic versioning, independent of the version of any applied element, pathway or package and of the standard version. (CCIS-REQ-011, CCIS-REQ-012)
- **IMP-111** A reader declares which major versions of the envelope it supports.
- **IMP-112** **Same major version, newer minor:** the reader reads what it understands and reports what it ignored. Unrecognised optional additions MAY be ignored. (CCIS-REQ-015)
- **IMP-113** **Unrecognised critical content:** the reader MUST reject the whole envelope. It MUST NOT import part of it.
- **IMP-114** **Newer major version:** the reader MUST refuse, with a clear message. It MUST NOT attempt best-effort reading.
- **IMP-115** **Older major version:** read only if this contract documents support for it. Otherwise refuse.
- **IMP-116** Extensions use the reserved `x-` namespace. An unknown mandatory extension is a safe failure. (CCIS-REQ-016)
- **IMP-117** A breaking change to this contract is a new major version and is recorded in the change log.

## 7. What the EMR must do

This section is for the EMR Enhancer's developers.

**Rows affected in the EMR tracker (`EMR_TASK_TRACKER.md`):**

- **B5 (context service):** must produce an envelope that conforms to this contract and passes the CCIS fixtures. The EMR's own B5 exit condition, that identity and narrative are not leaked to unapproved consumers, is the same rule as section 4.
- **D8b (cohort exporter):** is the last EMR row. It is blocked on B3c, B5 and on CCIS row 6.4 (cohort package contract). It is accepted only through the same import path and contract test. Nothing in this document defines cohort export.
- The plan also recommends marking EMR rows C0 to C9 and D1 to D7 as moved to the CCIS repo, and closing the open question on where the CCIS libraries live (answer: a separate repo). These are tracker edits to make in the EMR repo.

**Acceptance rule:**

- **IMP-120** The EMR exporter is accepted **only** through this contract and the fixtures CCIS builds in Stage 2. Passing the EMR's own tests is not sufficient.
- **IMP-121** Until B5 exists, the CCIS app is developed against synthetic envelopes written by hand from this contract.
- **IMP-122** Until Stage 2 defines the exact shape, an EMR developer may build to this draft, but MUST expect field names and layout to change and MUST NOT treat any naming as fixed.

**What the EMR must be able to supply, in short:** a pseudonymous case reference; exact applied versions (not newest); append-only observations with explicit units, both times, status, source class and provenance; classified events; codes with verification state; the six distinct data states; and a declaration of what was withheld. It must withhold identity, narrative and entered-in-error records by default, and it must never present an unverified code as verified.

## 8. Not defined here (Stage 2 or later)

Field names and the file layout; the envelope schema; the set of observation value kinds; the full list of verification states; the integrity mechanism; the validator rules that check an envelope; the fixtures; FHIR R4 Bundle import (the native export comes first, FHIR Mode later); and anything about cohort export.

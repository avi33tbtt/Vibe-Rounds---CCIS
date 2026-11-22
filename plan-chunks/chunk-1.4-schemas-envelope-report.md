# Chunk 1.4-schemas-envelope-report: Schemas for the context envelope and the import report

_Phase 1, Stage 2. Needs: 1.3a (done). Written just in time from the plan brief for 1.4. The brief lists five schemas; the other three (validation record, run result, run record) are split off as row `1.4a` to keep this chunk inside its size guard. This chunk file is docs only; the schemas are built at the next "do next"._

**Core rules:** attach `01-core.md` too.

**Read only:** `docs/IMPORT-CONTRACT.md` sections 2 to 6 (IMP-010 to IMP-117); `ccis/SPEC.md` (REQ-032 to 038, 040 to 044, 082 to 084); `ccis/schemas/README.md`; `ccis/schemas/manifest.schema.json` (for `semver`, `artefactId`, `artefactType`); `ccis/schemas/element.schema.json` (only its source-class list, line about `patient-reported`); `scripts/build-validators.js`.

## Lessons from 1.1 to 1.3a to follow

- Closed objects with `patternProperties: {"^x-": {}}`; ids `https://ccis.invalid/schemas/<n>.schema.json`; `$ref` shared definitions, never copy them.
- Ajv strict mode needs `"type": "object"` beside `properties` inside `if`, `allOf`, `contains`, `then`. `strictRequired` is off (D-016).
- No `uniqueItems`, `format`, or non-ASCII `minLength` (they pull in Ajv runtime helpers). Date-times are checked by `pattern`.
- Excluded content is excluded by **closed objects**: the envelope has no field for a name, contact detail, note or narrative, so such content is rejected by `additionalProperties` (IMP-091 reporting is the importer's job, row 3.1).
- IMP-122: field names here are the first fixed naming; the EMR is told they are now defined by these schemas.

## Decisions this chunk proposes (owner approves the chunk file; builder logs them)

- **G-01 informant source class (amendment A-001).** Add one source class, `informant-reported`: a value reported by someone other than the patient (for example a companion giving a bite time). It stays distinct from `patient-reported`, is never merged into it, and is never treated as verified. If approved, the builder adds A-001 to `ccis/CHANGELOG.md` (not to SPEC.md), adds the value to the source-class enum in `element.schema.json` and to the envelope, regenerates validators, closes G-01 in `docs/TRACEABILITY.md`, and adds one fixture for it.
- **The envelope declares exclusions as constants.** `inclusions` holds `identity`, `narrative`, `enteredInError`, each fixed to `false` in 0.1.0 (IMP-090, 096). There is no `purpose` field; adding one is a later amendment (IMP-092, 093).
- **Integrity stays open (G-05).** IMP-014 (detect a corrupted or truncated file) needs a mechanism that G-05 decides before row 2.4. The envelope gets **no** checksum field now; IMP-014 is recorded as unmet until then, in `ccis/schemas/README.md`.
- **No certainty or model-confidence field in 0.1.0.** IMP-049 forbids merging provenance, certainty and confidence; with only provenance present there is nothing to merge. Either can come later as an `x-` extension or an amendment.
- **Case reference is an opaque token.** The schema enforces an opaque pattern and a minimum length only. Checking that it is not derived from an identifier is the EMR's and the importer's job (IMP-020; rows 3.1 and the EMR's B5).

## Build

1. **`ccis/schemas/context-envelope.schema.json`** (IMP-010 to IMP-081; REQ-032 to 038, 040 to 042, 083). Required: `envelope` (`version` semver, `exportedAt` with explicit offset by pattern, `producer` `{system, version}`), `inclusions` (above), `case` (`ref`), `applied` (`elements`, `pathways`, each `{id, type, version}` with **exact** version via manifest `semver`; a range or `latest` is rejected, IMP-030 to 032), `observations`, `events`, and each may be an empty array.
   - **Observation:** `id` (envelope-local), `concept` `{id, codes[]}`, `kind` (the closed set from D-017: quantity, integer, boolean, code, string, date, datetime) with `value` shaped by kind, `unit` required for quantity and integer (dimensionless `"1"`), `effective` time, `recorded` time (a time or the explicit state `unknown`; never copied from effective, IMP-044), optional `collected` time, `status` (preliminary, final, corrected, entered-in-error), `sourceClass` (the seven classes plus `informant-reported`), `provenance` `{roleClass, origin, verified, corrected}` (role or system class only, never a person's name), optional `derivation` `{formula, version, from[]}` required when `sourceClass` is `derived`, optional `correctionOf` (envelope-local id; the original stays, IMP-081).
   - **Value states (IMP-051; REQ-032, 033):** an observation either carries a `value` or carries `state` from `absent`, `unknown`, `not-collected`, `not-applicable`, `explicitly-negative`; never both, never neither. `entered-in-error` is a `status`, and an observation with that status is rejected by the importer by default (IMP-091), so the schema allows the value but the fixtures show the importer-facing case.
   - **Time:** `{value, zone}` where `zone` is `stated` (pattern requires `Z` or `±hh:mm`) or `unknown` (pattern forbids an offset). Never a bare date-time without a zone state (IMP-046).
   - **Codes:** `{system, systemVersion?, code, verification}` with `verification` in `verified`, `unverified`; a concept with no code has `codes: []` and `noCode: true` is not needed (empty means none, IMP-073).
   - **Event:** `id`, `type` (a classified meaning id, or the literal `unclassified`, IMP-061), `time` or `period` (`{start, end?}`), `status`, `sourceClass`, `provenance`.
2. **`ccis/schemas/import-report.schema.json`** (IMP-100 to IMP-108, 112 to 115; REQ-044, 084). Required: `outcome` (`read` or `refused`); `envelope` `{version, exportedAt, producer}`; `inclusions` (echoed); `importer` `{version}`; `standard` `{version}`; `appliedVersions[]` `{id, type, version, held}` with `held` boolean (IMP-107); `records[]`; `counts` `{accepted, rejected, unmapped, ambiguous, total}` non-negative integers; `ignored[]` `{path, reason}` for newer-minor additions (IMP-112).
   - Each record: `ref` (envelope-local id), `recordKind` (`observation`, `event`, `reference`), `category` (exactly one of `accepted`, `rejected`, `unmapped`, `ambiguous`), `reasons[]` of `{code, category?}` where an excluded-content reason names the **category** (`identity`, `narrative`, `entered-in-error`) and never the content (IMP-091); `notes[]`; for `ambiguous`, optional `decision` `{choice, decidedBy}` where `decidedBy` is a role. `rejected`, `unmapped` and `ambiguous` require at least one reason.
   - `outcome: refused` requires `refusalReason` and an empty `records` (IMP-113, 114); `outcome: read` forbids `refusalReason`.
3. **`element.schema.json`**: add `informant-reported` to the source-class enum (A-001). **Build script**: add `contextEnvelope` and `importReport` to the export list; regenerate and commit validators.
4. **Left to later rows** (add to `ccis/schemas/README.md`): counts add up to the record count and every envelope record appears once in the report (IMP-105; importer and Phase 2); every `correctionOf`, concept and applied id resolves (IMP-021); an applied version the app does not hold is reported (IMP-107; row 3.1); unit and zone checks beyond the pattern; the pseudonym derivation check; an unknown critical field and envelope major-version handling (IMP-111 to 116; row 3.1); integrity (IMP-014, G-05).

## Fixtures (`ccis/fixtures/schemas/`, add to `index.json`), up to 14

Synthetic only; no clinical numbers; no real-looking names or identifiers.
- Envelope good: `context-envelope-good-minimal` (empty arrays); `context-envelope-good-full` (observations of several kinds, an unknown recorded time, an unknown-zone time, a correction link, a derived value, a code with `unverified`, an `unclassified` event, an `informant-reported` value).
- Envelope bad: `-bad-range-version` (applied element version a range); `-bad-inclusion-true` (`inclusions.narrative` true); `-bad-name-field` (a `name` field on the case); `-bad-quantity-no-unit`; `-bad-value-and-state` (both); `-bad-time-no-zone-state`.
- Report good: `import-report-good-read` (all four categories present, counts given); `import-report-good-refused`.
- Report bad: `-bad-two-categories` (a record category outside the four); `-bad-rejected-no-reason`; `-bad-refused-with-records`; `-bad-category-names-content` (an excluded-content reason carrying a free-text field).
Inline mutations in the test (not files): a record without `recordKind`; `counts` missing `ambiguous`; a negative count; `held` as a string; `recorded` equal to a bare time with no state; `sourceClass` outside the eight; an extra personal field on `provenance`; `derived` without `derivation`.

## Do not

- No validation record, run result or run record (row 1.4a). No checksum, hash or signature fields (G-05). No cohort or narrative fields.
- No edits to `ccis/SPEC.md`. A-001 goes in `ccis/CHANGELOG.md` only.
- No clinical numbers, thresholds or defaults. Reference envelopes with hand-calculated expectations are row 1.5, not here.

## Done when

`npm test` passes once; `npm run build` leaves no diff; the standalone validator has no runtime import; at most 3 deliberate-breakage checks (for example allow `inclusions.narrative` true, allow a value and a state together, drop `reasons` from the rejected rule), each seen failing then restored.

## Size guard

2 schemas, one enum edit, the build script's export list, up to 14 fixtures plus the index edit, test additions, README and CHANGELOG and TRACEABILITY edits, regenerated validators, up to 3 decision rows. If it does not fit, build the envelope first and split the report into `1.4b`.

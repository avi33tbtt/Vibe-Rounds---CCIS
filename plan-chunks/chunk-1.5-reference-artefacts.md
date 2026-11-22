# Chunk 1.5-reference-artefacts: The valid snake-envenomation reference artefacts

_Phase 1, Stage 2. Needs: 1.4a (done). Written just in time from the plan brief for 1.5. The brief has two parts: the valid artefacts and the synthetic fixtures with hand-calculated results. Only the artefacts are in this chunk; the fixtures are split off as row `1.5a` to keep this chunk inside its size guard. This chunk file is docs only; the artefacts are built at the next "do next"._

**Core rules:** attach `01-core.md` too.

**Read only:** `docs/USE-CASE-SNAKE.md` sections 1 to 5 (the scope, nine facts F1 to F9, the pathway and its two nodes, the two analytics, the six parameters); `ccis/schemas/README.md`; the six schemas it names (`manifest`, `element`, `terminology-binding`, `pathway`, `decision-node`, `analytics`); one good fixture of each in `ccis/fixtures/schemas/` for shape; `ccis/SPEC.md` REQ-005, 026, 027, 029, 032, 033, 042, 043.

## Lessons from 1.1 to 1.4a to follow

- Output and parameter ids use the analytics `key` pattern (camelCase, no hyphens). Artefact ids are lower-case dotted (`artefactId`).
- The schemas have no field for a threshold, default, dose or recommendation, and the reference artefacts must not smuggle one in through free text either.
- Parameters arrive disabled and carry **no value** (D-022). A test-only placeholder value (D-013) never appears in an artefact; it belongs to run inputs in row 1.5a.
- The validator safety test scans schema text for forbidden words; keep prose in artefacts plain.

## Decisions this chunk proposes (owner approves the chunk file; builder logs them)

- **Location.** The artefacts live in `ccis/examples/snake/`, one file per artefact, named `<id>.<kind>.json` (the manifest inside each carries the id). Publisher is `Synthetic test publisher`; every artefact is `status: draft`, standard `0.1.0`, version `0.1.0`.
- **No invented codes (IMP-073).** The terminology binding uses a clearly labelled local demonstration code system, `ccis-demo`, whose entries are plain labels such as `performed` and `not-performed`, with every code marked as a demonstration and unverified. No SNOMED, ICD, LOINC or similar code is written from memory. A real terminology package comes only from a named clinician owner.
- **Clinician owner stays unnamed.** Every artefact's provenance says the content was drafted for demonstration and has had no clinical review. Parameters stay disabled; nothing here may be read as clinical advice.
- **Schema gaps stop the build.** If the dossier needs something the schemas cannot express (for example a field's certainty beside its date-time, a per-item state table, or a count over a parameter-supplied set), the builder stops on that point, lists it, and proposes a numbered amendment or a new schema row. It does not stretch a schema, edit an earlier chunk, or leave a half-built artefact.

## Build

1. **`ccis/examples/snake/`** with these files:
   - **Element** `snake-envenomation.element.json`: facts F1 to F9 from the dossier, each with its value kind, effective and recorded time meaning, allowed source classes (including `informant-reported` for F1, A-001), the six epistemic states it can carry, and its missing-data notes in words. F1 declares its certainty (exact, estimated, not known) as a companion field. F4 and F8 are applicable only when F3 and F7 say performed or given; F9 only when F7 says not given (as relationships or applicability rules the element schema allows). No product, quantity or dose field.
   - **Terminology binding** `snake-demo-terminology.binding.json`: value sets for F3, F6, F7, F9 and the F1 certainty, as above.
   - **Pathway** `snake-documentation.pathway.json` and **two decision nodes** `snake-node-clotting.node.json`, `snake-node-antivenom.node.json`: the four stages and the outcome tables of dossier section 3, with an explicit `indeterminate` outcome in each node, every outcome leading to a stage or the end, and no action, order or dose.
   - **Two analytics** `snake-interval.analytics.json` (Analytic A) and `snake-completeness.analytics.json` (Analytic B): inputs with explicit `onMissing`, the six parameters as disabled, declared and value-free (P1 to P6, each used where the dossier says), one expression tree per output with no numeric literal, `value`, `classification` and `table` outputs as the dossier needs, `carries` including `warnings`, `limitations`, `missingDataNotes`, an `interpretation` that states the record-not-care-quality distinction for B (D-014), an execution profile, evidence (a statement that none exists yet), provenance.
2. **`ccis/examples/snake/README.md`**: one page listing the artefacts, what each describes, that all are demonstration-only and unreviewed, and what row 1.5a adds.
3. **`test/examples.test.js`** (uses the committed validators, no new dependency): every artefact validates against its schema; cross-checks the schemas cannot express: every element, field key, analytics input, parameter id, output id, stage and node id referenced anywhere resolves; the pathway and analytics reference the element at its exact version; every parameter has `enabledByDefault: false` and no value, default or suggested field; no numeric literal in any tree; every node has an `indeterminate` outcome and a `next` on every outcome; no artefact contains a `recommendation`, `threshold`, `dose` or `default` key (walk all keys). A list of the cross-checks run is printed in the test names.
4. **Left to later rows** (add to `ccis/examples/snake/README.md`): operator arity and types, unit consistency and reachability (Phase 2); results (rows 1.5a, 3.4).

## Do not

- No synthetic cases, envelopes, run records or expected results (row 1.5a). No invalid examples (row 1.6).
- No thresholds, bands, doses, formulas with numbers, or defaults. No real terminology codes. No edits to `ccis/SPEC.md`, the schemas, or earlier chunk files; a needed change is a numbered amendment or a new row.
- No clinician names or claims of review.

## Done when

`npm test` passes once; at most 3 deliberate-breakage checks (for example set a parameter's `enabledByDefault` to true, point a node outcome at a missing stage, rename an element field key an analytics input uses), each seen failing then restored.

## Size guard

7 artefact files, 1 README, 1 test file, up to 3 decision rows. If it does not fit, split into `1.5b`: the two analytics (the largest files) go to `1.5b`.

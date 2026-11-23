# Chunk DS6-demo-staged-cohort: Staged cohort view

_Needs: DS5._ **Core rules:** attach `01-core.md`.
**Build:**
1. `scripts/demo-batch.js`: runs the real runner over all cases in `ccis/fixtures/snake/index.json`, writes `ccis/demo/cohort-demo.json` (counts per output state, per fixture class; no patient identifiers exist in the synthetic data anyway).
2. A "Cohort (staged)" section in the viewer reading that JSON, with a persistent label "Staged: aggregate of the demo runner over synthetic fixtures; not the cohort engine (rows 5.x)".
3. A "Second package: coming" roadmap card (no function).
4. Test: counts equal the hand-calculated expected classes.
**Done when:** the platform moment of the demo script works and is honestly labelled.
**Size guard:** 1 script, 1 page edit, 1 test.

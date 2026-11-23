# EMR and CCIS roadmap coordination (row DS-X, 2026-11-23)

Rule: every new EMR clinical capability states its **context impact** before it is built, so the CCIS context model stays correct. Source of the EMR roadmap: `emr-plan-chunks/04-demo-and-roadmap.md` in the EMR repo.

| EMR capability (row) | Envelope impact | CCIS action |
|---|---|---|
| Demo slice (B5a, B5b) | uses current `context-envelope` 0.1.x | none |
| Advanced OPD, new observation kinds (R1) | more `observations`; same schema | new elements/bindings only |
| Terminology versions (R2) | binding carries code system version | check `terminology-binding` schema |
| Problems, allergies (R3) | new sections: minor schema version | schema change row (CHANGELOG, your approval) |
| Orders and results (R4), administrations (R5) | new sections: minor or major version | schema change row; fixtures for each |
| Batch cohort export (R7, D8b) | batch envelope; gaps G-03, G-05 | rows 5.x and 6.4 |

Rules: a breaking change is a new major version (core rules); unknown critical fields are rejected; extensions use `x-`; each schema change adds fixtures with hand-calculated expected results; the EMR exporter must pass the CCIS fixtures.

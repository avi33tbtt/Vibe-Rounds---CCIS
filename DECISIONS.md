# CCIS Decisions Log

Max 3 rows per task. Append at the bottom.

| Date | Task | Decision | Why |
|------|------|----------|-----|
| 2026-11-22 | 0.0 | D-001 Standalone repo and app. Integration only through an export file from the EMR Enhancer. | Book Ch6: separate products, clean privacy boundary. |
| 2026-11-22 | 0.0 | D-002 Local-first: static browser app + Node CLI; no server, no database in 0.1.0. Revisit in row 5.7. | Patient data stays on device; simple hosting. |
| 2026-11-22 | 0.0 | D-003 JavaScript ES modules, flat root-level `ccis-*.js` plus `ccis/`; Node 22 in CI. | One code path in Node and browser, no build step. |
| 2026-11-22 | 0.0 | D-004 Pure core modules: no network, file access, clock or randomness; time and ids are inputs. | Determinism. |
| 2026-11-22 | 0.0 | D-005 JSON Schema 2020-12; validators generated at development time (Ajv standalone, verify in row 1.1) and committed. | Strict CSP and no-eval rule. |
| 2026-11-22 | 0.0 | D-006 Whitelist interpreter over a declarative expression tree. | Safe execution. |
| 2026-11-22 | 0.0 | D-007 Three-valued results; distinct missing-data states. | Unknown must never become false or normal. |
| 2026-11-22 | 0.0 | D-008 First slice: snake envenomation process metrics; thresholds are disabled parameters from a local clinician. | No doses or bands. Diabetes + CKD is the second demo (row 4.5). |
| 2026-11-22 | 0.0 | D-009 Immutable content-addressed run records with input snapshot. | Reproducibility. |
| 2026-11-22 | 0.0 | D-010 No network requests until row 4.1; then only the marketplace host. | Privacy. |
| 2026-11-22 | 0.0 | D-011 AI off and absent in 0.1.0; later drafts only. | Governance. |
| 2026-11-22 | 0.0 | D-012 Lifecycle statuses from the book; assurance dimensions recorded separately. | No single "validated" badge. |
| 2026-11-22 | 0.0 | Schemas, validator rule catalogue, compiler algorithm, storage formats and CLI/API contracts are deferred to Stage 2. | User instruction. |
| 2026-11-22 | 0.0 | Plan briefs 4.4, 5.2, 5.4, 6.2 and 6.3 restored detail from the retired EMR rows D1c, D2b, D3, D6 and D7 (status-label rules, reviewer independence, release gate, evaluation limits, Avinash hypothesis). | The EMR Track C/D rows were moved here; nothing may be lost in the move. |
| 2026-11-22 | 0.0 | Spec is prototype-baselined in Phase 0; gaps found later are numbered amendments in `ccis/CHANGELOG.md` with user approval; true freeze at CCIS 0.1.0. | Schema work always exposes spec gaps. |
| 2026-11-22 | 0.4 | D-013 Fixtures needing an enabled parameter use clearly labelled test-only placeholder values that are never clinical recommendations and never ship enabled. | Lets fixtures run without a model or the plan supplying clinical numbers. |
| 2026-11-22 | 0.4 | D-014 The documentation-completeness analytic reports "not documented" for an item with nothing recorded, never "not performed". | The record cannot tell not-done from done-but-unrecorded. |

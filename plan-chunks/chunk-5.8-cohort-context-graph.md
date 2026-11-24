# Chunk 5.8 — Cohort Context Graph and Longitudinal Cohort Explorer

_Status: planned / LOCKED. CCIS cohort-level capability. Synthetic cohorts only; not for clinical use._

## Purpose and product boundary

Implement a **cohort-level Context Graph** that lets a user explore how clinical contexts, conditions, observations, events, pathways and aggregate trajectories relate across a selected cohort.

This feature belongs in **CCIS**, not EMR Enhancer.

- EMR Enhancer owns one patient's clinical record and its patient-level timeline.
- CCIS imports a governed cohort data package and performs cohort-level analysis and visualization.
- The Context Graph is a derived analytical view over cohort data and existing CCIS artefacts. It is not a second system of record and does not write back to EMR clinical tables.

## What already exists in this repository

The current CCIS plan and specifications already provide foundations to reuse:

- Contextual elements and their terminology/concept bindings.
- Pathways and typed decision nodes.
- Planned typed decision graphs (row 5.3).
- Cohort definitions and three-valued eligibility (row 5.5).
- Cohort analytics, aggregation and provenance (row 5.6).
- Population-level access/purpose/audit design (row 5.7).
- Cohort data-package contract and import path (row 6.4).
- Deterministic execution, explicit missingness, provenance and synthetic fixtures.

**Important distinction:** row 5.3's decision graph represents a pathway/decision process. It is not itself a graph of cohort clinical data. Do not repurpose decision nodes as patient or cohort events. Reuse its typed-graph discipline and validation ideas, while building the Context Graph as a small derived projection from cohort definitions, imported cohort facts and CCIS artefact references.

Repository search did not find an implemented cohort Context Graph view or a dedicated graph runtime. This chunk defines the missing visualization/projection work without claiming that it already exists. Keep it deliberately small; do not introduce a new graph database, server or generic graph platform.

## Intended experience

A user selects a synthetic cohort (initially diabetes + CKD, optionally hypertension) and sees:

1. **Cohort summary:** cohort size, eligibility states, time span and data coverage.
2. **Context Graph:** a readable node-edge view showing conditions/contexts, observation concepts, event categories, pathways and aggregate analytic outputs.
3. **Cohort trajectories:** simple aggregate trends across time windows (e.g. yearly or quarterly HbA1c/eGFR summaries), where supported by synthetic data and declared analytics.
4. **Click-to-explore:** clicking a node filters/highlights related nodes and opens an aggregate detail panel; clicking an edge explains the relationship and its evidence.
5. **Time-window navigation:** selecting a period updates graph weights and aggregate summaries for that period.
6. **Provenance:** every node/edge/result can show which cohort definition, element/pathway versions, analytic package/version, input package and source concept/event types produced it.

The graph is for aggregate cohort exploration, not a patient-by-patient timeline. Do not expose patient identifiers or make individual patient nodes in the graph.

## Graph model — minimal derived view

Generate the graph deterministically in memory from the selected cohort package and canonical cohort representation.

### Node types

- `cohort`: selected cohort definition and version.
- `condition-context`: a condition or clinical context represented by a pinned concept/context reference.
- `observation-concept`: a measured concept such as HbA1c, eGFR, creatinine or blood pressure.
- `event-category`: a documented category such as diagnosis milestone, admission or treatment-change category, only if represented in the input contract.
- `pathway`: a referenced pathway and exact version.
- `analytic-output`: an aggregate output from a declared CCIS analytic package/version.
- `time-window`: an explicit period used to compute the displayed aggregate.

### Edge types

- `includes-context`: cohort definition references a condition/context.
- `measured-by`: context is represented by an observation concept.
- `has-event-category`: context is associated with a declared event category.
- `uses-pathway`: context/cohort references a pathway.
- `summarised-by`: cohort/context is summarized by an analytic output.
- `observed-in-window`: an aggregate concept/event has data in a time window.
- `co-occurs-with`: two concepts/events occur in the same declared time window or cohort slice.

Every edge must carry a relationship kind, source references, time scope and aggregate count/weight where appropriate. Distinguish an explicitly declared relationship from a computed co-occurrence. **Co-occurrence is not causation.** Never label an edge as causal unless a separately reviewed artefact explicitly supports that claim (out of scope here).

Do not store patient-level membership in graph nodes or edge payloads. The graph contains aggregate counts only, subject to the small-cell policy from row 5.6 and access rules from row 5.7.

## Minimal UI (keep it simple)

- One CCIS Cohort Explorer page/section.
- Left: cohort selector, context filters and time-range selector.
- Centre: simple node-edge graph. A static SVG/canvas-free layout or a small existing dependency is preferred; no elaborate graph editor.
- Right: selected node/edge details, aggregate counts, trend summary and provenance.
- Below or as a tab: a compact time-series chart/table for the selected context.
- Clicking a node highlights its connected nodes/edges and filters the aggregate timeline.
- Clicking an edge explains the edge type, computation/definition, time window and source references.

If graph layout becomes disproportionately complex, ship the simpler alternative: a **context relationship map** (grouped cards with labelled connecting lines) plus the same click-to-filter behavior. Do not let a sophisticated graph renderer block the cohort feature.

## Synthetic cohort demonstration

Use a deterministic synthetic cohort of approximately 30 subjects, consistent with row 5.5's planned scale. It should contain:

- Diabetes-only, CKD-only, diabetes + CKD and diabetes + CKD + hypertension combinations.
- Several years of synthetic HbA1c, eGFR/creatinine and blood-pressure observations.
- Some missing, unknown and not-collected states.
- A range of follow-up durations and observation density.
- Synthetic encounter/event categories where the cohort contract supports them.
- Enough variation to demonstrate cohort-level trends and co-occurrence edges.

The dataset must be clearly labelled **SYNTHETIC COHORT — NOT FOR CLINICAL USE**. Use fixed IDs and deterministic fixture generation. Expected aggregate counts and time-window summaries must be hand-calculated or independently asserted in tests. No real patient data, real EMR cohort export or clinical thresholds are needed for this first implementation.

## Build sequence

### 5.8.1 — Inspect and map existing graph/cohort foundations
- Refresh repository.
- Read the relevant 5.3, 5.5, 5.6, 5.7 and 6.4 contracts/chunks plus current cohort fixtures and UI.
- Identify which graph structures are already implemented and which are only planned.
- Record a short mapping: existing artefact -> Context Graph node/edge source.
- Do not create duplicate graph/decision-node schemas.

### 5.8.2 — Define a minimal Context Graph projection
- Pure deterministic function from canonical cohort input + cohort definition + selected analytic results to nodes and edges.
- Stable node/edge IDs derived from source references and relationship type, not randomness.
- Include provenance, time scope, aggregate count/weight and relationship classification.
- Validate references and reject dangling nodes/edges.
- Apply small-cell suppression before emitting any aggregate node/edge count.
- No graph database or persistent graph storage.

### 5.8.3 — Build synthetic longitudinal cohort fixture
- Deterministic ~30-subject fixture with multiple conditions and repeated observations across time.
- Explicit missingness and follow-up variation.
- Hand-check expected cohort membership and selected aggregates.
- Keep the fixture separate from the snake demo fixtures and do not change their expected results.

### 5.8.4 — Cohort graph + aggregate timeline UI
- Add a simple graph/relationship-map view.
- Add time-window selector and condition/context filters.
- Add aggregate trend table/chart.
- Node/edge click updates the detail panel and selected cohort context.
- Show data coverage, missingness and provenance.
- Persist no patient-level data to the marketplace; local-first synthetic demo only.

### 5.8.5 — Tests and safeguards
- Stable output for identical inputs.
- Node/edge references resolve; no duplicate source facts.
- Aggregate counts match independently checked expectations.
- Unknown/missing/not-collected are not silently treated as zero/negative.
- Small-cell masking is applied consistently.
- No individual patient identifiers or drill-down in graph UI.
- Co-occurrence is labelled as association/temporal co-occurrence, never causation.
- No network requests carrying cohort data.
- UI carries the synthetic-data banner.

## Dependencies and sequencing

- Requires the relevant Stage 2 schemas/runtime and Phase 4 foundations to be complete.
- Reuses 5.3 graph validation discipline, 5.5 cohort definition/evaluator and 5.6 cohort aggregation/provenance.
- The first synthetic-only view does not require the EMR cohort exporter or 6.4 real import path. Real cohort package ingestion remains gated on 6.4 and its contract tests.
- Row 5.7's access/purpose/audit decision must be respected before any shared or real population-level use. A local synthetic demo must not be presented as permission for real cohort processing.
- The EMR's R7/D8b exporter remains a separate final integration task; this feature does not move cohort export into CCIS.

## Acceptance criteria

- A user can select the synthetic diabetes + CKD cohort and explore its context relationship map.
- The graph includes condition contexts, observation concepts, pathways/event categories and analytic outputs where supported.
- Selecting a node or edge updates the detail panel and aggregate timeline.
- Changing the time window changes the displayed aggregate summaries deterministically.
- Every relationship has a declared or computed type and provenance.
- The graph shows aggregate cohort information only; no patient identifiers or individual patient nodes.
- Small-cell masking and missing-data semantics are preserved.
- Co-occurrence is not described as causation.
- The existing snake demo fixtures and deterministic run behavior remain unchanged.
- The simpler relationship-map fallback is acceptable and counts as completion if it meets interaction and provenance criteria.

## Explicitly deferred

- Individual patient timelines (EMR feature).
- Real cohort ingestion before row 6.4.
- Multi-user/server-backed cohort sharing before the 5.7 access-model decision.
- Graph database, general-purpose graph query language or AI graph reasoning.
- Causal inference, predictive risk scoring or treatment recommendations.
- LLM-generated edges or unreviewed semantic mappings.

# Vibe-Rounds---CCIS

**CCIS** is the Contextual Clinical Intelligence App and the **Clinical Context Intelligence Standard** it runs on. It is a separate app from the EMR Enhancer: it imports an export file from the EMR Enhancer, discovers compatible knowledge packages, and runs them through a deterministic, constrained engine with full provenance.

> Status: planning (Phase 0). Prototype. Synthetic data only, not for clinical use.

## Start here

- [`CCIS_BUILD_PLAN.md`](CCIS_BUILD_PLAN.md): the build plan (decisions, architecture, phases, gates). **Schemas and other formal contracts are deliberately deferred to a later stage** (section 4).
- [`CCIS_TASK_TRACKER.md`](CCIS_TASK_TRACKER.md): the task list and the "do next" working protocol.
- [`DECISIONS.md`](DECISIONS.md): decisions log.
- [`plan-chunks/`](plan-chunks/): one small plan file per task.

## Research

The research behind CCIS (the ten-chapter book, from context-aware EMRs to the CCIS standard and platform scaling) is in the EMR Enhancer repository:

- Research folder: https://github.com/avi33tbtt/Vibe-Rounds---EMR-Enhancer-App/tree/main/Research

## Related repository

- EMR Enhancer (produces the contextual patient export that this app imports): https://github.com/avi33tbtt/Vibe-Rounds---EMR-Enhancer-App/

## License

See [`LICENSE`](LICENSE).

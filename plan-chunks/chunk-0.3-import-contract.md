# Chunk 0.3-import-contract: Import contract in words

_Phase 0. Book Ch6 section 6, Ch5 sections 6 and 7. Needs: 0.2._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/SPEC.md`; `CCIS_BUILD_PLAN.md` section 5.5 and 9.

**Book source (not in this repo):** attach `Research/Ai-augmented-Clinical-intelligence.html` from the EMR Enhancer repo (https://github.com/avi33tbtt/Vibe-Rounds---EMR-Enhancer-App/blob/main/Research/Ai-augmented-Clinical-intelligence.html). If it is not attached, stop and ask for it; do not write from memory.

**Build:**
1. `docs/IMPORT-CONTRACT.md`: what the EMR Enhancer export (the "context envelope") must carry, in words: case reference (pseudonymous), envelope version and export time, applied elements and pathways with exact versions, observations (value kind, unit, effective time, recorded time, status, source class, provenance), clinical events, terminology codes with verification state; the distinct missing-data and epistemic states; what is excluded by default (identity, narrative, entered-in-error) and how a purpose could change that later.
2. The import report semantics: accepted, rejected, unmapped, ambiguous, with the principle "nothing is silently lost or coerced".
3. Versioning of the envelope and what a reader does with a newer version.
4. A section "What the EMR must do": which EMR tracker rows are affected (B5, D8b) and the rule that the EMR exporter is accepted only through this contract and the fixtures that will be built in Stage 2.

**Done when:** an EMR developer could read it and know what to export, without any field name or JSON shape being fixed.

**Size guard:** 1 markdown file. No schema, no example JSON.

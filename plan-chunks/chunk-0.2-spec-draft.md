# Chunk 0.2-spec-draft: CCIS specification draft 0.1 (documentation only)

_Phase 0. Book Ch7 sections 3 to 14 and Ch9 section 2. Needs: 0.1._

**Core rules:** attach `01-core.md` too.

**Read only:** the attached book file, Ch7 and Ch9 only (use `grep`/ranges, not the whole file); `CCIS_BUILD_PLAN.md` sections 3, 4 and 5.

**Book source (not in this repo):** attach `Research/Ai-augmented-Clinical-intelligence.html` from the EMR Enhancer repo (https://github.com/avi33tbtt/Vibe-Rounds---EMR-Enhancer-App/blob/main/Research/Ai-augmented-Clinical-intelligence.html). If it is not attached, stop and ask for it; do not write from memory.

**Build:**
1. `ccis/SPEC.md`: normative core in words, every requirement with an id `CCIS-REQ-nnn` and a short rationale. Cover: scope and the product boundary; identity, versioning and compatibility policy (semver, `x-` extensions, unknown critical fields rejected); the artefact families and what each must declare (in words, no field names); epistemic and provenance rules (missing-data states, source classes, effective vs recorded time); terminology and unit rules (never compare by label, conversions explicit); lifecycle statuses and the separate assurance dimensions; compatibility outcomes and the six checks; execution boundary (declarative only, whitelist, three-valued, deterministic, resource limits); run record contents; privacy boundary (no patient data in packages or marketplace); the eight validator layers **by name only**; the requirements matrix columns (id, statement, artefact, validation method, test, status) with empty test columns.
2. `ccis/CHANGELOG.md`: "0.1.0-draft" entry and the amendment rule (numbered amendments, user approval).
3. `ccis/README.md`: what the folder will contain later (schemas, examples, fixtures, templates) marked "Stage 2, not started".

**Done when:** every requirement has an id, no two requirements contradict, and nothing in the files is a schema, field-level shape, storage format, rule catalogue or algorithm.

**Size guard:** 3 markdown files, no code.

# Chunk 0.4-use-case: Snake envenomation use-case dossier

_Phase 0. Fixed first slice (D-008). Needs: 0.2._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/SPEC.md`; `CCIS_BUILD_PLAN.md` sections 3 (D-008) and 7 (rows 1.5, 3.4, 3.11).

**Build:**
1. `docs/USE-CASE-SNAKE.md`: the contextual element in words (which facts it records: bite time, arrival, clotting-test performed and result recorded times, anti-snake-venom administration time, and so on, each with the kind of value and time semantics, no field keys); a short pathway with two decision nodes and an explicit indeterminate branch (questions only, no actions or doses); two analytics in words: (a) bite-to-ASV interval, (b) documentation completeness of the 20-minute clotting test.
2. Parameters: list which would be parameters (for example a target interval, a timing window), all **disabled by default**, all to be supplied by a named local clinician. No number from any model.
3. The fixture classes to be built later (normal, boundary, missing, conflicting, out-of-scope, unit-conversion) with one sentence each of what the case tests. No data.
4. What the slice will NOT prove.

**Done when:** a clinician can read it and say whether the facts and questions are the right ones, without any threshold appearing.

**Size guard:** 1 markdown file. No numbers that look like clinical thresholds.

# Chunk DS2b-demo-pathway: Two-node pathway evaluation

_Needs: DS2a._ **Core rules:** attach `01-core.md`.
**Read only:** `snake-documentation.pathway.json`; the two node files; `pathway.schema.json` and `decision-node.schema.json` (branch fields only).
**Build:**
1. In `ccis-demo-exec.js` (or `ccis-demo-pathway.js` if long): evaluate the pathway's two nodes; explicit branches for true, false, indeterminate and missing data; a node outcome is descriptive, never a recommendation.
2. Return node results in the run-record `results` shape used by DS3.
3. Tests: fixture cases with node expectations (missing, conflicting, out-of-scope) give the expected branch; indeterminate never routes as false.
**Done when:** node outcomes match fixtures; out-of-scope cases are reported as out of scope.
**Size guard:** 1 module (or 1 extra), 1 test file.

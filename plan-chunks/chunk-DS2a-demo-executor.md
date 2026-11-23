# Chunk DS2a-demo-executor: Expression subset interpreter

_Needs: DS1._ **Core rules:** attach `01-core.md`.
**Read only:** `ccis/examples/snake/snake-interval.analytics.json` and `snake-completeness.analytics.json` (list operators actually used, with grep); `docs/DEMO-SLICE.md`; `ccis/fixtures/snake/README.md` (findings F-1 to F-5); D-032 to D-037.

**Build:**
1. `ccis-demo-exec.js` (pure): `evaluateAnalytic(analytic, envelope, parameters, evaluationTime)` implementing only the operators found in the two analytics. Whitelist; an unknown operator returns a refusal, never a guess. No `eval`, `Function`, dynamic import.
2. Three-valued logic and the six data states per D-007 and D-032; disabled parameters give declared state `parameter-not-enabled` with `dependsOnParameters`.
3. Output is an array of results that validate against `run-result.schema.json`.
4. Tests: every fixture case of both analytics equals its `.expected.json`; hostile and malformed inputs do not crash and never produce a value from unknown.
**Done when:** all fixture cases for the two analytics pass.
**Size guard:** 1 module, 1 test file. If over ~300 lines, split interval (DS2a-1) and completeness (DS2a-2).

# Chunk DS3-demo-run-record: Build the run record

_Needs: DS2b._ **Core rules:** attach `01-core.md`.
**Read only:** `run-record.schema.json`; `run-result.schema.json`; D-030, D-031, D-009; the fixtures `index.json`.
**Build:**
1. `ccis-demo-record.js` (pure): `buildRunRecord({ id, package, envelope, parameters, evaluationTime, results, ... })`. `id` is an input, content-addressed by the caller (SHA-256 of canonical JSON); evaluation time states its zone; input snapshot is the envelope; enabled parameters carry value and role, disabled carry neither.
2. `failed` status when the loader refuses: has `failure`, no results (D-031).
3. When demo placeholders are enabled add `x-demo` note "demo placeholders, not clinical values" in warnings.
4. Tests: record validates; same inputs give byte-identical output; changing one observation changes the id; failed record shape.
**Done when:** every fixture produces a schema-valid, deterministic record.
**Size guard:** 1 module, 1 test file.

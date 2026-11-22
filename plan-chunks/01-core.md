# Core rules (never change)

**Product:** the Contextual Clinical Intelligence App and the CCIS standard. A separate app that imports an export file from the EMR Enhancer. It is not a clinical application and never the system of record for the EMR's data.

**Architecture**
- Standalone repo. No access to the EMR's database or code; only a documented export file crosses the boundary.
- Local-first: static browser app plus Node CLI, JavaScript ES modules, flat root-level `ccis-*.js` files, `ccis/` for spec/schemas/examples/fixtures. No server and no database in 0.1.0.
- Core modules are **pure**: no network, no file access, no clock reads, no randomness. Evaluation time and ids are inputs.
- Packages are declarative data only. The executor is a whitelist interpreter: no `eval`, `Function`, dynamic import.
- Results are three-valued (true, false, indeterminate). **Unknown never becomes false or normal.** Absent, unknown, not collected, not applicable, negative and entered-in-error stay distinct.
- Same input, versions and parameters give byte-identical output.
- Versioning is semver; a breaking change is a new major; unknown critical fields are rejected; extensions use the `x-` namespace. Package version, standard version, engine version and FHIR version are independent.

**Safety**
- Synthetic data only until the go-live gate.
- No LLM-supplied doses, thresholds, bands or formulas. Thresholds are parameters supplied by a local clinician and arrive **disabled**.
- AI is off by default. When it exists it only drafts, from a whitelist payload, and cannot publish or validate.
- Software conformance never implies clinical safety. Record them separately. "Validated" always carries scope (version, population, setting, intended use).
- Results are descriptive, not recommendations, unless a package declares and governs an intended decision-support use.

**Privacy and data**
- Patient data never leaves the device. The marketplace holds definitions, code, docs and synthetic fixtures only; never patient records or cohort membership.
- Identity and narrative are excluded from the import by default. Entered-in-error is excluded by default.
- The browser app makes no network requests until the distribution row; after that only to the declared marketplace host, never with patient data.
- Run records are immutable and hold the input snapshot.

**Process**
- One chunk per chat, size guard respected. Never mark DONE unless implemented and verified.
- Phase 0 contains no schemas, no field-level shapes, no storage design: those are Stage 2 ("start stage 2").
- UI: all text through the shared escaper; no inline handlers (CSP).
- Tests with `node --test`; CI on every push; hand-calculated expected results for fixtures.

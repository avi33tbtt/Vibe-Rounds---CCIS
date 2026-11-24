# Chunk 1.6-invalid-examples: One invalid example per validator layer, with expected diagnostics

_Phase 1, Stage 2. Needs: 1.5a, 1.5b (done). Written just in time from the plan brief for 1.6. The brief has two parts: the invalid examples and a FHIR-Mode example. Only the invalid examples are in this chunk; the FHIR-Mode example is split off as row `1.6a` to keep this chunk inside its size guard. This chunk file is docs only; the examples are built at the next "do next"._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis/SPEC.md` section 12 (the eight layer names) and REQ-088, 089, 090; `ccis/examples/snake/README.md`; the nine files in `ccis/examples/snake/` that are not the 0.1.0 analytics (use the 0.1.1 analytics); `ccis/fixtures/schemas/` file names only, for how the existing bad fixtures are named; `ccis/schemas/README.md` (what the schemas enforce and what they leave to the Phase 2 validator).

## What this row is for

Rows 2.1 to 2.3 will build the validator layer by layer. Each layer needs an example it must reject, and the diagnostic it must give, **before** it is written (Gate B, checklist B-03). This row makes those examples and states the expected diagnostics. It builds no validator. Nothing here runs the artefacts; the schema validators already committed are used only to prove which examples the schemas catch and which they cannot.

## Lessons from earlier rows to follow

- The schemas already catch layers 1 and 2 (malformed text, shape). They cannot express cross-field rules (`ccis/schemas/README.md`, "Left to the Phase 2 validator"). Layers 3 to 8 therefore need examples that **pass the schemas** and fail only a later layer. A test proves both halves.
- Never write a threshold, dose or clinical code into an example, not even as the defect. Defects are structural: a wrong id, a wrong unit family, an unreachable stage.
- Parameters stay disabled and value-free in every example (D-022). Only the defect differs from the valid original.
- No code from a real terminology is written from memory (IMP-073).
- Plain prose in all text fields; the validator safety test scans for forbidden words.

## Decisions this chunk proposes (owner approves the chunk file; builder logs them)

- **One defect each.** Every invalid example is a copy of one valid snake artefact with exactly one deliberate change. The expected-diagnostics file records the base file, the JSON path of the change, and that nothing else differs. A test recomputes the difference and fails if the example differs from its base anywhere else.
- **Location and names.** `ccis/examples/invalid/<layer-number>-<layer-name>/` holding `<case>.json` and `<case>.expected-diagnostics.json`. Layer 1 is stored as `<case>.json.txt` because it is not valid JSON (so no tool opens it as JSON by accident); the expected file names it.
- **Diagnostic shape (words, matching REQ-089).** Each expected diagnostic has `severity` (`error`, `warning` or `info`), a stable `ruleId`, `path` (a JSON pointer into the example; for layer 1 a line and column), `message`, and `hint`. Rule ids use `CCIS-V<layer>-<nnn>` with the layer as one digit (for example `CCIS-V3-001`). The ids written here are the first entries of the rule catalogue; rows 2.1 to 2.3 keep them stable and may add more. The wording of messages is expected text for the later tests, not final user interface text.
- **No new schema.** The expected-diagnostics shape is checked by a small test-only helper, not a committed schema file, because the validator report schema belongs to the validator rows (2.1 and 2.3, with the validation record already in 1.4a).
- **A schema gap stops the build.** If a layer needs a field the schemas cannot hold (layer 7 needs a place where a package declares its own test cases, layer 8 needs a validation claim with scope), the builder stops on that point, lists it, and proposes a numbered amendment or a new row. It does not stretch a schema, edit an earlier chunk, or half-build the example.

## Build

1. **Eight invalid examples** in `ccis/examples/invalid/`, one per layer. Suggested defect for each (the builder may pick a different single defect of the same kind and says so):
   1. **Syntax:** the interval analytics file cut off mid-object (a missing closing brace).
   2. **Structural:** a parameter that carries a `value` (D-022 forbids it). The schema must reject it.
   3. **Reference integrity:** the pathway names a decision node id that no artefact holds; or an analytics input names an element field that does not exist. Passes the schemas.
   4. **Semantic:** a comparison that mixes a duration with a plain count, or an input of one time meaning compared with another without a declared conversion. Passes the schemas.
   5. **Graph and compatibility:** a node outcome that leads to a stage that does not exist, or a stage no outcome can reach. Passes the schemas.
   6. **Executable safety:** an `x-` extension member that holds a code-like string (the schemas allow any `x-` member, so only layer 6 can refuse it). The example uses a harmless placeholder string that looks like code and never runs; no real script text.
   7. **Test verification:** the package states a test case whose expected result disagrees with what the artefact would give. If the schemas hold no place for a package's own tests, this is a stop-and-list gap (see above).
   8. **Governance:** a manifest that claims `validated` without naming a version and scope, or claims it for a different version than the one it holds. If the manifest schema cannot hold the claim, stop and list.
2. **Eight `<case>.expected-diagnostics.json` files:** base file, changed path, the layer, and the list of expected diagnostics (each with the five parts above). Each lists **only** diagnostics a correct validator must give; a valid base file gives none.
3. **`ccis/examples/invalid/README.md`:** a table of the eight layers: example, defect, which layer must catch it, and whether the committed schemas already reject it. State that no validator exists yet and that these are the acceptance targets for rows 2.1 to 2.3.
4. **`test/invalid-examples.test.js`:** (a) every valid base file still passes its schema; (b) layer 1 is not parseable as JSON; (c) layer 2 fails the schema validator; (d) layers 3 to 8 pass the schema validators (they are beyond the schemas); (e) each example differs from its base only at the declared path; (f) each expected-diagnostics file has all five parts, a pattern-valid unique `ruleId`, a `path` that exists in the example (except layer 1), and a layer digit equal to its folder; (g) no example contains a number-like threshold, a code from a real terminology or the forbidden words.
5. Update `ccis/SPEC.md` matrix? **No.** The matrix Test column is filled by the validator rows. Add the eight rule ids and their example files to a short section in `docs/TRACEABILITY.md` only if the builder finds a natural place; otherwise leave it for 2.1.

**Done when:** eight invalid examples with expected diagnostics are committed, `npm test` passes, the test proves examples 3 to 8 are invisible to the schemas, and three deliberate breakages (for example: change a base file; change an expected path; make example 3 fail the schema) are seen failing.

**Size guard:** 8 examples, 8 expected files, 1 README, 1 test. If more than two layers hit a schema gap, STOP, build the layers that can be built, and split the rest off as `1.6b`.

# Invalid examples (row 1.6)

Prototype. Synthetic data only. Not for clinical use. **No validator exists yet.** These files are the acceptance targets for rows 2.1 to 2.3 (gate B-03): each is a real snake artefact with exactly one deliberate defect, and each has an `.expected-diagnostics.json` file naming the diagnostics a correct validator must give.

| Layer | Example | The one defect | Committed schemas reject it? |
|-------|---------|----------------|------------------------------|
| 1 Syntax | `1-syntax/interval-truncated.json.txt` | The final closing brace is missing. Stored as `.json.txt` so no tool opens it as JSON by accident. | Cannot be read at all |
| 2 Structural | `2-structural/parameter-carries-value.json` | A parameter carries a `value` member (D-022). | **Yes** |
| 3 Reference integrity | `3-reference-integrity/input-field-missing.json` | An input names a field the element does not define (one letter off). | No |
| 4 Semantic | `4-semantic/time-diff-on-code.json` | A time difference is taken over a code input. | No |
| 5 Graph and compatibility | `5-graph-and-compatibility/transition-to-missing-stage.json` | A transition ends at a stage id that does not exist; a real stage becomes unreachable. | No |
| 6 Executable safety | `6-executable-safety/extension-holds-code-text.json` | An `x-` member holds a harmless placeholder that looks like code. It is never run. | No |
| 7 Test verification | `7-test-verification/test-expects-missing-output.json` | A package test expects an output id the package does not declare (one letter off). | No |
| 8 Governance | `8-governance/validated-without-evidence.json` | Status `validated`, while the package's own evidence says none is claimed. (Carries a synthetic validation scope only because the schema requires one for that status.) | No |
| 8 Governance (scope) | `8-governance/validated-for-another-version.json` | Status `validated` with a validation scope that names a different package version. The evidence statement is changed too, so only the scope rule fires; the three changes are one defect. | No |

Layers 3 to 8 pass the schemas on purpose: only the later validator layers can refuse them. A test proves this.

## Layer 7 and the scope part of layer 8: amendment A-003 (approved)

A-003 gave packages a place for their own `tests` and gave the manifest a `validation` scope (schema members added in row 1.6b). Row 1.6c built the layer 7 example and the scope example on top of them. Layer 7 checks a package's tests against the fixtures; nothing is run here, and a test carries no parameter values. All eight layers now have an example.

## Diagnostic shape

Each expected diagnostic has `severity` (`error`, `warning` or `info`), `ruleId` (`CCIS-V<layer>-<nnn>`), `path` (a JSON pointer into the example; for layer 1 a line and column), `message` and `hint` (REQ-089). The ids are the first entries of the rule catalogue; rows 2.1 to 2.3 keep them stable. Message wording is expected text for later tests, not final interface text.

Each expected file also names the base artefact, the layer, the schema to test with, and `changedPaths`, the only places the example differs from its base.

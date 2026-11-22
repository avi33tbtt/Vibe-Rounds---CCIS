# CCIS schemas (rows 1.1 and 1.2)

JSON Schema 2020-12. Prototype. Synthetic data only. Not for clinical use.

| File | Covers |
|------|--------|
| `manifest.schema.json` | CCIS-REQ-009 to 012, 014 to 016. No integrity fields (gap G-05). |
| `element.schema.json` | CCIS-REQ-021, 022, 032, 035, 036, 042. |
| `terminology-binding.schema.json` | CCIS-REQ-039 to 041, 044. |
| `pathway.schema.json` | CCIS-REQ-025, 027. Stages are `information` or `report` only; no field can hold an action, order, dose or number; timing names a parameter id, never a value. |
| `decision-node.schema.json` | CCIS-REQ-026. Every outcome has a `next` (stage or end); every node contains an `indeterminate` outcome. |

Validators are generated (`npm run build`) into `ccis/validators/ccis-validators.js`, committed, and checked for staleness by the tests. Nothing compiles a schema at runtime.

**Enforced in the schema:** closed objects (unknown fields rejected; `x-` extensions allowed); semver and ranges; references are id plus exact version or range, never embedded content; numeric fields (`quantity`, `integer`) must declare units; `date` and `datetime` fields must declare a time meaning; `code` fields must carry a binding; bindings are by code-system reference and code, version pinned or `noVersionPublished`; unmapped concepts carry no code; lossy and low-confidence mappings carry confidence and a note. There is no field in which a threshold, dose or band could be stored: thresholds are parameters (row 1.3).

**Left to the Phase 2 validator (cannot be expressed in JSON Schema):** field keys unique within an element; relationships point at existing keys; module fields do not collide with core fields; a binding on a non-`code` field matches the field's concept; unit strings are valid UCUM; reference ids exist and versions resolve.

**Decision-node limits (D-018).** Outcome tests are state tests only: `present`, `absent`, `unknown`, `not-collected`, `not-applicable`, `explicitly-negative`, `entered-in-error`, `conflicting`. "Present" means a record exists; it says nothing about its value. Tests on values wait for the expression tree (row 1.3). Phase 2 validator, additionally: every `next.stage` and transition target exists; every outcome `input` is one of the node's inputs; outcomes cover every state a node input can be in; no unreachable stage; every `needs` key exists in the referenced element; timing `parameter` ids exist in the required analytics. Graph-wide checks (dead ends, bounded cycles) are gap G-09, row 5.3.

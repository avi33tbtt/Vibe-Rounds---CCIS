# Chunk 2.2b-validator-element-binding-checks: Layer 4 element and binding checks

_Phase 2, Stage 2 (written 2026-11-24). Needs: 2.2 (done: `ccis-validator-semantic.js`, `semanticLayer`, rule ids V4-001 to V4-008). Split from 2.2 (D-089). This chunk file is docs only; the checks are built at the next "do next"._

**Core rules:** attach `01-core.md` too.

**Read only:** `ccis-validator-semantic.js` (`semanticLayer`, `SEMANTIC_RULES`, `diag`); `ccis-validator.js` (pipeline: `mark('semantic', ...)`); `ccis/schemas/README.md` ("Left to the Phase 2 validator"); `ccis/schemas/element.schema.json` (`field`: `type`, `units`, `binding`); `ccis/schemas/terminology-binding.schema.json`; `ccis/examples/snake/snake-envenomation.element.json` and `snake-interval.analytics.0.1.1.json` (valid models); `ccis/SPEC.md` REQ-042, 044.

## What this row is for

Layer 4 today checks analytics only. Add the three element checks that layer 3 left to layer 4: a binding on a field that is not a `code` field, and unit strings that are not valid UCUM. After this row every valid snake artefact still has no diagnostics, and one handmade defect per new rule id gives exactly its rule at its pointer. No new example folder; layers 6 to 8 are row 2.3.

## Lessons from earlier rows to follow

- Extend `semanticLayer` (an element branch next to the analytics branch); same diagnostic parts, same pure library, no new CLI command, no new import.
- Stable ids continue the catalogue: `CCIS-V4-009`, `V4-010`, `V4-011`. Plain prose in messages; no clinical code or threshold in any message.
- **Unknown is not false.** UCUM is a small offline grammar check. Anything the grammar cannot decide (for example an annotation or a unit it does not know) is a **warning** that says it was not checked, never an error and never a silent pass.
- Valid artefacts must stay at zero diagnostics. Test every unit string in the snake files first (`min`, `h`, `1`, and any others); the grammar must accept them.

## Decisions this chunk proposes (owner approves by approving the chunk file; at most three rows in `DECISIONS.md`)

- `CCIS-V4-009` (error): a field carries a `binding` but its `type` is not `code`. Applies to core and module fields. The second item named in the plan ("binding whose type does not fit its field") has no member to test, because a binding holds no type; it is recorded as not applicable.
- `CCIS-V4-010` (error): a unit string is clearly not UCUM (empty parts, unbalanced brackets, a space inside, an operator with nothing on one side, an unknown prefix-plus-unit form the grammar can rule out). Checked in element field `units`, analytics input and parameter `units`, output `unit`, and conversion `from` and `to`.
- `CCIS-V4-011` (warning): the grammar cannot decide (braces annotation, a unit symbol not in the small built-in table). Says "not checked", with the string.
- The built-in table is small: base units and prefixes needed for time, mass, volume, length, and `1`; extendable later. It is data inside the module, not a download.

## Build

1. `ccis-validator-semantic.js`: element branch in `semanticLayer`, UCUM grammar helper, three entries in `SEMANTIC_RULES`; README "Validate" table and known-gaps line updated (remove "not yet checked").
2. `test/ccis-validator-element.test.js`: (a) every valid snake artefact still has no diagnostics through layer 5; (b) one handmade defect per new id, from a copy of the valid element (binding on a quantity field; units `m g` with a space; a brace-annotated unit giving the warning); (c) a table of accepted and refused unit strings (about 20 each); (d) the pure-library scan still holds; (e) the catalogue lists the new ids once and `outcome` stays `no-errors-so-far` for the warning case.
3. `DECISIONS.md`, tracker.

**Done when:** the three new ids each have a handmade case at the right pointer, the valid snake files stay clean, and three deliberate breakages (let a binding on a quantity field pass; accept `m g`; turn the undecidable warning into silence) are seen failing. The owner runs or skips `npm test` as instructed in that session.

**Size guard:** 1 module edit, 1 test file, 1 README edit, 3 rule ids. If more is needed, drop the output and conversion unit checks first (analytics units), keep element units.

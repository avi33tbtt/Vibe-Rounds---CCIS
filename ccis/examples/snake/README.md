# Snake envenomation reference artefacts (row 1.5)

Prototype. Synthetic data only. Not for clinical use. Every artefact here is **demonstration only** and has had **no clinical review**. No clinician owner is named, so every parameter is disabled and carries no value.

Source: `docs/USE-CASE-SNAKE.md` sections 1 to 5. All artefacts are `status: draft`, version `0.1.0`, standard `0.1.0`, publisher `Synthetic test publisher`.

| File | What it describes |
|------|-------------------|
| `snake-envenomation.element.json` | The element: facts F1 to F9 as ten fields (F1 is a bite time plus a companion certainty field). No product, quantity or amount of anything. |
| `snake-demo-terminology.binding.json` | The local demonstration binding for the clotting test status (F3). A label in a demonstration code system `ccis-demo`, unverified. No real code is used. |
| `snake-documentation.pathway.json` | Four stages (presentation, clotting-test documentation, anti-snake-venom documentation, gap report), the two nodes embedded, transitions and one timing link that names a parameter and carries no number. |
| `snake-node-clotting.node.json`, `snake-node-antivenom.node.json` | The two decision nodes as standalone files. A test keeps them identical to the copies inside the pathway. Each has explicit indeterminate and missing-data outcomes and a next step on every outcome. |
| `snake-interval.analytics.json` | Analytic A: bite-to-anti-snake-venom interval and an optional comparison that stays `parameter-not-enabled` until a target and an edge rule are enabled. |
| `snake-completeness.analytics.json` | Analytic B: per-item documentation states, a count and overall status against expected items (once supplied), and a read-time window (once supplied). Measures the record, not care. |
| `snake-interval.analytics.0.1.1.json`, `snake-completeness.analytics.0.1.1.json` | Versions 0.1.1 of the two analytics (row 1.5b): the comparison honours the certainty choice and F7 (F-1), the read-time window needs F3 documented as present (F-2), the per-item table gives `conflict` (F-3, in part), and the declared conversion `hoursToMinutes` 0.1.0 lets a duration parameter be given in hours. Same ids, status `draft`. The 0.1.0 files are unchanged and stay published. The findings are in `ccis/fixtures/snake/README.md`. |

## Modelling choices to know about

- **Status facts use the six data states.** F3 and F7 are coded fields. A value means performed or given. "Explicitly not performed" and "explicitly not given" are the state `explicitly-negative`, "unknown" is `unknown`, "no entry" is `absent`. The decision nodes test states only (D-018), so this is how the dossier's outcomes become expressible. Demonstration code lists therefore stay tiny.
- **Value-set membership is not expressible (decision D-032).** The binding schema holds one code. It cannot list the members of a value set, and there is no terminology-package schema. Each coded field carries its own single-concept binding. Member lists wait for a numbered amendment or a new row, decided when fixtures (1.5a) or the importer need them.
- **Technical bounds only.** The duration parameters need an allowed range. The numbers `0` to `525600` (minutes in 365 days) are a technical bound of the format, stated in each parameter's note. They are not clinical values and not suggestions.
- **Population scope (P6) is declared but not used in any tree.** The whitelist has no operator that applies clinician-defined criteria. The scope filter is a pre-filter for the executor (row 3.4). Tracked in D-034.

## Left to later rows

- Operator arity and types, including what `select` and `count` mean over a parameter-supplied set; unit consistency; reachability; that every `needs` key and ref resolves in a real validator (Phase 2). This row's test checks the references only for these artefacts.
- Unit conversion (a duration parameter in hours) is not declared. Parameter units are minutes only. Row 1.5a decides whether the unit-conversion fixture class needs a new version. (Done in row 1.5b: declared in the 0.1.1 files; the 0.1.0 files stay minutes only.)
- Results, synthetic cases and hand-calculated expected values: row 1.5a, then row 3.4. Invalid examples: row 1.6.

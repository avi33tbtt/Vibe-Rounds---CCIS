# CCIS: Contextual Clinical Intelligence Standard (prototype)

Prototype. Synthetic data only. Not for clinical use. Nothing here has had clinical review, and no number in the demo is a clinical value.

## Run the demo

Needs Node 22 or newer. No network, no database, no server.

```
git clone https://github.com/avi33tbtt/Vibe-Rounds---CCIS
cd Vibe-Rounds---CCIS
npm ci
npm test
npm run demo -- run --envelope ccis/fixtures/snake/emr-export/emr-demo-case.envelope.json --out demo-record.json --at 2026-11-24T12:00:00Z --demo-parameters
```

The last command reads the EMR Enhancer's export of its seeded demo case and writes one run record (`demo-record.json`, status `completed`). Then open `ccis-viewer.html` in a browser, choose `demo-record.json` in the first file picker and, for the staged cohort view, `ccis/demo/cohort-demo.json` in the second.

What you should see for this case (worked out by hand in `ccis/fixtures/snake/emr-export/emr-demo-case.expected.json`):

- bite-to-antivenom interval and its comparison: **needs data** (the start time was never recorded), no value, never zero;
- clotting documentation: three items documented, the result **unknown**, count 3 of 4, overall **indeterminate**, read time in window;
- pathway: the clotting node stops at **indeterminate** (an explicit unknown result has no outcome, finding F-7) and goes to the gap report.

Leave out `--demo-parameters` and every parameter stays disabled: the results that need a clinician's value say `parameter-not-enabled`. Running the same command again gives byte-identical output; a different record is never written over an existing file.

To produce a fresh export, run the demo from the EMR Enhancer repository (https://github.com/avi33tbtt/Vibe-Rounds---EMR-Enhancer-App, `docs/DEMO-RUNBOOK.md`). Its bridge calls this CLI.

## Validate an artefact (rows 2.1 and 2.2)

Layers 1 to 5 of the validator are built: syntax, structural, reference integrity (row 2.1), semantic, and graph and compatibility (row 2.2). Layers 6 to 8 are row 2.3; until then the result lists them as **not run**, and "not run" is never a pass.

```
node ccis-cli.js validate ccis/examples/snake/snake-interval.analytics.0.1.1.json --known ccis/examples/snake
node ccis-cli.js validate ccis/examples/invalid/4-semantic/time-diff-on-code.json --known ccis/examples/snake
node ccis-cli.js validate ccis/examples/invalid/5-graph-and-compatibility/transition-to-missing-stage.json --known ccis/examples/snake
```

- Exit code 0: no error diagnostics (warnings do not count). 1: at least one error. 2: usage error or an unreadable file. `--json` prints the same data as JSON.
- References resolve only against the artefacts given: the files on the command line (known to each other) and the `.json` files in `--known <dir>`. A reference to anything else is reported (CCIS-V3-004), never assumed.
- A layer that fails stops the later layers for that artefact (fail closed). Every diagnostic has a severity, a stable rule id, a location, a message and a hint. Layers 4 and 5 list diagnostics by rule id, then location.
- As a library: `validateArtefact(textOrObject, { known, schema })` in `ccis-validator.js`; layers 4 and 5 are in `ccis-validator-semantic.js`. Pure: no files, no network, no clock.

| Layer | Rule ids | What they check |
|-------|----------|-----------------|
| 1 Syntax | `V1-001`, `V1-002` | The text is a JSON object. |
| 2 Structural | `V2-001` to `V2-006` | The committed schemas. |
| 3 Reference integrity | `V3-001` to `V3-005` | Fields, keys and referenced artefacts exist. |
| 4 Semantic | `V4-001` to `V4-006`, `V4-009`, `V4-010` errors; `V4-007`, `V4-008`, `V4-011` warnings | Analytics: operator argument types and counts; ids resolve; units and declared conversions; states an output declares; known time zones; unused inputs and parameters. Elements: a binding only on a code field; unit strings are UCUM (a small offline grammar; what it cannot decide is a warning that says "not checked"). |
| 5 Graph and compatibility | `V5-001` to `V5-006`, `V5-008` errors; `V5-007` warning | Stages and transitions exist and are reachable; outcomes test the node's inputs and cover its first input's six record states; timing parameters exist; every non-report stage has a way out; supported standard and operator-set versions. A cycle is a warning only. |

- Known gaps: duplicate keys inside a JSON object are not detected; a leading byte order mark is a syntax error. **Not checked:** a full UCUM check (units outside the small built-in table and brace annotations give a warning only, CCIS-V4-011); whether a cycle is bounded (gap G-09, row 5.3); execution-profile feasibility and pin resolution (row 2.4); layers 6 to 8 (row 2.3). `criteria` parameters are never reported as unused, because their use lies outside the expression tree.

## What is staged

Shown, but not the real thing. Each is labelled in the viewer.

- **Demo runner.** The `ccis-demo-*.js` files and `ccis-cli.js` are a small stand-in. Rows 2.x and 3.x replace them; the `ccis-cli.js run` interface and the fixtures stay.
- **Parameters.** `--demo-parameters` enables test-only placeholder values (the same as fixture `normal-01`). Every record and view then says "demo placeholders, not clinical values". No clinician owns the parameters yet.
- **Cohort view.** Counts from running the real runner over the 32 synthetic fixture cases. It is not the cohort engine (rows 5.x).
- **Second package.** A roadmap card only (row 4.5).

## Limitations

What the demo runner does not do, and where the real thing is planned.

| Not done | Planned |
|----------|---------|
| Validator layers 6 to 8 and the compiler. Layers 1 to 5 exist as a library and `validate` command, but the demo runner does not call them. UCUM units and bindings on non-code fields are not checked yet. | Rows 2.2b, 2.3, 2.4 |
| Importer with compatibility rules: only the exact 0.1.0 package is held, and the loader refuses anything else. The EMR maps its own version 1 to 0.1.0 outside CCIS. | Rows 3.x (importer, compatibility) |
| Executor: a whitelist interpreter for only the operators the two snake analytics and two nodes use. An unknown operator is refused. | Row 3.4 |
| Run records: built and content-addressed, but no batch records and no integrity or signature fields (gaps G-03, G-05). | Rows 3.x |
| One package only (snake envenomation, two analytics, two nodes). No marketplace, no templates, no research-to-package, no AI drafting. | Rows 3.x, 4.x, 5.x |
| Browser viewer: a static page that reads a record file you choose. It cannot import, edit or share anything, and makes no network request. | Rows 3.x (browser app) |
| FHIR Mode, governance, evaluation of clinical safety. | Rows 6.x |
| Open findings in the use case: F-4, F-5 (tree behaviour against the dossier), F-6 (a not-collected expected item reads complete), F-7 (no node outcome for a performed test with an unknown result), F-8 (no estimate warning when an interval is needs-data for another reason). | New package version |

Before any real data: clinical review and a named clinician owner, safety sign-off, security review, privacy assessment and licence checks.

## Schemas (row 1.1)

JSON Schema 2020-12.

| File | Covers |
|------|--------|
| `manifest.schema.json` | CCIS-REQ-009 to 012, 014 to 016. No integrity fields (gap G-05). |
| `element.schema.json` | CCIS-REQ-021, 022, 032, 035, 036, 042. |
| `terminology-binding.schema.json` | CCIS-REQ-039 to 041, 044. |

Validators are generated (`npm run build`) into `ccis/validators/ccis-validators.js`, committed, and checked for staleness by the tests. Nothing compiles a schema at runtime.

**Enforced in the schema:** closed objects (unknown fields rejected; `x-` extensions allowed); semver and ranges; references are id plus exact version or range, never embedded content; numeric fields (`quantity`, `integer`) must declare units; `date` and `datetime` fields must declare a time meaning; `code` fields must carry a binding; bindings are by code-system reference and code, version pinned or `noVersionPublished`; unmapped concepts carry no code; lossy and low-confidence mappings carry confidence and a note. There is no field in which a threshold, dose or band could be stored: thresholds are parameters (row 1.3).

**Left to the Phase 2 validator (cannot be expressed in JSON Schema):** field keys unique within an element; relationships point at existing keys; module fields do not collide with core fields; a binding on a non-`code` field matches the field's concept; unit strings are valid UCUM; reference ids exist and versions resolve.

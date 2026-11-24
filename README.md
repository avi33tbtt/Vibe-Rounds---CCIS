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
| Layered validator and compiler: only schema checks run. Cross-field rules (unique keys, references that resolve, UCUM units, value sets) are not checked. | Rows 2.1 to 2.4 |
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

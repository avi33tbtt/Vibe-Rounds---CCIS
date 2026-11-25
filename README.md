# CCIS: Contextual Clinical Intelligence Standard (prototype)

Prototype. Synthetic data only. Not for clinical use. Nothing here has had clinical review, and no number in the demo is a clinical value.

## Run the demo

Needs Node 22 or newer. No network, no database, no server.

```
git clone https://github.com/avi33tbtt/Vibe-Rounds---CCIS
cd Vibe-Rounds---CCIS
npm ci
npm test
npm run accept   # the whole slice through the real command line, checked against the hand-calculated fixture
npm run demo -- run --envelope ccis/fixtures/snake/emr-export/emr-demo-case.envelope.json --out demo-record.json --at 2026-11-24T12:00:00Z --demo-parameters
```

The last command reads the EMR Enhancer's export of its seeded demo case and writes one run record (`demo-record.json`, status `completed`). Then open `ccis-viewer.html` in a browser, choose `demo-record.json` in the first file picker and, for the staged cohort view, `ccis/demo/cohort-demo.json` in the second.

What you should see for this case (worked out by hand in `ccis/fixtures/snake/emr-export/emr-demo-case.expected.json`):

- bite-to-antivenom interval and its comparison: **needs data** (the start time was never recorded), no value, never zero;
- clotting documentation: three items documented, the result **unknown**, count 3 of 4, overall **indeterminate**, read time in window;
- pathway: the clotting node stops at **indeterminate** (an explicit unknown result has no outcome, finding F-7) and goes to the gap report.

Leave out `--demo-parameters` and every parameter stays disabled: the results that need a clinician's value say `parameter-not-enabled`. Running the same command again gives byte-identical output; a different record is never written over an existing file.

To produce a fresh export, run the demo from the EMR Enhancer repository (https://github.com/avi33tbtt/Vibe-Rounds---EMR-Enhancer-App, `docs/DEMO-RUNBOOK.md`). Its bridge calls this CLI.

## Run through the local market (row 3.7)

Four commands take a market folder (`market/`, built by `node scripts/market-build.js`) and an export file to a run record, with no browser and no network. `run` without `--market` is still the demo above. `--at` is required (nothing reads the clock). Parameters stay disabled unless `--params <file>` supplies them (`{ "id": { "value": ... } }`); a package that needs data to report on missing data runs only with `--run-needs-data`. Output never shows observation values, and `show` never prints the input snapshot. Exit codes: 0 done, 1 refused (nothing written), 2 usage error.

```
E=ccis/fixtures/snake/normal/normal-01-all-enabled.envelope.json
node ccis-cli.js import --envelope $E --market market
node ccis-cli.js compat --envelope $E --market market --pathway snake.documentation-path
node ccis-cli.js run --market market --pathway snake.documentation-path --envelope $E --out run.json --at 2026-11-24T12:00:00Z
node ccis-cli.js show run.json
```

## Browser app shell (row 3.8)

`node scripts/build-app.js` bundles `ccis-app.js` into one inline script (esbuild, with a pure SHA-256 standing in for `node:crypto` in the bundle only) and writes `index.html` with its script and style hashes in a strict CSP; `--check` fails if the committed file is stale. Open `index.html` in a browser: for now it shows only the banners and a ready line. It loads no market, reads no file and makes no network request; rows 3.8a onward add those one at a time.

## Validate an artefact (rows 2.1 to 2.3)

All eight layers of the validator are built: syntax, structural, reference integrity (row 2.1), semantic, and graph and compatibility (rows 2.2, 2.2b), executable safety, test verification and governance (row 2.3). A layer that did not run is listed as **not run** with its reason, and "not run" is never a pass.

```
node ccis-cli.js validate ccis/examples/snake/snake-interval.analytics.0.1.1.json --known ccis/examples/snake
node ccis-cli.js validate ccis/examples/invalid/4-semantic/time-diff-on-code.json --known ccis/examples/snake
node ccis-cli.js validate ccis/examples/invalid/5-graph-and-compatibility/transition-to-missing-stage.json --known ccis/examples/snake
node ccis-cli.js validate ccis/examples/invalid/7-test-verification/test-expects-missing-output.json --known ccis/examples/snake --fixtures ccis/fixtures/snake
```

- Exit code 0: no error diagnostics (warnings do not count). 1: at least one error. 2: usage error or an unreadable file. `--json` prints the same data as JSON. `--fixtures <dir>` reads the case names in `<dir>/index.json` for layer 7; without it a test's fixture name is not checked and a warning says so (CCIS-V7-004).
- References resolve only against the artefacts given: the files on the command line (known to each other) and the `.json` files in `--known <dir>`. A reference to anything else is reported (CCIS-V3-004), never assumed.
- A layer that fails stops the later layers for that artefact (fail closed). Every diagnostic has a severity, a stable rule id, a location, a message and a hint. Layers 4 to 8 list diagnostics by rule id, then location.
- As a library: `validateArtefact(textOrObject, { known, schema, fixtures })` in `ccis-validator.js`; layers 4 and 5 are in `ccis-validator-semantic.js`, layers 6 to 8 in `ccis-validator-governance.js`. Pure: no files, no network, no clock.

| Layer | Rule ids | What they check |
|-------|----------|-----------------|
| 1 Syntax | `V1-001`, `V1-002` | The text is a JSON object. |
| 2 Structural | `V2-001` to `V2-006` | The committed schemas. |
| 3 Reference integrity | `V3-001` to `V3-005` | Fields, keys and referenced artefacts exist. |
| 4 Semantic | `V4-001` to `V4-006`, `V4-009`, `V4-010` errors; `V4-007`, `V4-008`, `V4-011` warnings | Analytics: operator argument types and counts; ids resolve; units and declared conversions; states an output declares; known time zones; unused inputs and parameters. Elements: a binding only on a code field; unit strings are UCUM (a small offline grammar; what it cannot decide is a warning that says "not checked"). |
| 5 Graph and compatibility | `V5-001` to `V5-006`, `V5-008` errors; `V5-007` warning | Stages and transitions exist and are reachable; outcomes test the node's inputs and cover its first input's six record states; timing parameters exist; every non-report stage has a way out; supported standard and operator-set versions. A cycle is a warning only. |
| 6 Executable safety | `V6-001`, `V6-002` | No code-like text in `x-` members; no runnable markup in any text; no network address in an `x-` member. By pattern only: it can miss clever text, and the executor's whitelist is the real barrier. |
| 7 Test verification | `V7-001` to `V7-003`, `V7-005` errors; `V7-004` warning | A package's declared tests name outputs, parameters, states and fixture cases that exist. Nothing is run. |
| 8 Governance | `V8-001`, `V8-002` errors; `V8-003` warning | A validated status is not claimed against an evidence statement that says none is claimed; the validation scope names the artefact's own version. It never judges whether a claim is true. |

- Known gaps: duplicate keys inside a JSON object are not detected; a leading byte order mark is a syntax error. **Not checked:** a full UCUM check (units outside the small built-in table and brace annotations give a warning only, CCIS-V4-011); whether a cycle is bounded (gap G-09, row 5.3); execution-profile feasibility and pin resolution (row 2.4); whether a review really took place (a claim is compared with claims, never with the world). `criteria` parameters are never reported as unused, because their use lies outside the expression tree.

### Validation record (row 2.3a)

`node ccis-cli.js validate <file>... --known <dir> --record <dir>` also writes `<file name>.validation-record.json` (canonical JSON) for each artefact, as `ccis-validation-record.js` builds it: the artefact id, type and version; the standard and validator versions; all eight layers with their diagnostics; and five assurance members. Only **structural** (layers 1 to 3) and **semantic** (layers 4 and 5) can be `met`, and only as a software check. **Clinical**, **execution** and **security-privacy** are always `not assessed`: no software check says anything about them. A `passed` outcome means no layer found an error. It does not mean safe. Warnings are listed in the `conditions` of the member they belong to.

- No record is written when layer 1 or 2 failed, or when the artefact has no manifest (decision nodes and terminology bindings have none yet). The reason is printed, and the validation result is shown as before.
- A record is never written over a different one (exit 2). Rule ids in a record are lowercase, for example `ccis.v4-009` for `CCIS-V4-009`.

### Compile and checksum (row 2.4)

`node ccis-cli.js compile <file> --out <dir> [--known <dir>] [--fixtures <dir>]` validates one artefact through all eight layers and, only if every layer passes, writes `<name>.canonical.json` (the canonical bytes, no trailing newline) and `<name>.compiled.json` (subject, canonical-form id, compiler version, checksum, warnings). `sha256sum` of the canonical file equals the checksum. Otherwise nothing is written (exit 1, with a code `CCIS-C-001` to `CCIS-C-008` and a reason). The library is `ccis-compile.js`.

- Canonical form `ccis-canonical-json/1`: sorted member names, array order kept, no whitespace, `x-` members covered. The checksum is `sha256:` and 64 hex characters, and is never stored inside the artefact. It shows the bytes are the same bytes; it says nothing about who published them or whether they are clinically safe.
- The text route refuses duplicate member names, unsafe numbers and invalid Unicode, which `JSON.parse` would hide.
- **The equivalence harness (`compareRoutes`) is proven here on three stand-ins for one route** (the committed text, an in-memory copy and a re-formatted copy). The code SDK (row 4.2), the form editor (4.4) and FHIR Mode (6.1) are not built; they plug into the same harness.
- **Limits:** array order is significant, so two routes that list the same items in a different order give different bytes. A lone decision node or terminology binding has no manifest and is refused (C-008). One artefact is compiled at a time; a bundle of pinned artefacts and the check of a pin at use come with rows 3.x. No signing.

### Import (row 3.1)

`ccis-import.js` is the importer library: `importEnvelope(envelope, { held, supportedEnvelopeMajors, expectedChecksum })` turns one EMR export into a **canonical context** (`ccis-context/1`) and an **import report**. It reads no files and makes no network request. `held` is the list of artefact documents the app holds. The command-line `import` command comes with row 3.7.

- **Four categories, one per record.** Every observation, event and applied reference is `accepted`, `rejected`, `unmapped` or `ambiguous`, and the counts add up to the record count. The context holds only the accepted records, unchanged and sorted by `id`, with a `sha256:` checksum. The report keeps the `ref`, a reason code and a category for the others, never their content.
- **Rejected:** entered in error; source class, state or kind not permitted by the field; a unit the field does not permit; a correction of an id that is not in the envelope. **Unmapped:** the concept is not a field of an applied element.
- **No unit conversion at import.** A unit that is not permitted is rejected, never converted or assumed. Conversion happens only in the executor, through a package's declared `convert`. No time, zone or value is ever filled in; unknown stays unknown, and the report notes `recorded-time-unknown` and `time-zone-unknown`.
- **`ambiguous` is always 0 for the snake package.** Conflicting observations are kept and handled by the executor's omission rule (D-050). The report format allows `ambiguous`; the importer does not produce it yet.
- **Whole-envelope refusal.** A file that is not an object, has an unsupported major version, fails the schema or carries an unrecognised member (identity and narrative have no member, so they arrive as one), applies an artefact version the app does not hold, uses a record id twice, or does not match `expectedChecksum` is refused with no records and no context. The reason never names the member or quotes the content.
- All `x-` members are ignored and listed in `ignored` by JSON pointer. `ccis-demo-loader.js` is unchanged and still runs the demo until the switch in rows 3.7 and 3.11.

### Compatibility (row 3.2)

`ccis-compat.js` decides whether a package **can run on a context, and says why**. `resolveCompatibility({ pathway, held, context, runtime, request })` returns one entry for the pathway and one for each analytics package it lists. It reads no files and makes no network request. `context` may be `null` (a catalogue view before any import); `runtime` is passed in; `request.mode` is `preview` (default) or `governed`.

- **Six checks, every entry lists all six:** artefact (held, in range, extensions understood), semantic (inputs match element fields, types and units; the context applies the held versions), schema (committed validators, standard major, context form), data readiness, runtime (engine, operator set, execution limits, FHIR), assurance suitability. Each check is `met`, `limited`, `needs-data`, `not-evaluable` or `not-met`, with its findings, a reason code (`CMP-n-nn`, 37 in the exported `COMPAT_REASONS`) and what would be needed.
- **Five outcomes, exactly one:** Not eligible (status or scope does not permit the use), Incompatible, Needs data, Compatible with limitations, Compatible. **A check that cannot be evaluated gives Incompatible**, never Compatible. Needs data means the model matches and only data is lacking.
- **No guessing.** Matching is by exact id, exact version or declared range, exact field key and unit. A different case, a similar name or a near version never matches; a unit differs unless a declared conversion covers it.
- **Unknown stays unknown.** An input is missing when no observation exists, or the only ones are `absent`, `unknown` or `not-collected`. `not-applicable` and `explicitly-negative` are documented answers. Entered-in-error records are not in the context, so they count as missing.
- **Pathway roll-up.** A required package counts in full; an optional package can only lower the pathway to "with limitations". The snake pathway lists both packages as optional.
- **Execution policy v0** (`executionPolicy`): only Compatible and Compatible with limitations may run. Preview runs every status except `rejected` and `withdrawn` with the banner "Preview. Prototype, synthetic data only, not validated, not for clinical use."; a validated status shows its scope (version, population, setting, intended use), a conditional one also says its conditions must be shown, and `reviewed` never reads as validated. Governed mode needs a validated status whose scope names the exact version.
- **Not checked here:** conflicting observations, terminology binding resolution, enabled parameter values (so every snake package is at best "with limitations"), pins and published checksums (3.6), running anything (3.3 to 3.5). The command-line `list compatible` comes with row 3.7.

### Executor (rows 3.3 and 3.4)

`ccis-exec.js` is the whitelist expression interpreter. It reads no files, makes no network request and uses no `eval`, `Function`, dynamic import, clock or randomness. It does not read the context or walk decision nodes, and it builds no run results (rows 3.4a, 3.4b and 3.5).

- **Two calls.** `prepareAnalytic({ analytic, checksum, runtime })` recomputes the canonical checksum (a mismatch is X-012), runs every static check, lists all refusals (sorted) and returns a deep-frozen prepared form. `evaluateOutput({ prepared, outputId, inputs, parameters })` evaluates one output and accepts nothing but a prepared form. A refusal never leaves a partial value.
- **All 18 whitelisted operators are implemented:** `and or not is-present state-of eq ne lt le gt ge if` (row 3.3) and `add sub time-diff convert count select` (row 3.4). The four snake analytics prepare. `first last min max coalesce` are not operators (finding F-9, deferred).
- **Three-valued.** Unknown carries the input or parameter states it came from (absent, unknown, not-collected, conflicting, parameter-not-enabled, unreadable) and never becomes false, zero or a default. Every argument is evaluated; `if` with an unknown condition is unknown and visits neither branch. `count` and a table row from `select` are unknown when any argument is unknown.
- **Units.** No implicit conversion: unlike types or units are X-010. `time-diff` is end minus start in minutes. `convert` expresses a value in the conversion's target unit (identity when already there); only `linear` conversions apply (X-015).
- **Limits.** Steps per node visited, depth at prepare, output bytes of the canonical value. Refusal ids X-001 to X-016 are in `EXEC_REFUSALS` (X-002 is kept but can no longer be reached).

### Binder and result mapper (row 3.4a)

`ccis-bind.js` joins a 3.1 context, a prepared analytic and the package's output contract. It is pure (no file, clock, network, randomness or `eval`). `runAnalytic({ prepared, context, supplied, evaluationTime })` returns every output as a run result, or one refusal (ids B-001 to B-011 in `BIND_REFUSALS`) and no partial results.

- **Records are found by concept, never by position.** No record is `absent`; more than one is `conflicting`, even if they agree. A time with no stated zone or an impossible date is unreadable: never a number, never zero (the analytic then reads it as not present, so it gives `needs-data`).
- **Parameters arrive disabled.** `supplied` enables them (`{ id: { value } }`). A supplied id the package does not declare, a malformed value, or an enabled `criteria` parameter is refused. Storage of a clinician's values is not decided (D-112).
- **Results are checked against the declared output.** An unknown result is `indeterminate` only if the output declares it; any other result the output does not declare refuses the whole analytic.
- **Wording is a labelled table (`WORDING`, D-047),** keyed by analytic id. Other analytics get generic notes only. The omission rule (D-050) and finding F-6 (D-052) are unchanged.
- **Oracle.** The 32 fixture cases plus the EMR export reproduce their expected files. Decision-node walking is row 3.4b.

### Decision-node walker (row 3.4b)

`ccis-walk.js` walks a pathway over a 3.1 context. It is pure (no file, clock, network, randomness or `eval`). `walkPathway({ pathway, context })` returns `{ ok, route, results, trace }`, or one refusal (ids W-001 to W-008 in `WALK_REFUSALS`) and nothing else.

- **Records only (D-018).** A node tests the recorded state of each input: present, absent, unknown, not-collected, not-applicable, explicitly-negative or conflicting. A field's records are found by concept, never by position; two agreeing records are still conflicting.
- **No outcome matches (D-053):** `indeterminate`, outcome null, and the route stops at the report stage. Two matches refuse the whole pathway. Unknown never routes as documented.
- **Rule trace.** One entry per node visited: the states found, the number and ids of the records (never values), every outcome considered in package order with each test and whether it passed, and the outcome taken. It is a separate member; the run-result schema is unchanged.
- **Oracle.** The 33 routes (32 cases plus the EMR export) and the node results equal the demo walker's.

### Run planner and run records (row 3.5)

`ccis-run.js` plans a run, executes it and writes one immutable run record. It is pure (no file, clock, network, randomness or `eval`). `planRun` uses the 3.2 compatibility result to decide what may run; `executeRun` walks the pathway (3.4b) and runs each allowed analytic (3.4a); `verifyRecord`, `rerunFromRecord` and `compareRerun` check and repeat a record. Refusals are R-001 to R-011 in `RUN_REFUSALS`.

- **One record per request.** The pathway is the record's `package`; the analytics, with their checksums, are in `x-analytics`. Results are node results in route order, then analytic results by analytic id.
- **The id is an address.** `run-` plus the SHA-256 of the run's inputs (versions and checksums, snapshot, parameters, evaluation time, `corrects`, plan options). A changed version, observation, parameter or time gives a different id. A correction is a new record that names the original.
- **Skipped, not guessed.** A package 3.2 does not allow to run (Needs data, Incompatible) is skipped and listed in `x-plan`. `request.runNeedsData: true` runs Needs data packages too (see F-10). Nothing runnable is a refusal and no record. A refused import or a binder refusal is a `failed` record with no results.
- **Rerun.** `rerunFromRecord` needs only the record and the same artefacts; the new record is byte-identical, id included. `verifyRecord` detects an altered record; it cannot prevent one (storage is row 3.7).

### Local test marketplace (row 3.6)

`ccis-market.js` is a pure library with a local marketplace as a plain value (`{ index, files }`): `publishArtefact` (patient-data screen, then all eight validation layers with references resolved against what is already published, then add), `resolve` (highest satisfying version that is not rejected or withdrawn; deprecated is flagged), `pin` and `verifyPin` (a pin is `{ id, type, version, checksum }`; a missing checksum blocks use), and `loadMarket` (every file is checked against its index entry; any mismatch refuses the whole market). The folder `market/` is the same shape the later GitHub-hosted marketplace will have: `index.json` plus `artefacts/<id>/<version>.json` in canonical bytes, so `sha256sum` of a file is its checksum. `node scripts/market-build.js` rebuilds it from the snake examples (the only file that writes to disk); `--check` fails if the folder differs from a fresh build. Releases are immutable, there is no unpublish, and there is no clock. **Limits:** a checksum proves the same bytes, not who published them or that they are safe (signing is row 6.2); the patient-data lint is a screen, not a proof: it can miss data and can refuse a harmless string, and it names a rule and a path, never the value. Only elements, analytics packages and pathways can be published; decision nodes and terminology bindings wait for finding D-099.

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
| The compiler. All eight validator layers and the validation record exist as a library and `validate` command, but the demo runner does not call them. A full UCUM check is not done (small built-in table). | Row 2.4 |
| The demo loader still decides what runs: only the exact 0.1.0 package is held, and it refuses anything else. The importer (3.1) and compatibility resolver (3.2) exist as libraries but the demo does not call them yet. The EMR maps its own version 1 to 0.1.0 outside CCIS. | Rows 3.7 and 3.11 (switch) |
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

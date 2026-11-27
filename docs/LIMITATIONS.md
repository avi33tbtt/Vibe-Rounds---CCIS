# CCIS 0.1.0 limitations (approved by the owner 2026-11-25)

Status: **approved** by the owner on 2026-11-25 ("approve limitations"); 0.1.0 frozen in row 3.11b. Written in row 3.11a for Gate C.
Prototype. Synthetic data only. Not for clinical use.
Each line names where it comes from. A line with no source is not here.

## What 0.1.0 is

- One synthetic pathway, `snake.documentation-path` 0.1.0, with two analytics (`snake.bite-to-antivenom-interval`, `snake.clotting-documentation-completeness`). The market holds 0.1.0 and 0.1.1 of each; a default run resolves 0.1.1. (`market/index.json`; rows 1.5b, 3.11.1)
- A local-first static page (`index.html`) plus a Node CLI. No server, no database. (D-002)
- `npm run accept` drives the real CLI through six steps and checks the hand-calculated fixture; `test/ccis-accept-negative.test.js` has 8 negative cases. Reruns are byte-identical. (rows 3.11, 3.11.1; core rules)
- Versions are independent and are all 0.1.0 today: standard (`ccis-import.js`, `ccis-validation-record.js`), importer, runner, run output contract, binder and wording, compat, walker, compiler (`market/index.json`). The market format is `ccis-market/1` and the canonical form `ccis-canonical-json/1`. `package.json` says 0.1.0 (row 3.11b). (`grep "VERSION ="`)

## Safety and clinical

- **LIM-01** Not validated and not for clinical use; every view carries the prototype banner. (README; plan section 13)
- **LIM-02** Synthetic data only until the go-live gate. (`01-core.md`; plan section 10)
- **LIM-03** No clinician owner is named, so every parameter value is a test-only placeholder and packages show mechanics only. (plan section 11 item 1; plan section 13 risk "placeholder parameters")
- **LIM-04** Results describe the record. They are not recommendations or decision support. (`01-core.md`)
- **LIM-05** Software conformance never implies clinical safety; "validated" must carry its scope. (`01-core.md`; plan section 12)
- **LIM-06** Before any real patient data: clinical safety sign-off, security review, privacy assessment, terminology licences, device-software and health-data rules, independent clinical review of anything labelled validated. (plan section 10)

## Scope

- **LIM-07** Not built: FHIR Mode, governance, evaluation of clinical safety (rows 6.x); templates, decision graphs, research-to-package, cohorts (rows 5.x); authoring routes and distribution (rows 4.x); AI drafting (D-011, row 4.3). (README; plan section 7)
- **LIM-08** One pathway only. (README)
- **LIM-09** No signing and no batch records. Signing is row 6.2. The README noted no integrity or signature fields on run records (gaps G-03, G-05); that README line dates from the demo stage and was not re-checked here. (`ccis-market.js` header; README)
- **LIM-10** The executor is a whitelist of six operators. `first`, `last`, `min`, `max` and `coalesce` are not available. (D-121, D-122, F-9)

## Data and privacy

- **LIM-11** Identity, narrative and entered-in-error records are excluded from the import by default. (`01-core.md`)
- **LIM-12** The market lint is a screen, not a proof: it can miss patient data. (`ccis-market.js` header; D-197)
- **LIM-13** A run record holds the input snapshot, so an exported record is data you must handle as such. (`01-core.md`)
- **LIM-14** The page makes no network request and has a strict CSP; a bundle-wide scan checks for forbidden APIs. (`01-core.md`; row 3.10, D-184)

## Engineering

- **LIM-15** `verifyRecord` checks the schema, the id and the results checksum. `record.context` is not part of the id, so a changed byte there still verifies. (F-11, D-143)
- **LIM-16** After `loadMarket` accepts a folder, `verifyPin` cannot fail from outside. (D-143)
- **LIM-17** `compat` reaches only "Compatible with limitations" and "Needs data" on the fixtures: parameter values cannot reach the resolver, conflicting observations are not detected, terminology bindings are not resolved. (D-112, D-143)
- **LIM-18** With no context the pathway row reads "Compatible with limitations" while both packages need data; the view must show the package rows. (F-12, D-162)
- **LIM-19** By default a package with a missing input is skipped: the EMR export gets one result instead of eight. `--run-needs-data` reproduces the 33 expected files. (F-10, D-134, D-198)
- **LIM-20** Decision nodes and terminology bindings get no validation record. (D-099)
- **LIM-21** Fixture findings stay open in the packages: F-4, F-5 (tree behaviour against the dossier), F-6 (a not-collected expected item reads complete), F-7, F-8. (D-043, D-052, D-069)
- **LIM-22** At the freeze (row 3.11b) the full `npm test` ran 845 tests: all passed except the two known F-6 TODO gaps (4 skipped). You have not yet run it on your own machine. (D-201; tracker owner list)
- **LIM-23** The browser smoke test needs Chrome; CI may need `CHROME_PATH` set. `index.html` is 1.35 MB. (row 3.10a; row 3.9b.2)
- **LIM-30** AI drafting (row 4.3): you paste your own model key into the page. It sits in a password field until the click, then is cleared, but a browser extension or a hostile page script could read it, so use a key with a small spending limit. A draft's source trace names the source and citation only, not the passage span, and a refusal may quote a member path taken from the model reply. (D-257)

## Decisions only you can make

- **LIM-24** Name the clinician owner. Affects LIM-03. (plan section 11 item 1)
- **LIM-25** Confirm D-002 (no server, no database); changes Phase 5 if you expect shared use. (plan section 11 item 2; row 5.7)
- **LIM-26** Decide the name "CCIS" before any public release; and where the marketplace repo lives (row 4.1); and licences and terminology licensing. (plan section 11 items 3 to 5)
- **LIM-27** Decide F-4 to F-9 (F-9 has a proposed answer in D-121/D-122), D-099, D-112, F-10, F-11, F-12; they affect LIM-10 and LIM-15 to LIM-21. (tracker owner list)
- **LIM-28** Branch protection on the repo. (tracker owner list)
- **LIM-29** Commit `market/` as it is, with its `.gitattributes` (`* -text`). (tracker owner list)

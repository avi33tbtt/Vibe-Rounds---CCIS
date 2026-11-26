# Chunk E2c: envelope 0.3.0 paperwork, fixture and EMR go-ahead (written 2026-11-26, docs and one fixture; built the same session at the owner's request)

**Why:** E2a (schema) and E2b (importer) are `DONE`. This row records the change as amendment A-005, adds one fixture the EMR exporter must pass, and tells the EMR it may build R5h. Mirrors E1c. Needs E2b `DONE`.

**No SPEC edit and no version bump** (D-214, D-215): the CHANGELOG entry is the amendment; package, standard and importer versions are unchanged.

**Change 1 (`CHANGELOG.md`):** add `## A-005 (2026-11-26): envelope section administrations (0.3.0)` above A-004, same fields. Requirements: CCIS-REQ-082 and CCIS-REQ-084 (clarified, not changed), CCIS-REQ-019. Change in words: one optional section `administrations`; each item has a classified concept id, an `outcome` (given, held, refused, unknown), status, source class, provenance, recorded time, optional effective time, `orderRef` and `correctionOf`, and no free-text member (no dose, reason, note, route, site); needs envelope 0.3.0 or later; entered-in-error and `unclassified` entries are never kept; held and refused are never a dose; `orderRef` is carried unchecked; accepted administrations are read into the context but not yet bound to analytics (D-229).

**Change 2 (`docs/ROADMAP-COORDINATION.md`):** in the R4/R5 row say administrations are ready in envelope 0.3.0 (E2a to E2c); add one line under the rules: the exporter must also pass `ccis/fixtures/snake/administrations/`.

**Change 3 (fixture pair, new folder `ccis/fixtures/snake/administrations/`, NOT in `index.json`):** `administrations-01.envelope.json` = the `normal-01` envelope at version 0.3.0 with one order `r1` and five administrations: `m1` given (with `orderRef` r1), `m2` held, `m3` entered-in-error, `m4` unclassified, `m5` refused with a zone-unknown `effective`. `administrations-01.expected.json` holds hand-calculated literals: 2 references + 9 observations accepted (11), r1, m1, m2, m5 accepted (15); m3 rejected (1); m4 unmapped (1); total 17; the accepted ids and each record's category, kind, reason code and notes.

**Test (`test/ccis-administrations-fixture.test.js`, at most 6 cases):** envelope valid and 0.3.0; import equals expected record by record; context holds exactly the accepted ids, outcomes kept; report valid and checksum stable; the same envelope declaring 0.2.0 is refused; no free-text member. At most 3 breakages (flip a count; make m3 final; set the version to 0.2.0).

**Size guard:** 2 doc edits, 1 fixture pair (each under 5 KB), 1 test, DECISIONS (max 3 rows), tracker. After this row the EMR may build R5h against envelope 0.3.0.

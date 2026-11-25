# Chunk 3.11a: the 0.1.0 limitations list (for your review), and the freeze text

_Phase 3, Stage 2. Needs: 3.11.1 (done). Docs only: no code, no test, no schema change. Gate C: "you review the limitations list"._

**Core rules:** attach `01-core.md` too.

**Read only (5 files):** `CCIS_BUILD_PLAN.md` lines 282-320 (gates, open questions, risks); `README.md` lines 165-end (the Limitations table, which is stale: it still describes the demo runner); `CHANGELOG.md` lines 1-12; `DECISIONS.md` through `grep -n "F-[0-9]\+\|D-002\|D-099\|D-112" DECISIONS.md | cut -c1-220` (never the whole file); `grep -n "VERSION =" ccis-*.js` (the version constants). Do not read `docs/OWNER-ITEMS.md` or the archive: the owner list is already in the tracker.

## What this row is for

Gate C needs a list you can review in five minutes: what 0.1.0 is, and everything it is **not**. Today limits are spread over the README table, the tracker owner list, `DECISIONS.md` findings and plan risks. This row gathers them in one file. It does not freeze anything: the freeze happens in 3.11b, only after you approve the list.

## Build (docs only: 1 new file, 2 small edits, 1 new tracker row)

1. New `docs/LIMITATIONS.md`, at most 120 lines, plain words, no new claims. Ids `LIM-01` and up. Sections, in this order:
   - **What 0.1.0 is** (6 lines): one synthetic snake pathway, two analytics, local-first browser app plus CLI, `npm run accept`, byte-identical reruns; the version constants found by grep (standard, engine, runner, output contract, package versions) listed separately, because they are independent.
   - **Safety and clinical** (not validated; synthetic data only; thresholds are test-only placeholders; results describe the record, not decision support; conformance is not clinical safety).
   - **Scope** (no FHIR Mode, cohorts, templates, decision graphs, AI, server, database, signing, authoring routes; one pathway).
   - **Data and privacy** (identity and narrative excluded by default; the lint is a screen, not a proof; run records hold the input snapshot).
   - **Engineering** (what `npm test` and `accept` do and do not prove; Chrome needed for the smoke test; `index.html` is 1.35 MB; known F-6 gaps; F-10 to F-12).
   - **Open decisions only you can make** (each as `LIM-nn`, one line, the row it affects): clinician owner, D-002, F-4 to F-9, D-099, D-112, branch protection.
   Every line says where it comes from (a D-, F-, REQ- or plan section id). If you cannot cite a source, leave the line out.
2. `README.md`: replace the stale Limitations table with three lines pointing to `docs/LIMITATIONS.md`. Keep the "Prototype. Synthetic data only. Not for clinical use." line.
3. `CHANGELOG.md`: add a short `## 0.1.0 (candidate, not yet frozen)` entry above A-002 naming the file and the gate. Not dated as a release.
4. Tracker: 3.11a done; add row `3.11b` (TODO, **owner-gated**: starts only when you say "approve limitations"): bump `package.json` to 0.1.0, date the CHANGELOG entry, run `npm test` and `npm run accept` once, and give you the exact `git tag v0.1.0` command (you run it). Phase 4 stays `LOCKED` until 3.11b is done. `DECISIONS.md`: one row.

If the file would pass 120 lines, STOP: keep the first three sections and add the rest as `3.11a1`.

**Not in this row:** changing any version, tagging, any code, any new limitation you cannot cite.

**Done when:** `docs/LIMITATIONS.md` exists with every section; every line cites a source; the README table is replaced; the CHANGELOG entry says "candidate". No `npm test` is needed (docs only); say so in the summary.

**Size guard:** 1 new doc (at most 120 lines), 2 small edits, 1 tracker row.

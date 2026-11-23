# Chunk DS7-demo-hardening: End-to-end test and demo README

_Needs: DS6 and EMR DM1._ **Core rules:** attach `01-core.md`.
**Build:**
1. Copy an envelope exported by the EMR for its seeded demo case into `ccis/fixtures/snake/emr-export/` (synthetic) with its hand-calculated expected result; test the full path: envelope -> CLI -> record -> schema valid -> equals expected.
2. README section "Run the demo" (exact commands) and "What is staged".
3. Limitations list (what the demo runner does not do, mapped to rows 2.x and 3.x).
4. CI runs the demo test.
**Done when:** a clean checkout reproduces the demo result with documented commands.
**Size guard:** 1 test, 1 fixture pair, README edit.

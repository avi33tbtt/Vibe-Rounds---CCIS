# Chunk DS4-demo-cli: Command-line runner

_Needs: DS3._ **Core rules:** attach `01-core.md`.
**Build:**
1. `ccis-cli.js`: `node ccis-cli.js run --envelope <file> --out <file> [--demo-parameters] [--at <ISO time with zone>]`. Reads files, calls the pure modules, writes the run record. The only file in the demo that touches the file system. Evaluation time defaults to the `--at` value; no default clock reads in pure modules.
2. Exit codes: 0 record written (including `failed` records), 2 usage error. No network.
3. Script `npm run demo -- ...` entry in package.json (no new dependencies).
4. Tests with a temp directory: run on three fixture envelopes; output equals expected; bad path gives exit 2.
**Done when:** the EMR bridge (EMR DM3) can call the CLI and read the record.
**Size guard:** 1 CLI file, 1 test file, package.json script.

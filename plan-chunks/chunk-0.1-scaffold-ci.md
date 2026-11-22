# Chunk 0.1-scaffold-ci: Repo scaffold and CI

_Phase 0. No dependencies. Needs: nothing._

**Core rules:** attach `01-core.md` too.

**Read only:** `CCIS_TASK_TRACKER.md`; `README.md`.

**Build:**
1. `package.json`: name `ccis`, `"type": "module"`, `"private": true`, `engines.node >= 22`, script `"test": "node --test"`. No dependencies and no devDependencies.
2. `.gitignore` (`node_modules/`, `.env`, `*.log`, `runs/`).
3. `test/smoke.test.js`: one test that passes (proves the runner works). Nothing else.
4. `.github/workflows/ci.yml`: on push and pull request; ubuntu-latest; Node 22; `npm test`; permissions `contents: read`. No database service.

**Done when:** `npm test` passes locally and the workflow file is valid YAML.

**Size guard:** 4 small files. No source modules, no schemas.

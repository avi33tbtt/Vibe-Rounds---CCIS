// Row 3.11: `npm run accept`. Runs the whole slice through the real command line as child processes over the committed market,
// and checks the run record against the hand-calculated expected file of the fixture. Prototype. Synthetic data only. Not for clinical use.
// Usage: node scripts/accept.js [--market <dir>]. Exit 0 when every step passes, 1 at the first failed step.
// It prints step names and one reason, never a temp path, an observation value or the time. Fixed evaluation time; no clock, no randomness.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { importEnvelope } from '../ccis-import.js';
import { heldFromMarket, importReportView } from '../ccis-app-import-report.js';

const ROOT = new URL('../', import.meta.url).pathname;
const at = process.argv.indexOf('--market');
const MARKET = at > 0 && process.argv[at + 1] ? resolve(process.argv[at + 1]) : join(ROOT, 'market');
const FX = join(ROOT, 'ccis/fixtures/snake');
const IMPORT_ENV = join(FX, 'boundary/boundary-01-edge-inside.envelope.json');
const RUN_ENV = join(FX, 'normal/normal-01-all-enabled.envelope.json');
const WANT = JSON.parse(readFileSync(join(FX, 'normal/normal-01-all-enabled.expected.json'), 'utf8'));
const PATHWAY = 'snake.documentation-path';
const AT = '2026-11-24T12:00:00Z';
const tmp = mkdtempSync(join(tmpdir(), 'ccis-accept-'));
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));

// One child process. A failure names the exit code and a refusal id (like M-010) if there is one, never a path.
function node(script, args) {
  const r = spawnSync(process.execPath, [join(ROOT, script), ...args], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    const refusal = /\b[A-Z]-\d{3}\b/.exec(`${r.stdout}${r.stderr}`);
    throw new Error(`exit ${r.status}${refusal ? ` (${refusal[0]})` : ''}`);
  }
  return r.stdout;
}
const cli = (...args) => node('ccis-cli.js', args);
const runArgs = (out) => ['run', '--market', MARKET, '--pathway', PATHWAY, '--envelope', RUN_ENV, '--out', out, '--at', AT, '--params', join(tmp, 'params.json')];
const first = join(tmp, 'first.json');
const second = join(tmp, 'second.json');

const STEPS = [
  ['app-page', () => { node('scripts/build-app.js', ['--check']); }],
  ['import', () => {
    const got = JSON.parse(cli('import', '--envelope', IMPORT_ENV, '--market', MARKET, '--json')).counts;
    const index = json(join(MARKET, 'index.json'));
    const market = { index, files: Object.fromEntries(index.entries.map((e) => [e.path, readFileSync(join(MARKET, e.path), 'utf8')])) };
    const want = importReportView(importEnvelope(json(IMPORT_ENV), { held: heldFromMarket(market) })).counts;
    for (const k of ['accepted', 'rejected', 'unmapped', 'ambiguous', 'total']) if (got[k] !== want[k]) throw new Error(`${k} count differs from the pure modules`);
  }],
  ['compat', () => {
    const out = cli('compat', '--envelope', RUN_ENV, '--market', MARKET, '--pathway', PATHWAY);
    const ids = [PATHWAY, ...new Set(json(join(MARKET, 'index.json')).entries.filter((e) => e.type === 'analytics-package').map((e) => e.id))];
    const found = ids.filter((id) => out.includes(id)).length;
    if (found !== ids.length) throw new Error(`lists ${found} of ${ids.length} packages`);
  }],
  ['run-oracle', () => {
    writeFileSync(join(tmp, 'params.json'), JSON.stringify(WANT.parameters));
    cli(...runArgs(first));
    const rec = json(first);
    if (rec.status !== 'completed') throw new Error('the record is not completed');
    for (const w of WANT.results) {
      const hit = rec.results.find((r) => r.outputId === w.outputId);
      if (!hit || (w.value !== undefined && !isDeepStrictEqual(hit.value, w.value))) throw new Error(`output ${w.outputId} differs from the hand-calculated value`);
    }
  }],
  ['rerun', () => {
    cli(...runArgs(second));
    if (readFileSync(first, 'utf8') !== readFileSync(second, 'utf8')) throw new Error('a second process wrote different bytes');
  }],
  ['show', () => {
    const out = cli('show', first);
    if (!/^verified: yes/m.test(out) || !/^status: completed/m.test(out)) throw new Error('the record is not shown as verified and completed');
  }],
];

let passed = 0;
try {
  for (const [name, step] of STEPS) {
    step();
    passed += 1;
    console.log(`ok  ${name}`);
  }
} catch (e) {
  console.log(`FAIL ${STEPS[passed][0]}: ${e.message}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`ACCEPTANCE: ${passed === STEPS.length ? 'PASS' : 'FAIL'} (${passed}/${STEPS.length})`);
process.exitCode = passed === STEPS.length ? 0 : 1;

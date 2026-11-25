// Row 3.11.1: the slice fails safely and changes visibly. Real CLI as child processes over temp copies. Prototype. Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintArtefact, publishArtefact, emptyMarket } from '../ccis-market.js';

const ROOT = new URL('../', import.meta.url).pathname;
const FX = join(ROOT, 'ccis/fixtures/snake');
const NORMAL = join(FX, 'normal/normal-01-all-enabled');
const AT = '2026-11-24T12:00:00Z';
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const tmp = mkdtempSync(join(tmpdir(), 'ccis-neg-'));
test.after(() => rmSync(tmp, { recursive: true, force: true }));
writeFileSync(join(tmp, 'params.json'), JSON.stringify(json(`${NORMAL}.expected.json`).parameters));

function cli(args) { return spawnSync(process.execPath, [join(ROOT, 'ccis-cli.js'), ...args], { cwd: ROOT, encoding: 'utf8' }); }
// Runs the real CLI; returns the parsed record. `market` and `extra` are optional.
function run(name, envelope, { market = join(ROOT, 'market'), extra = [] } = {}) {
  const env = join(tmp, `${name}.envelope.json`); const out = join(tmp, `${name}.record.json`);
  writeFileSync(env, JSON.stringify(envelope));
  const r = cli(['run', '--market', market, '--pathway', 'snake.documentation-path', '--envelope', env, '--out', out, '--at', AT, '--params', join(tmp, 'params.json'), ...extra]);
  assert.equal(r.status, 0, `run ${name} exited ${r.status}`);
  return { rec: json(out), file: out };
}
const normalEnvelope = () => json(`${NORMAL}.envelope.json`);
const withoutBiteTime = () => { const e = normalEnvelope(); e.observations = e.observations.filter((o) => o.id !== 'o1'); return e; };
const outputOf = (rec, id) => rec.results.find((r) => r.outputId === id);
const baseline = run('baseline', normalEnvelope());

test('1 removal: without bite time the interval analytic is skipped, never run as zero', () => {
  const { rec, file } = run('removed', withoutBiteTime());
  assert.equal(rec.status, 'completed');
  assert.equal(outputOf(rec, 'interval'), undefined);
  assert.equal(outputOf(rec, 'comparison'), undefined);
  assert.notEqual(rec.id, baseline.rec.id);
  assert.match(cli(['show', file]).stdout, /^verified: yes/m);
});

test('2 removal with --run-needs-data: states equal the hand-calculated missing-01 oracle', () => {
  const { rec } = run('removed-nd', withoutBiteTime(), { extra: ['--run-needs-data'] });
  const want = json(join(FX, 'missing/missing-01-no-bite-time.expected.json'));
  const needs = want.results.filter((w) => w.state === 'needs-data');
  assert.deepEqual(needs.map((w) => w.outputId), ['interval', 'comparison']);
  for (const w of needs) {
    const hit = outputOf(rec, w.outputId);
    assert.equal(hit.state, w.state, `${w.outputId} state`);
    assert.equal(hit.value, undefined, `${w.outputId} has no value`);
    assert.deepEqual(hit.missingDataNotes, w.missingDataNotes);
  }
});

test('3 input change: bite time one minute later gives a distinct record and the hand-calculated interval', () => {
  const e = normalEnvelope(); const o1 = e.observations.find((o) => o.id === 'o1');
  o1.effective.value = '2026-11-20T08:01:00Z'; o1.value.value = '2026-11-20T08:01:00Z';
  const { rec } = run('moved', e);
  assert.notEqual(rec.id, baseline.rec.id);
  assert.notEqual(rec['x-checksums'].envelope, baseline.rec['x-checksums'].envelope);
  // Antivenom starts 09:30; bite 08:01; 89 minutes (the unchanged record is 90).
  assert.deepEqual(outputOf(rec, 'interval').value, { amount: 89, unit: 'min' });
});

test('4 version change: a market holding only 0.1.0 analytics gives a distinct, verified record', () => {
  const m = join(tmp, 'market-010'); cpSync(join(ROOT, 'market'), m, { recursive: true });
  const index = json(join(m, 'index.json'));
  const drop = index.entries.filter((e) => e.type === 'analytics-package' && e.version === '0.1.1');
  assert.equal(drop.length, 2);
  for (const e of drop) rmSync(join(m, e.path));
  index.entries = index.entries.filter((e) => !drop.includes(e));
  writeFileSync(join(m, 'index.json'), JSON.stringify(index, null, 2));
  const { rec, file } = run('old', normalEnvelope(), { market: m });
  assert.deepEqual(rec['x-analytics'].map((a) => a.version), ['0.1.0', '0.1.0']);
  assert.deepEqual(baseline.rec['x-analytics'].map((a) => a.version), ['0.1.1', '0.1.1']);
  assert.notEqual(rec.id, baseline.rec.id);
  assert.match(cli(['show', file]).stdout, /^verified: yes/m);
});

const artefactFiles = () => readdirSync(join(ROOT, 'market/artefacts'), { recursive: true }).filter((p) => p.endsWith('.json'));
test('5 lint accepts every committed artefact', () => {
  const files = artefactFiles();
  assert.ok(files.length >= 6);
  for (const f of files) assert.equal(lintArtefact(json(join(ROOT, 'market/artefacts', f))).ok, true, f);
});

test('6 lint refuses a planted identity member; the refusal never quotes the value', () => {
  const planted = { ...json(join(ROOT, 'market/artefacts', artefactFiles()[0])), email: 'zed.planted@example.org' };
  const lint = lintArtefact(planted);
  assert.equal(lint.ok, false);
  assert.ok(lint.findings.length > 0 && lint.findings.every((f) => /^L-\d{3}$/.test(f.id)));
  const refused = publishArtefact({ market: emptyMarket(), artefact: planted });
  const text = JSON.stringify(refused);
  assert.match(text, /M-004/);
  assert.equal(text.includes('zed.planted'), false);
});

// Purity scan: comments are removed first. Files that may import node:fs are named here; a new importer fails case 7.
const FS_ALLOWED = ['ccis-cli-flow.js', 'ccis-cli.js'];
const FORBIDDEN = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bWebSocket\b/, /\beval\s*\(/, /new\s+Function\b/, /Date\.now\s*\(/, /new\s+Date\s*\(\s*\)/, /Math\.random/, /node:(https?|net|child_process)/];
const scan = (src) => { const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); return FORBIDDEN.filter((re) => re.test(code)).map(String); };
test('7 purity scan: no network, clock, randomness or eval in root modules; node:fs only in the named CLI files', () => {
  const files = readdirSync(ROOT).filter((f) => /^ccis-.*\.js$/.test(f));
  assert.ok(files.length > 30);
  for (const f of files) assert.deepEqual(scan(readFileSync(join(ROOT, f), 'utf8')), [], f);
  const fsUsers = files.filter((f) => /node:fs/.test(readFileSync(join(ROOT, f), 'utf8')));
  assert.deepEqual(fsUsers, FS_ALLOWED);
});

test('8 the scan can fail', () => {
  assert.deepEqual(scan('const t = Date.now();'), [String(FORBIDDEN[5])]);
  assert.deepEqual(scan('// Date.now() is only named here\nconst a = 1;'), []);
});

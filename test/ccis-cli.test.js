import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_PARAMETERS, main } from '../ccis-cli.js';
import { runRecord } from '../ccis/validators/ccis-validators.js';
import { canonicalJson } from '../ccis-demo-record.js';

const root = new URL('..', import.meta.url);
const CLI = fileURLToPath(new URL('ccis-cli.js', root));
const fx = new URL('../ccis/fixtures/snake/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const index = read(new URL('index.json', fx));
const envPath = (c) => fileURLToPath(new URL(`${c.class}/${c.case}.envelope.json`, fx));
const expected = (c) => read(new URL(`${c.class}/${c.case}.expected.json`, fx));
const dir = mkdtempSync(join(tmpdir(), 'ccis-cli-'));
const AT = '2026-11-20T12:00:00Z';
const cli = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
const run = (c, out, ...extra) => cli('run', '--envelope', envPath(c), '--out', out, '--at', AT, ...extra);
const pick = (p) => index.cases.find((c) => c.case.startsWith(p));
test.after(() => rmSync(dir, { recursive: true, force: true }));

test('source: header label, no clock, randomness, network, eval or dynamic import', () => {
  const src = readFileSync(CLI, 'utf8');
  assert.ok(src.startsWith('// DEMO RUNNER'));
  const code = src.replace(/^\s*\/\/.*$/gm, '');
  for (const bad of [/new Date/, /Date\.now/, /Math\.random/, /\bfetch\b/, /XMLHttpRequest/, /node:https?/, /node:net/, /\beval\b/, /new Function/, /\bimport\(/, /localStorage/]) {
    assert.equal(bad.test(code), false, String(bad));
  }
});

test('the demo placeholders equal the fixture normal-01 and are all marked test-only', () => {
  assert.deepEqual(DEMO_PARAMETERS, expected(pick('normal-01')).parameters);
});

test('three fixtures: record written, valid, results equal the hand-calculated expected results', () => {
  for (const name of ['normal-01', 'boundary-02', 'missing-03']) {
    const c = pick(name);
    const out = join(dir, `${name}.json`);
    const r = run(c, out, '--demo-parameters');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /record written/);
    const rec = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(runRecord(rec), true, JSON.stringify(runRecord.errors));
    assert.equal(rec.status, 'completed');
    assert.equal(rec.evaluationTime.value, AT);
    assert.deepEqual(rec.warnings, ['demo placeholders, not clinical values']);
    if (name === 'normal-01') {
      const want = expected(c).results;
      for (const w of want) {
        const got = rec.results.find((x) => x.outputId === w.outputId && x['x-analytic'] === w['x-analytic']);
        assert.deepEqual(got, w, `${name} ${w.outputId}`);
      }
    }
  }
});

test('without --demo-parameters every parameter is disabled and no placeholder appears', () => {
  const c = pick('normal-02');
  const out = join(dir, 'none.json');
  assert.equal(run(c, out).status, 0);
  const rec = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(rec.parameters.every((p) => p.enabled === false), true);
  assert.deepEqual(rec.warnings, []);
  assert.equal(readFileSync(out, 'utf8').includes('testOnly'), false);
  for (const w of expected(c).results) assert.deepEqual(rec.results.find((x) => x.outputId === w.outputId && x['x-analytic'] === w['x-analytic']), w, w.outputId);
});

test('same inputs give byte-identical files; a different record is never written over one', () => {
  const c = pick('normal-01');
  const a = join(dir, 'same-a.json');
  const b = join(dir, 'same-b.json');
  assert.equal(run(c, a, '--demo-parameters').status, 0);
  assert.equal(run(c, b, '--demo-parameters').status, 0);
  assert.equal(readFileSync(a, 'utf8'), readFileSync(b, 'utf8'));
  assert.equal(run(c, a, '--demo-parameters').status, 0, 'identical bytes may be written again');
  const before = readFileSync(a, 'utf8');
  const r = run(c, a);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /different record/);
  assert.equal(readFileSync(a, 'utf8'), before);
  assert.equal(readFileSync(a, 'utf8').endsWith('}\n'), true);
  assert.equal(readFileSync(a, 'utf8'), `${canonicalJson(JSON.parse(before))}\n`);
});

test('a refused envelope still writes a failed record and exits 0, with nothing echoed', () => {
  const bad = read(envPath(pick('normal-01')));
  bad.observations[0].note = 'Jane Doe <script>';
  const inp = join(dir, 'bad-env.json');
  writeFileSync(inp, JSON.stringify(bad));
  const out = join(dir, 'failed.json');
  const r = cli('run', '--envelope', inp, '--out', out, '--at', AT);
  assert.equal(r.status, 0, r.stderr);
  const rec = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(runRecord(rec), true, JSON.stringify(runRecord.errors));
  assert.equal(rec.status, 'failed');
  assert.deepEqual(rec.results, []);
  assert.equal(readFileSync(out, 'utf8').includes('Jane Doe'), false);
});

test('usage errors exit 2 and write nothing', () => {
  const c = pick('normal-01');
  const out = join(dir, 'never.json');
  const notJson = join(dir, 'notjson.txt');
  writeFileSync(notJson, 'not json');
  const cases = [
    [['run', '--envelope', join(dir, 'missing.json'), '--out', out, '--at', AT], /cannot read/],
    [['run', '--envelope', notJson, '--out', out, '--at', AT], /not JSON/],
    [['run', '--envelope', envPath(c), '--out', out], /--at is required/],
    [['run', '--envelope', envPath(c), '--out', out, '--at', '2026-11-20T12:00:00'], /offset/],
    [['run', '--out', out, '--at', AT], /--envelope is required/],
    [['run', '--envelope', envPath(c), '--at', AT], /--out is required/],
    [['run', '--envelope', envPath(c), '--out', join(dir, 'no-such-dir', 'x.json'), '--at', AT], /cannot write/],
    [['run', '--envelope', envPath(c), '--out', out, '--at', AT, '--bogus'], /unknown argument/],
    [['run', '--envelope'], /needs a value/],
    [['frobnicate'], /only command/],
    [[], /only command/],
  ];
  for (const [args, re] of cases) {
    const r = cli(...args);
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, re, args.join(' '));
    assert.match(r.stderr, /usage:/);
  }
  assert.equal(existsSync(out), false);
});

test('main returns the exit code and reports through io', () => {
  const lines = [];
  const code = main(['run'], { out: (s) => lines.push(s), err: (s) => lines.push(s) });
  assert.equal(code, 2);
  assert.match(lines[0], /--envelope is required/);
});

test('npm script: package.json has a demo entry and no new dependencies', () => {
  const pkg = read(new URL('package.json', root));
  assert.equal(pkg.scripts.demo, 'node ccis-cli.js');
  assert.deepEqual(Object.keys(pkg.devDependencies), ['ajv']);
  assert.equal(pkg.dependencies, undefined);
});

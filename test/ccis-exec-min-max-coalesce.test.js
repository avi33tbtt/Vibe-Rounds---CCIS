// Row ECO-B9: operators min, max, coalesce of ccis-exec.js (ED-39). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareAnalytic, evaluateOutput } from '../ccis-exec.js';
import { canonicalize, checksumOf } from '../ccis-compile.js';

const RUNTIME = { limits: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 } };
const I = (id) => ({ ref: 'input', id });
const L = (literal) => ({ literal });
const op = (name, ...args) => ({ op: name, args });
const base = (expr, version = '0.2.0') => ({
  inputs: ['a', 'b', 'c', 'n1', 'n2', 'n3', 't1'].map((key) => ({ key, type: 'code' })),
  parameters: [], conversions: [], operatorSet: { name: 'ccis-core-ops', version },
  computation: [{ output: 'o', expr }], outputs: [{ id: 'o' }],
  executionProfile: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 },
});
const prep = (a) => prepareAnalytic({ analytic: a, checksum: checksumOf(canonicalize(a).text), runtime: RUNTIME });
const nv = (v, unit = 'min') => ({ state: 'present', value: { t: 'number', v, unit } });
const tv = (v) => ({ state: 'present', value: { t: 'text', v } });
const bv = (v) => ({ state: 'present', value: { t: 'bool', v } });
const st = (state) => ({ state });
const IN = (over = {}) => ({ a: st('unknown'), b: st('absent'), c: st('not-collected'), n1: nv(5), n2: nv(7), n3: nv(2), t1: tv('x'), ...over });
const run = (expr, inputs = IN(), version) => { const p = prep(base(expr, version)); assert.equal(p.ok, true, JSON.stringify(p)); return evaluateOutput({ prepared: p.prepared, outputId: 'o', inputs, parameters: {} }); };

test('1 min and max of two and of three same-unit numbers', () => {
  assert.deepEqual(run(op('min', I('n1'), I('n2'))).value, { t: 'number', v: 5, unit: 'min' });
  assert.deepEqual(run(op('max', I('n1'), I('n2'))).value, { t: 'number', v: 7, unit: 'min' });
  assert.equal(run(op('min', I('n1'), I('n2'), I('n3'))).value.v, 2);
  assert.equal(run(op('max', I('n1'), I('n2'), I('n3'))).value.v, 7);
});

test('2 min with an unknown argument is unknown with the reason; mixed units is X-010', () => {
  const r = run(op('min', I('n1'), I('a')));
  assert.equal(r.ok, true);
  assert.equal(r.value.t, 'unknown');
  assert.deepEqual(r.value.because.map((b) => [b.id, b.state]), [['a', 'unknown']]);
  const m = run(op('max', I('n1'), I('n2')), IN({ n2: nv(7, 'h') }));
  assert.deepEqual([m.ok, m.refusal.id], [false, 'X-010']);
});

test('3 coalesce returns the first known value and ignores the second known one', () => {
  assert.deepEqual(run(op('coalesce', I('a'), I('n2'), I('n1'))).value, { t: 'number', v: 7, unit: 'min' });
  assert.equal(run(op('coalesce', I('n1'), I('n2'))).value.v, 5);
});

test('4 coalesce of all unknown is unknown; a type mismatch among known values is X-010', () => {
  const r = run(op('coalesce', I('a'), I('b'), I('c')));
  assert.equal(r.value.t, 'unknown');
  assert.deepEqual(r.value.because.map((b) => b.id), ['a', 'b', 'c']);
  const m = run(op('coalesce', I('n1'), I('t1')));
  assert.deepEqual([m.ok, m.refusal.id], [false, 'X-010']);
});

test('5 coalesce with a literal argument is refused at prepare (X-018), with the path', () => {
  const r = prep(base(op('coalesce', I('a'), L(false))));
  assert.equal(r.ok, false);
  assert.deepEqual(r.refusals.map((x) => [x.id, x.path]), [['X-018', 'computation[0].expr.args[1]']]);
});

test('6 a package that uses min under operator set 0.1.0 is refused (X-017); 0.2.0 prepares; old operators are untouched', () => {
  const old = prep(base(op('min', I('n1'), I('n2')), '0.1.0'));
  assert.deepEqual(old.refusals.map((x) => x.id), ['X-017']);
  assert.equal(prep(base(op('min', I('n1'), I('n2')), '0.2.0')).ok, true);
  assert.equal(prep(base(op('add', I('n1'), I('n2')), '0.1.0')).ok, true);
});

test('7 wrong argument counts give X-003', () => {
  for (const name of ['min', 'max', 'coalesce']) assert.deepEqual(prep(base(op(name, I('n1')))).refusals.map((x) => x.id), ['X-003']);
});

test('8 same input twice gives identical results; the snake analytics still prepare', () => {
  const a = canonicalize(run(op('coalesce', I('a'), I('n2'))).value).text;
  assert.equal(a, canonicalize(run(op('coalesce', I('a'), I('n2'))).value).text);
  const snake = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-interval.analytics.json', import.meta.url), 'utf8'));
  const r = prepareAnalytic({ analytic: snake, checksum: checksumOf(canonicalize(snake).text), runtime: RUNTIME });
  assert.equal(r.ok, true);
});

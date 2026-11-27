// Row 4.2d.3: the whole analytics() builder, proved on the snake examples. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { analytics, operatorSet } from '../ccis-sdk-analytics.js';
import { SdkError } from '../ccis-sdk.js';
import { compareRoutes } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const dir = new URL('../ccis/examples/snake/', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('../ccis/schemas/analytics.schema.json', import.meta.url), 'utf8'));
const files = readdirSync(dir).filter((n) => n.includes('analytics'));
const load = (f) => readFileSync(new URL(f, dir), 'utf8');
const base = () => JSON.parse(load('snake-interval.analytics.json'));
const refused = (fn, code, path) => {
  try { fn(); } catch (e) { assert.ok(e instanceof SdkError); if (code) assert.equal(e.code, code); if (path !== undefined) assert.equal(e.path, path); return e; }
  assert.fail('not refused');
};
const verdict = (doc) => Object.entries(validateArtefact(doc).layers).map(([k, v]) => [k, v.outcome, v.diagnostics.map((d) => d.ruleId)]);

test('4.2d.3: each snake analytics file is identical on the code route and validates the same', () => {
  assert.equal(files.length, 4);
  for (const f of files) {
    const doc = JSON.parse(load(f));
    const r = compareRoutes([{ name: 'json', input: load(f) }, { name: 'code', input: analytics(doc) }]);
    assert.equal(r.identical, true, f);
    assert.equal(r.routes[0].checksum, r.routes[1].checksum);
    assert.deepEqual(verdict(analytics(doc)), verdict(doc), f);
  }
});

test('4.2d.3: the result is frozen at the top and in nested members', () => {
  const a = analytics(base());
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.outputs) && Object.isFrozen(a.outputs[0]) && Object.isFrozen(a.computation[0].expr));
});

test('4.2d.3: each required member removed in turn is S-002 at that member', () => {
  assert.equal(schema.required.length, 15);
  for (const k of schema.required) { const d = base(); delete d[k]; refused(() => analytics(d), 'S-002', k); }
});

test('4.2d.3: unknown member S-001, x- kept, wrong manifest type refused', () => {
  refused(() => analytics({ ...base(), extra: 1 }), 'S-001', 'extra');
  assert.equal(analytics({ ...base(), 'x-note': 'n' })['x-note'], 'n');
  const d = base(); d.manifest.type = 'pathway';
  refused(() => analytics(d), undefined, 'manifest.type');
});

test('4.2d.3: operatorSet, and the optional members', () => {
  refused(() => operatorSet({ name: 'Bad Name', version: '0.1.0' }), 'S-003', 'name');
  refused(() => operatorSet({ name: 'ok' }), 'S-002', 'version');
  refused(() => operatorSet({ name: 'ok', version: '0.1.0', 'x-a': 1 }), 'S-001', 'x-a');
  const d = base(); d.conversions = [];
  assert.deepEqual(analytics(d).conversions, []);
  assert.equal('tests' in analytics(base()), false);
});

test('4.2d.3: an error deep inside keeps its path', () => {
  const d = base(); d.outputs[1].kind = 'nope';
  refused(() => analytics(d), 'S-003', 'outputs.1.kind');
  const e = base(); e.computation[0].expr = { op: 'not', args: [{ literal: true }, { literal: 5 }] };
  refused(() => analytics(e), 'S-003', 'computation.0.expr.args.1.literal');
});

test('4.2d.3: cross-references are not checked here; the validator rejects, on both routes alike', () => {
  const d = base(); d.inputs[0].element = 'no.such-element';
  const a = analytics(d);
  assert.deepEqual(verdict(a), verdict(d));
  assert.ok(verdict(a).some(([, outcome]) => outcome !== 'pass'));
});

test('4.2d.3: hostile string never in a message; purity scan', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const d = base(); d.outputs[0].kind = evil;
  assert.ok(!String(refused(() => analytics(d), 'S-003').message).includes(evil));
  const src = readFileSync(new URL('../ccis-sdk-analytics.js', import.meta.url), 'utf8');
  assert.ok(!/\b(eval|Function|Date\.now|Math\.random|fetch|readFile|import\()/.test(src.replace(/^import .*$/gm, '')));
});

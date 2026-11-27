// Row ECO-B10: rule-pack schema part 1 (shape only). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { rulePack, pathway, elementGroup } from '../ccis/validators/ccis-validators.js';

const base = () => ({
  manifest: { id: 'demo.data-quality', name: 'Demo data quality', type: 'rule-pack', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft' },
  class: 'data-quality',
  scope: { pathways: [{ id: 'demo.pathway', type: 'pathway', range: '>=0.1.0' }] },
  inputs: [{ id: 'crea', concept: 'creatinine', read: 'count' }],
  parameters: [{ id: 'window', label: 'Window', kind: 'interval', units: ['day'], enabledByDefault: false, suppliedBy: 'Local clinician' }],
  sourceNote: 'Synthetic note about an information gap.',
});
const ok = (d) => rulePack(d) === true;
const mutate = (fn) => { const d = base(); fn(d); return d; };

test('1 a minimal valid pack passes', () => {
  assert.equal(ok(base()), true, JSON.stringify(rulePack.errors));
});

test('2 each required member missing is refused', () => {
  for (const k of ['manifest', 'class', 'scope', 'inputs', 'parameters', 'sourceNote']) assert.equal(ok(mutate((d) => { delete d[k]; })), false, k);
});

test('3 wrong manifest type or class is refused', () => {
  assert.equal(ok(mutate((d) => { d.manifest.type = 'pathway'; })), false);
  assert.equal(ok(mutate((d) => { d.class = 'advice'; })), false);
  assert.equal(ok(mutate((d) => { d.class = 'clinical-prompt'; })), true);
});

test('4 unknown member refused, x- accepted, rules refused until B11', () => {
  assert.equal(ok(mutate((d) => { d.extra = 1; })), false);
  assert.equal(ok(mutate((d) => { d['x-note'] = 1; })), true);
  assert.equal(ok(mutate((d) => { d.rules = []; })), false);
});

test('5 bad inputs and scope are refused', () => {
  assert.equal(ok(mutate((d) => { d.inputs[0].label = 'Creatinine'; })), false);
  assert.equal(ok(mutate((d) => { d.inputs[0].read = 'sum'; })), false);
  assert.equal(ok(mutate((d) => { d.inputs = []; })), false);
  assert.equal(ok(mutate((d) => { d.scope.pathways = []; })), false);
  assert.equal(ok(mutate((d) => { d.scope.pathways[0].type = 'analytics-package'; })), false);
});

test('6 a parameter with a value, default or range, or enabled by default, is refused', () => {
  for (const k of ['value', 'default', 'allowedRange']) assert.equal(ok(mutate((d) => { d.parameters[0][k] = 1; })), false, k);
  assert.equal(ok(mutate((d) => { d.parameters[0].enabledByDefault = true; })), false);
  assert.equal(ok(mutate((d) => { d.parameters = []; })), true);
});

test('7 the manifest change is additive: existing example artefacts still validate', () => {
  const dir = new URL('../ccis/examples/snake/', import.meta.url);
  const f = readdirSync(dir).filter((n) => n.endsWith('.pathway.json'));
  assert.ok(f.length > 0);
  for (const n of f) { const d = JSON.parse(readFileSync(new URL(n, dir), 'utf8')); assert.equal(pathway(d), true, n); }
  assert.equal(typeof elementGroup, 'function');
});

test('8 the generated validators equal a fresh build', () => {
  const r = spawnSync(process.execPath, ['scripts/build-validators.js', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

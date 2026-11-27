// Row ECO-B11: rule-pack schema part 2 (rules, messages, provenance, tests). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { rulePack } from '../ccis/validators/ccis-validators.js';

const kinds = ['missing', 'stale', 'conflicting', 'inconsistent', 'interval-documentation'];
const rule = (id, kind) => ({ id, kind, severity: 'info', when: { op: 'is-present', args: [{ ref: 'input', id: 'crea' }] }, message: { template: 'No record found for the concept.' } });
const base = () => ({
  manifest: { id: 'demo.data-quality', name: 'Demo data quality', type: 'rule-pack', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft' },
  class: 'data-quality',
  scope: { pathways: [{ id: 'demo.pathway', type: 'pathway', range: '>=0.1.0' }] },
  inputs: [{ id: 'crea', concept: 'creatinine', read: 'count' }],
  parameters: [{ id: 'window', label: 'Window', kind: 'interval', units: ['day'], enabledByDefault: false, suppliedBy: 'Local clinician' }],
  rules: kinds.map((k, i) => rule('rule' + i, k)),
  tests: kinds.map((k, i) => ({ id: 'test' + i, rule: 'rule' + i, fixture: 'synthetic-' + i, synthetic: true, enables: [], expect: 'does-not-fire' })),
  provenance: { origin: 'Synthetic test', basis: 'Synthetic test' },
  sourceNote: 'Synthetic note about an information gap.',
});
const ok = (d) => rulePack(d) === true;
const mutate = (fn) => { const d = base(); fn(d); return d; };

test('1 a pack with one rule of each kind and a test per rule passes', () => {
  assert.equal(ok(base()), true, JSON.stringify(rulePack.errors));
});

test('2 missing or empty rules, tests, provenance, and 21 rules are refused', () => {
  for (const k of ['rules', 'tests', 'provenance']) assert.equal(ok(mutate((d) => { delete d[k]; })), false, k);
  assert.equal(ok(mutate((d) => { d.rules = []; })), false);
  assert.equal(ok(mutate((d) => { d.tests = []; })), false);
  assert.equal(ok(mutate((d) => { d.rules = Array.from({ length: 21 }, (_, i) => rule('r' + i, 'missing')); })), false);
  assert.equal(ok(mutate((d) => { d.rules = Array.from({ length: 20 }, (_, i) => rule('r' + i, 'missing')); })), true);
});

test('3 bad kind, critical severity, unknown member refused; x- accepted', () => {
  assert.equal(ok(mutate((d) => { d.rules[0].kind = 'high'; })), false);
  assert.equal(ok(mutate((d) => { d.rules[0].severity = 'critical'; })), false);
  assert.equal(ok(mutate((d) => { d.rules[0].action = 'order'; })), false);
  assert.equal(ok(mutate((d) => { d.rules[0]['x-note'] = 'n'; })), true);
});

test('4 numeric literal, conversion ref, or off-list operator in when is refused', () => {
  assert.equal(ok(mutate((d) => { d.rules[0].when = { op: 'gt', args: [{ ref: 'input', id: 'crea' }, { literal: 5 }] }; })), false);
  assert.equal(ok(mutate((d) => { d.rules[0].when = { ref: 'conversion', id: 'c' }; })), false);
  assert.equal(ok(mutate((d) => { d.rules[0].when = { op: 'eval', args: [{ literal: true }] }; })), false);
  assert.equal(ok(mutate((d) => { d.rules[0].when = { ref: 'parameter', id: 'window' }; })), true);
});

test('5 a message over 200 characters, empty, or not a string is refused', () => {
  assert.equal(ok(mutate((d) => { d.rules[0].message.template = 'a'.repeat(201); })), false);
  assert.equal(ok(mutate((d) => { d.rules[0].message.template = 'a'.repeat(200); })), true);
  assert.equal(ok(mutate((d) => { d.rules[0].message.template = ''; })), false);
  assert.equal(ok(mutate((d) => { d.rules[0].message.template = 7; })), false);
});

test('6 a test with synthetic not true, a bad expect, or testOnly false is refused', () => {
  assert.equal(ok(mutate((d) => { d.tests[0].synthetic = false; })), false);
  assert.equal(ok(mutate((d) => { delete d.tests[0].synthetic; })), false);
  assert.equal(ok(mutate((d) => { d.tests[0].expect = 'maybe'; })), false);
  assert.equal(ok(mutate((d) => { d.tests[0].enables = [{ parameter: 'window', testOnly: false }]; })), false);
  assert.equal(ok(mutate((d) => { d.tests[0].enables = [{ parameter: 'window', testOnly: true }]; })), true);
});

test('7 the operator list equals the analytics operator list', () => {
  const ops = (f) => JSON.parse(readFileSync(new URL('../ccis/schemas/' + f, import.meta.url), 'utf8')).$defs.expr.oneOf[0].properties.op.enum;
  assert.deepEqual(ops('rule-pack.schema.json'), ops('analytics.schema.json'));
});

test('8 the generated validators equal a fresh build', () => {
  const r = spawnSync(process.execPath, ['scripts/build-validators.js', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

// Row ECO-B13: rule-pack layer 6 data-quality shape (CCIS-V6-003). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact, RULES } from '../ccis-validator.js';
import { rulePackShape } from '../ccis-validator-rulepack-shape.js';

const pw = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-documentation.pathway.json', import.meta.url), 'utf8'));
pw.manifest.id = 'demo.pathway';
const inp = (id) => ({ ref: 'input', id });
const par = { ref: 'parameter', id: 'window' };
const present = { op: 'is-present', args: [inp('crea')] };
const base = (when, cls = 'data-quality') => ({
  manifest: { id: 'demo.data-quality', name: 'Demo data quality', type: 'rule-pack', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft' },
  class: cls,
  scope: { pathways: [{ id: 'demo.pathway', type: 'pathway', range: '>=0.1.0' }] },
  inputs: [{ id: 'crea', concept: 'creatinine', read: 'latest' }, { id: 'crea2', concept: 'creatinine', read: 'latest' }],
  parameters: [{ id: 'window', label: 'Window', kind: 'interval', units: ['day'], enabledByDefault: false, suppliedBy: 'Local clinician' }],
  rules: [{ id: 'dqOne', kind: 'stale', severity: 'info', when, message: { template: 'Information gap.' } }],
  tests: [{ id: 't1', rule: 'dqOne', fixture: 'synthetic-1', synthetic: true, enables: [{ parameter: 'window', testOnly: true }], expect: 'not-evaluated' }],
  provenance: { origin: 'Synthetic', basis: 'Synthetic' },
  sourceNote: 'Synthetic note.',
});
const rows = (when, cls) => rulePackShape(base(when, cls)).map((x) => [x.ruleId, x.path]);
const tdiff = { op: 'time-diff', args: [inp('crea'), inp('crea2')] };

test('1 allowed shapes give no V6-003', () => {
  const when = { op: 'and', args: [present, { op: 'lt', args: [inp('crea'), inp('crea2')] }, { op: 'gt', args: [tdiff, par] }] };
  assert.deepEqual(rows(when), []);
});

test('2 an input against a parameter is refused at the node path', () => {
  assert.deepEqual(rows({ op: 'gt', args: [inp('crea'), par] }), [['CCIS-V6-003', '/rules/0/when']]);
});

test('3 an input against a literal is refused', () => {
  assert.deepEqual(rows({ op: 'lt', args: [inp('crea'), { literal: 'x' }] }), [['CCIS-V6-003', '/rules/0/when']]);
});

test('4 a count against a parameter is refused', () => {
  assert.deepEqual(rows({ op: 'ge', args: [{ op: 'count', args: [inp('crea')] }, par] }), [['CCIS-V6-003', '/rules/0/when']]);
});

test('5 time-diff against a parameter (either order) and state-of against a string literal are accepted', () => {
  assert.deepEqual(rows({ op: 'lt', args: [par, tdiff] }), []);
  assert.deepEqual(rows({ op: 'eq', args: [{ op: 'state-of', args: [inp('crea')] }, { literal: 'absent' }] }), []);
});

test('6 a refused comparison under and and not is found at its own path', () => {
  const bad = { op: 'gt', args: [inp('crea'), par] };
  assert.deepEqual(rows({ op: 'and', args: [present, { op: 'not', args: [bad] }] }), [['CCIS-V6-003', '/rules/0/when/args/1/args/0']]);
});

test('7 a clinical-prompt pack is not checked here', () => {
  assert.deepEqual(rows({ op: 'gt', args: [inp('crea'), par] }, 'clinical-prompt'), []);
});

test('8 V6-003 is in RULES and stops layer 6 through validateArtefact', () => {
  assert.ok(RULES.some((r) => r.ruleId === 'CCIS-V6-003'));
  const r = validateArtefact(JSON.stringify(base({ op: 'gt', args: [inp('crea'), par] })), { known: [pw] });
  assert.ok(r.diagnostics.some((d) => d.ruleId === 'CCIS-V6-003'), JSON.stringify(r.diagnostics));
  assert.notEqual(r.layers['executable-safety'].outcome, 'passed');
});

// Row ECO-B12: rule-pack validator rules (CCIS-V4-012 to 018). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact, RULES } from '../ccis-validator.js';
import { rulePackSemantic } from '../ccis-validator-rulepack.js';

const pw = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-documentation.pathway.json', import.meta.url), 'utf8'));
pw.manifest.id = 'demo.pathway';
const mk = () => ({ op: 'is-present', args: [{ ref: 'input', id: 'crea' }] });
const base = () => ({
  manifest: { id: 'demo.data-quality', name: 'Demo data quality', type: 'rule-pack', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft' },
  class: 'data-quality',
  scope: { pathways: [{ id: 'demo.pathway', type: 'pathway', range: '>=0.1.0' }] },
  inputs: [{ id: 'crea', concept: 'creatinine', read: 'count' }],
  parameters: [{ id: 'window', label: 'Window', kind: 'interval', units: ['day'], enabledByDefault: false, suppliedBy: 'Local clinician' }],
  rules: [{ id: 'dqOne', kind: 'stale', severity: 'info', when: { op: 'and', args: [mk(), { op: 'gt', args: [{ ref: 'parameter', id: 'window' }, { ref: 'input', id: 'crea' }] }] }, message: { template: 'Information gap.' } }],
  tests: [{ id: 't1', rule: 'dqOne', fixture: 'synthetic-1', synthetic: true, enables: [{ parameter: 'window', testOnly: true }], expect: 'not-evaluated' }],
  provenance: { origin: 'Synthetic', basis: 'Synthetic' },
  sourceNote: 'Synthetic note.',
});
const mutate = (fn) => { const d = base(); fn(d); return d; };
const rows = (d) => rulePackSemantic(d).map((x) => [x.ruleId, x.path]);

test('1 a valid pack passes all eight layers through validateArtefact', () => {
  const r = validateArtefact(JSON.stringify(base()), { known: [pw] });
  assert.equal(r.outcome, 'no-errors-so-far', JSON.stringify(r.diagnostics));
  assert.deepEqual(Object.values(r.layers).map((l) => l.outcome), Array(8).fill('passed'));
});

test('2 V4-012 and V4-013 for an undeclared input and parameter', () => {
  assert.deepEqual(rows(mutate((d) => { d.rules[0].when.args[0].args[0].id = 'nope'; })).filter((x) => x[0] === 'CCIS-V4-012'), [['CCIS-V4-012', '/rules/0/when/args/0/args/0/id']]);
  assert.deepEqual(rows(mutate((d) => { d.rules[0].when.args[1].args[0].id = 'nope'; })).filter((x) => x[0] === 'CCIS-V4-013'), [['CCIS-V4-013', '/rules/0/when/args/1/args/0/id']]);
});

test('3 V4-014 for a test naming an unknown rule or enabling an undeclared parameter', () => {
  assert.deepEqual(rows(mutate((d) => { d.tests[0].rule = 'ghost'; })), [['CCIS-V4-014', '/tests/0/rule']]);
  assert.deepEqual(rows(mutate((d) => { d.tests[0].enables[0].parameter = 'ghost'; })), [['CCIS-V4-014', '/tests/0/enables/0/parameter']]);
});

test('4 V4-015 for a duplicate id in rules, tests, inputs and parameters', () => {
  const dup = (list) => rows(mutate((d) => { d[list].push(structuredClone(d[list][0])); })).filter((x) => x[0] === 'CCIS-V4-015');
  assert.deepEqual(dup('rules'), [['CCIS-V4-015', '/rules/1/id']]);
  assert.deepEqual(dup('tests'), [['CCIS-V4-015', '/tests/1/id']]);
  assert.deepEqual(dup('inputs'), [['CCIS-V4-015', '/inputs/1/id']]);
  assert.deepEqual(dup('parameters'), [['CCIS-V4-015', '/parameters/1/id']]);
});

test('5 V4-016 for the wrong number of arguments', () => {
  assert.deepEqual(rows(mutate((d) => { d.rules[0].when = { op: 'not', args: [mk(), mk()] }; })).filter((x) => x[0] === 'CCIS-V4-016'), [['CCIS-V4-016', '/rules/0/when/args']]);
  assert.deepEqual(rows(mutate((d) => { d.rules[0].when = { op: 'gt', args: [{ ref: 'parameter', id: 'window' }] }; })).filter((x) => x[0] === 'CCIS-V4-016'), [['CCIS-V4-016', '/rules/0/when/args']]);
});

test('6 V4-017 for a non-boolean root and for a logical operator with a reference argument', () => {
  assert.deepEqual(rows(mutate((d) => { d.rules[0].when = { ref: 'input', id: 'crea' }; })).filter((x) => x[0] === 'CCIS-V4-017'), [['CCIS-V4-017', '/rules/0/when']]);
  assert.deepEqual(rows(mutate((d) => { d.rules[0].when = { op: 'and', args: [mk(), { ref: 'parameter', id: 'window' }] }; })).filter((x) => x[0] === 'CCIS-V4-017'), [['CCIS-V4-017', '/rules/0/when/args/1']]);
});

test('7 V4-018 is a warning for an unused input or parameter and does not fail the pack', () => {
  const d = mutate((x) => { x.inputs.push({ id: 'spare', concept: 'glucose', read: 'latest' }); x.parameters.push({ id: 'spareP', label: 'Spare', kind: 'count', enabledByDefault: false, suppliedBy: 'Local clinician' }); });
  const r = rulePackSemantic(d);
  assert.deepEqual(r.map((x) => [x.ruleId, x.severity, x.path]), [['CCIS-V4-018', 'warning', '/inputs/1'], ['CCIS-V4-018', 'warning', '/parameters/1']]);
  assert.equal(validateArtefact(JSON.stringify(d), { known: [pw] }).outcome, 'no-errors-so-far');
});

test('8 an unknown scope pathway gives layer 3 error V3-004; all seven new ids are in RULES', () => {
  const r = validateArtefact(JSON.stringify(base()), { known: [] });
  assert.ok(r.diagnostics.some((x) => x.ruleId === 'CCIS-V3-004' && x.path === '/scope/pathways/0'));
  for (let n = 12; n <= 18; n++) assert.ok(RULES.some((x) => x.ruleId === `CCIS-V4-0${n}`), String(n));
});

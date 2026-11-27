// Row ECO-B13a: rule-pack layer 7 test cases per rule (CCIS-V7-004 to 007). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact, RULES } from '../ccis-validator.js';
import { rulePackCases } from '../ccis-validator-rulepack-cases.js';

const pw = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-documentation.pathway.json', import.meta.url), 'utf8'));
pw.manifest.id = 'demo.pathway';
const crea = { ref: 'input', id: 'crea' };
const par = { ref: 'parameter', id: 'window' };
const whenNone = { op: 'is-present', args: [crea] };
const whenParam = { op: 'gt', args: [par, { op: 'time-diff', args: [crea, crea] }] };
const en = [{ parameter: 'window', testOnly: true }];
const tc = (id, expect, enables = []) => ({ id, rule: 'dqOne', fixture: `synthetic-${id}`, synthetic: true, enables, expect });
const pack = (when, tests) => ({
  manifest: { id: 'demo.data-quality', name: 'Demo data quality', type: 'rule-pack', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft' },
  class: 'data-quality',
  scope: { pathways: [{ id: 'demo.pathway', type: 'pathway', range: '>=0.1.0' }] },
  inputs: [{ id: 'crea', concept: 'creatinine', read: 'latest' }],
  parameters: [{ id: 'window', label: 'Window', kind: 'interval', units: ['day'], enabledByDefault: false, suppliedBy: 'Local clinician' }],
  rules: [{ id: 'dqOne', kind: 'stale', severity: 'info', when, message: { template: 'Information gap.' } }],
  tests,
  provenance: { origin: 'Synthetic', basis: 'Synthetic' },
  sourceNote: 'Synthetic note.',
});
const three = [tc('a', 'fires'), tc('b', 'does-not-fire'), tc('c', 'not-evaluated')];
const four = [tc('a', 'fires', en), tc('b', 'does-not-fire', en), tc('c', 'not-evaluated', en), tc('d', 'not-evaluated')];
const rows = (d, fixtures = ['synthetic-a', 'synthetic-b', 'synthetic-c', 'synthetic-d']) => rulePackCases(d, { fixtures }).map((x) => [x.ruleId, x.severity, x.path]);
const msgs = (d) => rulePackCases(d, { fixtures: [] }).filter((x) => x.ruleId === 'CCIS-V7-006').map((x) => x.message);

test('1 a rule with the three cases and no parameter gives no layer 7 row', () => {
  assert.deepEqual(rows(pack(whenNone, three)), []);
});

test('2 V7-006 names each missing case', () => {
  const missing = (drop) => msgs(pack(whenNone, three.filter((t) => t.expect !== drop)));
  for (const c of ['fires', 'does-not-fire', 'not-evaluated']) assert.ok(missing(c).length === 1 && missing(c)[0].includes(`"${c}"`), c);
});

test('3 a parameter rule with no disabled case gives V7-007', () => {
  const d = pack(whenParam, [tc('a', 'fires', en), tc('b', 'does-not-fire', en), tc('c', 'not-evaluated', en)]);
  assert.deepEqual(rows(d), [['CCIS-V7-007', 'error', '/rules/0']]);
});

test('4 a parameter rule with all four cases passes', () => {
  assert.deepEqual(rows(pack(whenParam, four)), []);
});

test('5 two not-evaluated tests that both enable the parameter do not make a disabled case', () => {
  const d = pack(whenParam, [tc('a', 'fires', en), tc('b', 'does-not-fire', en), tc('c', 'not-evaluated', en), tc('d', 'not-evaluated', en)]);
  assert.deepEqual(rows(d), [['CCIS-V7-007', 'error', '/rules/0']]);
  const onlyDisabled = pack(whenParam, [tc('a', 'fires', en), tc('b', 'does-not-fire', en), tc('d', 'not-evaluated')]);
  assert.deepEqual(rows(onlyDisabled), [['CCIS-V7-006', 'error', '/rules/0']]);
  assert.ok(msgs(onlyDisabled)[0].includes('enables all its parameters'));
});

test('6 V7-004 warns without a fixture list, V7-005 refuses an unknown name, nothing when listed', () => {
  const d = pack(whenNone, three);
  assert.deepEqual(rulePackCases(d, {}).map((x) => [x.ruleId, x.severity]), Array(3).fill(['CCIS-V7-004', 'warning']));
  assert.deepEqual(rows(d, ['synthetic-a', 'synthetic-b']), [['CCIS-V7-005', 'error', '/tests/2/fixture']]);
  assert.deepEqual(rows(d, ['synthetic-a', 'synthetic-b', 'synthetic-c']), []);
});

test('7 a rule with no test at all gets all its missing-case rows', () => {
  assert.deepEqual(rows(pack(whenParam, [])), [['CCIS-V7-006', 'error', '/rules/0'], ['CCIS-V7-006', 'error', '/rules/0'], ['CCIS-V7-006', 'error', '/rules/0'], ['CCIS-V7-007', 'error', '/rules/0']]);
});

test('8 V7-006 and V7-007 are in RULES and stop the pack at layer 7', () => {
  const ids = RULES.map((r) => r.ruleId);
  assert.ok(ids.includes('CCIS-V7-006') && ids.includes('CCIS-V7-007'));
  const r = validateArtefact(JSON.stringify(pack(whenNone, three.slice(0, 2))), { known: [pw], fixtures: ['synthetic-a', 'synthetic-b'] });
  assert.ok(r.diagnostics.some((x) => x.ruleId === 'CCIS-V7-006'), JSON.stringify(r.diagnostics));
  assert.notEqual(r.layers['test-verification'].outcome, 'passed');
  assert.equal(r.layers.governance.outcome, 'not-run');
});

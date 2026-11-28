// Row ECO-B13c: rule-pack layer 8, governance (CCIS-V8-004 to 007). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact, RULES } from '../ccis-validator.js';
import { rulePackGovernance } from '../ccis-validator-rulepack-governance.js';

const pw = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-documentation.pathway.json', import.meta.url), 'utf8'));
pw.manifest.id = 'demo.pathway';
const tc = (id, expect) => ({ id, rule: 'dqOne', fixture: `synthetic-${id}`, synthetic: true, enables: [], expect });
const pack = (over = {}) => ({
  manifest: { id: 'demo.data-quality', name: 'Demo data quality', type: 'rule-pack', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft', ...(over.manifest || {}) },
  class: over.class || 'data-quality',
  scope: { pathways: [{ id: 'demo.pathway', type: 'pathway', range: '>=0.1.0' }] },
  inputs: [{ id: 'crea', concept: 'creatinine', read: 'latest' }],
  parameters: [],
  rules: [{ id: 'dqOne', kind: 'stale', severity: 'info', when: { op: 'is-present', args: [{ ref: 'input', id: 'crea' }] }, message: { template: 'Information gap.' } }],
  tests: [tc('a', 'fires'), tc('b', 'does-not-fire'), tc('c', 'not-evaluated')],
  provenance: { origin: 'Synthetic', basis: 'Synthetic' },
  sourceNote: 'Synthetic note.',
  ...(over.governance ? { governance: over.governance } : {}),
});
const rev = (name, version = '0.1.0') => ({ name, version, date: '2026-11-28' });
const rows = (d) => rulePackGovernance(d).map((x) => [x.ruleId, x.path]);

test('1 a draft pack with no governance gives no row', () => {
  assert.deepEqual(rows(pack()), []);
});

test('2 a reviewer named like the author gives V8-004; a different name does not', () => {
  const same = pack({ governance: { author: 'Synthetic Author', reviewers: [rev('  synthetic   AUTHOR '), rev('Other Person')] } });
  assert.deepEqual(rows(same), [['CCIS-V8-004', '/governance/reviewers/0/name']]);
  assert.deepEqual(rows(pack({ governance: { author: 'Synthetic Author', reviewers: [rev('Other Person')] } })), []);
});

test('3 clinical-prompt needs a named owner; data-quality may stay unassigned', () => {
  assert.deepEqual(rows(pack({ class: 'clinical-prompt' })), [['CCIS-V8-005', '/governance/owner']]);
  assert.deepEqual(rows(pack({ class: 'clinical-prompt', governance: { owner: 'Unassigned' } })), [['CCIS-V8-005', '/governance/owner']]);
  assert.deepEqual(rows(pack({ class: 'clinical-prompt', governance: { owner: 'Synthetic Owner' } })), []);
  assert.deepEqual(rows(pack({ governance: { owner: 'unassigned' } })), []);
});

test('4 status reviewed with no record for this version gives V8-006, also for another version', () => {
  const g = (reviewers) => ({ author: 'Synthetic Author', reviewers });
  assert.deepEqual(rows(pack({ manifest: { status: 'reviewed' }, governance: g([]) })), [['CCIS-V8-006', '/manifest/status']]);
  assert.deepEqual(rows(pack({ manifest: { status: 'reviewed' }, governance: g([rev('Other Person', '0.0.9')]) })), [['CCIS-V8-006', '/manifest/status']]);
});

test('5 status reviewed with a record for this exact version gives no V8-006', () => {
  assert.deepEqual(rows(pack({ manifest: { status: 'reviewed' }, governance: { author: 'Synthetic Author', reviewers: [rev('Other Person')] } })), []);
});

test('6 status submitted without an author gives V8-007; with an author it does not', () => {
  assert.deepEqual(rows(pack({ manifest: { status: 'submitted' } })), [['CCIS-V8-007', '/manifest/status']]);
  assert.deepEqual(rows(pack({ manifest: { status: 'submitted' }, governance: { author: 'Synthetic Author' } })), []);
});

test('7 a clean reviewed clinical-prompt pack gives no row', () => {
  const d = pack({ class: 'clinical-prompt', manifest: { status: 'reviewed' }, governance: { author: 'Synthetic Author', owner: 'Synthetic Owner', reviewers: [rev('Other Person')] } });
  assert.deepEqual(rows(d), []);
});

test('8 the rows are in RULES and appear in the governance layer', () => {
  const ids = RULES.map((r) => r.ruleId);
  for (const id of ['CCIS-V8-004', 'CCIS-V8-005', 'CCIS-V8-006', 'CCIS-V8-007']) assert.ok(ids.includes(id), id);
  const d = pack({ manifest: { status: 'submitted' } });
  const r = validateArtefact(JSON.stringify(d), { known: [pw], fixtures: ['synthetic-a', 'synthetic-b', 'synthetic-c'] });
  assert.equal(r.layers['test-verification'].outcome, 'passed', JSON.stringify(r.diagnostics));
  assert.ok(r.diagnostics.some((x) => x.ruleId === 'CCIS-V8-007'), JSON.stringify(r.diagnostics));
  assert.notEqual(r.layers.governance.outcome, 'passed');
});

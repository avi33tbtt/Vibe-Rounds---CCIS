// Row ECO-B13b: rule-pack schema, optional governance members (ED-46). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rulePack } from '../ccis/validators/ccis-validators.js';

const base = () => ({
  manifest: { id: 'demo.data-quality', name: 'Demo data quality', type: 'rule-pack', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft' },
  class: 'data-quality',
  scope: { pathways: [{ id: 'demo.pathway', type: 'pathway', range: '>=0.1.0' }] },
  inputs: [{ id: 'crea', concept: 'creatinine', read: 'count' }],
  parameters: [],
  rules: [{ id: 'rule0', kind: 'missing', severity: 'info', when: { op: 'is-present', args: [{ ref: 'input', id: 'crea' }] }, message: { template: 'No record found for the concept.' } }],
  tests: [{ id: 'test0', rule: 'rule0', fixture: 'synthetic-0', synthetic: true, enables: [], expect: 'does-not-fire' }],
  provenance: { origin: 'Synthetic test', basis: 'Synthetic test' },
  sourceNote: 'Synthetic note about an information gap.',
});
const gov = () => ({ author: 'Synthetic Author', owner: 'Synthetic Owner', reviewers: [{ name: 'Synthetic Reviewer', version: '0.1.0', date: '2026-11-28' }] });
const withGov = (g) => { const d = base(); d.governance = g; return d; };
const ok = (d) => rulePack(d) === true;

test('1 a pack with a full governance passes', () => {
  assert.equal(ok(withGov(gov())), true, JSON.stringify(rulePack.errors));
});

test('2 a pack with no governance still passes', () => {
  assert.equal(ok(base()), true);
});

test('3 owner unassigned passes at schema level', () => {
  const g = gov(); g.owner = 'unassigned';
  assert.equal(ok(withGov(g)), true);
});

test('4 a reviewer without version, and one without date, are refused', () => {
  for (const k of ['version', 'date']) { const g = gov(); delete g.reviewers[0][k]; assert.equal(ok(withGov(g)), false, k); }
});

test('5 a malformed date and a non-version string are refused', () => {
  const a = gov(); a.reviewers[0].date = '2026-1-2';
  const b = gov(); b.reviewers[0].version = 'one';
  assert.equal(ok(withGov(a)), false);
  assert.equal(ok(withGov(b)), false);
});

test('6 an unknown governance member is refused; an x- member is accepted', () => {
  const a = gov(); a.approvedBy = 'Someone';
  const b = gov(); b['x-note'] = 'ok';
  assert.equal(ok(withGov(a)), false);
  assert.equal(ok(withGov(b)), true);
});

test('7 an empty author and a 121-character name are refused; 120 pass', () => {
  const a = gov(); a.author = '';
  const b = gov(); b.owner = 'a'.repeat(121);
  const c = gov(); c.owner = 'a'.repeat(120);
  assert.equal(ok(withGov(a)), false);
  assert.equal(ok(withGov(b)), false);
  assert.equal(ok(withGov(c)), true);
});

test('8 21 reviewers are refused, 20 pass', () => {
  const r = { name: 'Synthetic Reviewer', version: '0.1.0', date: '2026-11-28' };
  const a = gov(); a.reviewers = Array.from({ length: 21 }, () => ({ ...r }));
  const b = gov(); b.reviewers = Array.from({ length: 20 }, () => ({ ...r }));
  assert.equal(ok(withGov(a)), false);
  assert.equal(ok(withGov(b)), true);
});

// Row ECO-B7: conflict report of ccis-compose.js. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conflictReport } from '../ccis-compose.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const concept = (code) => ({ codeSystem: { id: 'local', version: '0.1.0' }, code, display: 'Demo', mapping: { status: 'mapped' } });
const f = (key, code, over = {}) => ({ key, label: `Label ${key}`, type: 'quantity', units: ['mm[Hg]'], concept: concept(code), ...over });
const el = (id, fields, version = '0.1.0') => ({ manifest: { id, type: 'contextual-element', version }, fields });
const pw = (...ids) => ({ manifest: { id: 'demo.pathway', type: 'pathway', version: '0.1.0' }, elements: ids.map((id) => ({ id, type: 'contextual-element', range: '^0.1.0' })) });
const ownedBy = (e) => ({ ownedBy: { element: e, key: 'bpSys' } });
const A = el('core.vitals', [f('bpSys', 'systolic-pressure')]);
const B = el('htn.core', [f('sbp', 'systolic-pressure', ownedBy('core.vitals'))]);
const only = (r, status) => r.concepts.filter((c) => c.status === status);

test('1 no shared concept gives no concepts and no blockers', () => {
  const r = conflictReport([pw('core.vitals', 'x.other')], [A, el('x.other', [f('hr', 'heart-rate')])]);
  assert.deepEqual([r.concepts, r.blockers], [[], []]);
});

test('2 one owner and one user with the same type and unit give ok (design example)', () => {
  const r = conflictReport([pw('core.vitals'), pw('core.vitals', 'htn.core')], [A, B]);
  assert.deepEqual(r, { sharedElements: ['core.vitals'], concepts: [{ concept: 'systolic-pressure', owner: { element: 'core.vitals', key: 'bpSys' }, users: [{ element: 'htn.core', key: 'sbp' }], unit: 'mm[Hg]', status: 'ok' }], blockers: [] });
});

test('3 different field keys for one concept are matched by code', () => {
  const r = conflictReport([pw('core.vitals', 'htn.core')], [A, B]);
  assert.deepEqual([r.concepts[0].owner.key, r.concepts[0].users[0].key], ['bpSys', 'sbp']);
});

test('4 needs-owner and second-owner are blockers', () => {
  const both = conflictReport([pw('core.vitals', 'htn.core')], [el('core.vitals', [f('bpSys', 'systolic-pressure', ownedBy('htn.core'))]), B]);
  assert.equal(both.concepts[0].status, 'needs-owner');
  assert.equal(both.concepts[0].owner, null);
  const two = conflictReport([pw('core.vitals', 'htn.core')], [A, el('htn.core', [f('sbp', 'systolic-pressure')])]);
  assert.equal(two.concepts[0].status, 'second-owner');
  assert.deepEqual(two.blockers.map((b) => b.status), ['second-owner']);
  assert.deepEqual(both.blockers.map((b) => b.status), ['needs-owner']);
});

test('5 unit-conflict and type-conflict are blockers', () => {
  const unit = conflictReport([pw('core.vitals', 'htn.core')], [A, el('htn.core', [f('sbp', 'systolic-pressure', { ...ownedBy('core.vitals'), units: ['kPa'] })])]);
  assert.deepEqual([unit.concepts[0].status, unit.concepts[0].unit, unit.blockers.length], ['unit-conflict', 'mm[Hg]', 1]);
  const type = conflictReport([pw('core.vitals', 'htn.core')], [A, el('htn.core', [f('sbp', 'systolic-pressure', { ...ownedBy('core.vitals'), type: 'integer' })])]);
  assert.deepEqual([type.concepts[0].status, type.blockers[0].concept], ['type-conflict', 'systolic-pressure']);
});

test('6 possible-duplicate is listed, never blocks and never merges', () => {
  const x = el('a.one', [f('glu', 'glucose-a', { label: ' Blood Glucose ' })]);
  const y = el('b.two', [f('glucose', 'glucose-b', { label: 'blood glucose' })]);
  const r = conflictReport([pw('a.one', 'b.two')], [x, y]);
  assert.deepEqual(r.concepts, [{ concept: 'glucose-a', owner: { element: 'a.one', key: 'glu' }, users: [{ element: 'b.two', key: 'glucose' }], unit: 'mm[Hg]', status: 'possible-duplicate' }]);
  assert.deepEqual(r.blockers, []);
});

test('7 sharedElements for two pathways; a missing element is a blocker', () => {
  const r = conflictReport([pw('core.vitals', 'nobody.here'), pw('core.vitals')], [A]);
  assert.deepEqual(r.sharedElements, ['core.vitals']);
  assert.deepEqual(r.blockers.map((b) => [b.status, b.concept]), [['missing-element', null]]);
  assert.match(r.blockers[0].message, /nobody\.here/);
});

test('8 reversed element order gives equal output; inputs are not mutated; highest version wins', () => {
  const pws = [pw('core.vitals', 'htn.core')];
  const old = el('htn.core', [f('sbp', 'systolic-pressure')], '0.0.9');
  const input = [A, B, old];
  const snap = clone(input);
  const r1 = conflictReport(pws, input);
  const r2 = conflictReport(pws, [...input].reverse());
  assert.deepEqual(r1, r2);
  assert.equal(r1.concepts[0].status, 'ok');
  assert.deepEqual(input, snap);
});

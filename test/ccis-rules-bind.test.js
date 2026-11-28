// Row ECO-B14a: bind a context to rule-pack inputs by local concept code (ED-50). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindRuleInputs } from '../ccis-rules-bind.js';
import { evaluateRulePack } from '../ccis-rules.js';

const I = (id) => ({ ref: 'input', id });
const pack = {
  manifest: { id: 'demo.dq', version: '0.1.0', type: 'rule-pack' }, class: 'data-quality',
  inputs: [{ id: 'crea', concept: 'creatinine', read: 'count' }, { id: 't1', concept: 'sample-time', read: 'latest' }, { id: 't2', concept: 'result-time', read: 'latest' }, { id: 'series', concept: 'creatinine', read: 'all' }],
  parameters: [{ id: 'window', label: 'Window', kind: 'interval', units: ['min'], enabledByDefault: false }],
  rules: [
    { id: 'missing', kind: 'missing', severity: 'info', when: { op: 'not', args: [{ op: 'is-present', args: [I('crea')] }] }, message: { template: 'No record found for {concept}.' } },
    { id: 'gap', kind: 'interval-documentation', severity: 'info', when: { op: 'gt', args: [{ op: 'time-diff', args: [I('t1'), I('t2')] }, { ref: 'parameter', id: 'window' }] }, message: { template: 'Gap longer than {parameter}.' } },
  ],
};
const T = (value) => ({ value, zone: 'stated' });
const obs = (id, code, over = {}) => ({ id, concept: { id: 'demo.field', codes: [{ system: 'local', code, verification: 'unverified' }] }, kind: 'datetime', value: T('2026-11-28T08:00Z'), effective: T('2026-11-28T08:00Z'), recorded: T('2026-11-28T08:00Z'), status: 'final', ...over });
const ctx = (observations) => ({ contextForm: 'ccis-context/1', observations });
const bind = (observations) => bindRuleInputs({ pack, context: ctx(observations) });

test('1 count gives the number and sorted refs; none gives absent with no refs', () => {
  assert.deepEqual(bind([obs('b', 'creatinine'), obs('a', 'creatinine')]).bound.crea, { state: 'present', value: { t: 'number', v: 2, unit: '1' }, refs: ['a', 'b'] });
  assert.deepEqual(bind([]).bound.crea, { state: 'absent', refs: [] });
});

test('2 an entered-in-error record is ignored', () => {
  assert.deepEqual(bind([obs('a', 'creatinine', { status: 'entered-in-error' })]).bound.crea, { state: 'absent', refs: [] });
});

test('3 latest picks the unique greatest effective instant; refs hold its id only', () => {
  const r = bind([obs('o1', 'sample-time', { value: T('2026-11-28T01:00Z'), effective: T('2026-11-28T01:00Z') }), obs('o2', 'sample-time', { value: T('2026-11-28T05:00Z'), effective: T('2026-11-28T05:00Z') })]);
  assert.deepEqual(r.bound.t1, { state: 'present', value: { t: 'instant', ms: Date.parse('2026-11-28T05:00Z') }, refs: ['o2'] });
});

test('4 latest with a tie or an unreadable time is conflicting with all ids', () => {
  assert.deepEqual(bind([obs('o1', 'sample-time'), obs('o2', 'sample-time')]).bound.t1, { state: 'conflicting', refs: ['o1', 'o2'] });
  assert.deepEqual(bind([obs('o1', 'sample-time'), obs('o2', 'sample-time', { effective: { value: '2026-11-28T08:00Z', zone: 'unknown' } })]).bound.t1, { state: 'conflicting', refs: ['o1', 'o2'] });
});

test('5 an explicit state passes through; a quantity record is present without a value', () => {
  assert.deepEqual(bind([obs('o1', 'sample-time', { state: 'unknown' })]).bound.t1, { state: 'unknown', refs: ['o1'] });
  const q = bind([obs('o1', 'sample-time', { kind: 'quantity', value: 5, unit: 'mmol' })]).bound.t1;
  assert.deepEqual(q, { state: 'present', refs: ['o1'] });
  assert.equal(bindRuleInputs({ pack, context: ctx([obs('o1', 'sample-time', { state: 'maybe' })]) }).ok, false);
});

test('6 another code system, or a concept id equal to the key, does not match', () => {
  const other = obs('o1', 'creatinine'); other.concept.codes[0].system = 'other';
  const byId = obs('o2', 'x'); byId.concept.id = 'creatinine';
  assert.deepEqual(bind([other, byId]).bound.crea, { state: 'absent', refs: [] });
});

test('7 chained into evaluateRulePack: missing fires on an empty context; the gap rule fires with expected refs and no values', () => {
  const asOf = '2026-11-28T10:00:00Z';
  const empty = evaluateRulePack({ pack, bound: bind([]).bound, asOf });
  assert.deepEqual([empty.prompts.map((p) => p.ruleId), empty.notEvaluated], [['demo.dq.missing'], ['gap']]);
  const t1 = obs('o1', 'sample-time', { value: T('2026-11-28T08:00Z') });
  const t2 = obs('o2', 'result-time', { value: T('2026-11-28T09:00Z') });
  const parameters = { window: { enabled: true, value: { t: 'number', v: 30, unit: 'min' } } };
  const r = evaluateRulePack({ pack, bound: bind([t1, t2, obs('c1', 'creatinine')]).bound, parameters, asOf });
  assert.deepEqual([r.prompts.map((p) => p.ruleId), r.prompts[0].recordRefs], [['demo.dq.gap'], ['o1', 'o2']]);
  assert.ok(!JSON.stringify(r).includes(String(Date.parse('2026-11-28T08:00Z'))));
});

test('8 a context that is not ccis-context/1 gives a fixed sentence that echoes nothing', () => {
  for (const context of [null, { contextForm: 'SECRET', observations: [] }, { contextForm: 'ccis-context/1' }]) {
    const r = bindRuleInputs({ pack, context });
    assert.deepEqual([r.ok, r.refusal, JSON.stringify(r).includes('SECRET')], [false, 'The context is not a ccis-context/1 object.', false]);
  }
});

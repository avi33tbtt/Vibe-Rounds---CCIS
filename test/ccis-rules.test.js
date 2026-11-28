// Row ECO-B14: pure rule-pack evaluator over pre-bound inputs (ED-48, ED-49). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRulePack } from '../ccis-rules.js';
import { canonicalize } from '../ccis-compile.js';

const I = (id) => ({ ref: 'input', id });
const P = (id) => ({ ref: 'parameter', id });
const missing = { id: 'missing', kind: 'missing', severity: 'info', when: { op: 'not', args: [{ op: 'is-present', args: [I('crea')] }] }, message: { template: 'No record found for {concept}. Count {count}.' } };
const gap = { id: 'gap', kind: 'interval-documentation', severity: 'info', when: { op: 'gt', args: [{ op: 'time-diff', args: [I('t1'), I('t2')] }, P('window')] }, message: { template: 'Gap longer than {parameter} between {concept} records.' } };
const allRule = { id: 'seen', kind: 'inconsistent', severity: 'info', when: { op: 'is-present', args: [I('series')] }, message: { template: 'Series present.' } };
const pack = (rules, id = 'demo.dq') => ({
  manifest: { id, version: '0.1.0', type: 'rule-pack' }, class: 'data-quality',
  inputs: [{ id: 'crea', concept: 'creatinine', read: 'count' }, { id: 't1', concept: 'sample-time', read: 'latest' }, { id: 't2', concept: 'result-time', read: 'latest' }, { id: 'series', concept: 'creatinine', read: 'all' }],
  parameters: [{ id: 'window', label: 'Window', kind: 'interval', units: ['min'], enabledByDefault: false }],
  rules,
});
const inst = (ms, ref) => ({ state: 'present', value: { t: 'instant', ms }, refs: [ref] });
const bound = (over = {}) => ({ crea: { state: 'absent', refs: [] }, t1: inst(0, 'r1'), t2: inst(3600000, 'r2'), ...over });
const win = (v) => ({ window: { enabled: true, value: { t: 'number', v, unit: 'min' } } });
const AS = '2026-11-28T10:00:00Z';
const run = (rules, b = bound(), parameters) => evaluateRulePack({ pack: pack(rules), bound: b, parameters, asOf: AS });

test('1 a missing rule on an absent count fires one prompt with the expected fields', () => {
  const r = run([missing]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.prompts, [{ ruleId: 'demo.dq.missing', packVersion: '0.1.0', packChecksum: r.packChecksum, kind: 'missing', severity: 'info', message: 'No record found for creatinine. Count 0.', recordRefs: [], asOf: AS }]);
  assert.match(r.packChecksum, /^sha256:[0-9a-f]{64}$/);
});

test('2 the same rule with a record present gives no prompt and is not notEvaluated', () => {
  const r = run([missing], bound({ crea: { state: 'present', value: { t: 'number', v: 1, unit: '1' }, refs: ['c1'] } }));
  assert.deepEqual([r.ok, r.prompts, r.notEvaluated], [true, [], []]);
});

test('3 an unknown input is notEvaluated: no prompt, never read as false', () => {
  const r = run([gap], bound({ t1: { state: 'unknown', refs: [] } }), win(30));
  assert.deepEqual([r.ok, r.prompts, r.notEvaluated], [true, [], ['gap']]);
});

test('4 a disabled parameter is notEvaluated; enabled it fires or not by its value', () => {
  assert.deepEqual(run([gap]).notEvaluated, ['gap']);
  assert.deepEqual(run([gap]).prompts, []);
  const fires = run([gap], bound(), win(30));
  assert.deepEqual([fires.prompts.length, fires.prompts[0].recordRefs, fires.prompts[0].message], [1, ['r1', 'r2'], 'Gap longer than Window between sample-time records.']);
  assert.deepEqual([run([gap], bound(), win(90)).prompts, run([gap], bound(), win(90)).notEvaluated], [[], []]);
});

test('5 a rule that reads an all-records input is notEvaluated even when nothing is bound for it', () => {
  const r = run([allRule, missing]);
  assert.deepEqual([r.notEvaluated, r.prompts.map((p) => p.ruleId)], [['seen'], ['demo.dq.missing']]);
});

test('6 no input value appears in the output', () => {
  const s = JSON.stringify(run([gap, missing], bound(), win(30)));
  assert.ok(!s.includes('3600000') && !s.includes('"v":30') && !s.includes('instant'));
});

test('7 same input gives byte-identical output; prompts are ordered by rule id', () => {
  const a = run([missing, gap], bound(), win(30));
  const b = run([missing, gap], bound(), win(30));
  assert.equal(canonicalize(a).text, canonicalize(b).text);
  assert.deepEqual(run([missing, gap], bound(), win(30)).prompts.map((p) => p.ruleId), ['demo.dq.gap', 'demo.dq.missing']);
  assert.deepEqual(run([gap, missing], bound(), win(30)).prompts.map((p) => p.ruleId), ['demo.dq.gap', 'demo.dq.missing']);
});

test('8 a malformed pack, a wrong checksum and a bad time give fixed sentences that echo nothing', () => {
  const bad = evaluateRulePack({ pack: { ...pack([missing], 'SECRET-ID'), rules: 'x' }, bound: bound(), asOf: AS });
  const sum = evaluateRulePack({ pack: pack([missing], 'SECRET-ID'), bound: bound(), asOf: AS, expectedChecksum: 'sha256:' + '0'.repeat(64) });
  const time = evaluateRulePack({ pack: pack([missing], 'SECRET-ID'), bound: bound(), asOf: '2026-11-28' });
  const miss = evaluateRulePack({ pack: pack([missing], 'SECRET-ID'), bound: {}, asOf: AS });
  for (const r of [bad, sum, time, miss]) assert.deepEqual([r.ok, typeof r.refusal, r.refusal.includes('SECRET-ID')], [false, 'string', false]);
});

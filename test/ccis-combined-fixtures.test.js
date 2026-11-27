// Row 4.5e: synthetic fixtures for the diabetes and CKD combined analytic 0.1.3. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { contextEnvelope, runResult } from '../ccis/validators/ccis-validators.js';
import { prepareAnalytic, evaluateOutput } from '../ccis-exec.js';
import { canonicalize, checksumOf } from '../ccis-compile.js';

const fx = new URL('../ccis/fixtures/diabetes-ckd/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const index = read(new URL('index.json', fx));
const doc = read(new URL('../ccis/examples/diabetes-ckd/diabetes-ckd.sample-gap.analytics.0.1.3.json', import.meta.url));
const RUNTIME = { limits: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 } };
const r0 = prepareAnalytic({ analytic: doc, checksum: checksumOf(canonicalize(doc).text), runtime: RUNTIME });
assert.equal(r0.ok, true, JSON.stringify(r0));
const OLD = ['normal-01-targets', 'normal-02-converted', 'boundary-01-same-minute', 'boundary-02-reversed']; // later rows add cases to the same folder (4.5e.1)
const cases = index.cases.filter((c) => OLD.includes(c.case)).map((c) => ({ ...c, envelope: read(new URL(`${c.case}.envelope.json`, fx)), expected: read(new URL(`${c.case}.expected.json`, fx)) }));
const byName = Object.fromEntries(cases.map((c) => [c.case, c]));

// Plain arithmetic, independent of the expression trees.
const obs = (env, key) => env.observations.filter((o) => o.concept.id.endsWith(`.${key}`));
const ms = (env, key) => Date.parse(obs(env, key)[0].value.value);
const num = (env, key) => ({ v: obs(env, key)[0].value, unit: obs(env, key)[0].unit });
const FACTOR = { 'mg/dL>umol/L': 88.4, 'mmol/L>mg/dL': 18.016 }; // unit definitions from the declared conversions
const toTarget = (q, target) => (q.unit === target ? q.v : q.v * FACTOR[`${q.unit}>${target}`]);
const inputsOf = (env) => ({
  diabetesTypeStatement: { state: 'present', value: { t: 'text', v: obs(env, 'diabetes-type-statement')[0].value } },
  hba1cCollected: { state: 'present', value: { t: 'instant', ms: ms(env, 'hba1c-result-time') } },
  kidneyDiseaseStatement: { state: 'present', value: { t: 'text', v: obs(env, 'kidney-disease-statement')[0].value } },
  creatinineCollected: { state: 'present', value: { t: 'instant', ms: ms(env, 'creatinine-result-time') } },
  creatinineValue: { state: 'present', value: { t: 'number', ...num(env, 'creatinine-value') } },
  glucoseValue: { state: 'present', value: { t: 'number', ...num(env, 'glucose-value') } },
});
const PAR = { sampleWindow: { enabled: false }, edgeRule: { enabled: false } };
const run = (c, o) => evaluateOutput({ prepared: r0.prepared, outputId: o, inputs: inputsOf(c.envelope), parameters: PAR });
const want = (c, o) => c.expected.results.find((r) => r.outputId === o);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('4.5e: the index starts with the four cases and the folder holds no other file', () => {
  assert.deepEqual(index.cases.slice(0, 4).map((c) => c.case), OLD);
  const want = ['index.json', ...index.cases.flatMap((c) => [`${c.case}.envelope.json`, `${c.case}.expected.json`])].sort();
  assert.deepEqual(readdirSync(fx).sort(), want);
});

test('4.5e: every envelope validates and has both contexts, no parameter is enabled', () => {
  for (const c of cases) {
    assert.equal(contextEnvelope(c.envelope), true, `${c.case} ${JSON.stringify(contextEnvelope.errors)}`);
    assert.deepEqual(c.envelope.applied.elements.map((e) => e.id).sort(), ['ckd.kidney-function-documentation', 'diabetes.glycaemia-documentation']);
    assert.equal(c.expected.parameters, 'none');
    assert.equal(c.expected['x-analyticVersion'], '0.1.3');
  }
});

test('4.5e: stored expected gap, order and count equal an independent recomputation', () => {
  for (const c of cases) {
    const gap = (ms(c.envelope, 'creatinine-result-time') - ms(c.envelope, 'hba1c-result-time')) / 60000;
    assert.equal(want(c, 'sampleGap').value.amount, gap, c.case);
    const order = gap > 0 ? 'hba1c-first' : gap < 0 ? 'creatinine-first' : 'same-time';
    assert.equal(want(c, 'sampleOrder').value.label, order, c.case);
    assert.equal(want(c, 'documentedFactCount').value.amount, ['diabetes-type-statement', 'hba1c-result-time', 'kidney-disease-statement', 'creatinine-result-time'].filter((k) => obs(c.envelope, k).length === 1 && !obs(c.envelope, k)[0].state).length, c.case);
  }
});

test('4.5e: the executor run of 0.1.3 equals the stored expected, output by output', () => {
  for (const c of cases) {
    const g = run(c, 'sampleGap'); assert.equal(g.ok, true); assert.equal(g.value.v, want(c, 'sampleGap').value.amount, c.case);
    assert.equal(run(c, 'sampleOrder').value.v, want(c, 'sampleOrder').value.label, c.case);
    assert.equal(run(c, 'sampleWithinWindow').value.v, want(c, 'sampleWithinWindow').state, c.case);
    assert.equal(run(c, 'documentedFactCount').value.v, want(c, 'documentedFactCount').value.amount, c.case);
    close(run(c, 'creatinineUmolL').value.v, want(c, 'creatinineUmolL').value.amount);
    close(run(c, 'glucoseMgdL').value.v, want(c, 'glucoseMgdL').value.amount);
    for (const r of c.expected.results) assert.equal(runResult(r), true, `${c.case} ${r.outputId} ${JSON.stringify(runResult.errors)}`);
  }
});

test('4.5e: converted values are 88.4 and 90.08, and a target-unit value is unchanged', () => {
  const c2 = byName['normal-02-converted'], c1 = byName['normal-01-targets'];
  close(run(c2, 'creatinineUmolL').value.v, 1 * 88.4); close(want(c2, 'creatinineUmolL').value.amount, 88.4);
  close(run(c2, 'glucoseMgdL').value.v, 5 * 18.016); close(want(c2, 'glucoseMgdL').value.amount, 90.08);
  assert.equal(run(c1, 'creatinineUmolL').value.v, 100); assert.equal(run(c1, 'glucoseMgdL').value.v, 90);
  for (const c of cases) { close(toTarget(num(c.envelope, 'creatinine-value'), 'umol/L'), want(c, 'creatinineUmolL').value.amount); close(toTarget(num(c.envelope, 'glucose-value'), 'mg/dL'), want(c, 'glucoseMgdL').value.amount); }
});

test('4.5e: the same-minute case gives gap 0 and same-time, never a missing or absent result', () => {
  const c = byName['boundary-01-same-minute'];
  const g = run(c, 'sampleGap');
  assert.equal(g.ok, true); assert.equal(g.value.v, 0); assert.equal(g.value.unit, 'min');
  assert.equal(run(c, 'sampleOrder').value.v, 'same-time');
  assert.equal('state' in want(c, 'sampleGap'), false);
});

test('4.5e: the reversed case has a negative gap that agrees with creatinine-first', () => {
  const c = byName['boundary-02-reversed'];
  const g = run(c, 'sampleGap').value.v;
  assert.equal(g, -120);
  assert.equal(run(c, 'sampleOrder').value.v, 'creatinine-first');
  assert.ok(g < 0 && want(c, 'sampleOrder').value.label === 'creatinine-first');
});

test('4.5e: a rerun is byte-identical', () => {
  for (const c of cases) {
    const a = JSON.stringify(['sampleGap', 'sampleOrder', 'sampleWithinWindow', 'documentedFactCount', 'creatinineUmolL', 'glucoseMgdL'].map((o) => run(c, o)));
    const b = JSON.stringify(['sampleGap', 'sampleOrder', 'sampleWithinWindow', 'documentedFactCount', 'creatinineUmolL', 'glucoseMgdL'].map((o) => run(c, o)));
    assert.equal(a, b);
  }
});

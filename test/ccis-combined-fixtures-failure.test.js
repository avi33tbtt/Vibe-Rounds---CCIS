// Row 4.5f: failure-policy fixtures for the combined analytic 0.1.3. Synthetic data only. Not for clinical use.
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
const r0 = prepareAnalytic({ analytic: doc, checksum: checksumOf(canonicalize(doc).text), runtime: { limits: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 } } });
assert.equal(r0.ok, true, JSON.stringify(r0));
const OLD = ['normal-01-targets', 'normal-02-converted', 'boundary-01-same-minute', 'boundary-02-reversed', 'unit-conversion-01-undeclared-unit', 'conflicting-01-two-creatinine-values', 'out-of-scope-01-hba1c-not-performed'];
const NEW = ['failure-01-kidney-context-missing', 'failure-02-diabetes-context-missing', 'failure-03-kidney-time-unknown'];
const load = (n) => ({ case: n, envelope: read(new URL(`${n}.envelope.json`, fx)), expected: read(new URL(`${n}.expected.json`, fx)) });
const byName = Object.fromEntries([...OLD, ...NEW].map((n) => [n, load(n)]));
const OUTS = ['sampleGap', 'sampleOrder', 'sampleWithinWindow', 'documentedFactCount', 'creatinineUmolL', 'glucoseMgdL'];
const PAR = { sampleWindow: { enabled: false }, edgeRule: { enabled: false } };

// Inputs built from the observations by plain rules: no record = absent, several = conflicting, a state stays that state.
const KEYS = { diabetesTypeStatement: 'diabetes-type-statement', hba1cCollected: 'hba1c-result-time', kidneyDiseaseStatement: 'kidney-disease-statement', creatinineCollected: 'creatinine-result-time', creatinineValue: 'creatinine-value', glucoseValue: 'glucose-value' };
const one = (o) => {
  if (o.state) return { state: o.state };
  if (o.kind === 'string') return { state: 'present', value: { t: 'text', v: o.value } };
  if (o.kind === 'datetime') return { state: 'present', value: { t: 'instant', ms: Date.parse(o.value.value) } };
  return { state: 'present', value: { t: 'number', v: o.value, unit: o.unit } };
};
const inputsOf = (env) => Object.fromEntries(Object.entries(KEYS).map(([k, c]) => {
  const rows = env.observations.filter((o) => o.concept.id.endsWith(`.${c}`));
  return [k, rows.length === 0 ? { state: 'absent' } : rows.length > 1 ? { state: 'conflicting' } : one(rows[0])];
}));
const run = (c, o) => evaluateOutput({ prepared: r0.prepared, outputId: o, inputs: inputsOf(c.envelope), parameters: PAR });
const want = (c, o) => c.expected.results.find((r) => r.outputId === o);
const isNumber = (r) => r.ok && r.value.t === 'number';
const same = (c, o) => {
  const r = run(c, o); const w = want(c, o);
  if (!w) return true;
  if (w.state) return r.ok && r.value.t === 'text' && r.value.v === w.state;
  if (w.value.label !== undefined) return r.ok && r.value.v === w.value.label;
  return isNumber(r) && Math.abs(r.value.v - w.value.amount) < 1e-9;
};

test('4.5f: the index lists ten cases and the folder holds no other file', () => {
  assert.deepEqual(index.cases.map((c) => c.case), [...OLD, ...NEW]);
  const files = ['index.json', ...index.cases.flatMap((c) => [`${c.case}.envelope.json`, `${c.case}.expected.json`])].sort();
  assert.deepEqual(readdirSync(fx).sort(), files);
});

test('4.5f: every new envelope validates and applies the contexts the case names', () => {
  const ids = (c) => c.envelope.applied.elements.map((e) => e.id);
  for (const n of NEW) {
    assert.equal(contextEnvelope(byName[n].envelope), true, `${n} ${JSON.stringify(contextEnvelope.errors)}`);
    assert.equal(byName[n].expected['x-analyticVersion'], '0.1.3'); assert.equal(byName[n].expected.parameters, 'none');
  }
  assert.deepEqual(ids(byName[NEW[0]]), ['diabetes.glycaemia-documentation']);
  assert.deepEqual(ids(byName[NEW[1]]), ['ckd.kidney-function-documentation']);
  assert.equal(ids(byName[NEW[2]]).length, 2);
});

test('4.5f: a missing kidney context gives indeterminate, glucose still a number, count not a number', () => {
  const c = byName[NEW[0]];
  for (const o of ['sampleGap', 'sampleOrder', 'documentedFactCount', 'creatinineUmolL']) {
    const r = run(c, o); assert.equal(isNumber(r), false, o); assert.equal(r.value.v, 'indeterminate', o); assert.equal(want(c, o).state, 'indeterminate', o);
  }
  assert.equal(run(c, 'glucoseMgdL').value.v, 90);
});

test('4.5f: a missing diabetes context gives needs-data, creatinine still a number', () => {
  const c = byName[NEW[1]];
  for (const o of ['sampleGap', 'sampleOrder', 'documentedFactCount', 'glucoseMgdL']) {
    const r = run(c, o); assert.equal(isNumber(r), false, o); assert.equal(r.value.v, 'needs-data', o); assert.equal(want(c, o).state, 'needs-data', o);
  }
  assert.equal(run(c, 'creatinineUmolL').value.v, 100);
});

test('4.5f: an unknown kidney time is indeterminate, never zero, and differs from a missing context', () => {
  const c = byName[NEW[2]]; const k = byName[NEW[0]];
  assert.equal(inputsOf(c.envelope).creatinineCollected.state, 'unknown');
  for (const o of ['sampleGap', 'sampleOrder']) { const r = run(c, o); assert.equal(isNumber(r), false, o); assert.equal(r.value.v, 'indeterminate', o); }
  assert.equal(run(c, 'documentedFactCount').value.v, 3);
  assert.notEqual(run(c, 'documentedFactCount').value.v, run(k, 'documentedFactCount').value.v);
  assert.notDeepEqual(want(c, 'sampleGap').missingDataNotes, want(k, 'sampleGap').missingDataNotes);
});

test('4.5f: no output is false, normal, true or an invented number for a missing input', () => {
  for (const n of NEW) {
    const c = byName[n];
    for (const o of OUTS) {
      const r = run(c, o);
      if (r.ok && r.value.t === 'text') assert.ok(!['normal', 'false', 'true'].includes(r.value.v), `${n} ${o}`);
      if (isNumber(r)) assert.ok(['creatinineUmolL', 'glucoseMgdL', 'documentedFactCount'].includes(o) && r.value.v !== 0, `${n} ${o}`);
    }
    for (const r of c.expected.results) assert.equal(runResult(r), true, `${n} ${r.outputId} ${JSON.stringify(runResult.errors)}`);
  }
});

test('4.5f: every stored expected equals its run, for the ten cases', () => {
  for (const n of [...OLD, ...NEW]) for (const o of OUTS) assert.equal(same(byName[n], o), true, `${n} ${o}`);
});

test('4.5f: a rerun of the new cases is byte-identical', () => {
  for (const n of NEW) {
    const once = () => canonicalize(OUTS.map((o) => run(byName[n], o))).text;
    assert.equal(once(), once(), n);
  }
});

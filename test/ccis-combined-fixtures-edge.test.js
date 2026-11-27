// Row 4.5e.1: refusal, conflicting and out-of-scope fixtures for the combined analytic 0.1.3. Synthetic data only. Not for clinical use.
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
const OLD = ['normal-01-targets', 'normal-02-converted', 'boundary-01-same-minute', 'boundary-02-reversed'];
const NEW = ['unit-conversion-01-undeclared-unit', 'conflicting-01-two-creatinine-values', 'out-of-scope-01-hba1c-not-performed'];
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
const NUMERIC = (r) => r.ok && r.value.t === 'number';

test('4.5e.1: the index lists its seven cases and their files exist', () => {
  assert.deepEqual(index.cases.map((c) => c.case).slice(0, 7), [...OLD, ...NEW]);
  const files = readdirSync(fx);
  for (const n of [...OLD, ...NEW]) assert.ok(files.includes(`${n}.envelope.json`) && files.includes(`${n}.expected.json`), n);
});

test('4.5e.1: every new envelope validates and has both contexts', () => {
  for (const n of NEW) {
    const { envelope, expected } = byName[n];
    assert.equal(contextEnvelope(envelope), true, `${n} ${JSON.stringify(contextEnvelope.errors)}`);
    assert.deepEqual(envelope.applied.elements.map((e) => e.id).sort(), ['ckd.kidney-function-documentation', 'diabetes.glycaemia-documentation']);
    assert.equal(expected['x-analyticVersion'], '0.1.3');
    assert.equal(expected.parameters, 'none');
  }
});

test('4.5e.1: an undeclared creatinine unit is refused with X-010 and gives no number', () => {
  const c = byName[NEW[0]];
  const r = run(c, 'creatinineUmolL');
  assert.equal(r.ok, false); assert.equal(r.refusal.id, 'X-010');
  assert.deepEqual(c.expected.refusals.map((x) => [x.outputId, x.refusal]), [['creatinineUmolL', 'X-010']]);
  assert.equal(want(c, 'creatinineUmolL'), undefined);
  assert.equal(run(c, 'sampleGap').value.v, 150); assert.equal(run(c, 'documentedFactCount').value.v, 4);
});

test('4.5e.1: two creatinine records are conflicting and give indeterminate, never either value or a mean', () => {
  const c = byName[NEW[1]];
  assert.equal(inputsOf(c.envelope).creatinineValue.state, 'conflicting');
  const r = run(c, 'creatinineUmolL');
  assert.equal(r.ok, true); assert.equal(r.value.t, 'text'); assert.equal(r.value.v, 'indeterminate');
  assert.equal(want(c, 'creatinineUmolL').state, 'indeterminate');
  assert.equal(want(c, 'creatinineUmolL').value, undefined);
  assert.equal(run(c, 'glucoseMgdL').value.v, 90);
});

test('4.5e.1: HbA1c not applicable gives needs-data for gap and order, never zero or false', () => {
  const c = byName[NEW[2]];
  for (const o of ['sampleGap', 'sampleOrder']) {
    const r = run(c, o);
    assert.equal(NUMERIC(r), false, o); assert.equal(r.value.v, 'needs-data'); assert.equal(want(c, o).state, 'needs-data');
  }
  assert.equal(run(c, 'documentedFactCount').value.v, 3);
  assert.equal(want(c, 'documentedFactCount').value.amount, 3);
});

test('4.5e.1: an unknown or conflicting input is never turned into normal or false', () => {
  for (const n of NEW) {
    const c = byName[n];
    for (const o of OUTS) {
      const r = run(c, o);
      if (r.ok && r.value.t === 'text') assert.ok(!['normal', 'false', 'true'].includes(r.value.v), `${n} ${o}`);
    }
    for (const r of c.expected.results) assert.equal(runResult(r), true, `${n} ${r.outputId} ${JSON.stringify(runResult.errors)}`);
  }
});

test('4.5e.1: the four earlier cases still run to their stored values', () => {
  for (const n of OLD) {
    const c = byName[n];
    assert.equal(run(c, 'sampleGap').value.v, want(c, 'sampleGap').value.amount, n);
    assert.equal(run(c, 'sampleOrder').value.v, want(c, 'sampleOrder').value.label, n);
    assert.equal(run(c, 'documentedFactCount').value.v, want(c, 'documentedFactCount').value.amount, n);
    assert.ok(Math.abs(run(c, 'creatinineUmolL').value.v - want(c, 'creatinineUmolL').value.amount) < 1e-9, n);
  }
});

test('4.5e.1: a rerun of the new cases is byte-identical', () => {
  for (const n of NEW) {
    const once = () => canonicalize(OUTS.map((o) => run(byName[n], o))).text;
    assert.equal(once(), once(), n);
  }
});

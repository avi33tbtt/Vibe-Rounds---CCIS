// Row 4.5d.2: sample-gap analytic 0.1.3, declared unit conversions. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analytics } from '../ccis-sdk-analytics.js';
import { prepareAnalytic, evaluateOutput } from '../ccis-exec.js';
import { compareRoutes, canonicalize, checksumOf } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const dir = new URL('../ccis/examples/diabetes-ckd/', import.meta.url);
const text = (f) => readFileSync(new URL(f, dir), 'utf8');
const fileText = text('diabetes-ckd.sample-gap.analytics.0.1.3.json');
const doc = JSON.parse(fileText);
const prev = JSON.parse(text('diabetes-ckd.sample-gap.analytics.0.1.2.json'));
const known = [JSON.parse(text('diabetes.element.json')), JSON.parse(text('ckd.element.json'))];
const PINNED = 'sha256:8ed35722fc4ab106666967d0579dc30643cc6fe7bd85f74b8d80df029685ec2e';
const PREV_PINNED = 'sha256:507692f82069fa5f94574f4bdfa830afbfa53a0b2c7ddd8d07d427dc85602876';
const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
const walk = (v, fn, path = '') => { fn(v, path); if (Array.isArray(v)) v.forEach((x, i) => walk(x, fn, `${path}/${i}`)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, fn, `${path}/${k}`); };
const RUNTIME = { limits: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 } };
const r0 = prepareAnalytic({ analytic: doc, checksum: checksumOf(canonicalize(doc).text), runtime: RUNTIME });
assert.equal(r0.ok, true, JSON.stringify(r0));
const nv = (v, unit) => ({ state: 'present', value: { t: 'number', v, unit } });
const tv = (v) => ({ state: 'present', value: { t: 'text', v } });
const iv = (ms) => ({ state: 'present', value: { t: 'instant', ms } });
const IN = (over = {}) => ({ diabetesTypeStatement: tv('x'), hba1cCollected: iv(0), kidneyDiseaseStatement: tv('y'), creatinineCollected: iv(60000), creatinineValue: nv(1, 'mg/dL'), glucoseValue: nv(5, 'mmol/L'), ...over });
const PAR = { sampleWindow: { enabled: false }, edgeRule: { enabled: false } };
const out = (outputId, over) => evaluateOutput({ prepared: r0.prepared, outputId, inputs: IN(over), parameters: PAR });
const ABSENT = { state: 'absent' };

test('4.5d.2: validates with both elements known; no row is raised', () => {
  const r = validateArtefact(doc, { known });
  assert.deepEqual(r.diagnostics, []);
  for (const [layer, v] of Object.entries(r.layers)) assert.equal(v.outcome, 'passed', layer);
});

test('4.5d.2: canonical bytes are stable, the checksum is pinned and 0.1.2 is unchanged', () => {
  const a = canonicalize(doc);
  assert.equal(canonicalize(JSON.parse(fileText)).text, a.text);
  assert.equal(checksumOf(a.text), PINNED);
  assert.equal(checksumOf(canonicalize(prev).text), PREV_PINNED);
  assert.deepEqual([doc.manifest.id, doc.manifest.version], [prev.manifest.id, '0.1.3']);
});

test('4.5d.2: the SDK route is identical and the file is the sorted SDK output', () => {
  assert.equal(compareRoutes([{ name: 'json', input: fileText }, { name: 'code', input: analytics(JSON.parse(fileText)) }]).identical, true);
  assert.equal(fileText, `${JSON.stringify(sorted(analytics(JSON.parse(fileText))), null, 2)}\n`);
});

test('4.5d.2: the earlier four outputs, computation entries and parameters are unchanged', () => {
  assert.deepEqual(doc.outputs.slice(0, 4), prev.outputs);
  assert.deepEqual(doc.computation.slice(0, 4), prev.computation);
  assert.deepEqual(doc.parameters, prev.parameters);
});

test('4.5d.2: exactly three conversions, the new two marked unreviewed, only the two factors are new numbers', () => {
  assert.deepEqual(doc.conversions.map((c) => c.id), ['hoursToMinutes', 'mgdlToUmolL', 'mmolLToMgdL']);
  for (const c of doc.conversions.slice(1)) assert.match(c['x-note'], /No clinical source reviewed/);
  const nums = (d) => { const n = []; walk(d, (v, p) => { if (typeof v === 'number') n.push([p, v]); }); return n; };
  const before = new Set(nums(prev).map(([p]) => p));
  assert.deepEqual(nums(doc).filter(([p]) => !before.has(p)), [['/conversions/1/factor', 88.4], ['/conversions/2/factor', 18.016]]);
  walk(doc.computation, (v) => { if (v && typeof v === 'object' && 'literal' in v) assert.equal(typeof v.literal, 'string'); });
});

test('4.5d.2: creatinine 1 mg/dL is 88.4 umol/L and glucose 5 mmol/L is 90.08 mg/dL (hand-calculated)', () => {
  const c = out('creatinineUmolL');
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.deepEqual([c.value.t, c.value.v, c.value.unit], ['number', 88.4, 'umol/L']);
  const g = out('glucoseMgdL');
  assert.equal(g.ok, true, JSON.stringify(g));
  assert.equal(g.value.unit, 'mg/dL');
  assert.ok(Math.abs(g.value.v - 90.08) < 1e-9);
});

test('4.5d.2: a value already in the target unit is unchanged; an unexpected unit is refused, never guessed', () => {
  const same = out('creatinineUmolL', { creatinineValue: nv(80, 'umol/L') });
  assert.deepEqual([same.value.v, same.value.unit], [80, 'umol/L']);
  const bad = out('creatinineUmolL', { creatinineValue: nv(1, 'mmol/L') });
  assert.equal(bad.ok, false);
  assert.equal('value' in bad, false);
  assert.equal(bad.refusal.id, 'X-010');
});

test('4.5d.2: a missing creatinine is indeterminate and a missing glucose is needs-data, never zero', () => {
  const c = out('creatinineUmolL', { creatinineValue: ABSENT });
  const g = out('glucoseMgdL', { glucoseValue: ABSENT });
  assert.equal(JSON.stringify(c.value).includes('indeterminate'), true);
  assert.equal(JSON.stringify(g.value).includes('needs-data'), true);
  assert.notEqual(c.value.t, 'number');
  assert.notEqual(g.value.t, 'number');
});

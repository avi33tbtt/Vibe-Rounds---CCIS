// Row 4.5d.1: the sample-gap analytic 0.1.1 with a disabled sample window. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analytics } from '../ccis-sdk-analytics.js';
import { prepareAnalytic, evaluateOutput } from '../ccis-exec.js';
import { compareRoutes, canonicalize, checksumOf } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const dir = new URL('../ccis/examples/diabetes-ckd/', import.meta.url);
const text = (f) => readFileSync(new URL(f, dir), 'utf8');
const fileText = text('diabetes-ckd.sample-gap.analytics.0.1.1.json');
const doc = JSON.parse(fileText);
const old = JSON.parse(text('diabetes-ckd.sample-gap.analytics.json'));
const snake = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-interval.analytics.0.1.1.json', import.meta.url), 'utf8'));
const known = [JSON.parse(text('diabetes.element.json')), JSON.parse(text('ckd.element.json'))];
const PINNED = 'sha256:994cc07475d54366907ce58ef28f3abfb3bd2db88b657026b7b054491ef75bf8';
const OLD_PINNED = 'sha256:0b21e782ee17b25cbe2bf8026b4f4601fa47152763cc42b789f011957c67e87d';
const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
const walk = (v, fn, path = '') => { fn(v, path); if (Array.isArray(v)) v.forEach((x, i) => walk(x, fn, `${path}/${i}`)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, fn, `${path}/${k}`); };
const RUNTIME = { limits: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 } };

test('4.5d.1: validates with both elements known; every layer passes and no row is raised', () => {
  const r = validateArtefact(doc, { known });
  assert.deepEqual(r.diagnostics, []);
  for (const [layer, v] of Object.entries(r.layers)) assert.equal(v.outcome, 'passed', layer);
});

test('4.5d.1: canonical bytes are stable, the checksum is pinned and the 0.1.0 file is unchanged', () => {
  const a = canonicalize(doc);
  assert.equal(a.ok, true);
  assert.equal(canonicalize(JSON.parse(fileText)).text, a.text);
  assert.equal(checksumOf(a.text), PINNED);
  assert.equal(checksumOf(canonicalize(old).text), OLD_PINNED);
  assert.deepEqual([doc.manifest.id, doc.manifest.version], [old.manifest.id, '0.1.1']);
});

test('4.5d.1: the SDK route is identical and the file is the sorted SDK output', () => {
  const r = compareRoutes([{ name: 'json', input: fileText }, { name: 'code', input: analytics(JSON.parse(fileText)) }]);
  assert.equal(r.identical, true);
  assert.equal(fileText, `${JSON.stringify(sorted(analytics(JSON.parse(fileText))), null, 2)}\n`);
});

test('4.5d.1: both parameters are disabled and carry no value; the only numbers are bounds, the factor and the profile', () => {
  assert.deepEqual(doc.parameters.map((p) => [p.id, p.enabledByDefault]), [['sampleWindow', false], ['edgeRule', false]]);
  for (const p of doc.parameters) for (const k of ['value', 'default', 'suggestion']) assert.equal(k in p, false, `${p.id}.${k}`);
  const numbers = [];
  walk(doc, (v, p) => { if (typeof v === 'number') numbers.push(p); });
  assert.deepEqual(numbers, ['/conversions/0/factor', '/executionProfile/maxDepth', '/executionProfile/maxOutputBytes', '/executionProfile/maxSteps', '/parameters/0/allowedRange/max', '/parameters/0/allowedRange/min']);
});

test('4.5d.1: hoursToMinutes equals the snake 0.1.1 conversion', () => {
  const pick = (d) => d.conversions.find((c) => c.id === 'hoursToMinutes');
  assert.deepEqual(pick(doc), pick(snake));
});

test('4.5d.1: the 0.1.0 outputs and computation entries are unchanged', () => {
  assert.deepEqual(doc.outputs.slice(0, 2), old.outputs);
  assert.deepEqual(doc.computation.slice(0, 2), old.computation);
  assert.deepEqual(doc.outputs.map((o) => o.id), doc.computation.map((c) => c.output));
});

test('4.5d.1: sampleWithinWindow declares exactly its three non-value states and no literal is a number', () => {
  const o = doc.outputs.find((x) => x.id === 'sampleWithinWindow');
  assert.deepEqual([...o.states].sort(), ['indeterminate', 'needs-data', 'parameter-not-enabled']);
  assert.deepEqual(o.labels, ['within-window', 'outside-window']);
  walk(doc.computation, (v) => { if (v && typeof v === 'object' && 'literal' in v) assert.equal(typeof v.literal, 'string'); });
});

test('4.5d.1: with no parameter enabled the window output is parameter-not-enabled and the gap is still a value', () => {
  const r = prepareAnalytic({ analytic: doc, checksum: checksumOf(canonicalize(doc).text), runtime: RUNTIME });
  assert.equal(r.ok, true, JSON.stringify(r));
  const inputs = { hba1cCollected: { state: 'present', value: { t: 'instant', ms: 0 } }, creatinineCollected: { state: 'present', value: { t: 'instant', ms: 3600000 } } };
  const parameters = { sampleWindow: { enabled: false }, edgeRule: { enabled: false } };
  const w = evaluateOutput({ prepared: r.prepared, outputId: 'sampleWithinWindow', inputs, parameters });
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.equal(JSON.stringify(w.value).includes('parameter-not-enabled'), true);
  const g = evaluateOutput({ prepared: r.prepared, outputId: 'sampleGap', inputs, parameters });
  assert.equal(g.ok, true, JSON.stringify(g));
  assert.deepEqual([g.value.t, g.value.v, g.value.unit], ['number', 60, 'min']);
});

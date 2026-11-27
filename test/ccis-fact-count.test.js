// Row 4.5d.1a: sample-gap analytic 0.1.2, a count of documented facts. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analytics } from '../ccis-sdk-analytics.js';
import { prepareAnalytic, evaluateOutput } from '../ccis-exec.js';
import { compareRoutes, canonicalize, checksumOf } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const dir = new URL('../ccis/examples/diabetes-ckd/', import.meta.url);
const text = (f) => readFileSync(new URL(f, dir), 'utf8');
const fileText = text('diabetes-ckd.sample-gap.analytics.0.1.2.json');
const doc = JSON.parse(fileText);
const prev = JSON.parse(text('diabetes-ckd.sample-gap.analytics.0.1.1.json'));
const known = [JSON.parse(text('diabetes.element.json')), JSON.parse(text('ckd.element.json'))];
const PINNED = 'sha256:507692f82069fa5f94574f4bdfa830afbfa53a0b2c7ddd8d07d427dc85602876';
const PREV_PINNED = 'sha256:994cc07475d54366907ce58ef28f3abfb3bd2db88b657026b7b054491ef75bf8';
const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
const walk = (v, fn, path = '') => { fn(v, path); if (Array.isArray(v)) v.forEach((x, i) => walk(x, fn, `${path}/${i}`)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, fn, `${path}/${k}`); };
const RUNTIME = { limits: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 } };
const prepared = (() => { const r = prepareAnalytic({ analytic: doc, checksum: checksumOf(canonicalize(doc).text), runtime: RUNTIME }); assert.equal(r.ok, true, JSON.stringify(r)); return r.prepared; })();
const tv = (v) => ({ state: 'present', value: { t: 'text', v } });
const iv = (ms) => ({ state: 'present', value: { t: 'instant', ms } });
const IN = (over = {}) => ({ diabetesTypeStatement: tv('x'), hba1cCollected: iv(0), kidneyDiseaseStatement: tv('y'), creatinineCollected: iv(60000), ...over });
const PAR = { sampleWindow: { enabled: false }, edgeRule: { enabled: false } };
const count = (over) => evaluateOutput({ prepared, outputId: 'documentedFactCount', inputs: IN(over), parameters: PAR });
const ABSENT = { state: 'absent' };

test('4.5d.1a: validates with both elements known; no row is raised', () => {
  const r = validateArtefact(doc, { known });
  assert.deepEqual(r.diagnostics, []);
  for (const [layer, v] of Object.entries(r.layers)) assert.equal(v.outcome, 'passed', layer);
});

test('4.5d.1a: canonical bytes are stable, the checksum is pinned and 0.1.1 is unchanged', () => {
  const a = canonicalize(doc);
  assert.equal(canonicalize(JSON.parse(fileText)).text, a.text);
  assert.equal(checksumOf(a.text), PINNED);
  assert.equal(checksumOf(canonicalize(prev).text), PREV_PINNED);
  assert.deepEqual([doc.manifest.id, doc.manifest.version], [prev.manifest.id, '0.1.2']);
});

test('4.5d.1a: the SDK route is identical and the file is the sorted SDK output', () => {
  assert.equal(compareRoutes([{ name: 'json', input: fileText }, { name: 'code', input: analytics(JSON.parse(fileText)) }]).identical, true);
  assert.equal(fileText, `${JSON.stringify(sorted(analytics(JSON.parse(fileText))), null, 2)}\n`);
});

test('4.5d.1a: the earlier outputs, computation, parameters and conversions are unchanged', () => {
  assert.deepEqual(doc.outputs.slice(0, 3), prev.outputs);
  assert.deepEqual(doc.computation.slice(0, 3), prev.computation);
  assert.deepEqual([doc.parameters, doc.conversions], [prev.parameters, prev.conversions]);
});

test('4.5d.1a: the count declares two non-value states, no literal is a number, no new number appears', () => {
  const o = doc.outputs.find((x) => x.id === 'documentedFactCount');
  assert.deepEqual([...o.states].sort(), ['indeterminate', 'needs-data']);
  walk(doc.computation, (v) => { if (v && typeof v === 'object' && 'literal' in v) assert.equal(typeof v.literal, 'string'); });
  const nums = (d) => { const n = []; walk(d, (v, p) => { if (typeof v === 'number') n.push(p); }); return n; };
  assert.deepEqual(nums(doc), nums(prev));
});

test('4.5d.1a: all four facts present count 4 (hand-calculated)', () => {
  const r = count();
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([r.value.t, r.value.v, r.value.unit], ['number', 4, '1']);
});

test('4.5d.1a: a missing kidney context is indeterminate, not 2; a missing diabetes context is needs-data', () => {
  const k = count({ kidneyDiseaseStatement: ABSENT, creatinineCollected: ABSENT });
  assert.equal(k.ok, true, JSON.stringify(k));
  assert.equal(JSON.stringify(k.value).includes('indeterminate'), true);
  const d = count({ diabetesTypeStatement: ABSENT, hba1cCollected: ABSENT });
  assert.equal(JSON.stringify(d.value).includes('needs-data'), true);
});

test('4.5d.1a: one fact per side counts 2, and an unknown fact counts as not recorded', () => {
  const two = count({ hba1cCollected: ABSENT, creatinineCollected: ABSENT });
  assert.equal(two.value.v, 2);
  const unk = count({ hba1cCollected: { state: 'unknown' } });
  assert.equal(unk.ok, true, JSON.stringify(unk));
  assert.equal(unk.value.v, 3);
});

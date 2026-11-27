// Row 4.5d: the sample-gap analytic over both contexts. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analytics } from '../ccis-sdk-analytics.js';
import { WHITELIST_OPS } from '../ccis-exec.js';
import { compareRoutes, canonicalize, checksumOf } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const dir = new URL('../ccis/examples/diabetes-ckd/', import.meta.url);
const text = (f) => readFileSync(new URL(f, dir), 'utf8');
const fileText = text('diabetes-ckd.sample-gap.analytics.json');
const doc = JSON.parse(fileText);
const known = [JSON.parse(text('diabetes.element.json')), JSON.parse(text('ckd.element.json'))];
const PINNED = 'sha256:0b21e782ee17b25cbe2bf8026b4f4601fa47152763cc42b789f011957c67e87d';
const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
const walk = (v, fn, path = '') => { fn(v, path); if (Array.isArray(v)) v.forEach((x, i) => walk(x, fn, `${path}/${i}`)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, fn, `${path}/${k}`); };

test('4.5d: validates with both elements known; every layer passes and no row is raised', () => {
  const r = validateArtefact(doc, { known });
  assert.deepEqual(r.diagnostics, []);
  for (const [layer, v] of Object.entries(r.layers)) assert.equal(v.outcome, 'passed', layer);
});

test('4.5d: canonical bytes are stable and the checksum is pinned', () => {
  const a = canonicalize(doc);
  assert.equal(a.ok, true);
  assert.equal(canonicalize(JSON.parse(fileText)).text, a.text);
  assert.equal(checksumOf(a.text), PINNED);
});

test('4.5d: the SDK route is identical and the file is the sorted SDK output', () => {
  const r = compareRoutes([{ name: 'json', input: fileText }, { name: 'code', input: analytics(JSON.parse(fileText)) }]);
  assert.equal(r.identical, true);
  assert.equal(fileText, `${JSON.stringify(sorted(analytics(JSON.parse(fileText))), null, 2)}\n`);
});

test('4.5d: manifest, exact element pins and exactly the two context fields', () => {
  assert.deepEqual([doc.manifest.id, doc.manifest.version, doc.manifest.status], ['diabetes-ckd.sample-gap', '0.1.0', 'draft']);
  assert.deepEqual(doc.manifest.references.map((r) => [r.id, r.version, 'range' in r]), known.map((e) => [e.manifest.id, '0.1.0', false]));
  assert.deepEqual(doc.context.map((c) => [c.ref.id, c.fields]), [[known[0].manifest.id, ['hba1cResultTime']], [known[1].manifest.id, ['creatinineResultTime']]]);
});

test('4.5d: no parameter, no conversion, and no number outside the execution profile', () => {
  assert.deepEqual([doc.parameters, doc.conversions], [[], undefined]);
  const numbers = [];
  walk(doc, (v, p) => { if (typeof v === 'number') numbers.push(p); });
  assert.deepEqual(numbers, ['/executionProfile/maxDepth', '/executionProfile/maxOutputBytes', '/executionProfile/maxSteps']);
});

test('4.5d: only whitelisted operators and no numeric literal', () => {
  const ops = new Set();
  walk(doc.computation, (v) => { if (v && typeof v === 'object' && 'op' in v) ops.add(v.op); if (v && typeof v === 'object' && 'literal' in v) assert.equal(typeof v.literal, 'string'); });
  assert.ok(ops.size > 0 && [...ops].every((o) => WHITELIST_OPS.includes(o)));
});

test('4.5d: a missing diabetes time is needs-data and a missing kidney time is indeterminate', () => {
  const by = Object.fromEntries(doc.inputs.map((i) => [i.key, i.onMissing]));
  assert.deepEqual(by, { hba1cCollected: 'needs-data', creatinineCollected: 'indeterminate' });
  assert.match(doc.limitations.items[0], /kidney/);
});

test('4.5d: each output declares exactly the two non-value states its tree can give', () => {
  for (const o of doc.outputs) assert.deepEqual([...o.states].sort(), ['indeterminate', 'needs-data'], o.id);
  assert.deepEqual(doc.outputs.map((o) => o.id), doc.computation.map((c) => c.output));
});

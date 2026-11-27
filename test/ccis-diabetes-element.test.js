// Row 4.5a: the diabetes element of the second demo. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { element, EPISTEMIC_STATES } from '../ccis-sdk-element.js';
import { compareRoutes, canonicalize, checksumOf } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const dir = new URL('../ccis/examples/diabetes-ckd/', import.meta.url);
const fileText = readFileSync(new URL('diabetes.element.json', dir), 'utf8');
const doc = JSON.parse(fileText);
const KEYS = ['diabetesTypeStatement', 'diagnosisDate', 'hba1cValue', 'hba1cResultTime', 'glucoseValue', 'glucoseResultTime', 'glucoseFastingStatus', 'treatmentPlanDocumented'];
const PINNED = 'sha256:1bfafb02e2a88a348a9031b02a4951017cc528ec1f2f75f16d1e3d533f262b95';

test('4.5a: the file validates with no diagnostic rows', () => {
  const r = validateArtefact(doc);
  for (const [layer, v] of Object.entries(r.layers)) assert.deepEqual([layer, v.outcome, v.diagnostics.length], [layer, 'passed', 0]);
});

test('4.5a: canonical bytes are stable and the checksum is pinned', () => {
  const a = canonicalize(doc);
  assert.equal(a.ok, true);
  assert.equal(canonicalize(JSON.parse(fileText)).text, a.text);
  assert.equal(checksumOf(a.text), PINNED);
});

test('4.5a: the SDK route gives identical bytes and the file is the SDK output', () => {
  const r = compareRoutes([{ name: 'json', input: fileText }, { name: 'code', input: element(JSON.parse(fileText)) }]);
  assert.equal(r.identical, true);
  assert.equal(fileText, `${JSON.stringify(element(JSON.parse(fileText)), null, 2)}\n`);
});

test('4.5a: manifest and the eight fields', () => {
  assert.deepEqual([doc.manifest.status, doc.manifest.version, doc.manifest.standard.version, doc.manifest.publisher.name], ['draft', '0.1.0', '0.1.0', 'Synthetic test publisher']);
  assert.deepEqual(doc.fields.map((f) => f.key), KEYS);
});

test('4.5a: every field lists the six epistemic states, unknown and absent included', () => {
  for (const f of doc.fields) {
    assert.deepEqual([...f.epistemic].sort(), [...EPISTEMIC_STATES].sort(), f.key);
    assert.ok(f.epistemic.includes('unknown') && f.epistemic.includes('absent'));
  }
});

test('4.5a: no threshold, target, band, dose, drug or limit number anywhere', () => {
  const bad = /threshold|target|band|dose|mg\/kg|insulin|metformin|statin|gliptin|sulfonylurea/i;
  const names = [];
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { names.push(k); walk(x); } };
  walk(doc);
  for (const f of doc.fields) names.push(f.key, f.label);
  assert.deepEqual(names.filter((n) => bad.test(n)), []);
  const numbers = [];
  const nums = (v) => { if (typeof v === 'number') numbers.push(v); else if (Array.isArray(v)) v.forEach(nums); else if (v && typeof v === 'object') Object.values(v).forEach(nums); };
  nums(doc);
  assert.ok(numbers.every((n) => n === 0 || n === 1), 'a number other than a 0 or 1 cardinality bound');
});

test('4.5a: both result times are datetimes with collection-time', () => {
  for (const k of ['hba1cResultTime', 'glucoseResultTime']) {
    const f = doc.fields.find((x) => x.key === k);
    assert.deepEqual([f.type, f.timeSemantics], ['datetime', 'collection-time']);
  }
  for (const f of doc.fields.filter((x) => ['date', 'datetime'].includes(x.type))) assert.ok(f.timeSemantics, f.key);
});

test('4.5a: the folder holds diabetes element file and the top-level members match the snake element', () => {
  assert.ok(readdirSync(dir).includes('diabetes.element.json'));
  assert.deepEqual(Object.keys(doc).sort(), ['fields', 'intent', 'manifest', 'provenance', 'relationships']);
  assert.equal(JSON.stringify(doc).includes('"x-'), false);
});

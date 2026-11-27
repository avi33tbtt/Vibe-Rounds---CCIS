// Row 4.5b: the kidney element of the second demo. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { element, EPISTEMIC_STATES } from '../ccis-sdk-element.js';
import { compareRoutes, canonicalize, checksumOf } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const dir = new URL('../ccis/examples/diabetes-ckd/', import.meta.url);
const fileText = readFileSync(new URL('ckd.element.json', dir), 'utf8');
const doc = JSON.parse(fileText);
const dia = JSON.parse(readFileSync(new URL('diabetes.element.json', dir), 'utf8'));
const KEYS = ['kidneyDiseaseStatement', 'diagnosisDate', 'creatinineValue', 'creatinineResultTime', 'egfrValue', 'egfrResultTime', 'egfrMethodStatement', 'kidneyFollowUpDocumented'];
const PINNED = 'sha256:f8a75a03e8789dae4f06b6865faae8199cf8816fb00ab131db3c595c71bbcb4f';
const DIABETES_PINNED = 'sha256:1bfafb02e2a88a348a9031b02a4951017cc528ec1f2f75f16d1e3d533f262b95';
const field = (d, k) => d.fields.find((f) => f.key === k);

test('4.5b: the file validates; the only row is the unchecked eGFR unit warning (D-278)', () => {
  const r = validateArtefact(doc);
  const rows = [];
  for (const [layer, v] of Object.entries(r.layers)) { assert.equal(v.outcome, 'passed', layer); for (const d of v.diagnostics) rows.push([d.severity, d.ruleId, d.path]); }
  assert.deepEqual(rows, [['warning', 'CCIS-V4-011', '/fields/4/units/0']]);
});

test('4.5b: canonical bytes are stable and the checksum is pinned', () => {
  const a = canonicalize(doc);
  assert.equal(a.ok, true);
  assert.equal(canonicalize(JSON.parse(fileText)).text, a.text);
  assert.equal(checksumOf(a.text), PINNED);
});

test('4.5b: the SDK route gives identical bytes and the file is the SDK output', () => {
  const r = compareRoutes([{ name: 'json', input: fileText }, { name: 'code', input: element(JSON.parse(fileText)) }]);
  assert.equal(r.identical, true);
  assert.equal(fileText, `${JSON.stringify(element(JSON.parse(fileText)), null, 2)}\n`);
});

test('4.5b: manifest values and the eight keys in order', () => {
  assert.deepEqual([doc.manifest.id, doc.manifest.status, doc.manifest.version, doc.manifest.standard.version, doc.manifest.publisher.name], ['ckd.kidney-function-documentation', 'draft', '0.1.0', '0.1.0', 'Synthetic test publisher']);
  assert.deepEqual(doc.fields.map((f) => f.key), KEYS);
});

test('4.5b: every field lists the six epistemic states, unknown and absent included', () => {
  for (const f of doc.fields) {
    assert.deepEqual([...f.epistemic].sort(), [...EPISTEMIC_STATES].sort(), f.key);
    assert.ok(f.epistemic.includes('unknown') && f.epistemic.includes('absent'));
  }
});

test('4.5b: no threshold, target, band, dose, drug, staging or formula name; every number is 0 or 1', () => {
  const bad = /threshold|target|band|dose|mg\/kg|insulin|metformin|statin|gliptin|sulfonylurea|stage|staging|formula|equation/i;
  const names = [];
  const numbers = [];
  const walk = (v) => {
    if (typeof v === 'number') numbers.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { names.push(k); walk(x); }
  };
  walk(doc);
  for (const f of doc.fields) names.push(f.key, f.label);
  assert.deepEqual(names.filter((n) => bad.test(n)), []);
  assert.ok(numbers.every((n) => n === 0 || n === 1), 'a number other than a 0 or 1 cardinality bound');
});

test('4.5b: result times are collection-time datetimes; eGFR has one unit, creatinine two', () => {
  for (const k of ['creatinineResultTime', 'egfrResultTime']) assert.deepEqual([field(doc, k).type, field(doc, k).timeSemantics], ['datetime', 'collection-time']);
  assert.deepEqual(field(doc, 'egfrValue').units, ['mL/min/1.73m2']);
  assert.deepEqual(field(doc, 'creatinineValue').units, ['umol/L', 'mg/dL']);
});

test('4.5b: near-collisions with the diabetes element stay apart and diabetes is unchanged', () => {
  assert.notEqual(field(doc, 'diagnosisDate').label, field(dia, 'diagnosisDate').label);
  assert.notDeepEqual(field(doc, 'diagnosisDate').constraints, field(dia, 'diagnosisDate').constraints);
  assert.notEqual(field(doc, 'kidneyFollowUpDocumented').label, field(dia, 'treatmentPlanDocumented').label);
  assert.equal(checksumOf(canonicalize(dia).text), DIABETES_PINNED);
  assert.equal(dia.fields.length, 8);
});

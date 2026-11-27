// Row 4.4: the pure form model for a contextual element. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formToSpec, draftFromForm, FORM_TYPES, FORM_STATUS } from '../ccis-app-form.js';
import { compareRoutes } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const FORM = {
  id: 'demo.element', name: 'Demo element', version: '0.1.0', publisher: 'Synthetic test publisher',
  purpose: 'Demonstration.', setting: 'Any.', population: 'Synthetic.', exclusions: '', rationale: 'Demonstration only.',
  origin: 'Demonstration', basis: 'None',
  fields: [
    { key: 'note', label: 'Note', type: 'string', min: '0', max: '1', epistemic: 'absent\nunknown', sourceClasses: 'clinician-entered', units: '', timeSemantics: '', constraints: '' },
    { key: 'dose', label: 'Dose', type: 'quantity', min: '0', max: 'unbounded', epistemic: 'absent', sourceClasses: 'clinician-entered\n\npatient-reported', units: 'mg', timeSemantics: '', constraints: 'Positive only.' },
    { key: 'count', label: 'Count', type: 'integer', min: '1', max: '3', epistemic: 'absent', sourceClasses: 'clinician-entered', units: 'count', timeSemantics: '', constraints: '' },
    { key: 'seen', label: 'Seen at', type: 'date', min: '0', max: '1', epistemic: 'absent', sourceClasses: 'clinician-entered', units: '', timeSemantics: 'event-time', constraints: '' },
  ],
};
const JSON_DOC = {
  manifest: { id: 'demo.element', name: 'Demo element', type: 'contextual-element', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.1.0' }, status: 'draft' },
  intent: { purpose: 'Demonstration.', setting: 'Any.', population: 'Synthetic.', exclusions: [], rationale: 'Demonstration only.' },
  fields: [
    { key: 'note', label: 'Note', type: 'string', cardinality: { min: 0, max: 1 }, epistemic: ['absent', 'unknown'], sourceClasses: ['clinician-entered'] },
    { key: 'dose', label: 'Dose', type: 'quantity', cardinality: { min: 0, max: 'unbounded' }, epistemic: ['absent'], sourceClasses: ['clinician-entered', 'patient-reported'], units: ['mg'], constraints: ['Positive only.'] },
    { key: 'count', label: 'Count', type: 'integer', cardinality: { min: 1, max: 3 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'], units: ['count'] },
    { key: 'seen', label: 'Seen at', type: 'date', cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'], timeSemantics: 'event-time' },
  ],
  provenance: { origin: 'Demonstration', basis: 'None' },
};
const verdict = (doc) => Object.entries(validateArtefact(doc).layers).map(([k, v]) => [k, v.outcome, v.diagnostics.map((d) => d.ruleId)]);

test('4.4: the form route and the JSON route give identical canonical bytes', () => {
  const d = draftFromForm(FORM);
  assert.equal(d.ok, true);
  const r = compareRoutes([{ name: 'json', input: JSON_DOC }, { name: 'form', input: d.spec }]);
  assert.equal(r.identical, true);
  assert.equal(r.routes[0].checksum, d.checksum);
  assert.equal(r.routes[1].checksum, d.checksum);
});

test('4.4: both routes get the same validator verdict', () => {
  const d = draftFromForm(FORM);
  assert.deepEqual(verdict(d.spec), verdict(JSON_DOC));
  assert.deepEqual(d.diagnostics.map((x) => x.ruleId), validateArtefact(JSON_DOC).diagnostics.map((x) => x.ruleId));
});

test('4.4: whole-number strings parse, unbounded stays, abc is refused at its path', () => {
  const s = formToSpec(FORM);
  assert.deepEqual([s.fields[1].cardinality, s.fields[2].cardinality], [{ min: 0, max: 'unbounded' }, { min: 1, max: 3 }]);
  const bad = clone(FORM);
  bad.fields[0].min = 'abc';
  const d = draftFromForm(bad);
  assert.deepEqual([d.ok, d.sdk.code, d.sdk.path], [false, 'S-003', 'fields.0.cardinality.min']);
  const blank = clone(FORM);
  blank.fields[0].min = '';
  assert.deepEqual([draftFromForm(blank).ok, draftFromForm(blank).sdk.path], [false, 'fields.0.cardinality.min']);
});

test('4.4: list lines drop blanks and keep order; an all-blank required list is refused', () => {
  assert.deepEqual(formToSpec(FORM).fields[1].sourceClasses, ['clinician-entered', 'patient-reported']);
  const bad = clone(FORM);
  bad.fields[0].epistemic = '\n  \n';
  const d = draftFromForm(bad);
  assert.deepEqual([d.ok, d.sdk.code], [false, 'S-003']);
});

test('4.4: an empty label is refused with a fixed sentence, naming code and path, never the value', () => {
  const bad = clone(FORM);
  bad.fields[1].label = '';
  bad.purpose = 'SECRET-TEXT';
  const d = draftFromForm(bad);
  assert.equal(d.ok, false);
  assert.match(d.sdk.path, /^fields\.1\.label$/);
  assert.equal(JSON.stringify(d).includes('SECRET-TEXT'), false);
  assert.equal(d.sdk.sentence, 'A member has the wrong type or an unacceptable value.');
});

test('4.4: duplicate field keys are accepted by the builder and reported by the validator', () => {
  const dup = clone(FORM);
  dup.fields[1].key = 'note';
  const d = draftFromForm(dup);
  assert.deepEqual([d.ok, d.sdk], [true, null]);
  assert.ok(d.diagnostics.length > 0);
  const row = d.diagnostics[0];
  assert.deepEqual(Object.keys(row), ['layer', 'severity', 'ruleId', 'path', 'message', 'hint']);
  assert.equal(row.layer, 'reference-integrity');
});

test('4.4: deterministic, frozen, input untouched, and status is draft whatever the form holds', () => {
  const f = clone(FORM);
  f.status = 'validated';
  const before = JSON.stringify(f);
  const a = draftFromForm(f);
  const b = draftFromForm(f);
  assert.equal(JSON.stringify(f), before);
  assert.deepEqual([a.canonical, a.checksum], [b.canonical, b.checksum]);
  assert.equal(a.spec.manifest.status, FORM_STATUS);
  assert.equal(FORM_STATUS, 'draft');
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.diagnostics));
});

test('4.4: a code field is refused, and the module source is pure', () => {
  assert.equal(FORM_TYPES.includes('code'), false);
  const bad = clone(FORM);
  bad.fields[0].type = 'code';
  const d = draftFromForm(bad);
  assert.deepEqual([d.ok, d.sdk.path], [false, 'fields.0.type']);
  const src = readFileSync(new URL('../ccis-app-form.js', import.meta.url), 'utf8').split('\n').filter((l) => !l.startsWith('//')).join('\n');
  for (const re of [/\bfetch\b/, /\bwindow\b/, /\bdocument\b/, /\bDate\b/, /Math\.random/, /localStorage|sessionStorage|indexedDB/, /\bimport\s*\(/]) assert.equal(re.test(src), false, String(re));
});

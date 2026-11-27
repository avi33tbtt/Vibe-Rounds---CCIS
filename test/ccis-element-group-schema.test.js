// Row 4.5c: the element-group schema (CCIS-REQ-023, 024). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { elementGroup } from '../ccis/validators/ccis-validators.js';
import { validateArtefact } from '../ccis-validator.js';

const base = () => ({
  manifest: { id: 'demo.group', name: 'Demo group', type: 'element-group', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.1.0' }, status: 'draft' },
  intent: { purpose: 'p', setting: 's', population: 'q', exclusions: ['x'], rationale: 'r' },
  members: [
    { element: { id: 'a.one', type: 'contextual-element', range: '>=0.1.0' }, required: true },
    { element: { id: 'b.two', type: 'contextual-element', version: '0.1.0' }, required: false }
  ],
  sharedConcepts: [{ concept: 'dateOfDiagnosis', meaning: 'The date a condition was recorded as diagnosed.', fields: [{ element: 'a.one', field: 'diagnosisDate' }, { element: 'b.two', field: 'diagnosisDate' }], resolution: 'related-not-merged' }],
  versionPolicy: { conflict: 'refuse' },
  provenance: { origin: 'o', basis: 'b' }
});
const ok = (g) => elementGroup(g) === true;
const mutate = (fn) => { const g = base(); fn(g); return g; };

test('4.5c: a minimal valid group passes', () => {
  assert.equal(ok(base()), true, JSON.stringify(elementGroup.errors));
});

test('4.5c: a shared concept needs a non-empty meaning', () => {
  assert.equal(ok(mutate((g) => { delete g.sharedConcepts[0].meaning; })), false);
  assert.equal(ok(mutate((g) => { g.sharedConcepts[0].meaning = ''; })), false);
});

test('4.5c: a shared concept cannot be identified by label', () => {
  assert.equal(ok(mutate((g) => { g.sharedConcepts[0].label = 'Date of diagnosis'; })), false);
});

test('4.5c: a shared concept lists two or more fields', () => {
  assert.equal(ok(mutate((g) => { g.sharedConcepts[0].fields.pop(); })), false);
});

test('4.5c: resolution and conflict policy take only their listed values', () => {
  assert.equal(ok(mutate((g) => { g.sharedConcepts[0].resolution = 'merge-by-label'; })), false);
  assert.equal(ok(mutate((g) => { g.versionPolicy.conflict = 'newest-wins'; })), false);
  assert.equal(ok(mutate((g) => { g.sharedConcepts[0].resolution = 'same-concept'; g.versionPolicy.conflict = 'prefer-listed-order'; })), true);
});

test('4.5c: a member declares mandatory or optional; unknown keys fail; x- keys pass', () => {
  assert.equal(ok(mutate((g) => { delete g.members[0].required; })), false);
  assert.equal(ok(mutate((g) => { g.members[0].weight = 2; })), false);
  assert.equal(ok(mutate((g) => { g.members[0]['x-note'] = 'ok'; })), true);
});

test('4.5c: the manifest type must be element-group', () => {
  assert.equal(ok(mutate((g) => { g.manifest.type = 'contextual-element'; })), false);
});

test('4.5c: existing elements are unaffected by the new artefact type', () => {
  for (const f of ['diabetes.element.json', 'ckd.element.json']) {
    const doc = JSON.parse(readFileSync(new URL(`../ccis/examples/diabetes-ckd/${f}`, import.meta.url), 'utf8'));
    const rows = Object.values(validateArtefact(doc).layers).flatMap((l) => l.diagnostics).filter((d) => d.severity === 'error');
    assert.deepEqual(rows, [], f);
  }
});

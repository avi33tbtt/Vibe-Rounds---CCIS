// Row 4.5c.1: validating an element group (CCIS-V5-009 to 013). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { groupChecks } from '../ccis-validator-group.js';

const dir = new URL('../ccis/examples/diabetes-ckd/', import.meta.url);
const dia = JSON.parse(readFileSync(new URL('diabetes.element.json', dir), 'utf8'));
const ckd = JSON.parse(readFileSync(new URL('ckd.element.json', dir), 'utf8'));
const DIA = dia.manifest.id;
const CKD = ckd.manifest.id;
const group = () => ({
  manifest: { id: 'diabetes-ckd.group', name: 'Diabetes and CKD group', type: 'element-group', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.1.0' }, status: 'draft' },
  intent: { purpose: 'p', setting: 's', population: 'q', exclusions: ['x'], rationale: 'r' },
  members: [
    { element: { id: DIA, type: 'contextual-element', version: '0.1.0' }, required: true },
    { element: { id: CKD, type: 'contextual-element', version: '0.1.0' }, required: false }
  ],
  sharedConcepts: [{ concept: 'diagnosisDates', meaning: 'Two different diagnosis dates that are kept apart.', fields: [{ element: DIA, field: 'diagnosisDate' }, { element: CKD, field: 'diagnosisDate' }], resolution: 'related-not-merged' }],
  versionPolicy: { conflict: 'refuse' },
  provenance: { origin: 'o', basis: 'b' }
});
const run = (g, known = [dia, ckd]) => validateArtefact(g, { known });
const ids = (r) => r.diagnostics.filter((d) => d.severity === 'error').map((d) => d.ruleId);
const mutate = (fn) => { const g = group(); fn(g); return g; };

test('4.5c.1: a valid group passes with no error row', () => {
  const r = run(group());
  assert.deepEqual(ids(r), []);
  assert.equal(r.layers['graph-and-compatibility'].outcome, 'passed');
});

test('4.5c.1: a member that is not among the known artefacts is reported, never assumed', () => {
  assert.deepEqual(ids(run(group(), [dia])), ['CCIS-V3-004']);
});

test('4.5c.1: V5-009 a concept names a non-member element', () => {
  assert.deepEqual(ids(run(mutate((g) => { g.sharedConcepts[0].fields[1].element = 'other.element'; }))), ['CCIS-V5-009', 'CCIS-V5-012']);
});

test('4.5c.1: V5-010 a concept names a field the element lacks', () => {
  assert.ok(ids(run(mutate((g) => { g.sharedConcepts[0].fields[1].field = 'noSuchField'; }))).includes('CCIS-V5-010'));
});

test('4.5c.1: V5-011 same-concept needs the same type and units', () => {
  const g = mutate((x) => { x.sharedConcepts.push({ concept: 'values', meaning: 'A claim of sameness that is false.', fields: [{ element: DIA, field: 'glucoseValue' }, { element: CKD, field: 'creatinineValue' }], resolution: 'same-concept' }); });
  assert.deepEqual(ids(run(g)), ['CCIS-V5-011']);
  assert.deepEqual(ids(run(mutate((x) => { x.sharedConcepts[0].resolution = 'same-concept'; }))), []);
});

test('4.5c.1: V5-012 an undeclared overlap is an error', () => {
  assert.deepEqual(ids(run(mutate((g) => { g.sharedConcepts = []; }))), ['CCIS-V5-012']);
});

test('4.5c.1: V5-013 a field in two concepts', () => {
  const g = mutate((x) => { x.sharedConcepts.push({ ...x.sharedConcepts[0], concept: 'again' }); });
  assert.ok(ids(run(g)).includes('CCIS-V5-013'));
});

test('4.5c.1: an unresolved member is skipped without a guess or a crash', () => {
  const ctx = { resolve: (ref) => (ref.id === CKD ? { state: 'missing' } : { state: 'ok', doc: dia }) };
  assert.deepEqual(groupChecks(group(), ctx).map((d) => d.ruleId), []);
});

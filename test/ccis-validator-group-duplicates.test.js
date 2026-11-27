// Row B4: group duplicates and single-member concepts (CCIS-V5-033 to 035). Synthetic data only. Not for clinical use.
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
const F = [{ element: DIA, field: 'diagnosisDate' }, { element: CKD, field: 'diagnosisDate' }];
const group = () => ({
  manifest: { id: 'diabetes-ckd.group', name: 'Diabetes and CKD group', type: 'element-group', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.1.0' }, status: 'draft' },
  intent: { purpose: 'p', setting: 's', population: 'q', exclusions: ['x'], rationale: 'r' },
  members: [
    { element: { id: DIA, type: 'contextual-element', version: '0.1.0' }, required: true },
    { element: { id: CKD, type: 'contextual-element', version: '0.1.0' }, required: false }
  ],
  sharedConcepts: [{ concept: 'diagnosisDates', meaning: 'Two different diagnosis dates that are kept apart.', fields: F, resolution: 'related-not-merged' }],
  versionPolicy: { conflict: 'refuse' },
  provenance: { origin: 'o', basis: 'b' }
});
const mutate = (fn) => { const g = group(); fn(g); return g; };
const pick = (d) => d.filter((x) => /V5-03[345]$/.test(x.ruleId)).map((x) => [x.ruleId, x.path]);
const rows = (g) => pick(validateArtefact(g, { known: [dia, ckd] }).diagnostics);
const missing = { resolve: () => ({ state: 'missing' }) };
const extra = (a, b) => ({ concept: 'second', meaning: 'm', fields: [{ element: DIA, field: a }, { element: CKD, field: b }], resolution: 'related-not-merged' });

test('B4: a member listed twice gives V5-033 at the second position only', () => {
  assert.deepEqual(rows(mutate((g) => g.members.push(g.members[0]))), [['CCIS-V5-033', '/members/2/element']]);
});

test('B4: a concept code used twice gives V5-034 at the second entry only', () => {
  const g = mutate((x) => x.sharedConcepts.push({ ...extra('hba1c', 'egfr'), concept: 'diagnosisDates' }));
  assert.deepEqual(rows(g), [['CCIS-V5-034', '/sharedConcepts/1/concept']]);
});

test('B4: a concept naming one member twice gives V5-035; two members give none', () => {
  const one = mutate((x) => { x.sharedConcepts[0].fields = [F[0], { element: DIA, field: 'other' }]; });
  assert.deepEqual(rows(one), [['CCIS-V5-035', '/sharedConcepts/0/fields']]);
  assert.deepEqual(rows(group()), []);
});

test('B4: V5-035 is skipped when a field names a non-member', () => {
  const g = mutate((x) => { x.sharedConcepts[0].fields = [F[0], { element: 'not.a.member', field: 'f' }]; });
  const d = validateArtefact(g, { known: [dia, ckd] }).diagnostics;
  assert.deepEqual(pick(d), []);
  assert.ok(d.some((x) => x.ruleId === 'CCIS-V5-009'));
});

test('B4: a similar label with a different key gives no V5-033 to 035 row', () => {
  const g = mutate((x) => x.sharedConcepts.push(extra('followUpLabel', 'followUp')));
  assert.deepEqual(rows(g), []);
});

test('B4: the shipped diabetes-ckd group gives no new row', () => {
  assert.deepEqual(rows(group()), []);
});

test('B4: unresolved members still give V5-033 and V5-034, with no crash', () => {
  const g = mutate((x) => { x.members.push(x.members[0]); x.sharedConcepts.push({ ...extra('a', 'b'), concept: 'diagnosisDates' }); });
  assert.deepEqual(pick(groupChecks(g, missing)), [['CCIS-V5-033', '/members/2/element'], ['CCIS-V5-034', '/sharedConcepts/1/concept']]);
});

test('B4: hostile-looking ids stay inside message text', () => {
  const evil = '<img src=x onerror=alert(1)>"\'';
  const g = mutate((x) => { x.members.push({ element: { id: evil, type: 'contextual-element', version: '0.1.0' } }, { element: { id: evil, type: 'contextual-element', version: '0.1.0' } }); });
  const d = groupChecks(g, missing).filter((x) => x.ruleId === 'CCIS-V5-033');
  assert.equal(d.length, 1);
  assert.equal(d[0].path, '/members/3/element');
  assert.ok(d[0].message.includes(evil));
});

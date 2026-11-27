// Row B3a: group owner and concept key (CCIS-V5-030 to 032). Synthetic data only. Not for clinical use.
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
const group = (std = '0.1.0') => ({
  manifest: { id: 'diabetes-ckd.group', name: 'Diabetes and CKD group', type: 'element-group', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: std }, status: 'draft' },
  intent: { purpose: 'p', setting: 's', population: 'q', exclusions: ['x'], rationale: 'r' },
  members: [
    { element: { id: DIA, type: 'contextual-element', version: '0.1.0' }, required: true },
    { element: { id: CKD, type: 'contextual-element', version: '0.1.0' }, required: false }
  ],
  sharedConcepts: [{ concept: 'diagnosisDates', meaning: 'Two different diagnosis dates that are kept apart.', fields: F, resolution: 'related-not-merged' }],
  versionPolicy: { conflict: 'refuse' },
  provenance: { origin: 'o', basis: 'b' }
});
const mutate = (fn, std) => { const g = group(std); fn(g); return g; };
const rows = (g, known = [dia, ckd]) => validateArtefact(g, { known }).diagnostics.filter((d) => /V5-03[012]$/.test(d.ruleId));
const same = (x) => { x.sharedConcepts[0].resolution = 'same-concept'; };

test('B3a: a same-concept entry whose owner is a listed field gives no V5-030 to 032 row', () => {
  assert.deepEqual(rows(mutate((x) => { same(x); x.sharedConcepts[0].owner = F[0]; })), []);
});

test('B3a: an owner that is not a listed field gives V5-030 at the owner path', () => {
  const a = rows(mutate((x) => { x.sharedConcepts[0].owner = { element: 'other.element', field: 'diagnosisDate' }; }));
  assert.deepEqual(a.map((d) => [d.ruleId, d.path]), [['CCIS-V5-030', '/sharedConcepts/0/owner']]);
  const b = rows(mutate((x) => { x.sharedConcepts[0].owner = { element: DIA, field: 'noSuchField' }; }));
  assert.deepEqual(b.map((d) => d.ruleId), ['CCIS-V5-030']);
});

test('B3a: a same-concept entry with no owner is a warning at 0.1.0 and an error at 0.2.0', () => {
  const w = rows(mutate(same, '0.1.0'));
  assert.deepEqual(w.map((d) => [d.ruleId, d.severity]), [['CCIS-V5-031', 'warning']]);
  const e = rows(mutate(same, '0.2.0'));
  assert.deepEqual(e.map((d) => [d.ruleId, d.severity]), [['CCIS-V5-031', 'error']]);
});

test('B3a: related-not-merged needs no owner, but a bad owner still gives V5-030', () => {
  assert.deepEqual(rows(group('0.2.0')), []);
  const r = rows(mutate((x) => { x.sharedConcepts[0].owner = { element: CKD, field: 'zzz' }; }, '0.2.0'));
  assert.deepEqual(r.map((d) => d.ruleId), ['CCIS-V5-030']);
});

test('B3a: concept key format (V5-032)', () => {
  for (const ok of ['bpSys', 'systolic-pressure']) {
    assert.deepEqual(rows(mutate((x) => { x.sharedConcepts[0].concept = ok; })), [], ok);
  }
  // keys the schema already refuses (leading capital or hyphen) never reach layer 5; these pass the schema only
  for (const bad of ['bad-Key', 'x_Y', `${'a'.repeat(32)}-${'a'.repeat(32)}`]) {
    const r = rows(mutate((x) => { x.sharedConcepts[0].concept = bad; }));
    assert.deepEqual(r.map((d) => d.ruleId), ['CCIS-V5-032'], bad);
  }
});

test('B3a: unresolved members still give the rows that need no resolution, without a crash', () => {
  const g = mutate((x) => { same(x); x.sharedConcepts[0].concept = 'bad-Key'; }, '0.2.0');
  const r = groupChecks(g, { resolve: () => ({ state: 'missing' }) }).filter((d) => /V5-03[012]$/.test(d.ruleId));
  assert.deepEqual(r.map((d) => d.ruleId).sort(), ['CCIS-V5-031', 'CCIS-V5-032']);
});

test('B3a: the existing diabetes-ckd group gives no new error row', () => {
  assert.deepEqual(rows(group()), []);
});

test('B3a: with two same-concept entries, only the one without an owner gives V5-031', () => {
  const g = mutate((x) => {
    same(x);
    x.sharedConcepts[0].owner = F[0];
    x.sharedConcepts.push({ concept: 'second', meaning: 'm', fields: [{ element: DIA, field: 'a' }, { element: CKD, field: 'b' }], resolution: 'same-concept' });
  });
  const r = groupChecks(g, { resolve: () => ({ state: 'missing' }) }).filter((d) => d.ruleId === 'CCIS-V5-031');
  assert.deepEqual(r.map((d) => d.path), ['/sharedConcepts/1']);
});

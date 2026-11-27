// Row ECO-B3: element-group owner per shared concept and local concept code (schema only). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { elementGroup } from '../ccis/validators/ccis-validators.js';
import { validateArtefact } from '../ccis-validator.js';

const base = () => ({
  manifest: { id: 'demo.group', name: 'Demo group', type: 'element-group', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.1.0' }, status: 'draft' },
  intent: { purpose: 'p', setting: 's', population: 'q', exclusions: ['x'], rationale: 'r' },
  members: [
    { element: { id: 'a.one', type: 'contextual-element', range: '>=0.1.0' }, required: true },
    { element: { id: 'b.two', type: 'contextual-element', version: '0.1.0' }, required: false },
  ],
  sharedConcepts: [{
    concept: 'systolic-pressure', meaning: 'The systolic value of one reading.',
    fields: [{ element: 'a.one', field: 'bpSys' }, { element: 'b.two', field: 'sbp' }],
    resolution: 'same-concept', owner: { element: 'a.one', field: 'bpSys' },
  }],
  versionPolicy: { conflict: 'refuse' },
  provenance: { origin: 'o', basis: 'b' },
});
const ok = (g) => elementGroup(g) === true;
const mutate = (fn) => { const g = base(); fn(g); return g; };
const sc = (g) => g.sharedConcepts[0];

test('1 a same-concept entry with owner validates', () => {
  assert.equal(ok(base()), true, JSON.stringify(elementGroup.errors));
});

test('2 owner missing element, then missing field, is refused', () => {
  assert.equal(ok(mutate((g) => { delete sc(g).owner.element; })), false);
  assert.equal(ok(mutate((g) => { delete sc(g).owner.field; })), false);
});

test('3 owner with an extra member is refused; an x- member is allowed', () => {
  assert.equal(ok(mutate((g) => { sc(g).owner.note = 'n'; })), false);
  assert.equal(ok(mutate((g) => { sc(g).owner['x-note'] = 'n'; })), true);
});

test('4 owner.element with uppercase or a space, and owner.field with a leading digit, are refused', () => {
  assert.equal(ok(mutate((g) => { sc(g).owner.element = 'A.One'; })), false);
  assert.equal(ok(mutate((g) => { sc(g).owner.element = 'a one'; })), false);
  assert.equal(ok(mutate((g) => { sc(g).owner.field = '1bp'; })), false);
});

test('5 concept takes a local code or a camelCase key; bad keys are refused', () => {
  assert.equal(ok(mutate((g) => { sc(g).concept = 'bpSys'; })), true);
  assert.equal(ok(mutate((g) => { sc(g).concept = 'Bad Key'; })), false);
  assert.equal(ok(mutate((g) => { sc(g).concept = '-x'; })), false);
});

test('6 a group with no owner still validates, and the diabetes-ckd example is unchanged', () => {
  assert.equal(ok(mutate((g) => { delete sc(g).owner; })), true);
  const ex = JSON.parse(readFileSync(new URL('../ccis/examples/diabetes-ckd/diabetes-ckd.group.json', import.meta.url), 'utf8'));
  assert.equal(ok(ex), true, JSON.stringify(elementGroup.errors));
});

test('7 validateArtefact on the example gives no schema error and no new row', () => {
  const ex = JSON.parse(readFileSync(new URL('../ccis/examples/diabetes-ckd/diabetes-ckd.group.json', import.meta.url), 'utf8'));
  const r = validateArtefact(ex, { known: [] });
  assert.deepEqual(r.diagnostics.filter((d) => d.ruleId.startsWith('CCIS-V2')), []);
  assert.deepEqual(r.diagnostics.filter((d) => /^CCIS-V5-0(3\d)$/.test(d.ruleId)), []);
});

test('8 generated validators equal a fresh build', () => {
  const r = spawnSync(process.execPath, ['scripts/build-validators.js', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

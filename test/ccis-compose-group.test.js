// Row ECO-B8: composeGroup of ccis-compose-group.js. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { composeGroup } from '../ccis-compose-group.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const snake = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8'));
const concept = (code) => ({ codeSystem: { id: 'local', version: '0.1.0' }, code, display: `Meaning of ${code}`, mapping: { status: 'mapped' } });
const f = (key, code, over = {}) => ({ key, label: `Label ${key}`, type: 'quantity', units: ['mmol/L'], cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'], concept: concept(code), ...over });
const el = (id, fields) => { const e = clone(snake); e.manifest.id = id; e.manifest.version = '0.1.0'; e.fields = fields; delete e.relationships; delete e.modules; delete e.tests; return e; };
const pw = (...ids) => ({ manifest: { id: 'demo.pathway', type: 'pathway', version: '0.1.0' }, elements: ids.map((id) => ({ id, type: 'contextual-element', range: '^0.1.0' })) });
const ownedBy = (e) => ({ ownedBy: { element: e, key: 'bpSys' } });
const A = el('core.vitals', [f('bpSys', 'systolic-pressure')]);
const B = el('htn.core', [f('sbp', 'systolic-pressure', ownedBy('core.vitals'))]);
const C = el('x.third', [f('other', 'other-thing')]);
const intent = { purpose: 'Demo composition.', setting: 'Any demo setting.', population: 'Synthetic people only.', exclusions: ['No treatment choice.'], rationale: 'Demonstration only.' };
const base = (over = {}) => ({
  manifest: { id: 'demo.group', name: 'Demo group', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standardVersion: '0.1.0' },
  intent, provenance: { origin: 'Synthetic demonstration.', basis: 'None. No clinical source.' },
  pathways: [pw('core.vitals', 'x.third'), pw('core.vitals', 'htn.core')], elements: [A, B, C], choices: {}, ...over,
});

test('1 clean case: two shared members, one shared concept, owner set, ready', () => {
  const r = composeGroup(base());
  assert.equal(r.ok, true);
  assert.equal(r.ready, true);
  assert.deepEqual(r.group.members.map((m) => m.element.id), ['core.vitals', 'x.third', 'htn.core']);
  assert.deepEqual(r.group.sharedConcepts, [{ concept: 'systolic-pressure', meaning: 'Meaning of systolic-pressure', fields: [{ element: 'core.vitals', field: 'bpSys' }, { element: 'htn.core', field: 'sbp' }], resolution: 'same-concept', owner: { element: 'core.vitals', field: 'bpSys' } }]);
});

test('2 the group validates with no error row', () => {
  const r = composeGroup(base());
  const v = validateArtefact(r.group, { known: [A, B, C] });
  assert.deepEqual(v.diagnostics.filter((d) => d.severity === 'error'), []);
});

test('3 byte determinism: reversed elements give identical canonical bytes', () => {
  const a = composeGroup(base());
  const b = composeGroup(base({ elements: [C, B, A] }));
  assert.equal(a.bytes, b.bytes);
  assert.equal(a.bytes, JSON.stringify(JSON.parse(a.bytes)).replace(/^/, ''));
  assert.ok(a.bytes.startsWith('{"intent":'));
});

test('4 required is true only for an element used by every pathway', () => {
  const r = composeGroup(base());
  assert.deepEqual(r.group.members.map((m) => [m.element.id, m.required]), [['core.vitals', true], ['x.third', false], ['htn.core', false]]);
});

test('5 second owner with a valid choice builds the group, lists the revision, is not ready', () => {
  const B2 = el('htn.core', [f('sbp', 'systolic-pressure')]);
  const r = composeGroup(base({ elements: [A, B2, C], choices: { 'systolic-pressure': { element: 'core.vitals', key: 'bpSys' } } }));
  assert.equal(r.ok, true);
  assert.equal(r.ready, false);
  assert.deepEqual(r.revisions, [{ element: 'htn.core', key: 'sbp', action: 'make-user-of', owner: { element: 'core.vitals', key: 'bpSys' } }]);
  assert.equal(composeGroup(base({ elements: [A, B2, C] })).blockers[0].status, 'second-owner');
});

test('6 an invalid choice is a bad-choice blocker and builds no group', () => {
  const B2 = el('htn.core', [f('sbp', 'systolic-pressure')]);
  const r = composeGroup(base({ elements: [A, B2, C], choices: { 'systolic-pressure': { element: 'x.third', key: 'other' } } }));
  assert.equal(r.ok, false);
  assert.equal(r.group, undefined);
  assert.ok(r.blockers.some((b) => b.status === 'bad-choice' && b.concept === 'systolic-pressure'));
});

test('7 unit-conflict and missing intent are blockers with no group', () => {
  const kpa = el('htn.core', [f('sbp', 'systolic-pressure', { ...ownedBy('core.vitals'), units: ['kPa'] })]);
  assert.deepEqual(composeGroup(base({ elements: [A, kpa, C] })).blockers.map((b) => b.status), ['unit-conflict']);
  const r = composeGroup(base({ intent: { ...intent, purpose: ' ' } }));
  assert.deepEqual([r.ok, r.blockers[0].status], [false, 'missing-text']);
});

test('8 possible duplicates stay out of the group; inputs are not mutated; an unused choice is a note', () => {
  const x = el('a.one', [f('glu', 'glucose-a', { label: 'Blood glucose' })]);
  const y = el('b.two', [f('glucose', 'glucose-b', { label: 'blood glucose' })]);
  const input = base({ pathways: [pw('a.one', 'b.two')], elements: [x, y], choices: { nothing: { element: 'a.one', key: 'glu' } } });
  const snap = clone(input);
  const r = composeGroup(input);
  assert.equal(r.ok, true);
  assert.deepEqual(r.group.sharedConcepts, []);
  assert.equal(r.notes.length, 1);
  assert.deepEqual(input, snap);
});

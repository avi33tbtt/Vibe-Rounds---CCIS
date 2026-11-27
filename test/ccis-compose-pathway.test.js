// Row ECO-B8a: composePathway of ccis-compose-pathway.js. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { composeGroup } from '../ccis-compose-group.js';
import { composePathway } from '../ccis-compose-pathway.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const snake = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8'));
const concept = (code) => ({ codeSystem: { id: 'local', version: '0.1.0' }, code, display: `Meaning of ${code}`, mapping: { status: 'mapped' } });
const f = (key, code, over = {}) => ({ key, label: `Label ${key}`, type: 'quantity', units: ['mmol/L'], cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'], concept: concept(code), ...over });
const el = (id, fields) => { const e = clone(snake); e.manifest.id = id; e.manifest.version = '0.1.0'; e.fields = fields; delete e.relationships; delete e.modules; delete e.tests; return e; };
const ownedBy = { ownedBy: { element: 'core.vitals', key: 'bpSys' } };
const A = el('core.vitals', [f('bpSys', 'systolic-pressure'), f('hr', 'heart-rate')]);
const B = el('htn.core', [f('sbp', 'systolic-pressure', ownedBy), f('htnNote', 'htn-note')]);
const ref = (id) => ({ id, type: 'contextual-element', range: '0.1.0' });
const form = (...secs) => ({ sections: secs });
const sec = (id, label, ...items) => ({ id, label, items });
const el1 = (element, extra = {}) => ({ kind: 'element', element, ...extra });
const mk = (id, elements, entryForm, contexts) => JSON.parse(JSON.stringify({ manifest: { id, name: id, type: 'pathway', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.1.0' }, status: 'draft' }, elements: elements.map(ref), entryForm, contexts }));
const P1 = mk('src.one', ['core.vitals'], form(sec('vitals', 'Vitals', el1('core.vitals', { rowGroups: [['bpSys', 'hr']] }), { kind: 'section', section: 'core.problems' })), [{ id: 'diabetes', label: 'Diabetes', elements: ['core.vitals'] }]);
const P2 = mk('src.two', ['core.vitals', 'htn.core'], form(sec('vitals', 'Vitals', el1('core.vitals', { rowGroups: [['bpSys', 'hr']] }), el1('htn.core', { rowGroups: [['sbp']] })), sec('extra', 'Extra', { kind: 'section', section: 'core.problems' })), [{ id: 'diabetes', label: 'Diabetes', elements: ['core.vitals', 'htn.core'] }]);
const intent = { purpose: 'Demo composition.', setting: 'Any demo setting.', population: 'Synthetic people only.', exclusions: ['No treatment choice.'], rationale: 'Demonstration only.' };
const groupOf = (pathways, elements) => composeGroup({ manifest: { id: 'demo.group', name: 'Demo group', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standardVersion: '0.1.0' }, intent, provenance: { origin: 'Synthetic demonstration.', basis: 'None.' }, pathways, elements, choices: {} }).group;
const base = (over = {}) => ({
  manifest: { id: 'demo.composed', name: 'Demo composed', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standardVersion: '0.1.0' },
  scope: 'Demo documentation.', intendedUse: 'Descriptive only.', exclusions: ['No treatment choice.'],
  stages: [{ id: 'documentation', label: 'Documentation', kind: 'report', entry: ['A case is open'], exit: ['The information is recorded'] }],
  group: groupOf([P1, P2], [A, B]), pathways: [P1, P2], elements: [A, B], ...over,
});

test('1 shared section id merges, a shared element is placed once, references are group then sources', () => {
  const r = composePathway(base());
  assert.equal(r.ok, true);
  assert.deepEqual(r.pathway.entryForm.sections.map((s) => [s.id, s.items.map((i) => i.element ?? i.section)]), [['vitals', ['core.vitals', 'core.problems', 'htn.core']]]);
  assert.deepEqual(r.pathway.manifest.references.map((x) => x.id), ['demo.group', 'src.one', 'src.two']);
  assert.deepEqual(r.pathway.elements.map((x) => x.id), ['core.vitals', 'htn.core']);
});

test('2 the user field shows once, at the owner: removed from fields and an emptied row group dropped', () => {
  const r = composePathway(base());
  const htn = r.pathway.entryForm.sections[0].items.find((i) => i.element === 'htn.core');
  assert.deepEqual(htn.fields, ['htnNote']);
  assert.equal(htn.rowGroups, undefined);
  assert.deepEqual(r.pathway.entryForm.sections[0].items[0].rowGroups, [['bpSys', 'hr']]);
});

test('3 the composed pathway validates with no error row', () => {
  const r = composePathway(base());
  const v = validateArtefact(r.pathway, { known: [base().group, P1, P2, A, B] });
  assert.deepEqual(v.diagnostics.filter((d) => d.severity === 'error'), []);
});

test('4 byte determinism: same input twice gives equal bytes with no newline', () => {
  const a = composePathway(base());
  const b = composePathway(base({ elements: [B, A] }));
  assert.equal(a.bytes, b.bytes);
  assert.ok(!a.bytes.includes('\n'));
});

test('5 contexts are united and deduplicated in first-seen order; a label conflict blocks', () => {
  assert.deepEqual(composePathway(base()).pathway.contexts, [{ id: 'diabetes', label: 'Diabetes', elements: ['core.vitals', 'htn.core'] }]);
  const bad = clone(P2); bad.contexts[0].label = 'Other label';
  const r = composePathway(base({ pathways: [P1, bad] }));
  assert.deepEqual([r.ok, r.blockers.map((b) => b.status)], [false, ['section-conflict']]);
});

test('6 a form section label conflict blocks; missing scope is missing-text', () => {
  const bad = clone(P2); bad.entryForm.sections[0].label = 'Other';
  assert.deepEqual(composePathway(base({ pathways: [P1, bad] })).blockers.map((b) => b.status), ['section-conflict']);
  assert.deepEqual(composePathway(base({ scope: '' })).blockers.map((b) => b.status), ['missing-text']);
});

test('7 a placement left with no field is no-field-left', () => {
  const B1 = el('htn.core', [f('sbp', 'systolic-pressure', ownedBy)]);
  const p2 = mk('src.two', ['core.vitals', 'htn.core'], form(sec('vitals', 'Vitals', el1('core.vitals'), el1('htn.core'))));
  const r = composePathway(base({ pathways: [P1, p2], elements: [A, B1], group: groupOf([P1, p2], [A, B1]) }));
  assert.deepEqual(r.blockers.map((b) => b.status), ['no-field-left']);
});

test('8 a later differing placement is dropped and noted; inputs are not mutated', () => {
  const p2 = mk('src.two', ['core.vitals'], form(sec('vitals', 'Vitals', el1('core.vitals', { fields: ['hr'] }))));
  const input = base({ pathways: [P1, p2] });
  const snap = clone(input);
  const r = composePathway(input);
  assert.equal(r.ok, true);
  assert.equal(r.notes.length, 1);
  assert.deepEqual(r.pathway.entryForm.sections[0].items[0].rowGroups, [['bpSys', 'hr']]);
  assert.deepEqual(input, snap);
});

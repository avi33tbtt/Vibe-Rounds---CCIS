// Row ECO-B1e: layer 5 owner checks (CCIS-V5-014 to 016). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';

const snake = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const CONCEPT = { codeSystem: { id: 'local', version: '0.1.0' }, code: 'demo-concept', display: 'Demo concept', mapping: { status: 'mapped' } };
const f = (over = {}) => ({ key: 'amount', label: 'Demo amount', type: 'quantity', units: ['mmol/L'], cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'], concept: CONCEPT, ...over });
const el = (id, fields, extra = {}) => {
  const e = clone(snake);
  e.manifest.id = id; e.fields = fields; delete e.relationships; delete e.modules; delete e.tests;
  return Object.assign(e, extra);
};
const owner = (over) => el('demo.owner', [f({ key: 'ownerKey', cardinality: { min: 0, max: 3 }, ...over })]);
const user = (over = {}, extra) => el('demo.user', [f({ ownedBy: { element: 'demo.owner', key: 'ownerKey' }, ...over })], extra);
const run = (u, known = [owner()]) => validateArtefact(u, { known });
const rows = (r) => r.diagnostics.filter((d) => d.ruleId.startsWith('CCIS-V5-01') && d.ruleId > 'CCIS-V5-013').map((d) => d.ruleId);

test('1 a matching owner and user give no owner row', () => {
  const r = run(user());
  assert.deepEqual(rows(r), []);
  assert.equal(r.outcome, 'no-errors-so-far');
});

test('2 an owner that is not among the known artefacts is skipped by layer 5', () => {
  const r = run(user(), []);
  assert.deepEqual(rows(r), []);
});

test('3 an owner field that does not exist is CCIS-V5-014', () => {
  assert.deepEqual(rows(run(user({ ownedBy: { element: 'demo.owner', key: 'noSuchKey' } }))), ['CCIS-V5-014']);
});

test('4 an owner field with no concept, or a different concept, is CCIS-V5-014', () => {
  const none = owner(); delete none.fields[0].concept;
  assert.deepEqual(rows(run(user(), [none])), ['CCIS-V5-014']);
  assert.deepEqual(rows(run(user(), [owner({ concept: { ...CONCEPT, code: 'other-concept' } })])), ['CCIS-V5-014']);
});

test('5 self-ownership is CCIS-V5-014', () => {
  assert.deepEqual(rows(run(user({ ownedBy: { element: 'demo.user', key: 'amount' } }))), ['CCIS-V5-014']);
});

test('6 type or units differing is CCIS-V5-015; the same units in another order pass', () => {
  assert.deepEqual(rows(run(user(), [owner({ type: 'integer' })])), ['CCIS-V5-015']);
  assert.deepEqual(rows(run(user(), [owner({ units: ['g/L'] })])), ['CCIS-V5-015']);
  assert.deepEqual(rows(run(user({ units: ['mmol/L', 'g/L'] }), [owner({ units: ['g/L', 'mmol/L'] })])), []);
});

test('7 a wider cardinality is a warning only', () => {
  const r = run(user({ cardinality: { min: 0, max: 'unbounded' } }));
  assert.deepEqual(rows(r), ['CCIS-V5-016']);
  assert.equal(r.diagnostics.find((d) => d.ruleId === 'CCIS-V5-016').severity, 'warning');
  assert.equal(r.outcome, 'no-errors-so-far');
});

test('8 a module field is checked with its module path; the snake element is unchanged', () => {
  const u = el('demo.user', [f({ key: 'other', concept: { ...CONCEPT, code: 'x' } })], { modules: [{ id: 'mod', appliesWhen: 'Always.', fields: [f({ ownedBy: { element: 'demo.owner', key: 'noSuchKey' } })] }] });
  const d = run(u).diagnostics.find((x) => x.ruleId === 'CCIS-V5-014');
  assert.equal(d.path, '/modules/0/fields/0/ownedBy');
  assert.deepEqual(rows(validateArtefact(snake, { known: [] })), []);
});

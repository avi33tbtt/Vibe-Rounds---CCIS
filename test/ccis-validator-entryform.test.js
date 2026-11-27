// Row ECO-B6: pathway entryForm validator rules (CCIS-V5-036 to 043). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { entryFormChecks } from '../ccis-validator-entryform.js';

const read = (f) => JSON.parse(readFileSync(new URL(`../ccis/examples/snake/${f}`, import.meta.url), 'utf8'));
const snakeEl = read('snake-envenomation.element.json');
const E1 = 'snake.envenomation-timing';
const E2 = 'other.element';
const other = { fields: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] };
const ctx = { resolve: (ref) => (ref.id === E1 ? { state: 'ok', doc: snakeEl } : ref.id === E2 ? { state: 'ok', doc: other } : { state: 'missing' }) };
const lost = { resolve: () => ({ state: 'missing' }) };
const ref = (id) => ({ id, type: 'contextual-element', range: '^0.1.0' });
const doc = () => ({
  elements: [ref(E1), ref(E2)],
  entryForm: { sections: [
    { id: 'history', label: 'History', items: [{ kind: 'element', element: E1, fields: ['biteTime', 'arrivalTime'], rowGroups: [['biteTime', 'arrivalTime']] }, { kind: 'section', section: 'core.problems' }] },
    { id: 'other', label: 'Other', items: [{ kind: 'element', element: E2 }] },
  ] },
});
const mutate = (fn) => { const d = doc(); fn(d); return d; };
const rows = (d, c = ctx) => entryFormChecks(d, c).map((x) => [x.ruleId, x.path]);
const first = (d) => d.entryForm.sections[0].items[0];

test('1 a valid form gives no row; no entryForm gives none; the pipeline path gives none', () => {
  assert.deepEqual(rows(doc()), []);
  assert.deepEqual(rows(mutate((d) => { delete d.entryForm; })), []);
  const snake = read('snake-documentation.pathway.json');
  snake.entryForm = { sections: [{ id: 'main', label: 'Main', items: [{ kind: 'element', element: E1 }] }] };
  const r = validateArtefact(snake, { known: [snakeEl] });
  assert.deepEqual(r.diagnostics.filter((d) => /V5-0(3[6-9]|4[0-3])$/.test(d.ruleId)), []);
});

test('2 V5-036 for an element not in elements, V5-037 for an element left out', () => {
  assert.deepEqual(rows(mutate((d) => { first(d).element = 'nobody.here'; })).map((r) => r[0]).sort(), ['CCIS-V5-036', 'CCIS-V5-037']);
  const left = rows(mutate((d) => { d.entryForm.sections[1].items = [{ kind: 'section', section: 'core.allergies' }]; }));
  assert.deepEqual(left, [['CCIS-V5-037', '/elements/1']]);
});

test('3 V5-038 for an unknown field, V5-040 for a row group field outside fields', () => {
  assert.deepEqual(rows(mutate((d) => { first(d).fields = ['biteTime', 'noSuchField']; first(d).rowGroups = [['biteTime']]; })), [['CCIS-V5-038', '/entryForm/sections/0/items/0/fields/1']]);
  assert.deepEqual(rows(mutate((d) => { first(d).rowGroups = [['biteTime', 'clottingResult']]; })), [['CCIS-V5-040', '/entryForm/sections/0/items/0/rowGroups/0/1']]);
});

test('4 V5-039 for a repeat in fields, across row groups, and across two placements', () => {
  assert.deepEqual(rows(mutate((d) => { first(d).fields = ['biteTime', 'biteTime']; first(d).rowGroups = [['biteTime']]; })), [['CCIS-V5-039', '/entryForm/sections/0/items/0/fields/1']]);
  assert.deepEqual(rows(mutate((d) => { first(d).rowGroups = [['biteTime'], ['biteTime']]; })), [['CCIS-V5-039', '/entryForm/sections/0/items/0/rowGroups/1/0']]);
  const two = rows(mutate((d) => { d.entryForm.sections[1].items.push({ kind: 'element', element: E2, fields: ['a'] }); }));
  assert.deepEqual(two, [['CCIS-V5-039', '/entryForm/sections/1/items/1/fields/0']]);
  const disjoint = mutate((d) => { d.entryForm.sections[1].items = [{ kind: 'element', element: E2, fields: ['a'] }, { kind: 'element', element: E2, fields: ['b'] }]; });
  assert.deepEqual(rows(disjoint), []);
});

test('5 V5-041 for an unknown section name', () => {
  assert.deepEqual(rows(mutate((d) => { d.entryForm.sections[0].items[1].section = 'core.problem'; })), [['CCIS-V5-041', '/entryForm/sections/0/items/1/section']]);
});

test('6 V5-042 for a duplicate section id, at the second index', () => {
  assert.deepEqual(rows(mutate((d) => { d.entryForm.sections[1].id = 'history'; })), [['CCIS-V5-042', '/entryForm/sections/1/id']]);
});

test('7 V5-043 is a warning, not an error', () => {
  const d = mutate((x) => { x.entryForm.sections[0].items[1].section = 'core.care-episode'; });
  const r = entryFormChecks(d, ctx);
  assert.deepEqual(r.map((x) => [x.ruleId, x.severity]), [['CCIS-V5-043', 'warning']]);
});

test('8 unresolved elements: no crash, no guessed field rows; hostile ids stay inside message text', () => {
  const evil = '<img src=x onerror=alert(1)>"\'';
  const d = mutate((x) => { first(x).element = evil; x.entryForm.sections[0].items[1].section = 'bad.name'; });
  const r = entryFormChecks(d, lost);
  assert.deepEqual(r.map((x) => x.ruleId).sort(), ['CCIS-V5-036', 'CCIS-V5-037', 'CCIS-V5-041']);
  assert.ok(r.find((x) => x.ruleId === 'CCIS-V5-036').message.includes(evil));
  assert.equal(rows(doc(), lost).filter((x) => /V5-038/.test(x[0])).length, 0);
});

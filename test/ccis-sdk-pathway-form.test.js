// Row ECO-B16a: the pathway builder's entryForm and contexts, proved equivalent to the file route. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathway } from '../ccis-sdk-pathway.js';
import { SdkError } from '../ccis-sdk.js';
import { compareRoutes } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const EL = { id: 'demo.element', type: 'contextual-element', range: '^0.1.0' };
const BASE = {
  manifest: { id: 'demo.path', name: 'Demo path', type: 'pathway', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.1.0' }, status: 'draft' },
  scope: 'Demonstration.', intendedUse: 'Descriptive only.', exclusions: [], elements: [EL],
  stages: [{ id: 'first', label: 'First', kind: 'information', entry: ['It starts.'], exit: ['It ends.'] }],
};
const FORM = { sections: [{ id: 'vitals', label: 'Vitals', items: [{ kind: 'element', element: 'demo.element', fields: ['a', 'b'], rowGroups: [['a', 'b']], visibleByDefault: true }, { kind: 'section', section: 'core.problems', visibleByDefault: false }] }] };
const CTX = [{ id: 'demo-condition', label: 'Demo condition', elements: ['demo.element'] }];
const FULL = { ...BASE, entryForm: FORM, contexts: CTX };
const refused = (fn, code, path) => {
  try { fn(); } catch (e) { assert.ok(e instanceof SdkError); if (code) assert.equal(e.code, code); if (path !== undefined) assert.equal(e.path, path); return e; }
  assert.fail('not refused');
};
const verdict = (doc) => Object.entries(validateArtefact(doc).layers).map(([k, v]) => [k, v.outcome, v.diagnostics.map((d) => d.ruleId)]);
const withForm = (f) => ({ ...BASE, entryForm: f });

test('B16a: a pathway with entryForm and contexts equals the hand-written object, frozen, input unchanged', () => {
  const before = JSON.stringify(FULL);
  const p = pathway(FULL);
  assert.deepEqual(p, FULL);
  assert.equal(JSON.stringify(FULL), before);
  assert.ok(Object.isFrozen(p.entryForm) && Object.isFrozen(p.entryForm.sections[0].items[0]) && Object.isFrozen(p.entryForm.sections[0].items[0].rowGroups[0]) && Object.isFrozen(p.contexts[0].elements));
});

test('B16a: identical on both routes and the same verdict per layer; both members stay optional', () => {
  const r = compareRoutes([{ name: 'json', input: JSON.stringify(FULL) }, { name: 'code', input: pathway(FULL) }]);
  assert.equal(r.identical, true);
  assert.deepEqual(verdict(pathway(FULL)), verdict(FULL));
  const snake = readFileSync(new URL('../ccis/examples/snake/snake-documentation.pathway.json', import.meta.url), 'utf8');
  assert.equal(compareRoutes([{ name: 'json', input: snake }, { name: 'code', input: pathway(JSON.parse(snake)) }]).identical, true);
  assert.equal('entryForm' in pathway(BASE) || 'contexts' in pathway(BASE), false);
});

test('B16a: missing members are S-002; empty lists are S-003', () => {
  refused(() => pathway(withForm({})), 'S-002', 'entryForm.sections');
  refused(() => pathway(withForm({ sections: [{ id: 'a', items: FORM.sections[0].items }] })), 'S-002', 'entryForm.sections.0.label');
  refused(() => pathway(withForm({ sections: [{ id: 'a', label: 'A' }] })), 'S-002', 'entryForm.sections.0.items');
  refused(() => pathway({ ...BASE, contexts: [{ id: 'c', label: 'C' }] }), 'S-002', 'contexts.0.elements');
  refused(() => pathway(withForm({ sections: [] })), 'S-003', 'entryForm.sections');
  refused(() => pathway(withForm({ sections: [{ id: 'a', label: 'A', items: [] }] })), 'S-003', 'entryForm.sections.0.items');
  refused(() => pathway({ ...BASE, contexts: [{ ...CTX[0], elements: [] }] }), 'S-003', 'contexts.0.elements');
  refused(() => pathway({ ...BASE, contexts: [] }), 'S-003', 'contexts');
});

test('B16a: item kind is required and decides which members are allowed', () => {
  const at = (item) => withForm({ sections: [{ id: 'a', label: 'A', items: [item] }] });
  refused(() => pathway(at({ element: 'demo.element' })), 'S-002', 'entryForm.sections.0.items.0.kind');
  refused(() => pathway(at({ kind: 'table', element: 'demo.element' })), 'S-003', 'entryForm.sections.0.items.0.kind');
  refused(() => pathway(at({ kind: 'element', element: 'demo.element', section: 'core.problems' })), 'S-001', 'entryForm.sections.0.items.0.section');
  refused(() => pathway(at({ kind: 'section', section: 'core.problems', element: 'demo.element' })), 'S-001', 'entryForm.sections.0.items.0.element');
  refused(() => pathway(at({ kind: 'element' })), 'S-002', 'entryForm.sections.0.items.0.element');
});

test('B16a: fields and row groups need at least one valid key', () => {
  const at = (extra) => withForm({ sections: [{ id: 'a', label: 'A', items: [{ kind: 'element', element: 'demo.element', ...extra }] }] });
  refused(() => pathway(at({ fields: [] })), 'S-003', 'entryForm.sections.0.items.0.fields');
  refused(() => pathway(at({ rowGroups: [] })), 'S-003', 'entryForm.sections.0.items.0.rowGroups');
  refused(() => pathway(at({ rowGroups: [[]] })), 'S-003', 'entryForm.sections.0.items.0.rowGroups.0');
  refused(() => pathway(at({ rowGroups: [['a', 'Bad Key']] })), 'S-003', 'entryForm.sections.0.items.0.rowGroups.0.1');
});

test('B16a: flags, ids and section names are checked', () => {
  const sec = (over) => withForm({ sections: [{ id: 'a', label: 'A', items: [{ kind: 'section', section: 'core.problems', ...over }] }] });
  refused(() => pathway(sec({ visibleByDefault: 'yes' })), 'S-003', 'entryForm.sections.0.items.0.visibleByDefault');
  refused(() => pathway(sec({ section: 'core problems' })), 'S-003', 'entryForm.sections.0.items.0.section');
  refused(() => pathway(withForm({ sections: [{ id: 'Vitals', label: 'V', items: FORM.sections[0].items }] })), 'S-003', 'entryForm.sections.0.id');
  refused(() => pathway({ ...BASE, contexts: [{ ...CTX[0], id: 'Bad Id' }] }), 'S-003', 'contexts.0.id');
});

test('B16a: x- members pass through and an unknown member is refused', () => {
  const f = { sections: [{ id: 'a', label: 'A', 'x-s': 1, items: [{ kind: 'section', section: 'core.problems', 'x-i': { k: 1 } }] }] };
  const p = pathway({ ...BASE, entryForm: f, contexts: [{ ...CTX[0], 'x-c': true }] });
  assert.equal(p.entryForm.sections[0]['x-s'], 1);
  assert.deepEqual(p.entryForm.sections[0].items[0]['x-i'], { k: 1 });
  assert.equal(p.contexts[0]['x-c'], true);
  refused(() => pathway({ ...BASE, contexts: [{ ...CTX[0], note: 'x' }] }), 'S-001', 'contexts.0.note');
});

test('B16a: known section names and element membership stay with the validator', () => {
  const odd = withForm({ sections: [{ id: 'a', label: 'A', items: [{ kind: 'section', section: 'made.up' }, { kind: 'element', element: 'not.in.pathway' }] }] });
  assert.equal(pathway(odd).entryForm.sections[0].items.length, 2);
});

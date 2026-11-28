// Row ECO-B15b: the market publishes element groups; the cohort-name screen has one narrow exception. Synthetic data only. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyMarket, publishArtefact, loadMarket, indexText, lintArtefact, PUBLISHABLE_TYPES } from '../ccis-market.js';

const snake = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const concept = (code) => ({ codeSystem: { id: 'local', version: '0.1.0' }, code, display: 'Demo concept', mapping: { status: 'mapped' } });
const f = (key, code, over = {}) => ({ key, label: `Demo ${key}`, type: 'quantity', units: ['mmol/L'], cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'], concept: concept(code), ...over });
const el = (id, fields, version = '0.1.0') => {
  const e = clone(snake);
  e.manifest.id = id; e.manifest.version = version; e.manifest.standard.version = '0.2.0'; delete e.manifest.references;
  e.fields = fields; delete e.relationships; delete e.modules; delete e.tests;
  return e;
};
const pathway = () => {
  const p = clone(JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-documentation.pathway.json', import.meta.url), 'utf8')));
  p.manifest.id = 'demo.pathway'; p.manifest.standard.version = '0.2.0';
  p.manifest.references = [{ id: 'own.one', type: 'contextual-element', version: '0.1.0' }];
  p.elements = [{ id: 'own.one', type: 'contextual-element', range: '>=0.1.0' }];
  p.analytics = []; p.stages = [{ id: 'only', label: 'Only stage', kind: 'report', entry: ['Synthetic entry.'], exit: ['Synthetic exit.'], needs: ['crea'] }]; p.nodes = []; p.transitions = []; delete p.timing;
  return p;
};
const tc = (id, expect) => ({ id, rule: 'dqOne', fixture: `synthetic-${id}`, synthetic: true, enables: [], expect });
const pack = () => ({
  manifest: { id: 'demo.data-quality', name: 'Demo data quality', type: 'rule-pack', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft', references: [{ id: 'own.one', type: 'contextual-element', version: '0.1.0' }] },
  class: 'data-quality',
  scope: { pathways: [{ id: 'demo.pathway', type: 'pathway', range: '>=0.1.0' }] },
  inputs: [{ id: 'crea', concept: 'creatinine', element: 'own.one', read: 'latest' }],
  parameters: [],
  rules: [{ id: 'dqOne', kind: 'stale', severity: 'info', when: { op: 'is-present', args: [{ ref: 'input', id: 'crea' }] }, message: { template: 'Information gap.' } }],
  tests: [tc('a', 'fires'), tc('b', 'does-not-fire'), tc('c', 'not-evaluated')],
  provenance: { origin: 'Synthetic', basis: 'Synthetic' },
  sourceNote: 'Synthetic note.',
});
const pub = (market, artefact) => publishArtefact({ market, artefact });
const must = (r) => { assert.equal(r.ok, true, JSON.stringify(r.refusal)); return r.market; };
const A = () => el('a.one', [f('crea', 'creatinine')]);
const B = () => el('b.two', [f('glu', 'glucose')]);
const base = () => must(pub(must(pub(emptyMarket(), A())), B()));
const group = () => ({
  manifest: { id: 'demo.group', name: 'Demo group', type: 'element-group', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft', references: [{ id: 'a.one', type: 'contextual-element', version: '0.1.0' }, { id: 'b.two', type: 'contextual-element', version: '0.1.0' }] },
  intent: { purpose: 'p', setting: 's', population: 'q', exclusions: ['x'], rationale: 'r' },
  members: [{ element: { id: 'a.one', type: 'contextual-element', range: '>=0.1.0' }, required: true }, { element: { id: 'b.two', type: 'contextual-element', version: '0.1.0' }, required: false }],
  sharedConcepts: [{ concept: 'creatinine', meaning: 'Demo meaning.', fields: [{ element: 'a.one', field: 'crea' }, { element: 'b.two', field: 'glu' }], resolution: 'related-not-merged' }],
  versionPolicy: { conflict: 'refuse' }, provenance: { origin: 'o', basis: 'b' },
});
const found = (a) => lintArtefact(a).findings.map((x) => `${x.id} ${x.path}`);

test('1 a group publishes once its members are held; the entry has the type, its references and empty concept lists', () => {
  assert.ok(PUBLISHABLE_TYPES.includes('element-group'));
  const r = pub(base(), group());
  assert.equal(r.ok, true, JSON.stringify(r.refusal));
  assert.equal(r.entry.type, 'element-group');
  assert.deepEqual(r.entry.references.map((x) => x.id), ['a.one', 'b.two']);
  assert.deepEqual([r.entry.provides, r.entry.requires], [[], []]);
});

test('2 the same bytes again are unchanged; changed bytes with the same version are M-006', () => {
  const m = must(pub(base(), group()));
  assert.equal(pub(m, group()).unchanged, true);
  const changed = group(); changed.intent.rationale = 'another';
  assert.equal(pub(m, changed).refusal.id, 'M-006');
});

test('3 members that are strings, or items of another shape, are still L-002 at /members', () => {
  const strings = group(); strings.members = ['x', 'y'];
  assert.deepEqual(found(strings), ['L-002 /members']);
  assert.equal(pub(base(), strings).refusal.id, 'M-004');
  const other = group(); other.members[0] = { element: other.members[0].element, name: 'x' };
  assert.deepEqual(found(other), ['L-002 /members']);
  const flag = group(); flag.members[0].required = 'yes';
  assert.deepEqual(found(flag), ['L-002 /members']);
});

test('4 the exception does not hide what is inside: a digit run or a record name in an item is still found', () => {
  const digits = group(); digits.members[0]['x-note'] = 'ref 12345678901';
  assert.deepEqual(found(digits), ['L-006 /members/0/x-note']);
  const rec = group(); rec.members[1]['x-a'] = { mrn: 'synthetic' };
  assert.deepEqual(found(rec), ['L-001 /members/1/x-a/mrn']);
});

test('5 cohort, membership and memberIds at the group root are still L-002', () => {
  for (const name of ['cohort', 'membership', 'memberIds']) { const g = group(); g[name] = []; assert.deepEqual(found(g), [`L-002 /${name}`], name); }
});

test('6 members on an element, nested (even a whole group), or on a group of another type is still L-002', () => {
  const e = A(); e.members = [];
  assert.deepEqual(found(e), ['L-002 /members']);
  const nested = group(); nested['x-a'] = { members: [] };
  assert.deepEqual(found(nested), ['L-002 /x-a/members']);
  const inner = group(); const outer = A(); outer['x-a'] = inner;
  assert.deepEqual(found(outer), ['L-002 /x-a/members']);
  const wrong = group(); wrong.manifest.type = 'pathway';
  assert.deepEqual(found(wrong), ['L-002 /members']);
});

test('7 a group whose member is not held is refused M-005 and nothing is added', () => {
  const m = must(pub(emptyMarket(), A()));
  const r = pub(m, group());
  assert.equal(r.refusal.id, 'M-005');
  assert.deepEqual(m.index.entries.map((e) => e.id), ['a.one']);
});

test('8 a market with a group round-trips through indexText and loadMarket', () => {
  const m = must(pub(base(), group()));
  const loaded = loadMarket({ indexText: indexText(m), files: { ...m.files } });
  assert.equal(loaded.ok, true, JSON.stringify(loaded.refusal));
  assert.deepEqual(loaded.market.index.entries.map((e) => e.type).sort(), ['contextual-element', 'contextual-element', 'element-group']);
});

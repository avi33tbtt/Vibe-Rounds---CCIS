// Row ECO-B15a: market entries carry provides and requires; providersOf and requirersOf. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyMarket, publishArtefact, loadMarket, indexText, providersOf, requirersOf, conceptsOf } from '../ccis-market.js';

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
const OWNER = (version = '0.1.0') => el('own.one', [f('crea', 'creatinine'), f('glu', 'glucose')], version);
const USER = () => el('user.two', [f('useCrea', 'creatinine', { ownedBy: { element: 'own.one', key: 'crea' } })]);
const build = () => must(pub(must(pub(must(pub(must(pub(emptyMarket(), OWNER())), USER())), pathway())), pack()));
const entryOf = (m, id) => m.index.entries.find((e) => e.id === id);
const files = (m) => ({ indexText: indexText(m), files: { ...m.files } });

test('1 an element lists what it owns and what it only uses', () => {
  assert.deepEqual(conceptsOf(OWNER()), { provides: ['creatinine', 'glucose'], requires: [] });
  assert.deepEqual(conceptsOf(USER()), { provides: [], requires: ['creatinine'] });
  const m = build();
  assert.deepEqual(entryOf(m, 'own.one').provides, ['creatinine', 'glucose']);
  assert.deepEqual(entryOf(m, 'user.two').requires, ['creatinine']);
});

test('2 a rule pack requires its input concepts; a pathway has two empty lists', () => {
  const m = build();
  assert.deepEqual([entryOf(m, 'demo.data-quality').provides, entryOf(m, 'demo.data-quality').requires], [[], ['creatinine']]);
  assert.deepEqual([entryOf(m, 'demo.pathway').provides, entryOf(m, 'demo.pathway').requires], [[], []]);
});

test('3 providersOf finds the owner only; requirersOf finds the user and the rule pack; a new version is listed once', () => {
  const m = must(pub(build(), OWNER('0.2.0')));
  assert.deepEqual(providersOf({ market: m, concept: 'creatinine' }).entries, [{ id: 'own.one', type: 'contextual-element', version: '0.2.0' }]);
  assert.deepEqual(requirersOf({ market: m, concept: 'creatinine' }).entries.map((e) => e.id), ['demo.data-quality', 'user.two']);
});

test('4 an unknown, empty or non-string concept gives an empty list; a bad market gives M-001', () => {
  const m = build();
  for (const c of ['nothing', '', undefined, 5, null]) assert.deepEqual(providersOf({ market: m, concept: c }), { ok: true, entries: [] });
  assert.equal(requirersOf({ market: 'x', concept: 'creatinine' }).refusal.id, 'M-001');
  assert.equal(providersOf().refusal.id, 'M-001');
});

test('5 a market round-trips with 14-member entries', () => {
  const m = build();
  const loaded = loadMarket(files(m));
  assert.equal(loaded.ok, true, JSON.stringify(loaded.refusal));
  assert.equal(Object.keys(loaded.market.index.entries[0]).length, 14);
  assert.deepEqual(providersOf({ market: loaded.market, concept: 'glucose' }).entries.map((e) => e.id), ['own.one']);
});

test('6 an older 12-member index still loads; both lookups skip its entries', () => {
  const m = build();
  const old = { format: m.index.format, entries: m.index.entries.map((e) => { const { provides, requires, ...rest } = e; return rest; }) };
  const loaded = loadMarket({ indexText: JSON.stringify(old), files: { ...m.files } });
  assert.equal(loaded.ok, true, JSON.stringify(loaded.refusal));
  assert.deepEqual(providersOf({ market: loaded.market, concept: 'creatinine' }).entries, []);
  assert.deepEqual(requirersOf({ market: loaded.market, concept: 'creatinine' }).entries, []);
});

test('7 an edited list is M-010; only one of the two members is M-001', () => {
  const m = build();
  const edit = (fn) => { const idx = clone(m.index); fn(idx.entries.find((e) => e.id === 'own.one')); return { indexText: JSON.stringify(idx), files: { ...m.files } }; };
  assert.equal(loadMarket(edit((e) => { e.provides = ['glucose']; })).refusal.id, 'M-010');
  assert.equal(loadMarket(edit((e) => { delete e.requires; })).refusal.id, 'M-001');
  assert.equal(loadMarket(edit((e) => { e.provides = [5]; })).refusal.id, 'M-001');
});

test('8 the real market folder loads with the new members', () => {
  const dir = new URL('../market/', import.meta.url);
  const idx = readFileSync(new URL('index.json', dir), 'utf8');
  const fs = {};
  for (const e of JSON.parse(idx).entries) fs[e.path] = readFileSync(new URL(e.path, dir), 'utf8');
  const r = loadMarket({ indexText: idx, files: fs });
  assert.equal(r.ok, true, JSON.stringify(r.refusal));
  assert.ok(r.market.index.entries.every((e) => Array.isArray(e.provides) && Array.isArray(e.requires)));
});

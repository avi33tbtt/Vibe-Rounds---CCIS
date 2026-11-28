// Row ECO-B15: the market publishes rule packs and refuses a second owner of a concept (M-014). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyMarket, publishArtefact, loadMarket, indexText, M_REFUSALS, PUBLISHABLE_TYPES } from '../ccis-market.js';

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
const OWNER = () => el('own.one', [f('crea', 'creatinine')]);
const base = () => must(pub(emptyMarket(), OWNER()));

test('1 a rule pack publishes once its scope pathway is held; the entry has the type and its references', () => {
  assert.ok(PUBLISHABLE_TYPES.includes('rule-pack'));
  const withPath = must(pub(base(), pathway()));
  const r = pub(withPath, pack());
  assert.equal(r.ok, true, JSON.stringify(r.refusal));
  assert.equal(r.entry.type, 'rule-pack');
  assert.deepEqual(r.entry.references, [{ id: 'own.one', type: 'contextual-element', version: '0.1.0' }]);
});

test('2 a rule pack whose scope pathway is not held is refused M-005 and nothing is added', () => {
  const m = base();
  const r = pub(m, pack());
  assert.equal(r.ok, false);
  assert.equal(r.refusal.id, 'M-005');
  assert.deepEqual(m.index.entries.map((e) => e.id), ['own.one']);
});

test('3 the same bytes again are unchanged; changed bytes with the same version are M-006', () => {
  const m = must(pub(base(), pathway()));
  const first = must(pub(m, pack()));
  const again = pub(first, pack());
  assert.equal(again.ok, true);
  assert.equal(again.unchanged, true);
  const changed = pack(); changed.sourceNote = 'Another synthetic note.';
  assert.equal(pub(first, changed).refusal.id, 'M-006');
});

test('4 a second element that owns a concept is refused M-014 with ids and codes; the market is unchanged', () => {
  const m = base();
  const before = JSON.stringify(m);
  const r = pub(m, el('other.two', [f('serumCrea', 'creatinine')]));
  assert.equal(r.ok, false);
  assert.equal(r.refusal.id, 'M-014');
  assert.equal(r.refusal.reason, M_REFUSALS.find((x) => x.id === 'M-014').sentence);
  assert.deepEqual(r.refusal.detail, { concepts: ['creatinine'], elements: ['other.two', 'own.one'] });
  assert.equal(JSON.stringify(m), before);
});

test('5 a new version of the owner publishes, and a field that names its owner is not a second owner', () => {
  const m = must(pub(base(), el('own.one', [f('crea', 'creatinine')], '0.2.0')));
  const user = el('user.three', [f('useCrea', 'creatinine', { ownedBy: { element: 'own.one', key: 'crea' } })]);
  const r = pub(m, user);
  assert.equal(r.ok, true, JSON.stringify(r.refusal));
  assert.equal(r.market.index.entries.filter((e) => e.id === 'own.one').length, 2);
});

test('6 a type that is still not publishable keeps M-002, with the new sentence', () => {
  const r = pub(emptyMarket(), { ...OWNER(), manifest: { ...OWNER().manifest, type: 'terminology-package' } });
  assert.equal(r.ok, false);
  assert.equal(r.refusal.id, 'M-002');
  assert.match(r.refusal.reason, /pathways and rule packs can\.$/);
});

test('7 a market with a rule pack round-trips through indexText and loadMarket', () => {
  const m = must(pub(must(pub(base(), pathway())), pack()));
  const loaded = loadMarket({ indexText: indexText(m), files: m.files });
  assert.equal(loaded.ok, true, JSON.stringify(loaded.refusal));
  assert.deepEqual(loaded.market.index.entries.map((e) => e.type).sort(), ['contextual-element', 'pathway', 'rule-pack']);
});

test('8 the M-014 detail holds ids and concept codes only, never a label', () => {
  const hostile = 'HOSTILE <b>label</b> 9f3c';
  const other = el('other.two', [f('serumCrea', 'creatinine', { label: hostile })]);
  const r = pub(base(), other);
  assert.equal(r.refusal.id, 'M-014');
  assert.equal(JSON.stringify(r).includes('HOSTILE'), false);
  assert.deepEqual(Object.keys(r.refusal.detail).sort(), ['concepts', 'elements']);
});

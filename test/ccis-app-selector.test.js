import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectorModel, selectOption, selectionView } from '../ccis-app-selector.js';

const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
const market = { index: idx, files: {} };
const CTX = 'snake.envenomation-timing@0.1.0';
const PATH = 'snake.documentation-path@0.1.0';
const entry = (type, id, version, status = 'draft', references = []) => ({ type, id, version, status, references });
const small = (entries) => ({ index: { format: 'ccis-market/1', entries }, files: {} });

test('no market gives empty lists; the committed market lists its contexts and pathways', () => {
  assert.deepEqual(selectorModel({ market: null }), { contexts: [], pathways: [] });
  assert.deepEqual(selectorModel(), { contexts: [], pathways: [] });
  const m = selectorModel({ market });
  assert.deepEqual(m.contexts.map((i) => i.key), [CTX]);
  assert.deepEqual(m.pathways.map((i) => i.key), [PATH]);
  assert.deepEqual(m.pathways[0].contextKeys, [CTX]);
});

test('order is stable, and rejected or withdrawn entries are left out', () => {
  const m = selectorModel({
    market: small([
      entry('contextual-element', 'b', '0.1.0'),
      entry('contextual-element', 'a', '0.1.10'),
      entry('contextual-element', 'a', '0.1.2'),
      entry('contextual-element', 'c', '0.1.0', 'rejected'),
      entry('contextual-element', 'd', '0.1.0', 'withdrawn'),
      entry('analytics-package', 'e', '0.1.0'),
    ]),
  });
  assert.deepEqual(m.contexts.map((i) => i.key), ['a@0.1.10', 'a@0.1.2', 'b@0.1.0']);
});

test('appliedByImport follows appliedVersions by id and version, and is false with no import', () => {
  const importResult = { report: { appliedVersions: [{ id: 'snake.envenomation-timing', type: 'contextual-element', version: '0.1.0', held: true }] } };
  assert.equal(selectorModel({ market, importResult }).contexts[0].appliedByImport, true);
  assert.equal(selectorModel({ market, importResult }).pathways[0].appliedByImport, false);
  assert.equal(selectorModel({ market }).contexts[0].appliedByImport, false);
  const other = { report: { appliedVersions: [{ id: 'snake.envenomation-timing', version: '9.9.9' }] } };
  assert.equal(selectorModel({ market, importResult: other }).contexts[0].appliedByImport, false);
});

test('selectOption is pure, ignores an unknown key, and clear empties both', () => {
  const m = selectorModel({ market });
  const start = Object.freeze({ contextKey: null, pathwayKey: null });
  const a = selectOption(m, start, { kind: 'context', key: CTX });
  assert.deepEqual(a, { contextKey: CTX, pathwayKey: null });
  assert.deepEqual(start, { contextKey: null, pathwayKey: null });
  assert.deepEqual(selectOption(m, a, { kind: 'pathway', key: 'nope@1.0.0' }), a);
  assert.deepEqual(selectOption(m, a, { kind: 'context', key: 'snake.envenomation-timing' }), a);
  const b = selectOption(m, a, { kind: 'pathway', key: PATH });
  assert.deepEqual(b, { contextKey: CTX, pathwayKey: PATH });
  assert.deepEqual(selectOption(m, b, { kind: 'clear' }), { contextKey: null, pathwayKey: null });
});

test('mismatch and ready for matching, non-matching and half-chosen selections', () => {
  const m = selectorModel({
    market: small([
      entry('contextual-element', 'c1', '0.1.0'),
      entry('contextual-element', 'c2', '0.1.0'),
      entry('pathway', 'p', '0.1.0', 'draft', [{ id: 'c1', type: 'contextual-element', version: '0.1.0' }]),
    ]),
  });
  const view = (contextKey, pathwayKey) => selectionView(m, { contextKey, pathwayKey });
  assert.deepEqual(view('c1@0.1.0', 'p@0.1.0'), { contextLabel: 'c1 0.1.0', pathwayLabel: 'p 0.1.0', mismatch: false, ready: true });
  const bad = view('c2@0.1.0', 'p@0.1.0');
  assert.equal(bad.mismatch, true);
  assert.equal(bad.ready, false);
  const half = view('c1@0.1.0', null);
  assert.deepEqual(half, { contextLabel: 'c1 0.1.0', pathwayLabel: 'Nothing chosen.', mismatch: false, ready: false });
});

test('a stale key (market changed) reads as nothing chosen', () => {
  const v = selectionView(selectorModel({ market: null }), { contextKey: CTX, pathwayKey: PATH });
  assert.deepEqual(v, { contextLabel: 'Nothing chosen.', pathwayLabel: 'Nothing chosen.', mismatch: false, ready: false });
});

test('ccis-app-selector.js uses no page, storage, network or dynamic code', () => {
  const src = readFileSync('ccis-app-selector.js', 'utf8');
  for (const word of ['document', 'window', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'innerHTML', 'eval', 'Date', 'Math.random', 'import(']) {
    assert.equal(src.includes(word), false, word);
  }
});

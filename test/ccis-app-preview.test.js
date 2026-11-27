// Row 4.4b: the readable preview model of a contextual element. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewModel } from '../ccis-app-preview.js';

const J = JSON.stringify;
const SNAKE = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8'));
const REFUSED = 'The preview needs a contextual element document.';
const MANIFEST = { name: 'Demo', status: 'draft', type: 'contextual-element' };
const F = (key, label, extra = {}) => ({ key, label, type: 'string', cardinality: { min: 0, max: 1 }, epistemic: ['absent'], ...extra });
const doc = (more) => ({ manifest: MANIFEST, ...more });

test('4.4b: the snake element gives one row per field and the counts', () => {
  const r = previewModel(J(SNAKE));
  assert.equal(r.ok, true);
  assert.equal(r.fieldRows.length, 10);
  assert.deepEqual([r.fieldRows[0].key, r.fieldRows[0].label, r.fieldRows[0].type, r.fieldRows[0].cardinality], ['biteTime', 'Time of the bite', 'datetime', '0 to 1']);
  assert.deepEqual([r.title, r.status, r.notes], ['Snake envenomation: timing and documentation', 'draft', '10 fields, 0 modules, 5 relationships.']);
});

test('4.4b: cardinality, units and states read as text', () => {
  const r = previewModel(doc({ fields: [
    F('a', 'A'), F('b', 'B', { cardinality: { min: 1, max: 'unbounded' }, units: ['mg', 'mL'], epistemic: ['absent', 'unknown'] }), F('c', 'C', { cardinality: { min: 2, max: 2 } }),
  ] }));
  assert.deepEqual(r.fieldRows.map((x) => x.cardinality), ['0 to 1', '1 to unbounded', 'exactly 2']);
  assert.deepEqual([r.fieldRows[1].units, r.fieldRows[1].states], ['mg, mL', 'absent, unknown']);
});

test('4.4b: the snake relationships read as sentences, none dangling, linked fields marked', () => {
  const r = previewModel(SNAKE);
  assert.equal(r.edgeRows.length, 5);
  assert.deepEqual([r.edgeRows[0].kind, r.edgeRows[0].text], ['refines', 'How certain the bite time is refines Time of the bite']);
  assert.equal(r.edgeRows.some((e) => e.dangling), false);
  const named = new Set(SNAKE.relationships.flatMap((e) => [e.from, e.to]));
  assert.deepEqual(r.fieldRows.map((f) => f.linked), SNAKE.fields.map((f) => named.has(f.key)));
});

test('4.4b: a relationship naming an unknown key is shown and flagged; duplicate keys both appear', () => {
  const r = previewModel(doc({ fields: [F('a', 'A'), F('a', 'A again')], relationships: [{ kind: 'derived-from', from: 'a', to: 'ghost' }] }));
  assert.deepEqual([r.edgeRows[0].dangling, r.edgeRows[0].text], [true, 'A derived from ghost']);
  assert.equal(r.fieldRows.length, 2);
});

test('4.4b: module fields carry the module id and the module row counts them', () => {
  const r = previewModel(doc({ fields: [F('a', 'A')], modules: [{ id: 'm1', appliesWhen: 'Always.', fields: [F('b', 'B'), F('c', 'C')] }] }));
  assert.deepEqual(r.fieldRows.map((x) => [x.key, x.module]), [['a', ''], ['b', 'm1'], ['c', 'm1']]);
  assert.deepEqual(r.moduleRows, [{ id: 'm1', appliesWhen: 'Always.', fieldCount: 2 }]);
  assert.equal(r.notes, '3 fields, 1 module, 0 relationships.');
});

test('4.4b: other input gets the fixed sentence and never quotes the input', () => {
  const pathway = { manifest: { type: 'pathway', name: 'SECRET' } };
  for (const bad of ['{not json SECRET', '[1]', 42, null, undefined, pathway, J(pathway)]) {
    const r = previewModel(bad);
    assert.deepEqual([r.ok, r.sentence], [false, REFUSED]);
    assert.equal(J(r).includes('SECRET'), false);
  }
});

test('4.4b: malformed members never throw and hostile text stays data', () => {
  const r = previewModel(doc({ fields: [F('a', 7), 'x', F('<img onerror=1>', '<img onerror=1>')], relationships: 'x' }));
  assert.deepEqual([r.fieldRows.length, r.fieldRows[0].label, r.edgeRows.length], [2, '', 0]);
  assert.equal(r.fieldRows[1].label, '<img onerror=1>');
  assert.equal(previewModel({ manifest: MANIFEST }).fieldRows.length, 0);
});

test('4.4b: deterministic, frozen, capped at 500 rows, fixed headline, and pure', () => {
  const big = doc({ fields: Array.from({ length: 600 }, (_, i) => F(`k${i}`, `L${i}`)) });
  const before = J(big);
  const r = previewModel(big);
  assert.equal(J(big), before);
  assert.deepEqual([r.fieldRows.length, r.truncated], [500, true]);
  assert.equal(J(previewModel(big)), J(r));
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.fieldRows) && Object.isFrozen(r.fieldRows[0]));
  const v = previewModel({ manifest: { ...MANIFEST, status: 'validated' }, fields: [F('a', 'A')] });
  assert.deepEqual([v.status, v.headline], ['validated', 'Preview only. It is not a validation result.']);
  const src = readFileSync(new URL('../ccis-app-preview.js', import.meta.url), 'utf8').split('\n').filter((l) => !l.startsWith('//')).join('\n');
  for (const re of [/\bfetch\b/, /\bwindow\b/, /\bdocument\.[a-z]/, /\bDate\b/, /Math\.random/, /localStorage|sessionStorage|indexedDB/, /\bimport\s*\(/]) assert.equal(re.test(src), false, String(re));
});

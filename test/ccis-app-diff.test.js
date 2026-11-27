// Row 4.4a: the pure diff of two canonical artefacts. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { diffArtefacts } from '../ccis-app-diff.js';

const J = JSON.stringify;
const F = (key, label = key) => ({ key, label });
const doc = (fields, extra = {}) => J({ fields, ...extra });
const REFUSED = 'The previous or the new version is not an artefact document.';

test('4.4a: identical texts are the same', () => {
  const r = diffArtefacts(doc([F('a')]), doc([F('a')]));
  assert.deepEqual([r.ok, r.same, r.rows.length, r.summary, r.truncated], [true, true, 0, 'No differences.', false]);
});

test('4.4a: a changed leaf, an added and a removed member give sorted rows with values', () => {
  const r = diffArtefacts(J({ a: { x: 1, gone: true }, c: 'old' }), J({ a: { x: 2 }, b: 'new', c: 'old' }));
  assert.deepEqual(r.rows.map((x) => [x.path, x.change, x.before, x.after]), [
    ['a.gone', 'removed', 'true', undefined], ['a.x', 'changed', '1', '2'], ['b', 'added', undefined, '"new"'],
  ]);
  assert.equal(r.summary, '1 added, 1 removed, 1 changed.');
});

test('4.4a: a keyed array matches by key, so a field inserted at the front is one added row', () => {
  const r = diffArtefacts(doc([F('dose'), F('count')]), doc([F('note'), F('dose'), F('count')]));
  assert.deepEqual(r.rows.map((x) => [x.path, x.change]), [['fields[note]', 'added']]);
  const byId = diffArtefacts(J({ s: [{ id: 'p', v: 1 }] }), J({ s: [{ id: 'p', v: 2 }] }));
  assert.deepEqual(byId.rows.map((x) => x.path), ['s[p].v']);
});

test('4.4a: the same keyed items in another order are one reordered row; a removed item is one removed row', () => {
  const r = diffArtefacts(doc([F('a'), F('b')]), doc([F('b'), F('a')]));
  assert.deepEqual(r.rows.map((x) => [x.path, x.change]), [['fields', 'reordered']]);
  const gone = diffArtefacts(doc([F('a'), F('b'), F('c')]), doc([F('a'), F('c')]));
  assert.deepEqual(gone.rows.map((x) => [x.path, x.change]), [['fields[b]', 'removed']]);
});

test('4.4a: an unkeyed array is compared by position', () => {
  const r = diffArtefacts(J({ exclusions: ['x', 'y'] }), J({ exclusions: ['x', 'z', 'w'] }));
  assert.deepEqual(r.rows.map((x) => [x.path, x.change]), [['exclusions[1]', 'changed'], ['exclusions[2]', 'added']]);
});

test('4.4a: values are cut, objects summarised, a kind change is one row, hostile text stays data', () => {
  const r = diffArtefacts(J({ s: 'x'.repeat(300), o: { a: 1 }, n: 'text', h: 'a' }), J({ s: 'y', o: { a: 1, b: 2 }, n: 5, h: '<img onerror=1>' }));
  const row = (p) => r.rows.find((x) => x.path === p);
  assert.equal(row('s').before.length, 123);
  assert.ok(row('s').before.endsWith('...'));
  assert.equal(row('o.b').after, '2');
  assert.deepEqual([row('n').change, row('n').before, row('n').after], ['changed', '"text"', '5']);
  assert.equal(row('h').after, '"<img onerror=1>"');
  const whole = diffArtefacts(J({ o: { a: 1 } }), J({ o: [1, 2] }));
  assert.deepEqual([whole.rows[0].before, whole.rows[0].after], ['object of 1 members', 'list of 2 items']);
});

test('4.4a: input that is not an artefact gets the fixed sentence and never quotes the input', () => {
  let deep = '1';
  for (let i = 0; i < 101; i += 1) deep = `{"a":${deep}}`;
  for (const bad of ['{not json SECRET', '[1,2]', 42, null, undefined, deep]) {
    const r = diffArtefacts(bad, bad === deep ? deep : '{}');
    assert.deepEqual([r.ok, r.sentence], [false, REFUSED]);
    assert.equal(JSON.stringify(r).includes('SECRET'), false);
  }
  assert.equal(diffArtefacts('{}', '[1]').ok, false);
});

test('4.4a: deterministic, frozen, inputs untouched, capped at 200 rows, and pure', () => {
  const a = { items: Array.from({ length: 250 }, (_, i) => i) };
  const b = { items: Array.from({ length: 250 }, (_, i) => i + 1000) };
  const before = J([a, b]);
  const r = diffArtefacts(a, b);
  assert.equal(J([a, b]), before);
  assert.deepEqual([r.rows.length, r.truncated], [200, true]);
  assert.equal(J(diffArtefacts(a, b)), J(r));
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.rows) && Object.isFrozen(r.rows[0]));
  const src = readFileSync(new URL('../ccis-app-diff.js', import.meta.url), 'utf8').split('\n').filter((l) => !l.startsWith('//')).join('\n');
  for (const re of [/\bfetch\b/, /\bwindow\b/, /\bdocument\.[a-z]/, /\bDate\b/, /Math\.random/, /localStorage|sessionStorage|indexedDB/, /\bimport\s*\(/]) assert.equal(re.test(src), false, String(re));
});

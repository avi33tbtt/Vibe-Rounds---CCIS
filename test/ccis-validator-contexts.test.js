// Row ECO-B6a: pathway contexts validator rules (CCIS-V5-044 to 047). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { contextsChecks } from '../ccis-validator-contexts.js';

const read = (f) => JSON.parse(readFileSync(new URL(`../ccis/examples/snake/${f}`, import.meta.url), 'utf8'));
const E1 = 'dm.sample';
const E2 = 'plain.sample';
const E3 = 'ckd.sample';
const tagged = { fields: [{ key: 'a', contexts: ['diabetes'] }, { key: 'b' }] };
const plain = { fields: [{ key: 'a' }] };
const ckdEl = { fields: [{ key: 'a', contexts: ['ckd'] }] };
const docs = { [E1]: tagged, [E2]: plain, [E3]: ckdEl };
const ctx = { resolve: (ref) => (docs[ref.id] ? { state: 'ok', doc: docs[ref.id] } : { state: 'missing' }) };
const lost = { resolve: () => ({ state: 'missing' }) };
const ref = (id) => ({ id, type: 'contextual-element', range: '^0.1.0' });
const doc = () => ({
  elements: [ref(E1), ref(E2), ref(E3)],
  contexts: [{ id: 'diabetes', label: 'Diabetes', elements: [E1] }, { id: 'ckd', label: 'CKD', elements: [E3] }],
});
const mutate = (fn) => { const d = doc(); fn(d); return d; };
const rows = (d, c = ctx) => contextsChecks(d, c).map((x) => [x.ruleId, x.path]);

test('1 a valid list gives no row; no contexts gives none; the pipeline path gives none', () => {
  assert.deepEqual(rows(doc()), []);
  assert.deepEqual(rows(mutate((d) => { delete d.contexts; })), []);
  const snake = read('snake-documentation.pathway.json');
  snake.contexts = [{ id: 'diabetes', label: 'Diabetes', elements: ['snake.envenomation-timing'] }];
  const r = validateArtefact(snake, { known: [read('snake-envenomation.element.json')] });
  assert.deepEqual(r.diagnostics.filter((d) => /V5-04[4-7]$/.test(d.ruleId)), []);
});

test('2 V5-044 for an element not in elements, at the list item', () => {
  assert.deepEqual(rows(mutate((d) => { d.contexts[1].elements.push('nobody.here'); })), [['CCIS-V5-044', '/contexts/1/elements/1']]);
});

test('3 V5-045 for a duplicate context id, at the second', () => {
  const r = rows(mutate((d) => { d.contexts[1].id = 'diabetes'; }));
  assert.ok(r.some((x) => x[0] === 'CCIS-V5-045' && x[1] === '/contexts/1/id'));
  assert.ok(!r.some((x) => x[1] === '/contexts/0/id'));
});

test('4 V5-046 for an unknown tag, and the hint lists the known tags', () => {
  const d = mutate((x) => { x.contexts[0].id = 'asthma'; });
  const out = contextsChecks(d, ctx).filter((x) => x.ruleId === 'CCIS-V5-046');
  assert.equal(out.length, 1);
  assert.equal(out[0].path, '/contexts/0/id');
  assert.match(out[0].hint, /diabetes, ckd, hypertension/);
});

test('5 V5-047 fires when the element tags and the pathway context differ', () => {
  const r = contextsChecks(mutate((d) => { d.contexts[0].id = 'ckd'; d.contexts[1].id = 'diabetes'; }), ctx).filter((x) => x.ruleId === 'CCIS-V5-047');
  assert.equal(r.length, 2);
  assert.equal(r[0].path, '/contexts/0/elements/0');
  assert.match(r[0].message, /\[diabetes\].*\[ckd\]/);
});

test('6 V5-047 stays silent: no field tags, in no context, or equal tags', () => {
  assert.deepEqual(rows(mutate((d) => { d.contexts[0].elements = [E2]; d.contexts[1].elements = [E3]; })), []);
  assert.deepEqual(rows(mutate((d) => { d.contexts = [d.contexts[1]]; })), []);
  assert.deepEqual(rows(mutate((d) => { d.contexts[0].elements = [E1, E2]; })), []);
});

test('7 unresolved elements: V5-044 to 046 still fire, V5-047 is skipped, no crash', () => {
  const d = mutate((x) => { x.contexts[0].id = 'asthma'; x.contexts[1].id = 'asthma'; x.contexts[1].elements.push('nobody.here'); });
  const ids = rows(d, lost).map((r) => r[0]).sort();
  assert.deepEqual(ids, ['CCIS-V5-044', 'CCIS-V5-045', 'CCIS-V5-046', 'CCIS-V5-046']);
});

test('8 a hostile id appears only inside message text', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const out = contextsChecks(mutate((d) => { d.contexts[0].id = evil; d.contexts[0].elements.push(evil); }), ctx);
  assert.ok(out.length >= 2);
  for (const x of out) { assert.match(x.path, /^\/contexts\/\d+(\/\w+(\/\d+)?)?$/); assert.ok(!x.ruleId.includes('<')); }
  assert.ok(out.every((x) => x.message.includes(evil) || !x.message.includes('<')));
});

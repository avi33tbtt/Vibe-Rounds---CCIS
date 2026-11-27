// Row 4.4c: the form view, inputs only (jsdom over a bare div). Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountFormView } from '../ccis-app-form-view.js';
import { draftFromForm, FORM_TYPES } from '../ccis-app-form.js';
import { HOSTILE, inert } from './hostile-kit.js';

const TOP = ['id', 'name', 'version', 'publisher', 'purpose', 'setting', 'population', 'rationale', 'origin', 'basis'];
const FIELD_KEYS = ['key', 'label', 'type', 'min', 'max', 'epistemic', 'sourceClasses', 'units', 'timeSemantics', 'constraints'];
const LISTS = { epistemic: ['absent', 'unknown'], sourceClasses: ['clinician-entered', 'patient-reported'], timeSemantics: ['point', 'event-time'] };

function mount(types = FORM_TYPES, lists = LISTS) {
  const w = new JSDOM('<div id="r"></div>').window;
  const d = w.document;
  const root = d.getElementById('r');
  const forms = [];
  const states = [];
  mountFormView({ document: d, root, onState: (s) => states.push(s), onForm: (f) => forms.push(f), types, lists });
  const fire = (n, t) => n.dispatchEvent(new w.Event(t, { bubbles: true }));
  const last = () => forms[forms.length - 1];
  const cards = () => [...root.querySelectorAll('.field-card')];
  const box = (scope, label) => scope.querySelector(`[aria-label="${label}"]`);
  const set = (n, v, t = 'input') => { n.value = v; fire(n, t); };
  const btn = (name, scope = root) => [...scope.querySelectorAll('button')].find((b) => b.textContent === name);
  return { root, forms, states, fire, last, cards, box, set, btn };
}
const fillMin = (m) => {
  const v = { id: 'syn-el', name: 'Synthetic element', version: '0.1.0', publisher: 'Synthetic publisher', purpose: 'p', setting: 's', population: 'pop', rationale: 'r', origin: 'o', basis: 'b' };
  for (const k of TOP) m.set(m.box(m.root, k), v[k]);
  const c = m.cards()[0];
  m.set(m.box(c, 'key'), 'k1'); m.set(m.box(c, 'label'), 'Label'); m.set(m.box(c, 'min'), '0'); m.set(m.box(c, 'max'), '1');
  m.set(m.box(c, 'units'), 'mg'); m.set(m.box(c, 'epistemic'), 'absent'); m.set(m.box(c, 'sourceClasses'), 'clinician-entered');
};

test('mount: one card, fixed status line, no status input, blank strings, Remove disabled', () => {
  const m = mount();
  assert.equal(m.cards().length, 1);
  assert.match(m.root.textContent, /Status: draft \(fixed\)\. A form cannot set a status\./);
  assert.equal(m.root.querySelector('[aria-label="status"]'), null);
  const f = m.last();
  assert.deepEqual(Object.keys(f), [...TOP, 'exclusions', 'fields']);
  for (const k of TOP) assert.equal(f[k], '');
  for (const k of FIELD_KEYS) assert.ok(k in f.fields[0], k);
  assert.equal(m.btn('Remove field').disabled, true);
});

test('typing in each top input reaches onForm as a fresh copy', () => {
  const m = mount();
  for (const k of [...TOP, 'exclusions']) m.set(m.box(m.root, k), `v-${k}`);
  const f = m.last();
  for (const k of [...TOP, 'exclusions']) assert.equal(f[k], `v-${k}`);
  f.id = 'changed'; f.fields[0].key = 'changed';
  m.set(m.box(m.root, 'name'), 'again');
  assert.equal(m.last().id, 'v-id');
  assert.equal(m.last().fields[0].key, '');
  assert.notEqual(m.last(), f);
});

test('field inputs are carried and a minimal form passes draftFromForm', () => {
  const m = mount();
  fillMin(m);
  const c = m.cards()[0];
  m.set(m.box(c, 'type'), FORM_TYPES[0], 'change');
  m.set(m.box(c, 'timeSemantics'), 'event-time', 'change');
  const f = m.last().fields[0];
  assert.deepEqual([f.key, f.label, f.type, f.min, f.max, f.timeSemantics], ['k1', 'Label', FORM_TYPES[0], '0', '1', 'event-time']);
  assert.match(c.textContent, /Allowed: absent, unknown/);
  assert.match(c.textContent, /Allowed: clinician-entered, patient-reported/);
  assert.equal(draftFromForm(m.last()).ok, true);
});

test('add and remove keep other cards; limits at 50 and 1', () => {
  const m = mount();
  m.set(m.box(m.cards()[0], 'key'), 'a');
  m.btn('Add field').click(); m.btn('Add field').click();
  m.set(m.box(m.cards()[1], 'key'), 'b'); m.set(m.box(m.cards()[2], 'key'), 'c');
  assert.equal(m.cards().length, 3);
  m.btn('Remove field', m.cards()[1]).click();
  assert.deepEqual(m.last().fields.map((x) => x.key), ['a', 'c']);
  m.btn('Remove field', m.cards()[1]).click();
  assert.equal(m.btn('Remove field').disabled, true);
  while (m.cards().length < 50) m.btn('Add field').click();
  assert.equal(m.btn('Add field').disabled, true);
  assert.equal(m.last().fields.length, 50);
});

test('Reset blanks everything and leaves one card', () => {
  const m = mount();
  fillMin(m);
  m.btn('Add field').click();
  m.btn('Reset form').click();
  assert.equal(m.cards().length, 1);
  const f = m.last();
  for (const k of [...TOP, 'exclusions']) assert.equal(f[k], '');
  for (const k of ['key', 'label', 'min', 'max', 'epistemic', 'sourceClasses', 'units', 'constraints']) assert.equal(f.fields[0][k], '');
  assert.deepEqual(m.states[m.states.length - 1], { fields: 1, touched: false });
});

test('hostile strings are inert and come back unchanged', () => {
  const h = HOSTILE.slice(0, 5);
  const m = mount([...h, 'ok'], { epistemic: h, sourceClasses: h, timeSemantics: h });
  for (const s of h) {
    for (const k of [...TOP, 'exclusions']) m.set(m.box(m.root, k), s);
    const c = m.cards()[0];
    for (const k of ['key', 'label', 'min', 'max', 'epistemic', 'sourceClasses', 'units', 'constraints']) m.set(m.box(c, k), s);
    const f = m.last();
    for (const k of [...TOP, 'exclusions']) assert.equal(f[k], s);
    assert.equal(f.fields[0].label, s);
    assert.equal(f.fields[0].constraints, s);
    inert(m.root, 'form view');
  }
  assert.equal(m.last().fields[0].type, h[0]);
});

test('seam: onState values are small; no on* attribute; no status control', () => {
  const m = mount();
  fillMin(m);
  m.btn('Add field').click();
  for (const s of m.states) {
    assert.deepEqual(Object.keys(s), ['fields', 'touched']);
    assert.ok(Number.isInteger(s.fields));
    assert.equal(typeof s.touched, 'boolean');
  }
  for (const n of m.root.querySelectorAll('*')) for (const a of n.attributes) assert.equal(a.name.startsWith('on'), false);
  assert.equal(m.root.querySelectorAll('[aria-label="status"], [name="status"]').length, 0);
});

test('source scan: only the DOM helper, no network, storage, clock, random, innerHTML', () => {
  const src = readFileSync(new URL('../ccis-app-form-view.js', import.meta.url), 'utf8').replace(/^\/\/.*$/gm, '');
  assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map((x) => x[1]), ['./ccis-app-dom.js']);
  for (const bad of [/\bfetch\b/, /localStorage|sessionStorage|indexedDB/, /\bDate\b/, /Math\.random/, /innerHTML/, /setTimeout|setInterval/]) assert.equal(bad.test(src), false, String(bad));
  assert.ok(/addEventListener/.test(src));
});

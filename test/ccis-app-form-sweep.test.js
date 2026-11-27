// Row 4.4e: hostile-string sweep of the form view and its results, joined with the REAL models (no stubs). jsdom. Synthetic data only.
// Hostile text must end as text only, on accepted forms as well as refusals. Failure messages name a string number, never the string.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountFormView } from '../ccis-app-form-view.js';
import { mountFormResultsView } from '../ccis-app-form-results-view.js';
import { draftFromForm, FORM_TYPES } from '../ccis-app-form.js';
import { previewModel } from '../ccis-app-preview.js';
import { diffArtefacts } from '../ccis-app-diff.js';
import { HOSTILE, inert } from './hostile-kit.js';

const LISTS = { epistemic: ['absent', 'unknown'], sourceClasses: ['clinician-entered'], timeSemantics: ['event-time'] };
const TOP = ['id', 'name', 'version', 'publisher', 'purpose', 'setting', 'population', 'rationale', 'origin', 'basis'];
const VALID = { id: 'syn-el', name: 'Synthetic element', version: '0.1.0', publisher: 'Synthetic publisher', purpose: 'p', setting: 's', population: 'pop', rationale: 'r', origin: 'o', basis: 'b' };
const CARD = { key: 'k1', label: 'Label', min: '0', max: '1', epistemic: 'absent', sourceClasses: 'clinician-entered', units: 'mg' };
const BANNED = ['script', 'style', 'iframe', 'img', 'svg', 'form', 'link', 'a'];

function rig({ types = FORM_TYPES, lists = LISTS } = {}) {
  const w = new JSDOM('<div id="r"></div>').window;
  const d = w.document;
  const created = [];
  const make = d.createElement.bind(d);
  d.createElement = (t) => { created.push(String(t).toLowerCase()); return make(t); };
  const root = d.getElementById('r');
  const formBox = make('div'); const resultsBox = make('div'); const keepBtn = make('button'); keepBtn.type = 'button';
  root.append(formBox, keepBtn, resultsBox);
  let kept = null; let current = null; const states = [];
  const results = mountFormResultsView({ document: d, root: resultsBox, onState: (s) => states.push(s) });
  const show = () => {
    const draft = current;
    results.show({ draft, preview: draft.ok ? previewModel(draft.spec) : null, diff: draft.ok && kept !== null ? diffArtefacts(kept, draft.canonical) : null });
  };
  keepBtn.addEventListener('click', () => { if (current?.ok) { kept = current.canonical; show(); } });
  mountFormView({ document: d, root: formBox, types, lists, onForm: (f) => { current = draftFromForm(f); show(); } });
  const fire = (n, t) => n.dispatchEvent(new w.Event(t, { bubbles: true }));
  const set = (n, v) => { n.value = v; fire(n, 'input'); };
  const box = (scope, label) => scope.querySelector(`[aria-label="${label}"]`);
  const cards = () => [...formBox.querySelectorAll('.field-card')];
  const fillValid = (over = {}, cardOver = {}) => {
    for (const k of TOP) set(box(formBox, k), over[k] ?? VALID[k]);
    const c = cards()[0];
    for (const [k, v] of Object.entries({ ...CARD, ...cardOver })) set(box(c, k), v);
    set(box(c, 'timeSemantics'), 'event-time'); fire(box(c, 'timeSemantics'), 'change');
  };
  return { root, formBox, keepBtn, states, created, set, box, cards, fillValid, fire, state: () => current, kept: () => kept };
}

test('hostile top-level strings: never thrown, inert (accepted or refused)', () => {
  const m = rig();
  HOSTILE.forEach((h, i) => {
    for (const k of TOP) {
      m.fillValid({ [k]: h });
      inert(m.root, `top ${k} string ${i}`);
    }
  });
});

test('hostile field strings: label, units, constraints, key', () => {
  const m = rig();
  HOSTILE.forEach((h, i) => {
    for (const k of ['label', 'units', 'constraints', 'key']) {
      m.fillValid({}, { [k]: h });
      inert(m.root, `field ${k} string ${i}`);
      if (k === 'label' && m.state().ok) assert.ok(m.root.textContent.includes(h), `label string ${i} not shown as text`);
    }
  });
});

test('hostile values in the kept version and after a change: diff rows are text', () => {
  const m = rig();
  HOSTILE.forEach((h, i) => {
    m.fillValid({ name: h });
    if (!m.state().ok) return;
    m.keepBtn.click();
    m.fillValid({ name: `${h}!` });
    inert(m.root, `diff string ${i}`);
    assert.ok(m.root.textContent.includes('changed manifest.name'), `diff row missing for string ${i}`);
  });
});

test('hostile types and lists entries in selects and hints', () => {
  const m = rig({ types: HOSTILE, lists: { epistemic: HOSTILE, sourceClasses: HOSTILE, timeSemantics: HOSTILE } });
  m.fillValid();
  inert(m.root, 'types and lists');
  assert.ok(m.root.querySelectorAll('option').length >= HOSTILE.length);
});

test('3000-character strings in every input: no throw, inert', () => {
  for (const big of ['x'.repeat(3000), '<'.repeat(3000)]) {
    const m = rig();
    for (const n of m.root.querySelectorAll('input[type="text"], textarea')) m.set(n, big);
    inert(m.root, 'long string');
    assert.ok(m.root.querySelectorAll('li').length <= 100);
  }
});

test('50 fields of hostile keys: no throw, rows capped at 100, Add disabled', () => {
  const m = rig();
  m.fillValid();
  const add = [...m.root.querySelectorAll('button')].find((b) => b.textContent === 'Add field');
  while (m.cards().length < 50) add.click();
  m.cards().forEach((c, i) => { m.set(m.box(c, 'key'), HOSTILE[i % HOSTILE.length]); m.set(m.box(c, 'label'), HOSTILE[i % HOSTILE.length]); });
  inert(m.root, '50 hostile keys');
  assert.equal(add.disabled, true);
  for (const ul of m.root.querySelectorAll('ul')) assert.ok(ul.children.length <= 100);
  for (const t of m.root.querySelectorAll('table')) assert.ok(t.querySelectorAll('tr').length <= 101);
});

test('no script, style, iframe, img, svg, form, link or anchor element is ever created', () => {
  const m = rig();
  HOSTILE.forEach((h) => { m.fillValid({ name: h, purpose: h }, { label: h, units: h }); m.keepBtn.click(); });
  const bad = m.created.filter((t) => BANNED.includes(t));
  assert.deepEqual(bad, []);
});

test('source of both views: no markup-writing or code-running calls', () => {
  for (const f of ['../ccis-app-form-view.js', '../ccis-app-form-results-view.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8').replace(/^\/\/.*$/gm, '');
    for (const bad of [/innerHTML/, /outerHTML/, /insertAdjacentHTML/, /document\.write/, /\beval\b/, /\bFunction\(/]) assert.equal(bad.test(src), false, `${f} ${bad}`);
  }
});

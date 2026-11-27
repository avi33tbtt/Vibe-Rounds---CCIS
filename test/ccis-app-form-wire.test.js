// Row 4.4d: the form view and its results wired into the page (jsdom runs the committed index.html). Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { draftFromForm } from '../ccis-app-form.js';
import { HOSTILE, inert } from './hostile-kit.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const FORM = (name = 'Synthetic element') => ({
  id: 'syn-el', name, version: '0.1.0', publisher: 'Synthetic publisher', purpose: 'p', setting: 's', population: 'pop', rationale: 'r', origin: 'o', basis: 'b',
  exclusions: '', fields: [{ key: 'k1', label: 'Label', type: 'quantity', min: '0', max: '1', epistemic: 'absent', sourceClasses: 'clinician-entered', units: 'mg', timeSemantics: 'event-time', constraints: '' }],
});
function page() {
  const calls = [];
  const writes = [];
  const w = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://page.example/',
    beforeParse(win) {
      win.structuredClone = (x) => win.JSON.parse(win.JSON.stringify(x));
      win.fetch = async (...a) => { calls.push(a); throw new Error('no network'); };
      for (const k of ['localStorage', 'sessionStorage']) {
        try { Object.defineProperty(win, k, { get: () => ({ setItem: (...a) => writes.push(a), getItem: () => null, removeItem: () => {}, clear: () => {} }) }); } catch { /* absent */ }
      }
    },
  }).window;
  const root = w.document.getElementById('form');
  const fire = (n, t) => n.dispatchEvent(new w.Event(t, { bubbles: true }));
  const box = (scope, label) => scope.querySelector(`[aria-label="${label}"]`);
  const set = (n, v, t = 'input') => { n.value = v; fire(n, t); };
  const btn = (name) => [...root.querySelectorAll('button')].find((b) => b.textContent === name);
  const fill = (f = FORM()) => {
    for (const k of ['id', 'name', 'version', 'publisher', 'purpose', 'setting', 'population', 'rationale', 'origin', 'basis']) set(box(root, k), f[k]);
    const c = root.querySelector('.field-card');
    for (const k of ['key', 'label', 'min', 'max', 'epistemic', 'sourceClasses', 'units']) set(box(c, k), f.fields[0][k]);
    set(box(c, 'timeSemantics'), f.fields[0].timeSemantics, 'change');
  };
  return { w, root, calls, writes, box, set, btn, fill, st: () => plain(w.ccisApp.formState()) };
}

test('mount: one card, fixed status line, formState holds booleans and counts', () => {
  const p = page();
  assert.equal(p.root.querySelectorAll('.field-card').length, 1);
  assert.match(p.root.textContent, /Status: draft \(fixed\)/);
  const s = p.st();
  assert.deepEqual(Object.keys(s), ['fields', 'touched', 'built', 'refused', 'rows', 'kept']);
  for (const v of Object.values(s)) assert.ok(typeof v === 'boolean' || Number.isInteger(v));
  assert.equal(s.fields, 1);
});

test('a blank form shows the refused line and no checksum', () => {
  const p = page();
  assert.match(p.root.textContent, /Refused\. No element was produced\./);
  assert.doesNotMatch(p.root.textContent, /Checksum:/);
  assert.equal(p.st().refused, true);
});

test('a minimal valid form is built as draft with the expected checksum', () => {
  const p = page();
  p.fill();
  assert.match(p.root.textContent, /Built from the form\. Status: draft\./);
  assert.ok(p.root.textContent.includes(`Checksum: ${draftFromForm(FORM()).checksum}`));
  assert.deepEqual([p.st().built, p.st().refused], [true, false]);
});

test('Keep, edit, see the change row; Forget clears it', () => {
  const p = page();
  p.fill();
  p.btn('Keep this version for comparison').click();
  assert.equal(p.st().kept, true);
  p.set(p.box(p.root, 'name'), 'Renamed element');
  assert.ok(p.root.textContent.includes('changed manifest.name: "Synthetic element" -> "Renamed element"'));
  p.btn('Forget kept version').click();
  assert.equal(p.st().kept, false);
  assert.match(p.root.textContent, /No previous version kept\./);
});

test('the same form typed twice gives the same checksum', () => {
  const sum = (p) => /Checksum: (\S+)/.exec(p.root.textContent)[1];
  const a = page(); a.fill();
  const b = page(); b.fill();
  assert.equal(sum(a), sum(b));
});

test('hostile strings in every input: inert, no throw, formState holds no string', () => {
  const p = page();
  for (const h of HOSTILE) {
    for (const n of p.root.querySelectorAll('input[type="text"], textarea')) p.set(n, h);
    inert(p.root, 'form page');
  }
  assert.ok(Object.values(p.st()).every((v) => typeof v !== 'string'));
});

test('no request and no storage write while the form is used', () => {
  const p = page();
  p.fill();
  p.btn('Keep this version for comparison').click();
  p.btn('Reset form').click();
  assert.equal(p.calls.length, 0);
  assert.equal(p.writes.length, 0);
});

test('seam: formState is exposed; no on* attribute anywhere in the page', () => {
  const p = page();
  assert.ok(Object.keys(p.w.ccisApp).includes('formState'));
  for (const n of p.w.document.querySelectorAll('*')) for (const a of n.attributes) assert.equal(a.name.startsWith('on'), false);
});

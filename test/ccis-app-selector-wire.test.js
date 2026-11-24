import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { importEnvelope } from '../ccis-import.js';
import { heldFromMarket } from '../ccis-app-import-report.js';

const ROOT = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', ROOT), 'utf8');
const ENV_TEXT = readFileSync(new URL('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json', ROOT), 'utf8');
const INDEX = JSON.parse(readFileSync(new URL('market/index.json', ROOT), 'utf8'));
const CTX = 'snake.envenomation-timing@0.1.0';
const PATH = 'snake.documentation-path@0.1.0';

function picked() {
  const out = [];
  const walk = (rel) => {
    for (const name of readdirSync(new URL(`market/${rel}`, ROOT)).sort()) {
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(new URL(`market/${r}`, ROOT)).isDirectory()) walk(r);
      else out.push({ path: `market/${r}`, text: readFileSync(new URL(`market/${r}`, ROOT), 'utf8') });
    }
  };
  walk('');
  return out;
}
const firstArtefact = () => INDEX.entries[0].path;
const page = () => new JSDOM(html, { runScripts: 'dangerously', beforeParse(w) { w.structuredClone = (x) => w.JSON.parse(w.JSON.stringify(x)); } }).window;
async function until(w, cond) { for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => w.setTimeout(r, 0)); }
async function pickMarket(w, items, wait = '#market table, #market [role=alert]') {
  const input = w.document.querySelector('#market input[type=file]');
  Object.defineProperty(input, 'files', { value: items.map((i) => ({ webkitRelativePath: i.path, name: i.path.split('/').pop(), text: async () => i.text })), configurable: true });
  input.dispatchEvent(new w.Event('change'));
  await until(w, () => w.document.querySelector(wait));
}
async function pickEnvelope(w, text = ENV_TEXT) {
  const input = w.document.querySelector('#import input[type=file]');
  Object.defineProperty(input, 'files', { value: [{ name: 'e.json', size: text.length, text: async () => text }], configurable: true });
  input.dispatchEvent(new w.Event('change'));
  await until(w, () => w.document.querySelector('#import p.refusal, #import p.muted'));
}
const plain = (x) => JSON.parse(JSON.stringify(x));
const sels = (w) => w.document.querySelectorAll('#select select');
const choose = (w, i, v) => { const s = sels(w)[i]; s.value = v; s.dispatchEvent(new w.Event('change')); };
const FALSE4 = { contextChosen: false, pathwayChosen: false, mismatch: false, ready: false };
const status = (w) => w.document.getElementById('status').textContent;

test('page: a fresh page has two disabled selects and an empty selector state', () => {
  const w = page();
  assert.equal(sels(w).length, 2);
  for (const s of sels(w)) assert.equal(s.disabled, true);
  assert.deepEqual(plain(w.ccisApp.selectorState()), FALSE4);
});

test('page: with the market loaded the selects are enabled and the status keeps the market message', async () => {
  const w = page();
  await pickMarket(w, picked());
  for (const s of sels(w)) { assert.equal(s.disabled, false); assert.equal(s.options.length, 2); }
  assert.match(status(w), /^Market loaded/);
});

test('page: choosing both gives ready and leaves the status line alone', async () => {
  const w = page();
  await pickMarket(w, picked());
  const before = status(w);
  choose(w, 0, CTX);
  choose(w, 1, PATH);
  assert.deepEqual(plain(w.ccisApp.selectorState()), { contextChosen: true, pathwayChosen: true, mismatch: false, ready: true });
  assert.equal(status(w), before);
});

test('page: the import marks applied options, keeps the selection, and its Clear removes the marks', async () => {
  const w = page();
  await pickMarket(w, picked());
  choose(w, 0, CTX);
  await pickEnvelope(w);
  const market = { index: INDEX, files: Object.fromEntries(INDEX.entries.map((e) => [e.path, readFileSync(new URL(`market/${e.path}`, ROOT), 'utf8')])) };
  const applied = importEnvelope(JSON.parse(ENV_TEXT), { held: heldFromMarket(market) }).report.appliedVersions;
  const names = (key) => applied.some((a) => `${a.id}@${a.version}` === key);
  for (const [i, key] of [[0, CTX], [1, PATH]]) assert.equal(sels(w)[i].options[1].textContent.includes('(applied by import)'), names(key), key);
  assert.equal(sels(w)[0].value, CTX);
  w.document.querySelector('#import button').click();
  for (const s of sels(w)) assert.ok(!s.options[1].textContent.includes('applied by import'));
  assert.equal(sels(w)[0].value, CTX);
});

test('page: clearing the market, or replacing it with a refused one, empties the selection', async () => {
  const w = page();
  await pickMarket(w, picked());
  choose(w, 0, CTX);
  w.document.querySelector('#market button').click();
  assert.deepEqual(plain(w.ccisApp.selectorState()), FALSE4);
  for (const s of sels(w)) { assert.equal(s.disabled, true); assert.equal(s.value, ''); }
  assert.match(status(w), /^Ready\./);
  await pickMarket(w, picked());
  choose(w, 1, PATH);
  const bad = picked().map((i) => (i.path === `market/${firstArtefact()}` ? { ...i, text: i.text + ' ' } : i));
  await pickMarket(w, bad, '#market [role=alert]');
  assert.deepEqual(plain(w.ccisApp.selectorState()), FALSE4);
  for (const s of sels(w)) assert.equal(s.disabled, true);
});

test('page: the three seams keep their keys and hold no market string, and no handler attribute appears', async () => {
  const w = page();
  await pickMarket(w, picked());
  await pickEnvelope(w);
  choose(w, 0, CTX);
  assert.equal(Object.keys(w.ccisApp.state()).length, 4);
  assert.equal(Object.keys(w.ccisApp.importState()).length, 6);
  assert.deepEqual(Object.keys(w.ccisApp.selectorState()), Object.keys(FALSE4));
  const shown = JSON.stringify([w.ccisApp.state(), w.ccisApp.importState(), w.ccisApp.selectorState()]);
  const secret = JSON.parse(readFileSync(new URL(`market/${firstArtefact()}`, ROOT), 'utf8'));
  for (const s of JSON.stringify(secret).match(/"[^"]{16,}"/g) ?? []) assert.ok(!shown.includes(s.slice(1, -1)), s);
  assert.ok(!shown.includes('snake.'));
  assert.equal([...w.document.querySelectorAll('*')].some((n) => [...n.attributes].some((a) => a.name.startsWith('on'))), false);
});

test('no storage, network, innerHTML or inline handlers in ccis-app.js and the import view', () => {
  for (const f of ['ccis-app.js', 'ccis-app-import-view.js']) {
    const src = readFileSync(new URL(f, ROOT), 'utf8');
    for (const word of ['innerHTML', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch(', 'XMLHttpRequest', 'eval(', 'onclick']) assert.equal(src.includes(word), false, `${f} ${word}`);
  }
});

// Row 3.8d.2: the catalogue is wired into the page. jsdom over the committed index.html with scripts run. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { importEnvelope } from '../ccis-import.js';
import { loadFromFiles } from '../ccis-app-market.js';
import { compatibilityFor, catalogueModel } from '../ccis-app-catalogue.js';
import { heldFromMarket } from '../ccis-app-import-report.js';

const ROOT = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', ROOT), 'utf8');
const ENV_TEXT = readFileSync(new URL('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json', ROOT), 'utf8');
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
const sels = (w) => w.document.querySelectorAll('#select select');
const choose = (w, i, v) => { const s = sels(w)[i]; s.value = v; s.dispatchEvent(new w.Event('change')); };
const compat = (w) => w.document.getElementById('compat');
const headings = (w) => [...compat(w).querySelectorAll('h3')].map((h) => h.textContent);
const clickText = (w, root, label) => [...w.document.querySelectorAll(`${root} button`)].find((b) => b.textContent.trim() === label);
const NONE = { shown: false, rows: 0, needsData: 0, incompatible: 0, other: 0 };

// The expected view is drawn from the pure modules, over the same market bytes.
const loaded = loadFromFiles(picked());
assert.equal(loaded.ok, true);
const market = loaded.market;
const plain = (x) => JSON.parse(JSON.stringify(x));
function expected(context) {
  const out = compatibilityFor({ market, pathwayKey: PATH, context });
  assert.equal(out.ok, true);
  const m = catalogueModel(out.result);
  return { headings: Object.keys(m.groups).filter((k) => m.groups[k].length).map((k) => `${m.rows[m.groups[k][0]].label} (${m.groups[k].length})`), rows: m.rows.length, needsData: m.counts['needs-data'] };
}

test('page: a fresh page says to load a market first and shows nothing', () => {
  const w = page();
  assert.match(compat(w).textContent, /Load a market first\./);
  assert.deepEqual(plain(w.ccisApp.catalogueState()), NONE);
});

test('page: with a market and no pathway it says to choose a pathway first', async () => {
  const w = page();
  await pickMarket(w, picked());
  assert.match(compat(w).textContent, /Choose a pathway first\./);
  assert.equal(w.ccisApp.catalogueState().shown, false);
});

test('page: choosing the pathway with no import shows the packages as Needs data', async () => {
  const w = page();
  await pickMarket(w, picked());
  choose(w, 1, PATH);
  const s = w.ccisApp.catalogueState();
  assert.equal(s.shown, true);
  assert.equal(s.needsData, 2);
  assert.ok(headings(w).some((h) => h.startsWith('Needs data')));
  assert.deepEqual(headings(w), expected(null).headings);
});

test('page: after an import the headings and counts equal those drawn from the pure modules', async () => {
  const w = page();
  await pickMarket(w, picked());
  await pickEnvelope(w);
  choose(w, 1, PATH);
  const imported = importEnvelope(JSON.parse(ENV_TEXT), { held: heldFromMarket(market) });
  assert.equal(imported.ok, true);
  const want = expected(imported.context);
  assert.deepEqual(headings(w), want.headings);
  const s = w.ccisApp.catalogueState();
  assert.equal(s.rows, want.rows);
  assert.equal(s.needsData, want.needsData);
});

test('page: clearing the import returns the view to the no-context result', async () => {
  const w = page();
  await pickMarket(w, picked());
  await pickEnvelope(w);
  choose(w, 1, PATH);
  const clear = clickText(w, '#import', 'Clear');
  assert.ok(clear);
  clear.click();
  assert.deepEqual(headings(w), expected(null).headings);
  assert.equal(w.ccisApp.catalogueState().needsData, 2);
});

test('page: clearing the market, or replacing it with a refused one, says to load a market first', async () => {
  const w = page();
  await pickMarket(w, picked());
  choose(w, 1, PATH);
  assert.equal(w.ccisApp.catalogueState().shown, true);
  const refused = picked().map((i) => (i.path === 'market/index.json' ? { ...i, text: '{' } : i));
  await pickMarket(w, refused, '#market [role=alert]');
  assert.match(compat(w).textContent, /Load a market first\./);
  assert.deepEqual(plain(w.ccisApp.catalogueState()), NONE);
  const w2 = page();
  await pickMarket(w2, picked());
  choose(w2, 1, PATH);
  const clear = clickText(w2, '#market', 'Clear');
  assert.ok(clear);
  clear.click();
  assert.match(compat(w2).textContent, /Load a market first\./);
  assert.equal(w2.ccisApp.catalogueState().shown, false);
});

test('page: the seams hold booleans and counts only, and no element has an on* attribute', async () => {
  const w = page();
  await pickMarket(w, picked());
  await pickEnvelope(w);
  choose(w, 1, PATH);
  assert.deepEqual(Object.keys(w.ccisApp).sort(), ['catalogueState', 'checksumOf', 'draftState', 'exportState', 'importState', 'remoteState', 'resultsState', 'runState', 'selectorState', 'state']);
  const cs = w.ccisApp.catalogueState();
  assert.deepEqual(Object.keys(plain(cs)), ['shown', 'rows', 'needsData', 'incompatible', 'other']);
  assert.equal(typeof cs.shown, 'boolean');
  for (const k of ['rows', 'needsData', 'incompatible', 'other']) assert.equal(typeof cs[k], 'number');
  const shown = JSON.stringify([w.ccisApp.state(), w.ccisApp.importState(), w.ccisApp.selectorState(), cs]);
  const envStrings = JSON.stringify(JSON.parse(ENV_TEXT)).match(/"[^"]{16,}"/g) ?? [];
  const marketStrings = picked().flatMap((i) => (i.text.startsWith('{') ? JSON.stringify(JSON.parse(i.text)).match(/"[^"]{16,}"/g) ?? [] : []));
  assert.ok(marketStrings.length > 0);
  for (const str of [...envStrings, ...marketStrings]) assert.ok(!shown.includes(str), `seam leaks ${str.slice(0, 30)}`);
  for (const el of w.document.querySelectorAll('*')) for (const a of el.getAttributeNames()) assert.ok(!a.startsWith('on'), `${el.tagName} has ${a}`);
});

test('source: the wired modules use no storage, network, innerHTML or inline handlers', () => {
  for (const f of ['ccis-app.js', 'ccis-app-import-view.js', 'ccis-app-selector-view.js']) {
    const src = readFileSync(new URL(f, ROOT), 'utf8');
    assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|WebSocket|sendBeacon|innerHTML|outerHTML|insertAdjacentHTML|\.onclick|setAttribute\(\s*['"]on/, f);
  }
});

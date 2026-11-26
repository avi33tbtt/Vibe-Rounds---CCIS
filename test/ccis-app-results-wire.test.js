// Row 3.9a.2: the results view is wired into the page. jsdom over the committed index.html with scripts run. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const ROOT = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', ROOT), 'utf8');
const ENV_DEFAULT = readFileSync(new URL('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json', ROOT), 'utf8');
const PATH = 'snake.documentation-path@0.1.0';
const TIME = '2026-01-01T00:00:00Z';
const EMPTY = { shown: false, state: 'none', groups: 0, items: 0, trace: 0, missing: 0 };
const ENV_TEXT = ENV_DEFAULT;
const MISSING_TEXT = readFileSync(new URL('ccis/fixtures/snake/missing/missing-01-no-bite-time.envelope.json', ROOT), 'utf8');

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
async function pickMarket(w) {
  const input = w.document.querySelector('#market input[type=file]');
  Object.defineProperty(input, 'files', { value: picked().map((i) => ({ webkitRelativePath: i.path, name: i.path.split('/').pop(), text: async () => i.text })), configurable: true });
  input.dispatchEvent(new w.Event('change'));
  await until(w, () => w.document.querySelector('#market table, #market [role=alert]'));
}
async function pickEnvelope(w, ENV_TEXT = ENV_DEFAULT) {
  const input = w.document.querySelector('#import input[type=file]');
  Object.defineProperty(input, 'files', { value: [{ name: 'e.json', size: ENV_TEXT.length, text: async () => ENV_TEXT }], configurable: true });
  input.dispatchEvent(new w.Event('change'));
  await until(w, () => w.document.querySelector('#import p.refusal, #import p.muted'));
}
const choose = (w, i, v) => { const s = w.document.querySelectorAll('#select select')[i]; s.value = v; s.dispatchEvent(new w.Event('change')); };
const btn = (w, root, label) => [...w.document.querySelectorAll(`${root} button`)].find((b) => b.textContent.trim() === label);
const boxes = (w) => [...w.document.querySelectorAll('#run input[type=checkbox]')].filter((b) => !b.getAttribute('aria-label'));
const typeTime = (w) => { const t = w.document.querySelector('#run input[aria-label="Evaluation time"]'); t.value = TIME; t.dispatchEvent(new w.Event('input')); };
const plain = (x) => JSON.parse(JSON.stringify(x));
async function ready(env) {
  const w = page();
  await pickMarket(w);
  await pickEnvelope(w, env);
  choose(w, 1, PATH);
  return w;
}


const go = (w) => { typeTime(w); btn(w, '#run', 'Run').click(); };
const text = (w) => w.document.querySelector('#results').textContent;

test('fresh page: No run yet. shows and resultsState is the empty state', () => {
  const w = page();
  assert.match(text(w), /No run yet\./);
  assert.deepEqual(plain(w.ccisApp.resultsState()), EMPTY);
});

test('after a run the results show under #results and resultsState counts them', async () => {
  const w = await ready();
  go(w);
  assert.match(text(w), /Run complete: \d+ results\./);
  assert.ok(w.document.querySelectorAll('#results h3').length >= 2);
  const s = w.ccisApp.resultsState();
  assert.equal(s.shown, true);
  assert.equal(s.state, 'completed');
  assert.ok(s.groups > 0 && s.items > 0);
});

test('a second run with one package unticked changes the item count', async () => {
  const w = await ready();
  go(w);
  const first = w.ccisApp.resultsState().items;
  boxes(w)[0].checked = false;
  boxes(w)[0].dispatchEvent(new w.Event('change', { bubbles: true }));
  go(w);
  const second = w.ccisApp.resultsState().items;
  assert.ok(second > 0 && second < first);
});

test('a new pathway choice, clearing the import and clearing the market each clear the results', async () => {
  for (const reset of [(w) => choose(w, 1, ''), (w) => btn(w, '#import', 'Clear').click(), (w) => btn(w, '#market', 'Clear').click()]) {
    const w = await ready();
    go(w);
    assert.equal(w.ccisApp.resultsState().shown, true);
    reset(w);
    await until(w, () => w.ccisApp.resultsState().shown === false);
    assert.deepEqual(plain(w.ccisApp.resultsState()), EMPTY);
    assert.match(text(w), /No run yet\./);
  }
});

test('a run on the needs-data fixture shows the Missing section open with needs-data', async () => {
  const w = await ready(MISSING_TEXT);
  boxes(w)[0].checked = true; // the Needs data package is unticked by default; ticking it asks the planner to skip and list it
  boxes(w)[0].dispatchEvent(new w.Event('change', { bubbles: true }));
  go(w);
  const missing = [...w.document.querySelectorAll('#results details')].find((d) => d.querySelector('summary').textContent === 'Missing');
  assert.equal(missing.open, true);
  assert.match(missing.textContent, /needs-data/);
  assert.ok(w.ccisApp.resultsState().missing >= 1);
});

test('seams: keys, booleans and counts only, no checksum, record id or typed time, no on* attributes', async () => {
  const w = await ready();
  go(w);
  assert.deepEqual(Object.keys(w.ccisApp).sort(), ['catalogueState', 'checksumOf', 'exportState', 'importState', 'remoteState', 'resultsState', 'runState', 'selectorState', 'state']);
  const rs = plain(w.ccisApp.resultsState());
  assert.deepEqual(Object.keys(rs), Object.keys(EMPTY));
  for (const [k, v] of Object.entries(rs)) assert.ok(typeof v === 'boolean' || typeof v === 'number' || v === 'completed' || v === 'none', k);
  const shown = JSON.stringify([w.ccisApp.state(), w.ccisApp.importState(), w.ccisApp.selectorState(), w.ccisApp.catalogueState(), w.ccisApp.runState(), rs]);
  assert.ok(!shown.includes(TIME) && !shown.includes('sha256'));
  assert.equal([...w.document.querySelectorAll('*')].some((e) => [...e.attributes].some((a) => a.name.startsWith('on'))), false);
});

test('the record is not reachable from window or window.ccisApp', async () => {
  const w = await ready();
  go(w);
  const holds = (o) => { try { return o !== null && typeof o === 'object' && Array.isArray(o.results); } catch { return false; } };
  for (const host of [w.ccisApp, w]) {
    for (const k of Object.getOwnPropertyNames(host)) {
      let v;
      try { v = typeof host[k] === 'function' && host === w.ccisApp ? host[k]() : host[k]; } catch { continue; }
      assert.equal(holds(v), false, k);
    }
  }
});

test('source scan: no storage, network, clock, innerHTML or inline handlers in ccis-app.js', () => {
  const src = readFileSync(new URL('ccis-app.js', ROOT), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const word of ['localStorage', 'sessionStorage', 'indexedDB', 'XMLHttpRequest', 'WebSocket', 'Date', 'innerHTML', 'onclick']) assert.equal(new RegExp(`\\b${word}\\b`).test(src), false, word);
});

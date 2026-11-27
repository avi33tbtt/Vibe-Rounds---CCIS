// Row 3.9.1a: the run view is wired into the page. jsdom over the committed index.html with scripts run. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const ROOT = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', ROOT), 'utf8');
const ENV_TEXT = readFileSync(new URL('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json', ROOT), 'utf8');
const PATH = 'snake.documentation-path@0.1.0';
const TIME = '2026-01-01T00:00:00Z';
const EMPTY = { ready: false, selected: 0, ran: false, failed: false, results: 0, skipped: 0, refused: false };

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
async function pickEnvelope(w) {
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
async function ready() {
  const w = page();
  await pickMarket(w);
  await pickEnvelope(w);
  choose(w, 1, PATH);
  return w;
}

test('fresh page: Run is disabled, the not-ready sentence shows, runState is empty', () => {
  const w = page();
  assert.equal(btn(w, '#run', 'Run').disabled, true);
  assert.match(w.document.querySelector('#run p').textContent, /Load a market, choose a pathway and import an envelope first/);
  assert.deepEqual(plain(w.ccisApp.runState()), EMPTY);
});

test('market, pathway and import give two ticked boxes; a typed time lets Run complete', async () => {
  const w = await ready();
  assert.equal(boxes(w).length, 2);
  assert.ok(boxes(w).every((b) => b.checked));
  assert.equal(w.ccisApp.runState().ready, true);
  typeTime(w);
  btn(w, '#run', 'Run').click();
  assert.match(w.document.querySelector('#run p').textContent, /^Run complete: 8 results, 0 skipped\.$/);
  const s = w.ccisApp.runState();
  assert.equal(s.ran, true);
  assert.equal(s.results, 8);
});

test('unticking one package gives fewer results', async () => {
  const w = await ready();
  boxes(w)[0].checked = false;
  boxes(w)[0].dispatchEvent(new w.Event('change', { bubbles: true }));
  typeTime(w);
  btn(w, '#run', 'Run').click();
  const s = w.ccisApp.runState();
  assert.equal(s.ran, true);
  assert.ok(s.results > 0 && s.results < 8);
});

test('a new pathway choice, clearing the import and clearing the market each reset runState', async () => {
  for (const reset of [(w) => choose(w, 1, ''), (w) => btn(w, '#import', 'Clear').click(), (w) => btn(w, '#market', 'Clear').click()]) {
    const w = await ready();
    typeTime(w);
    btn(w, '#run', 'Run').click();
    assert.equal(w.ccisApp.runState().ran, true);
    reset(w);
    await until(w, () => w.ccisApp.runState().ready === false);
    assert.deepEqual(plain(w.ccisApp.runState()), EMPTY);
  }
});

test('seams: keys, booleans and counts only, no market, context or typed time, no on* attributes', async () => {
  const w = await ready();
  typeTime(w);
  btn(w, '#run', 'Run').click();
  assert.deepEqual(Object.keys(w.ccisApp).sort(), ['catalogueState', 'checksumOf', 'draftState', 'exportState', 'importState', 'remoteState', 'resultsState', 'runState', 'selectorState', 'state']);
  const rs = w.ccisApp.runState();
  assert.deepEqual(Object.keys(plain(rs)), Object.keys(EMPTY));
  for (const [k, v] of Object.entries(plain(rs))) assert.ok(typeof v === 'boolean' || typeof v === 'number', k);
  const shown = JSON.stringify([w.ccisApp.state(), w.ccisApp.importState(), w.ccisApp.selectorState(), w.ccisApp.catalogueState(), rs]);
  assert.ok(!shown.includes(TIME));
  for (const f of picked().slice(0, 5)) assert.ok(!shown.includes(f.text.slice(0, 40)) || f.text.slice(0, 40).length < 10);
  assert.ok(!shown.includes(ENV_TEXT.slice(0, 40)));
  assert.equal(w.document.querySelectorAll('*').length > 0 && [...w.document.querySelectorAll('*')].some((e) => [...e.attributes].some((a) => a.name.startsWith('on'))), false);
});

test('the record is not reachable from window or window.ccisApp', async () => {
  const w = await ready();
  typeTime(w);
  btn(w, '#run', 'Run').click();
  const holds = (o) => { try { return o !== null && typeof o === 'object' && Array.isArray(o.results); } catch { return false; } };
  for (const host of [w.ccisApp, w]) {
    for (const k of Object.getOwnPropertyNames(host)) {
      let v;
      try { v = typeof host[k] === 'function' && host === w.ccisApp ? host[k]() : host[k]; } catch { continue; }
      assert.equal(holds(v), false, k);
    }
  }
});

test('source scan: no storage, network, clock, innerHTML or inline handlers in the app and import view', () => {
  for (const f of ['ccis-app.js', 'ccis-app-import-view.js']) {
    const src = readFileSync(new URL(f, ROOT), 'utf8');
    assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|WebSocket|Date\.now|new Date|performance\.now|innerHTML|outerHTML|insertAdjacentHTML|setAttribute\(\s*['"]on/, f);
  }
});

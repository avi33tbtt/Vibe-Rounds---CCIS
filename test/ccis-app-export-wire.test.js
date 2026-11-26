// Row 3.9b.2: the export view is wired into the page. jsdom over the committed index.html with scripts run. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const ROOT = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', ROOT), 'utf8');
const ENV_DEFAULT = readFileSync(new URL('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json', ROOT), 'utf8');
const PATH = 'snake.documentation-path@0.1.0';
const TIME = '2026-01-01T00:00:00Z';
const EMPTY = { shown: false, verified: false, saved: false };
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
const downloads = new WeakMap();
const page = (opts = {}) => new JSDOM(html, {
  runScripts: 'dangerously',
  beforeParse(w) {
    w.structuredClone = (x) => w.JSON.parse(w.JSON.stringify(x));
    const log = { clicks: [], blobs: [], revoked: 0 };
    downloads.set(w, log);
    w.URL.createObjectURL = (b) => { if (opts.throwOnSave) throw new Error('blocked'); log.blobs.push(b); return 'blob:test'; };
    w.URL.revokeObjectURL = () => { log.revoked += 1; };
    w.HTMLAnchorElement.prototype.click = function click() { log.clicks.push({ download: this.download, href: this.href }); };
  },
}).window;
const readBlob = (w, b) => new Promise((res) => { const r = new w.FileReader(); r.onload = () => res(r.result); r.readAsText(b); });
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
async function ready(env, opts) {
  const w = page(opts);
  await pickMarket(w);
  await pickEnvelope(w, env);
  choose(w, 1, PATH);
  return w;
}


const go = (w) => { typeTime(w); btn(w, '#run', 'Run').click(); };
const text = (w) => w.document.querySelector('#export').textContent;

test('fresh page: the start sentence shows and exportState is all false', () => {
  const w = page();
  assert.match(text(w), /Nothing to export yet\./);
  assert.deepEqual(plain(w.ccisApp.exportState()), EMPTY);
});

test('after a run the verified sentence and one Download button show', async () => {
  const w = await ready();
  go(w);
  assert.ok(text(w).includes('Verified: id and results checksum match.'));
  assert.equal(w.document.querySelectorAll('#export button').length, 1);
  assert.deepEqual(plain(w.ccisApp.exportState()), { shown: true, verified: true, saved: false });
});

test('click makes one download named for the record id, with the canonical text', async () => {
  const w = await ready();
  go(w);
  btn(w, '#export', 'Download run record').click();
  const log = downloads.get(w);
  assert.equal(log.clicks.length, 1);
  assert.match(log.clicks[0].download, /^run-[0-9a-f]{64}\.json$/);
  const body = await readBlob(w, log.blobs[0]);
  assert.ok(body.endsWith('\n'));
  assert.equal(JSON.parse(body).status, 'completed');
  assert.equal(`${log.clicks[0].download}`, `${JSON.parse(body).id}.json`);
  assert.equal(log.revoked, 1);
  assert.equal(w.ccisApp.exportState().saved, true);
});

test('a throwing object URL gives the failure sentence and saved stays false', async () => {
  const w = await ready(undefined, { throwOnSave: true });
  go(w);
  btn(w, '#export', 'Download run record').click();
  assert.match(text(w), /The file could not be saved\./);
  assert.equal(w.ccisApp.exportState().saved, false);
  assert.equal(downloads.get(w).clicks.length, 0);
});

test('a new pathway choice, clearing the import and clearing the market each clear the offer', async () => {
  for (const reset of [(w) => choose(w, 1, ''), (w) => btn(w, '#import', 'Clear').click(), (w) => btn(w, '#market', 'Clear').click()]) {
    const w = await ready();
    go(w);
    assert.equal(w.ccisApp.exportState().shown, true);
    reset(w);
    await until(w, () => w.ccisApp.exportState().shown === false);
    assert.deepEqual(plain(w.ccisApp.exportState()), EMPTY);
    assert.match(text(w), /Nothing to export yet\./);
    assert.equal(w.document.querySelectorAll('#export button').length, 0);
  }
});

test('seams: keys, booleans only, no checksum, record id, file name or typed time, no on* attributes', async () => {
  const w = await ready();
  go(w);
  btn(w, '#export', 'Download run record').click();
  assert.deepEqual(Object.keys(w.ccisApp).sort(), ['catalogueState', 'checksumOf', 'exportState', 'importState', 'remoteState', 'resultsState', 'runState', 'selectorState', 'state']);
  const es = plain(w.ccisApp.exportState());
  assert.deepEqual(Object.keys(es), Object.keys(EMPTY));
  for (const [k, v] of Object.entries(es)) assert.equal(typeof v, 'boolean', k);
  const shown = JSON.stringify([w.ccisApp.state(), w.ccisApp.importState(), w.ccisApp.selectorState(), w.ccisApp.catalogueState(), w.ccisApp.runState(), w.ccisApp.resultsState(), es]);
  const name = downloads.get(w).clicks[0].download;
  assert.ok(!shown.includes(TIME) && !shown.includes('sha256') && !shown.includes(name) && !shown.includes('run-'));
  assert.equal([...w.document.querySelectorAll('*')].some((e) => [...e.attributes].some((a) => a.name.startsWith('on'))), false);
});

test('the record and the file text are not reachable from window or window.ccisApp', async () => {
  const w = await ready();
  go(w);
  const holds = (o) => { try { return o !== null && typeof o === 'object' && (Array.isArray(o.results) || (typeof o.text === 'string' && o.text.includes('"results"'))); } catch { return false; } };
  for (const host of [w.ccisApp, w]) {
    for (const k of Object.getOwnPropertyNames(host)) {
      let v;
      try { v = typeof host[k] === 'function' && host === w.ccisApp ? host[k]() : host[k]; } catch { continue; }
      assert.equal(holds(v), false, k);
      assert.equal(typeof v === 'string' && v.includes('"results"'), false, k);
    }
  }
});

test('source scan: ccis-app.js has no storage, network, clock, innerHTML or handlers; Blob and URL only there', () => {
  const clean = (f) => readFileSync(new URL(f, ROOT), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const app = clean('ccis-app.js');
  for (const word of ['localStorage', 'sessionStorage', 'indexedDB', 'XMLHttpRequest', 'WebSocket', 'Date', 'innerHTML', 'onclick']) assert.equal(new RegExp(`\\b${word}\\b`).test(app), false, word);
  for (const f of readdirSync(ROOT).filter((n) => /^ccis-app-.*\.js$/.test(n))) assert.equal(/\b(Blob|createObjectURL)\b/.test(clean(f)), false, f);
});

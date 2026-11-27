// Row 3.8b.2: the import view wired into the page (jsdom over the committed index.html). Prototype. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { importEnvelope } from '../ccis-import.js';
import { heldFromMarket, importReportView } from '../ccis-app-import-report.js';

const ROOT = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', ROOT), 'utf8');
const ENV_TEXT = readFileSync(new URL('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json', ROOT), 'utf8');

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
const firstArtefact = () => JSON.parse(readFileSync(new URL('market/index.json', ROOT), 'utf8')).entries[0].path;
// jsdom has no structuredClone (every real browser does, and ccis-import.js uses it); the test lends it a same-realm JSON clone (the Node one would mix realms).
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
const EMPTY = { imported: false, refused: false, accepted: 0, rejected: 0, unmapped: 0, ambiguous: 0 };

test('page: an envelope with no market shows the fixed sentence and imports nothing', async () => {
  const w = page();
  await pickEnvelope(w);
  assert.match(w.document.getElementById('import').textContent, /Load a market first/);
  assert.equal(w.ccisApp.importState().imported, false);
});

test('page: with the market loaded the report shows and the counts equal the pure import', async () => {
  const w = page();
  await pickMarket(w, picked());
  await pickEnvelope(w);
  const idx = JSON.parse(readFileSync(new URL('market/index.json', ROOT), 'utf8'));
  const files = {};
  for (const e of idx.entries) files[e.path] = readFileSync(new URL(`market/${e.path}`, ROOT), 'utf8');
  const v = importReportView(importEnvelope(JSON.parse(ENV_TEXT), { held: heldFromMarket({ index: idx, files }) }));
  const s = w.ccisApp.importState();
  assert.equal(s.imported, true);
  assert.deepEqual([s.accepted, s.rejected, s.unmapped, s.ambiguous], [v.counts.accepted, v.counts.rejected, v.counts.unmapped, v.counts.ambiguous]);
  assert.match(w.document.getElementById('import').textContent, /Envelope read/);
});

test('page: clearing the market clears the import report and the state', async () => {
  const w = page();
  await pickMarket(w, picked());
  await pickEnvelope(w);
  w.document.querySelector('#market button').click();
  assert.equal(w.document.querySelector('#import div').textContent, '');
  assert.deepEqual(plain(w.ccisApp.importState()), EMPTY);
  assert.match(w.document.getElementById('status').textContent, /^Ready\./);
});

test('page: replacing the market with a refused one also clears the import report', async () => {
  const w = page();
  await pickMarket(w, picked());
  await pickEnvelope(w);
  const bad = picked().map((i) => (i.path === `market/${firstArtefact()}` ? { ...i, text: i.text + ' ' } : i));
  await pickMarket(w, bad, '#market [role=alert]');
  assert.equal(w.document.querySelector('#import div').textContent, '');
  assert.deepEqual(plain(w.ccisApp.importState()), EMPTY);
  assert.match(w.document.getElementById('status').textContent, /^Market refused/);
});

test('page: state() keeps its four keys and neither seam holds a market string', async () => {
  const w = page();
  await pickMarket(w, picked());
  await pickEnvelope(w);
  assert.deepEqual(Object.keys(w.ccisApp.state()), ['marketLoaded', 'entries', 'runs', 'refused']);
  assert.deepEqual(Object.keys(w.ccisApp).sort(), ['catalogueState', 'checksumOf', 'draftState', 'exportState', 'importState', 'remoteState', 'resultsState', 'runState', 'selectorState', 'state']);
  const shown = JSON.stringify([w.ccisApp.state(), w.ccisApp.importState()]);
  const secret = JSON.parse(readFileSync(new URL(`market/${firstArtefact()}`, ROOT), 'utf8'));
  const strings = JSON.stringify(secret).match(/"[^"]{16,}"/g) ?? [];
  assert.ok(strings.length > 0);
  for (const s of strings) assert.ok(!shown.includes(s.slice(1, -1)), s);
});

test('no storage, network, innerHTML or inline handlers in the wired modules and the page', async () => {
  for (const f of ['ccis-app-import-view.js', 'ccis-app.js']) {
    const src = readFileSync(new URL(f, ROOT), 'utf8');
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|eval\(|new Function|import\(/.test(src), f);
    assert.ok(!/\bon[a-z]+\s*=/.test(src.replace(/\/\/.*$/gm, '')), f);
  }
  const w = page();
  await pickMarket(w, picked());
  await pickEnvelope(w);
  for (const el of w.document.querySelectorAll('*')) for (const a of el.attributes) assert.ok(!/^on/i.test(a.name), `${el.tagName} ${a.name}`);
});

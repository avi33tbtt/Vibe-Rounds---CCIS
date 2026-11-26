// Row 4.1c: the marketplace view is wired into the page. jsdom with scripts run over the committed index.html and over a
// distribution build; window.fetch is a fake serving market/. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildApp } from '../scripts/build-app.js';

const ROOT = new URL('../', import.meta.url);
const BASE = 'https://market.example/m/';
const committed = readFileSync(new URL('index.html', ROOT), 'utf8');
const dist = buildApp({ marketBase: BASE });
const mdir = new URL('market/', ROOT);
const site = (() => {
  const out = {};
  const walk = (rel) => {
    for (const name of readdirSync(new URL(rel, mdir)).sort()) {
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(new URL(r, mdir)).isDirectory()) walk(r); else out[r] = readFileSync(new URL(r, mdir), 'utf8');
    }
  };
  walk('');
  return out;
})();
const resp = (text) => ({ ok: true, status: 200, redirected: false, type: 'cors', text: async () => text });
function page(html, { throwWith } = {}) {
  const calls = [];
  const w = new JSDOM(html, {
    runScripts: 'dangerously',
    beforeParse(win) {
      win.structuredClone = (x) => win.JSON.parse(win.JSON.stringify(x));
      win.fetch = async (url, opts) => {
        calls.push({ url, opts });
        if (throwWith) throw new Error(throwWith);
        const rel = url.slice(BASE.length);
        if (!url.startsWith(BASE) || !Object.hasOwn(site, rel)) throw new Error('404');
        return resp(site[rel]);
      };
    },
  }).window;
  return { w, calls };
}
const until = async (w, cond) => { for (let i = 0; i < 400 && !cond(); i++) await new Promise((r) => w.setTimeout(r, 0)); };
const btn = (w, root, label) => [...w.document.querySelectorAll(`${root} button`)].find((b) => b.textContent.trim() === label);
const load = async (w) => { btn(w, '#remote', 'Load from marketplace').click(); await until(w, () => w.document.querySelector('#remote table, #remote [role=alert]')); };
const plain = (x) => JSON.parse(JSON.stringify(x));
const NONE = { available: false, loaded: false, refused: false, source: 'none' };

test('committed page: one fixed line, no button, empty remote state', () => {
  const { w } = page(committed);
  assert.match(w.document.querySelector('#remote').textContent, /No marketplace address is set in this build\./);
  assert.equal(btn(w, '#remote', 'Load from marketplace'), undefined);
  assert.deepEqual(plain(w.ccisApp.remoteState()), NONE);
  // a CSP address that goodBase refuses (not https) gives the same line and no button
  const bad = page(committed.replace("connect-src 'none'", 'connect-src http://insecure.example/m/')).w;
  assert.equal(btn(bad, '#remote', 'Load from marketplace'), undefined);
  assert.equal(bad.ccisApp.remoteState().available, false);
});

test('distribution page: the address shows as text and the Load button shows', () => {
  const { w } = page(dist);
  assert.ok(w.document.querySelector('#remote').textContent.includes(`Address: ${BASE}`));
  assert.ok(btn(w, '#remote', 'Load from marketplace'));
  assert.deepEqual(plain(w.ccisApp.remoteState()), { ...NONE, available: true });
});

test('Load fills the table, the market is live and the source is remote', async () => {
  const { w } = page(dist);
  await load(w);
  const rows = w.document.querySelectorAll('#remote table tr').length;
  assert.ok(rows > 1);
  assert.equal(w.ccisApp.state().marketLoaded, true);
  assert.deepEqual(plain(w.ccisApp.remoteState()), { available: true, loaded: true, refused: false, source: 'remote' });
  assert.ok(w.document.querySelectorAll('#select select').length > 0);
});

test('every request is a plain GET to the base: no query, fragment, body or headers', async () => {
  const { w, calls } = page(dist);
  await load(w);
  assert.ok(calls.length > 1);
  for (const { url, opts } of calls) {
    assert.ok(url.startsWith(BASE) && !/[?#]/.test(url), url);
    assert.equal(opts.method, 'GET'); assert.equal(opts.body, undefined); assert.equal(opts.headers, undefined); assert.equal(opts.credentials, 'omit');
  }
});

test('loading from the folder afterwards clears the remote table; remote Clear clears the market', async () => {
  const { w } = page(dist);
  await load(w);
  const input = w.document.querySelector('#market input[type=file]');
  const files = [];
  for (const [path, text] of Object.entries(site)) files.push({ webkitRelativePath: `market/${path}`, name: path.split('/').pop(), text: async () => text });
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new w.Event('change'));
  await until(w, () => w.ccisApp.remoteState().source === 'folder');
  assert.equal(w.document.querySelectorAll('#remote table').length, 0);
  assert.equal(w.document.querySelectorAll('#market table').length, 1);
  assert.equal(w.ccisApp.remoteState().source, 'folder');
  await load(w);
  assert.equal(w.document.querySelectorAll('#market table').length, 0, 'one table on screen');
  btn(w, '#remote', 'Clear').click();
  assert.equal(w.ccisApp.state().marketLoaded, false);
  assert.equal(w.ccisApp.remoteState().source, 'none');
});

test('a failing fetch shows the fixed refusal and never the secret or the address path', async () => {
  const { w } = page(dist, { throwWith: 'secret-token' });
  await load(w);
  const t = w.document.body.textContent;
  assert.ok(w.document.querySelector('#remote [role=alert]'));
  assert.equal(t.includes('secret-token'), false);
  assert.equal(w.document.querySelector('#remote [role=alert]').textContent.includes('market.example'), false, 'the refusal never quotes the address');
  assert.equal(w.ccisApp.remoteState().refused, true);
});

test('seams: remoteState is listed, holds no address, and no on* attribute exists', async () => {
  const { w } = page(dist);
  await load(w);
  assert.ok(Object.keys(w.ccisApp).includes('remoteState'));
  const shown = JSON.stringify([w.ccisApp.state(), w.ccisApp.remoteState(), w.ccisApp.catalogueState(), w.ccisApp.runState()]);
  assert.equal(shown.includes('market.example'), false);
  for (const el of w.document.querySelectorAll('*')) for (const a of el.attributes) assert.equal(/^on/i.test(a.name), false, a.name);
});

test('source scan of ccis-app.js: no fetch call of its own, timer, storage or innerHTML', () => {
  const src = readFileSync(new URL('ccis-app.js', ROOT), 'utf8').replace(/\/\/.*$/gm, '');
  // The only mentions of fetch: the adapter import and the injected window.fetch handed to it (D-231). No call of its own.
  const rest = src.replace("from './ccis-app-fetch.js'", '').replace("typeof window.fetch === 'function'", '').replace('window.fetch.bind(window)', '');
  assert.equal(/fetch\s*\(/.test(rest), false);
  assert.equal(/fetch\b/.test(rest), false, 'fetch appears only in the three expected places');
  for (const bad of ['setTimeout', 'setInterval', 'localStorage', 'sessionStorage', 'innerHTML', 'XMLHttpRequest', 'eval(']) assert.equal(src.includes(bad), false, bad);
});

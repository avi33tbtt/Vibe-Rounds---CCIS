// Row 4.1b.1: the "Load from marketplace" view, proved in jsdom with a fake fetchText serving market/. Not wired. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountRemoteView } from '../ccis-app-remote-view.js';
import { marketView } from '../ccis-app-market.js';

const BASE = 'https://market.example.test/ccis/';
const dir = new URL('../market/', import.meta.url);
const indexText = readFileSync(new URL('index.json', dir), 'utf8');
const entries = JSON.parse(indexText).entries;
const served = () => Object.fromEntries([['index.json', indexText], ...entries.map((e) => [e.path, readFileSync(new URL(e.path, dir), 'utf8')])]);
const fake = (site, { gate, throwWith } = {}) => {
  const calls = [];
  const fetchText = async (url) => {
    calls.push(url);
    if (throwWith) throw new Error(throwWith);
    if (gate) await gate;
    const rel = url.slice(BASE.length);
    if (!Object.hasOwn(site, rel)) throw new Error('404');
    return site[rel];
  };
  return { fetchText, calls };
};
function setup(opts = {}) {
  const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>');
  const document = dom.window.document;
  const root = document.getElementById('root');
  const states = [];
  mountRemoteView({ document, root, onState: (s) => states.push(s), ...opts });
  const btn = (label) => [...root.querySelectorAll('button')].find((b) => b.textContent === label);
  const until = async (f) => { for (let i = 0; i < 200 && !f(); i += 1) await new Promise((r) => setImmediate(r)); };
  return { root, states, btn, until, document };
}

test('1 a bad base or no fetchText shows one line, no button, and never calls onState', () => {
  for (const o of [{ base: 'http://a.test/', fetchText: async () => '' }, { base: 'https://a.test/market', fetchText: async () => '' }, { base: BASE }, {}]) {
    const s = setup(o);
    assert.equal(s.root.querySelectorAll('button').length, 0);
    assert.match(s.root.textContent, /No marketplace address is set in this build\./);
    assert.equal(s.states.length, 0);
  }
});

test('2 Load fills the table, shows the request count, calls onState once with the market', async () => {
  const f = fake(served());
  const s = setup({ base: BASE, fetchText: f.fetchText });
  s.btn('Load from marketplace').click();
  await s.until(() => s.states.length > 0);
  assert.equal(s.root.querySelectorAll('tbody tr').length, marketView(s.states[0].market).rows.length);
  assert.equal(s.root.querySelectorAll('tbody tr').length, entries.length);
  assert.match(s.root.textContent, new RegExp(`${f.calls.length} requests were made`));
  assert.equal(s.states.length, 1);
  assert.equal(s.states[0].loaded, true); assert.equal(s.states[0].source, 'remote'); assert.ok(s.states[0].market);
});

test('3 every URL the fake saw starts with the base and has no query or fragment', async () => {
  const f = fake(served());
  const s = setup({ base: BASE, fetchText: f.fetchText });
  s.btn('Load from marketplace').click();
  await s.until(() => s.states.length > 0);
  assert.ok(f.calls.length >= 2);
  assert.ok(f.calls.every((u) => u.startsWith(BASE) && !u.includes('?') && !u.includes('#')));
});

test('4 a throwing fetch gives the R-002 sentence and leaks neither the secret nor the address path', async () => {
  const f = fake(served(), { throwWith: 'secret-token' });
  const s = setup({ base: BASE, fetchText: f.fetchText });
  s.btn('Load from marketplace').click();
  await s.until(() => s.states.length > 0);
  const alert = s.root.querySelector('[role=alert]');
  assert.ok(alert); assert.match(alert.textContent, /R-002/);
  assert.equal(alert.textContent.includes('secret-token'), false);
  assert.equal(alert.textContent.includes('/ccis/'), false);
  assert.equal(s.states[0].refused, true); assert.equal('market' in s.states[0], false);
});

test('5 one changed byte gives R-006 and no table', async () => {
  const site = served(); const p = entries[0].path; site[p] += ' ';
  const s = setup({ base: BASE, fetchText: fake(site).fetchText });
  s.btn('Load from marketplace').click();
  await s.until(() => s.states.length > 0);
  assert.match(s.root.querySelector('[role=alert]').textContent, /R-006/);
  assert.equal(s.root.querySelector('[role=alert]').textContent.includes(p), false, 'no file path in the alert');
  assert.equal(s.root.querySelector('[role=alert]').textContent.includes('M-010'), false, 'no detail in the alert');
  assert.equal(s.root.querySelectorAll('table').length, 0);
});

test('6 the button is disabled while loading and a second click makes no second request', async () => {
  let open; const gate = new Promise((r) => { open = r; });
  const f = fake(served(), { gate });
  const s = setup({ base: BASE, fetchText: f.fetchText });
  const b = s.btn('Load from marketplace');
  b.click(); await s.until(() => f.calls.length > 0);
  assert.equal(b.disabled, true);
  b.click(); b.click();
  assert.equal(f.calls.filter((u) => u.endsWith('index.json')).length, 1);
  open(); await s.until(() => s.states.length > 0);
  assert.equal(b.disabled, false);
});

test('7 Clear during a pending load discards the late reply; Clear after success empties the view', async () => {
  let open; const gate = new Promise((r) => { open = r; });
  const f = fake(served(), { gate });
  const s = setup({ base: BASE, fetchText: f.fetchText });
  s.btn('Load from marketplace').click(); await s.until(() => f.calls.length > 0);
  s.btn('Clear').click();
  open(); for (let i = 0; i < 50; i += 1) await new Promise((r) => setImmediate(r));
  assert.equal(s.root.querySelectorAll('table').length, 0);
  assert.deepEqual(s.states.map((x) => x.loaded), [false]);
  const g = fake(served());
  const t = setup({ base: BASE, fetchText: g.fetchText });
  t.btn('Load from marketplace').click(); await t.until(() => t.states.length > 0);
  t.btn('Clear').click();
  assert.equal(t.root.querySelectorAll('table').length, 0);
  assert.equal(t.states.at(-1).loaded, false);
});

test('8 markup in a base never reaches the DOM; the module source has no forbidden API', () => {
  const s = setup({ base: 'https://a.test/<img onerror=x>/', fetchText: async () => '' });
  assert.equal(s.root.querySelectorAll('img').length, 0);
  assert.equal(s.root.querySelectorAll('button').length, 0);
  const src = readFileSync(new URL('../ccis-app-remote-view.js', import.meta.url), 'utf8');
  for (const bad of ['innerHTML', 'fetch(', 'setTimeout', 'localStorage', 'eval', 'import(', 'onclick']) assert.equal(src.includes(bad), false, bad);
});

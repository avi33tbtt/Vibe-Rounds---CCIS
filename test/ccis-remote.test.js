// Row 4.1: the remote market loader, proved with a fake `fetchText` that serves the committed market/ from memory.
// Prototype. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadRemoteMarket, REMOTE_REFUSALS } from '../ccis-remote.js';
import { loadMarket, resolve } from '../ccis-market.js';

const BASE = 'https://market.example.test/ccis/';
const dir = new URL('../market/', import.meta.url);
const indexText = readFileSync(new URL('index.json', dir), 'utf8');
const entries = JSON.parse(indexText).entries;
const served = () => Object.fromEntries([['index.json', indexText], ...entries.map((e) => [e.path, readFileSync(new URL(e.path, dir), 'utf8')])]);
// A fake network: serves `site` by URL, logs every call's arguments, and can throw on the nth request.
function fake(site, { throwOn } = {}) {
  const calls = [];
  const fetchText = async (...args) => {
    calls.push(args);
    if (throwOn === calls.length) throw new Error(`secret failure at ${args[0]}`);
    const rel = args[0].slice(BASE.length);
    return Object.hasOwn(site, rel) ? site[rel] : 404;
  };
  return { fetchText, calls };
}
const withIndex = (mutate) => { const idx = JSON.parse(indexText); mutate(idx); return { ...served(), 'index.json': JSON.stringify(idx) }; };

test('1 happy path: the market equals loadMarket on the folder and the snake pathway resolves', async () => {
  const { fetchText } = fake(served());
  const r = await loadRemoteMarket({ base: BASE, fetchText });
  assert.equal(r.ok, true);
  const files = Object.fromEntries(entries.map((e) => [e.path, readFileSync(new URL(e.path, dir), 'utf8')]));
  assert.deepEqual(r.market, loadMarket({ indexText, files }).market);
  assert.equal(resolve({ market: r.market, ref: { id: 'snake.documentation-path', type: 'pathway', range: '^0.1.0' } }).ok, true);
});

test('2 requests: index first, then each indexed path sorted; one argument; no query or hash', async () => {
  const { fetchText, calls } = fake(served());
  const r = await loadRemoteMarket({ base: BASE, fetchText });
  const want = [BASE + 'index.json', ...[...new Set(entries.map((e) => e.path))].sort().map((p) => BASE + p)];
  assert.deepEqual(calls.map((c) => c[0]), want);
  assert.deepEqual(r.requests, want);
  assert.ok(calls.every((c) => c.length === 1 && !/[?#]/.test(c[0])));
});

test('3 one changed byte in one artefact: R-006 with an M- id and no market', async () => {
  const site = served(); const p = entries[0].path;
  site[p] = site[p].replace(/.$/s, (c) => (c === ' ' ? '\n' : ' '));
  const r = await loadRemoteMarket({ base: BASE, fetchText: fake(site).fetchText });
  assert.equal(r.ok, false);
  assert.equal(r.refusal.id, 'R-006');
  assert.match(r.refusal.detail.refusedBy, /^M-\d{3}$/);
  assert.equal('market' in r, false);
});

test('4 bad bases refuse with R-001 and make zero requests', async () => {
  for (const base of ['http://market.example.test/ccis/', 'https://user:pw@market.example.test/ccis/', 'https://market.example.test/ccis/?v=1', 'https://market.example.test/ccis', 'https://market.example.test/ccis/#x', 42]) {
    const { fetchText, calls } = fake(served());
    const r = await loadRemoteMarket({ base, fetchText });
    assert.equal(r.refusal.id, 'R-001', String(base));
    assert.equal(calls.length, 0);
  }
  assert.equal((await loadRemoteMarket({ base: BASE, fetchText: 'no' })).refusal.id, 'R-001');
});

test('5 hostile index paths refuse with R-004 and no file is requested', async () => {
  for (const bad of ['../x', '/abs', 'https://evil.example/x', 'a\\b', 'other/x.json', 'artefacts/../x.json', 'artefacts/%2e%2e/x']) {
    const { fetchText, calls } = fake(withIndex((i) => { i.entries[0].path = bad; }));
    const r = await loadRemoteMarket({ base: BASE, fetchText });
    assert.equal(r.refusal.id, 'R-004', bad);
    assert.equal(calls.length, 1, `only the index was requested for ${bad}`);
  }
});

test('6 caps: an oversize index gives R-003, an oversize file gives R-005', async () => {
  assert.equal((await loadRemoteMarket({ base: BASE, fetchText: fake(served()).fetchText, limits: { indexBytes: 100 } })).refusal.id, 'R-003');
  assert.equal((await loadRemoteMarket({ base: BASE, fetchText: fake(served()).fetchText, limits: { fileBytes: 100 } })).refusal.id, 'R-005');
  const r = await loadRemoteMarket({ base: BASE, fetchText: fake(served()).fetchText, limits: { fileBytes: 10 ** 9 } });
  assert.equal(r.ok, true, 'limits can only be lowered');
});

test('7 a failing request refuses with R-002 and quotes neither the URL nor the error', async () => {
  const r = await loadRemoteMarket({ base: BASE, fetchText: fake(served(), { throwOn: 3 }).fetchText });
  assert.equal(r.refusal.id, 'R-002');
  const text = JSON.stringify(r);
  assert.equal(text.includes('secret failure'), false);
  assert.equal(text.includes('market.example.test'), false);
  assert.equal(REMOTE_REFUSALS.length, 6);
});

test('8 the module source has no network, clock, randomness, eval or dynamic import', () => {
  const src = readFileSync(new URL('../ccis-remote.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const re of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /\bDate\b/, /Math\.random/, /\beval\s*\(/, /\bimport\s*\(/, /node:/]) assert.equal(re.test(src), false, String(re));
});

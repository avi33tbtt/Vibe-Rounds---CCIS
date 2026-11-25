// Row 4.1b: the browser fetch adapter, proved with a fake fetch function and no network. Prototype. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeFetchText } from '../ccis-app-fetch.js';
import { loadRemoteMarket } from '../ccis-remote.js';

const BASE = 'https://example.test/market/';
const dir = new URL('../market/', import.meta.url);
const indexText = readFileSync(new URL('index.json', dir), 'utf8');
const entries = JSON.parse(indexText).entries;
const served = () => Object.fromEntries([['index.json', indexText], ...entries.map((e) => [e.path, readFileSync(new URL(e.path, dir), 'utf8')])]);
const res = (o = {}) => ({ ok: true, status: 200, redirected: false, type: 'cors', text: async () => 'body', ...o });
const rejects = (p, msg) => assert.rejects(p, (e) => e.message === msg);
const fakeServer = (site, calls = []) => async (...args) => {
  calls.push(args);
  const rel = args[0].slice(BASE.length);
  return Object.hasOwn(site, rel) ? res({ text: async () => site[rel] }) : res({ ok: false, status: 404 });
};

test('1 the fake receives exactly a string and the frozen fixed options', async () => {
  const calls = [];
  await makeFetchText(async (...a) => { calls.push(a); return res(); })('https://example.test/x');
  assert.equal(calls.length, 1); assert.equal(calls[0].length, 2); assert.equal(typeof calls[0][0], 'string');
  assert.deepEqual(calls[0][1], { method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', mode: 'cors' });
  assert.equal(Object.isFrozen(calls[0][1]), true);
  for (const k of ['body', 'headers', 'signal', 'keepalive']) assert.equal(k in calls[0][1], false, k);
});

test('2 a 200 ok response gives its text', async () => {
  assert.equal(await makeFetchText(async () => res())('https://example.test/x'), 'body');
});

test('3 bad responses throw the fixed text, never the address', async () => {
  for (const o of [{ status: 404, ok: false }, { status: 500, ok: false }, { status: 204 }, { ok: false }, { redirected: true }, { type: 'opaque' }]) {
    await assert.rejects(makeFetchText(async () => res(o))('https://secret.example.test/x'), (e) => e.message === 'request failed' && !e.message.includes('secret'), JSON.stringify(o));
  }
});

test('4 a fetch function that throws a secret gives the fixed text only', async () => {
  await assert.rejects(makeFetchText(async () => { throw new Error('secret-token-123'); })('https://example.test/x'), (e) => e.message === 'request failed');
});

test('5 text() rejecting or returning a number gives the fixed text', async () => {
  await rejects(makeFetchText(async () => res({ text: async () => { throw new Error('boom'); } }))('https://example.test/x'), 'request failed');
  await rejects(makeFetchText(async () => res({ text: async () => 42 }))('https://example.test/x'), 'request failed');
});

test('6 a non-function fetch and a non-string address give their fixed texts', async () => {
  assert.throws(() => makeFetchText('nope'), (e) => e.message === 'fetch function is not acceptable');
  await rejects(makeFetchText(async () => res())(42), 'request is not acceptable');
});

test('7 end to end through loadRemoteMarket: loads the market, no query or fragment; one changed byte refuses R-006', async () => {
  const calls = [];
  const r = await loadRemoteMarket({ base: BASE, fetchText: makeFetchText(fakeServer(served(), calls)) });
  assert.equal(r.ok, true, JSON.stringify(r.refusal));
  assert.ok(r.requests.length >= 2);
  assert.ok(calls.every(([u]) => !u.includes('?') && !u.includes('#') && u.startsWith(BASE)));
  const site = served(); const p = entries[0].path; site[p] = site[p] + ' ';
  const bad = await loadRemoteMarket({ base: BASE, fetchText: makeFetchText(fakeServer(site)) });
  assert.equal(bad.ok, false); assert.equal(bad.refusal.id, 'R-006');
});

test('8 the module text has no network, timer, clock, storage, eval or import call', () => {
  const src = readFileSync(new URL('../ccis-app-fetch.js', import.meta.url), 'utf8');
  for (const bad of ['fetch(', 'XMLHttpRequest', 'setTimeout', 'Date', 'localStorage', 'eval', 'import(', 'import ']) assert.equal(src.includes(bad), false, bad);
});

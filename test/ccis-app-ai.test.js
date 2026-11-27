// Row 4.3a: the model-call adapter, proved with a fake fetch and no network. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeAiClient, AiError, AI_ENDPOINT, MAX_TOKENS, SYSTEM_RULES } from '../ccis-app-ai.js';

const KEY = 'sk-test-KEY-123';
const PAYLOAD = { artefactType: 'analytics-package', standardVersion: '0.1.0', instruction: 'Draft it.', sources: [{ id: 'src-1', kind: 'guideline', citation: 'c', passage: 'p' }], terminology: [] };
const REPLY = { artefact: { a: 1 }, trace: [], assumptions: [] };
const wrap = (text) => JSON.stringify({ content: [{ type: 'text', text }] });
const res = (o = {}) => ({ ok: true, status: 200, redirected: false, text: async () => wrap(JSON.stringify(REPLY)), ...o });
const client = (impl, calls = []) => ({ calls, run: (over = {}) => makeAiClient(async (...a) => { calls.push(a); return impl(...a); })({ payload: PAYLOAD, model: 'claude-sonnet-5-5', key: KEY, ...over }) });
const refused = async (p, code) => { try { await p; } catch (e) { assert.ok(e instanceof AiError); assert.equal(e.code, code); return e; } assert.fail('not refused'); };
const withText = (text) => res({ text: async () => wrap(text) });

test('4.3a: a good call sends the fixed request and returns the frozen reply', async () => {
  const c = client(() => res());
  const out = await c.run();
  const [url, opts] = c.calls[0];
  assert.equal(url, AI_ENDPOINT);
  assert.deepEqual({ ...opts, headers: undefined, body: undefined }, { method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', mode: 'cors', headers: undefined, body: undefined });
  assert.deepEqual(Object.keys(opts.headers).sort(), ['anthropic-dangerous-direct-browser-access', 'anthropic-version', 'content-type', 'x-api-key']);
  const body = JSON.parse(opts.body);
  assert.equal(body.max_tokens, MAX_TOKENS);
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].content, JSON.stringify(PAYLOAD));
  assert.deepEqual(out, REPLY);
  assert.ok(Object.isFrozen(out));
});

test('4.3a: key and model are checked; a non-function fetch is refused', async () => {
  for (const key of ['', 'a b', 'k'.repeat(201), 5, undefined]) await refused(client(() => res()).run({ key }), 'AIC-001');
  await refused(client(() => res()).run({ model: 'gpt-4' }), 'AIC-001');
  assert.throws(() => makeAiClient('fetch'));
});

test('4.3a: a payload with an extra or missing member is refused and nothing is sent', async () => {
  const c = client(() => res());
  for (const k of ['context', 'runRecord', 'patient']) await refused(c.run({ payload: { ...PAYLOAD, [k]: {} } }), 'AIC-004');
  const { terminology, ...less } = PAYLOAD;
  await refused(c.run({ payload: less }), 'AIC-004');
  assert.equal(c.calls.length, 0);
});

test('4.3a: a failed request is one fixed sentence with no key, status, body or address', async () => {
  const cases = [() => { throw new Error(`boom ${KEY} ${AI_ENDPOINT}`); }, () => res({ status: 401 }), () => res({ ok: false }), () => res({ redirected: true }), () => res({ text: async () => 'not json SECRET-BODY' })];
  for (const impl of cases) {
    const e = await refused(client(impl).run(), 'AIC-002');
    for (const s of [KEY, '401', 'SECRET-BODY', 'anthropic', 'boom']) assert.ok(!e.message.includes(s));
  }
});

test('4.3a: reply shapes: a fence parses; everything else is AIC-003', async () => {
  assert.deepEqual(await client(() => withText('```json\n' + JSON.stringify(REPLY) + '\n```')).run(), REPLY);
  const bad = ['Here is a draft.', JSON.stringify(REPLY) + JSON.stringify(REPLY), '[]', JSON.stringify({ ...REPLY, extra: 1 }), 'x'.repeat(200001)];
  for (const t of bad) await refused(client(() => withText(t)).run(), 'AIC-003');
  await refused(client(() => res({ text: async () => JSON.stringify({ content: [{ type: 'tool_use' }] }) })).run(), 'AIC-003');
});

test('4.3a: the key appears only in the x-api-key header of the one call', async () => {
  const c = client(() => res());
  const out = await c.run();
  const [, opts] = c.calls[0];
  assert.equal(c.calls.length, 1);
  assert.equal(opts.headers['x-api-key'], KEY);
  assert.ok(!opts.body.includes(KEY) && !JSON.stringify(out).includes(KEY));
  for (const [k, v] of Object.entries(opts.headers)) if (k !== 'x-api-key') assert.ok(!v.includes(KEY));
});

test('4.3a: the system text holds each safety sentence', async () => {
  const c = client(() => res());
  await c.run();
  const sys = JSON.parse(c.calls[0][1].body).system;
  assert.equal(SYSTEM_RULES.length, 5);
  for (const s of SYSTEM_RULES) assert.ok(sys.includes(s));
  assert.ok(/numeric literal/.test(sys) && /Never claim clinical validity/.test(sys) && /only draft/.test(sys));
});

test('4.3a: purity scan of the module', () => {
  const src = readFileSync(new URL('../ccis-app-ai.js', import.meta.url), 'utf8').replace(/^\/\/.*$/gm, '');
  assert.ok(!/\bfetch\s*\(/.test(src));
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|setTimeout|setInterval|\beval\b|new Function|\bimport\(/.test(src));
});

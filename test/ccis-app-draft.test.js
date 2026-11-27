// Row 4.3b: the pure page model for governed AI drafting. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { draftForPage, draftModel, DRAFT_SENTENCES } from '../ccis-app-draft.js';
import { DRAFT_REFUSALS } from '../ccis-draft.js';
import { AiError, AI_REFUSALS } from '../ccis-app-ai.js';

const KEY = 'sk-test-KEY-123';
const MODEL = 'claude-sonnet-5-5';
const SRC = { id: 'src-1', kind: 'guideline', citation: 'Synthetic guideline', passage: 'A synthetic passage.' };
const REQ = { artefactType: 'analytics-package', standardVersion: '0.1.0', instruction: 'Draft it.', sources: [SRC], terminology: [] };
const doc = () => JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-interval.analytics.json', import.meta.url), 'utf8'));
const reply = (artefact = doc(), extra = {}) => ({
  artefact, trace: Object.keys(artefact).filter((k) => k !== 'manifest').map((member) => ({ member, source: 'src-1' })), assumptions: [], ...extra,
});
const fake = (impl, calls = []) => ({ calls, draftWithModel: async (a) => { calls.push(a); return impl(a); } });
const run = (client, over = {}) => draftForPage({ enabled: true, key: KEY, model: MODEL, request: REQ, client, ...over });

test('4.3b: a good run returns the frozen draft; the client saw the five payload members, key and model once', async () => {
  const c = fake(() => reply());
  const r = await run(c);
  assert.equal(r.ok, true);
  assert.ok(Object.isFrozen(r.draft) && Object.isFrozen(r.draft.trace));
  assert.equal(c.calls.length, 1);
  assert.deepEqual(Object.keys(c.calls[0].payload).sort(), ['artefactType', 'instruction', 'sources', 'standardVersion', 'terminology']);
  assert.equal(c.calls[0].key, KEY);
  assert.equal(c.calls[0].model, MODEL);
});

test('4.3b: switch off (absent, false, "true") is the AI-001 sentence and the client is never called', async () => {
  for (const v of [undefined, false, 'true']) {
    const c = fake(() => reply());
    const r = await run(c, { enabled: v });
    assert.equal(r.ok, false);
    assert.equal(r.sentence, DRAFT_SENTENCES['AI-001']);
    assert.equal(c.calls.length, 0);
  }
});

test('4.3b: each client refusal is its own sentence; an unexpected throw is fixed and hides its message', async () => {
  for (const { code } of AI_REFUSALS) {
    const r = await run(fake(() => { throw new AiError(code); }));
    assert.equal(r.ok, false);
    assert.equal(r.sentence, DRAFT_SENTENCES[code]);
  }
  const r = await run(fake(() => { throw new Error('secret-detail ' + KEY); }));
  assert.equal(r.ok, false);
  assert.ok(!JSON.stringify(r).includes('secret-detail') && !JSON.stringify(r).includes(KEY));
  const none = await run({});
  assert.equal(none.ok, false);
  assert.equal(typeof none.sentence, 'string');
});

test('4.3b: a reply that breaks a rule is refused with its sentence, code and path', async () => {
  const bad = doc();
  bad.manifest = { ...bad.manifest, status: 'validated' };
  const a = await run(fake(() => reply(bad)));
  assert.equal(a.sentence, DRAFT_SENTENCES['AI-004']);
  const b = await run(fake(() => reply(doc(), { trace: [] })));
  assert.equal(b.sentence, DRAFT_SENTENCES['AI-005']);
  assert.equal(b.code, 'AI-005');
  assert.equal(typeof b.path, 'string');
  const lit = doc();
  lit.computation = { op: 'add', args: [{ number: 5 }] };
  const c = await run(fake(() => reply(lit)));
  assert.equal(c.sentence, DRAFT_SENTENCES['AI-006']);
});

test('4.3b: every refusal code of both tables has a sentence; none holds the key or a path', () => {
  for (const { code } of [...DRAFT_REFUSALS, ...AI_REFUSALS]) assert.equal(typeof DRAFT_SENTENCES[code], 'string', code);
  for (const s of Object.values(DRAFT_SENTENCES)) assert.ok(!s.includes(KEY) && !/[\\/]|\.json|artefact\./.test(s), s);
  assert.ok(Object.isFrozen(DRAFT_SENTENCES));
});

test('4.3b: the key never appears in any result, sentence or draft', async () => {
  const results = [
    await run(fake(() => reply())),
    await run(fake(() => reply(doc(), { trace: [] }))),
    await run(fake(() => { throw new AiError('AIC-002'); })),
    await run(fake(() => reply()), { enabled: false }),
  ];
  for (const r of results) assert.ok(!JSON.stringify(r).includes(KEY));
});

test('4.3b: draftModel gives the label, draft status, headline and one row per non-manifest member in file order, frozen', async () => {
  const art = doc();
  const members = Object.keys(art).filter((k) => k !== 'manifest');
  const r = await run(fake(() => reply(art, {
    trace: members.filter((k) => k !== 'question').map((member) => ({ member, source: 'src-1' })),
    assumptions: [{ member: 'question', note: 'Assumed for the synthetic demo.' }],
  })));
  assert.equal(r.ok, true);
  const m = draftModel(r.draft);
  assert.equal(m.status, 'draft');
  assert.equal(m.sourceClass, 'AI-proposed');
  assert.equal(m.label, r.draft.label);
  assert.equal(m.headline, 'Draft only. A human must review it. It is not published or validated.');
  assert.deepEqual(m.rows.map((x) => x.member), Object.keys(r.draft.artefact).filter((k) => k !== 'manifest'));
  assert.equal(m.rows.length, members.length);
  const q = m.rows.findIndex((x) => x.member === 'question');
  assert.equal(m.rows[q].basis, 'Assumption: Assumed for the synthetic demo.');
  assert.ok(m.rows.filter((_, i) => i !== q).every((x) => x.basis === 'Source: src-1'));
  assert.equal(m.notes, `${members.length} members, 1 assumption.`);
  assert.ok(Object.isFrozen(m) && Object.isFrozen(m.rows) && Object.isFrozen(m.rows[0]));
});

test('4.3b: ccis-app-draft.js is pure (no network call, storage, timer, eval, Function or page access)', () => {
  const src = readFileSync(new URL('../ccis-app-draft.js', import.meta.url), 'utf8');
  for (const bad of ['fetch(', 'localStorage', 'sessionStorage', 'indexedDB', 'setTimeout', 'setInterval', 'eval(', 'Function', 'document', 'window']) {
    assert.ok(!src.includes(bad), bad);
  }
});

// Row 4.3b.1: the AI draft view (jsdom over a bare div, a stub draft function). Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountDraftView } from '../ccis-app-draft-view.js';

const KEY = 'sk-test-KEY-123';
const INSTR = 'Draft the interval analytics.';
const CITE = 'Synthetic guideline';
const PASS = 'A synthetic passage.';
const HEADLINE = 'Draft only. A human must review it. It is not published or validated.';
const GOOD = () => Object.freeze({
  ok: true,
  draft: Object.freeze({
    artefact: Object.freeze({ manifest: {}, question: 1, inputs: 2 }), label: 'AI-drafted, unreviewed. Not clinically validated.',
    status: 'draft', sourceClass: 'AI-proposed', assumptions: Object.freeze([{ member: 'inputs', note: 'Assumed.' }]),
    trace: Object.freeze([{ member: 'question', source: 'src-1' }]),
  }),
});

function mount(draft = async () => GOOD()) {
  const w = new JSDOM('<div id="r"></div>').window;
  const states = [];
  const calls = [];
  const drafts = [];
  const d = w.document;
  const api = mountDraftView({
    document: d, root: d.getElementById('r'), onState: (s) => states.push(s), types: ['analytics-package', 'element'], kinds: ['guideline', 'paper'],
    draft: async (a) => { calls.push(a); return draft(a); }, onDraft: (x) => drafts.push(x),
  });
  const root = d.getElementById('r');
  const fire = (n, t) => n.dispatchEvent(new w.Event(t, { bubbles: true }));
  const input = (label) => root.querySelector(`input[aria-label^="${label}"]`);
  const set = (label, v) => { input(label).value = v; fire(input(label), 'input'); };
  const btn = (name) => [...root.querySelectorAll('button')].find((b) => b.textContent === name);
  const sw = () => input('Allow AI drafting');
  const fill = () => {
    sw().checked = true; fire(sw(), 'change');
    set('API key', KEY); set('Source citation', CITE); set('Source passage', PASS); set('Instruction', INSTR);
  };
  return { w, d, root, api, states, calls, drafts, fire, input, set, btn, sw, fill, last: () => states[states.length - 1], text: () => root.textContent };
}
const click = async (m, name) => { m.btn(name).click(); await new Promise((r) => setTimeout(r, 0)); };

test('4.3b.1: mounts off, Draft disabled, key field is a password, no link, image, script, textarea or release control', () => {
  const m = mount();
  assert.equal(m.sw().checked, false);
  assert.equal(m.btn('Draft').disabled, true);
  assert.equal(m.input('API key').type, 'password');
  assert.equal(m.input('API key').getAttribute('autocomplete'), 'off');
  assert.equal(m.root.querySelector('a, img, script, textarea'), null);
  assert.ok(!/publish|validate|approve|save/i.test([...m.root.querySelectorAll('button')].map((b) => b.textContent).join(' ')));
  assert.deepEqual(m.last(), { enabled: false, hasKey: false, ready: false, drafted: false, refused: false, rows: 0 });
});

test('4.3b.1: Draft needs the switch and every field; the stub sees enabled and the exact request', async () => {
  const m = mount();
  m.set('API key', KEY); m.set('Source citation', CITE); m.set('Source passage', PASS); m.set('Instruction', INSTR);
  assert.equal(m.btn('Draft').disabled, true);
  m.sw().checked = true; m.fire(m.sw(), 'change');
  assert.equal(m.btn('Draft').disabled, false);
  m.set('Instruction', '  ');
  assert.equal(m.btn('Draft').disabled, true);
  m.set('Instruction', INSTR);
  await click(m, 'Draft');
  assert.equal(m.calls.length, 1);
  const c = m.calls[0];
  assert.equal(c.enabled, true);
  assert.equal(c.key, KEY);
  assert.equal(c.model, 'claude-sonnet-5-5');
  assert.deepEqual(c.request, {
    artefactType: 'analytics-package', standardVersion: '0.1.0', instruction: INSTR,
    sources: [{ id: 'src-1', kind: 'guideline', citation: CITE, passage: PASS }], terminology: [],
  });
});

test('4.3b.1: a good result shows label, headline, one row per member and notes; onDraft once', async () => {
  const m = mount();
  m.fill();
  await click(m, 'Draft');
  const t = m.text();
  assert.ok(t.includes('AI-drafted, unreviewed. Not clinically validated.') && t.includes(HEADLINE));
  const rows = [...m.root.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent));
  assert.deepEqual(rows, [['question', 'Source: src-1'], ['inputs', 'Assumption: Assumed.']]);
  assert.ok(t.includes('2 members, 1 assumption.'));
  assert.equal(m.drafts.length, 1);
  assert.deepEqual(m.last(), { enabled: true, hasKey: false, ready: false, drafted: true, refused: false, rows: 2 });
});

test('4.3b.1: the key input is empty after a good run, a refusal and a throwing stub', async () => {
  for (const stub of [async () => GOOD(), async () => ({ ok: false, sentence: 'No.' }), async () => { throw new Error('boom ' + KEY); }]) {
    const m = mount(stub);
    m.fill();
    assert.equal(m.input('API key').value, KEY);
    await click(m, 'Draft');
    assert.equal(m.input('API key').value, '');
    assert.ok(!m.root.innerHTML.includes(KEY));
  }
});

test('4.3b.1: a refusal shows its sentence, code and path; a throw shows the fixed sentence without its message', async () => {
  const a = mount(async () => ({ ok: false, sentence: 'The draft was refused.', code: 'AI-005', path: 'question' }));
  a.fill();
  await click(a, 'Draft');
  assert.equal(a.root.querySelector('p.refusal').textContent, 'The draft was refused. Code: AI-005. Member: question.');
  assert.equal(a.root.querySelector('table'), null);
  assert.equal(a.drafts.length, 0);
  assert.deepEqual(a.last(), { enabled: true, hasKey: false, ready: false, drafted: false, refused: true, rows: 0 });
  const b = mount(async () => { throw new Error('secret-detail'); });
  b.fill();
  await click(b, 'Draft');
  assert.equal(b.root.querySelector('p.refusal').textContent, 'Drafting stopped unexpectedly. Nothing was drafted.');
  assert.ok(!b.text().includes('secret-detail'));
});

test('4.3b.1: onState over a whole session never holds the key, instruction, citation, passage or a sentence', async () => {
  const m = mount(async () => ({ ok: false, sentence: 'A fixed sentence.' }));
  m.fill();
  await click(m, 'Draft');
  m.btn('Clear').click();
  const all = JSON.stringify(m.states);
  for (const s of [KEY, INSTR, CITE, PASS, 'A fixed sentence.', 'src-1']) assert.ok(!all.includes(s), s);
  for (const s of m.states) assert.deepEqual(Object.keys(s), ['enabled', 'hasKey', 'ready', 'drafted', 'refused', 'rows']);
});

test('4.3b.1: switching off or Clear empties key, result and status; an edit clears a stale result', async () => {
  const m = mount();
  m.fill();
  await click(m, 'Draft');
  assert.ok(m.root.querySelector('table'));
  m.set('Instruction', 'Another instruction.');
  assert.equal(m.root.querySelector('table'), null);
  m.fill();
  await click(m, 'Draft');
  m.sw().checked = false; m.fire(m.sw(), 'change');
  assert.equal(m.root.querySelector('table'), null);
  assert.equal(m.input('API key').value, '');
  assert.equal(m.btn('Draft').disabled, true);
  m.fill();
  m.input('API key').value = KEY;
  await click(m, 'Draft');
  m.btn('Clear').click();
  assert.equal(m.root.querySelector('table'), null);
  assert.equal(m.input('API key').value, '');
  assert.equal(m.root.querySelector('p[aria-live]').textContent, '');
});

test('4.3b.1: hostile strings in member, basis and sentence appear only as text', async () => {
  const bad = ['<img src=x onerror=1>', 'javascript:1', '"><script>alert(1)</script>'];
  const evil = { ok: true, draft: { ...GOOD().draft, artefact: { manifest: {}, [bad[0]]: 1 }, assumptions: [{ member: bad[0], note: bad[1] }], trace: [] } };
  for (const stub of [async () => evil, async () => ({ ok: false, sentence: bad[2], code: bad[1], path: bad[0] })]) {
    const m = mount(stub);
    m.fill();
    await click(m, 'Draft');
    assert.equal(m.root.querySelector('img, script, a'), null);
    for (const n of m.root.querySelectorAll('*')) for (const a of n.attributes) assert.ok(!/^on/i.test(a.name) && a.name !== 'style' && a.name !== 'href', a.name);
    assert.ok(m.text().includes(bad[0]));
  }
});

// Row 4.3b.3: hostile-string sweep of the AI draft view (jsdom, stub draft function). Prototype. Synthetic data only. Not for clinical use.
// Hostile text reaches the view as model reply text, typed fields, refusal members, thrown errors and option lists. It must end as text only.
// Failure messages name a string number, never the string.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountDraftView } from '../ccis-app-draft-view.js';
import { HOSTILE, inert } from './hostile-kit.js';

const KEY = 'sk-test-KEY-123';
const DEFECT = 'Drafting stopped unexpectedly. Nothing was drafted.';
const ALL_STATES = [];
const draftWith = (h) => ({
  ok: true,
  draft: { artefact: { manifest: {}, [h]: 1 }, label: h, status: 'draft', sourceClass: 'AI-proposed', assumptions: [{ member: h, note: h }], trace: [] },
});

function rig(draft, { types = ['analytics-package'], kinds = ['guideline'] } = {}) {
  const w = new JSDOM('<div id="r"></div>').window;
  const root = w.document.getElementById('r');
  const calls = [];
  mountDraftView({
    document: w.document, root, onState: (s) => ALL_STATES.push(s), types, kinds,
    draft: async (a) => { calls.push(a); return draft(a); },
  });
  const input = (label) => root.querySelector(`input[aria-label^="${label}"]`);
  const set = (label, v) => { input(label).value = v; input(label).dispatchEvent(new w.Event('input', { bubbles: true })); };
  const click = async () => {
    [...root.querySelectorAll('button')].find((b) => b.textContent === 'Draft').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const run = async (vals = {}) => {
    const sw = input('Allow AI drafting');
    sw.checked = true; sw.dispatchEvent(new w.Event('change', { bubbles: true }));
    set('API key', KEY);
    set('Source citation', vals.cite ?? 'Synthetic guideline');
    set('Source passage', vals.passage ?? 'A synthetic passage.');
    set('Instruction', vals.instr ?? 'Draft it.');
    if (vals.model !== undefined) set('Model', vals.model);
    await click();
  };
  return { w, root, calls, input, run };
}
const text = (root) => root.textContent;

test('reply text: a hostile label, member, note and source end as cell or paragraph text', async () => {
  for (const [i, h] of HOSTILE.entries()) {
    const r = rig(async () => draftWith(h));
    await r.run();
    inert(r.root, `reply ${i}`);
    assert.ok(text(r.root).includes(h.slice(0, 20)) || h.length > 20, `reply ${i}: not shown as text`);
    assert.equal(r.root.querySelectorAll('table td').length >= 2, true, `reply ${i}: no rows`);
  }
});

test('typed fields: hostile text is passed on unchanged and never echoed', async () => {
  for (const [i, h] of HOSTILE.entries()) {
    const r = rig(async () => ({ ok: false, sentence: 'Refused.' }));
    await r.run({ instr: h, cite: h, passage: h, model: h });
    inert(r.root, `typed ${i}`);
    assert.equal(r.calls.length, 1, `typed ${i}: calls`);
    assert.equal(r.calls[0].request.instruction, h, `typed ${i}: instruction changed`);
    assert.equal(r.calls[0].model, h, `typed ${i}: model changed`);
    assert.equal(text(r.root).includes(h), false, `typed ${i}: echoed`);
  }
});

test('refusal members: a hostile sentence, code and path end as status text', async () => {
  for (const [i, h] of HOSTILE.entries()) {
    const r = rig(async () => ({ ok: false, sentence: h, code: h, path: h }));
    await r.run();
    inert(r.root, `refusal ${i}`);
    assert.equal(r.root.querySelectorAll('table').length, 0, `refusal ${i}: table shown`);
    assert.ok(r.root.querySelector('.refusal'), `refusal ${i}: no refusal line`);
  }
});

test('a throwing draft function shows the fixed defect sentence and leaks neither string nor key', async () => {
  for (const [i, h] of HOSTILE.entries()) {
    const r = rig(async () => { throw new Error(h + KEY); });
    await r.run();
    inert(r.root, `throw ${i}`);
    assert.ok(text(r.root).includes(DEFECT), `throw ${i}: no defect sentence`);
    assert.equal(text(r.root).includes(KEY), false, `throw ${i}: key shown`);
    assert.equal(text(r.root).includes(h), false, `throw ${i}: string shown`);
  }
});

test('hostile option lists stay text and the view still mounts', () => {
  for (const [i, h] of HOSTILE.entries()) {
    const r = rig(async () => ({ ok: false }), { types: [h], kinds: [h] });
    inert(r.root, `options ${i}`);
    const opts = [...r.root.querySelectorAll('option')].map((o) => o.textContent);
    assert.deepEqual(opts, [h, h], `options ${i}: option text`);
  }
});

test('a 3000-character instruction and passage still draft, with unchanged rows', async () => {
  const long = 'x'.repeat(3000);
  const r = rig(async () => draftWith('inputs'));
  await r.run({ instr: long, passage: long });
  inert(r.root, 'long');
  assert.equal(r.calls[0].request.sources[0].passage.length, 3000);
  assert.equal(r.root.querySelectorAll('tbody tr').length, 1);
});

test('seam: every onState value is a boolean or a whole number', () => {
  assert.ok(ALL_STATES.length > 0);
  for (const [i, s] of ALL_STATES.entries()) {
    for (const [k, v] of Object.entries(s)) {
      assert.ok(typeof v === 'boolean' || Number.isInteger(v), `state ${i}: ${k} is ${typeof v}`);
    }
  }
});

test('key hygiene: the key input is empty after a good reply, a refusal and a throw', async () => {
  const stubs = [async () => draftWith('inputs'), async () => ({ ok: false, sentence: 'No.' }), async () => { throw new Error('x'); }];
  for (const [i, stub] of stubs.entries()) {
    const r = rig(stub);
    await r.run();
    assert.equal(r.input('API key').value, '', `outcome ${i}: key left in input`);
    assert.equal(r.root.innerHTML.includes(KEY), false, `outcome ${i}: key in markup`);
  }
});

// Row 4.3b.2: the AI draft view is wired into the page. jsdom with scripts run over the committed index.html and over a
// build with --ai-origin; window.fetch is a recording fake. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildApp } from '../scripts/build-app.js';

const ROOT = new URL('../', import.meta.url);
const committed = readFileSync(new URL('index.html', ROOT), 'utf8');
const dist = buildApp({ aiOrigin: 'https://api.anthropic.com' });
const KEY = 'sk-test-KEY-123';
const INSTR = 'Draft the interval analytics.';
const doc = () => JSON.parse(readFileSync(new URL('ccis/examples/snake/snake-interval.analytics.json', ROOT), 'utf8'));
const reply = (artefact = doc()) => ({ artefact, trace: Object.keys(artefact).filter((k) => k !== 'manifest').map((member) => ({ member, source: 'src-1' })), assumptions: [] });
const resp = (r) => ({ ok: true, status: 200, redirected: false, text: async () => JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(r) }] }) });
const plain = (x) => JSON.parse(JSON.stringify(x));
const INITIAL = { enabled: false, hasKey: false, ready: false, drafted: false, refused: false, rows: 0 };

function page(html, { throwWith, answer = reply() } = {}) {
  const calls = [];
  const w = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://page.example/',
    beforeParse(win) {
      win.structuredClone = (x) => win.JSON.parse(win.JSON.stringify(x));
      win.fetch = async (url, opts) => {
        calls.push({ url, opts });
        if (throwWith) throw new Error(throwWith);
        return resp(answer);
      };
    },
  }).window;
  const root = w.document.getElementById('draft');
  const fire = (n, t) => n.dispatchEvent(new w.Event(t, { bubbles: true }));
  const input = (label) => root.querySelector(`input[aria-label^="${label}"]`);
  const set = (label, v) => { input(label).value = v; fire(input(label), 'input'); };
  const sw = () => input('Allow AI drafting');
  const fill = () => {
    sw().checked = true; fire(sw(), 'change');
    const t = root.querySelector('select[aria-label="Artefact type"]');
    t.value = 'analytics-package'; fire(t, 'change');
    set('API key', KEY); set('Source citation', 'Synthetic guideline'); set('Source passage', 'A synthetic passage.'); set('Instruction', INSTR);
  };
  const draft = async () => {
    [...root.querySelectorAll('button')].find((b) => b.textContent === 'Draft').click();
    for (let i = 0; i < 400 && !root.querySelector('table, p.refusal'); i++) await new Promise((r) => w.setTimeout(r, 0));
  };
  return { w, calls, root, input, set, sw, fill, draft, fire };
}

test('4.3b.2: committed page: the section shows, switch off, Draft disabled, password key, initial state, nothing sent', () => {
  const p = page(committed);
  assert.ok(p.root);
  assert.equal(p.sw().checked, false);
  assert.equal([...p.root.querySelectorAll('button')].find((b) => b.textContent === 'Draft').disabled, true);
  assert.equal(p.input('API key').type, 'password');
  assert.deepEqual(plain(p.w.ccisApp.draftState()), INITIAL);
  assert.match(p.w.document.getElementById('status').textContent, /^Ready\. No market is loaded and nothing has been run\.$/);
  assert.equal(p.calls.length, 0);
});

test('4.3b.2: committed page, switch on and filled: one call, a throw shows the fixed AIC-002 sentence and no secret', async () => {
  const p = page(committed, { throwWith: 'secret-token' });
  p.fill();
  await p.draft();
  assert.equal(p.calls.length, 1);
  assert.match(p.root.querySelector('p.refusal').textContent, /^The model request failed\./);
  assert.ok(!p.w.document.body.textContent.includes('secret-token'));
  assert.equal(p.w.ccisApp.draftState().refused, true);
});

test('4.3b.2: distribution page, good reply: label, headline and a row per member; draftState counts them', async () => {
  const p = page(dist);
  p.fill();
  await p.draft();
  const members = Object.keys(doc()).filter((k) => k !== 'manifest').length;
  const t = p.root.textContent;
  assert.ok(t.includes('AI-drafted, unreviewed. Not clinically validated.'));
  assert.ok(t.includes('Draft only. A human must review it. It is not published or validated.'));
  assert.equal(p.root.querySelectorAll('tbody tr').length, members);
  assert.deepEqual(plain(p.w.ccisApp.draftState()), { enabled: true, hasKey: false, ready: false, drafted: true, refused: false, rows: members });
});

test('4.3b.2: the one request: fixed URL, POST, exactly the five payload members, typed key header, no credentials', async () => {
  const p = page(dist);
  p.fill();
  await p.draft();
  assert.equal(p.calls.length, 1);
  const { url, opts } = p.calls[0];
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(opts.method, 'POST');
  assert.equal(opts.credentials, 'omit');
  assert.equal(opts.headers['x-api-key'], KEY);
  assert.ok(!('cookie' in opts.headers) && !('authorization' in opts.headers));
  const sent = JSON.parse(JSON.parse(opts.body).messages[0].content);
  assert.deepEqual(Object.keys(sent).sort(), ['artefactType', 'instruction', 'sources', 'standardVersion', 'terminology']);
});

test('4.3b.2: the key is empty after the run and absent from the page, every seam and storage', async () => {
  const p = page(dist);
  p.fill();
  await p.draft();
  assert.equal(p.input('API key').value, '');
  const seams = Object.keys(p.w.ccisApp).filter((k) => /State$/.test(k)).map((k) => p.w.ccisApp[k]());
  assert.ok(!JSON.stringify(seams).includes(KEY));
  assert.ok(!p.w.document.documentElement.innerHTML.includes(KEY));
  assert.ok(!JSON.stringify(p.w.ccisApp).includes(KEY));
  assert.equal(p.w.localStorage.length + p.w.sessionStorage.length, 0);
});

test('4.3b.2: a reply with status validated shows the AI-004 sentence and no table', async () => {
  const bad = doc();
  bad.manifest = { ...bad.manifest, status: 'validated' };
  const p = page(dist, { answer: reply(bad) });
  p.fill();
  await p.draft();
  assert.match(p.root.querySelector('p.refusal').textContent, /^The draft was refused: a draft cannot be published, validated or approved\./);
  assert.equal(p.root.querySelector('table'), null);
});

test('4.3b.2: seams: draftState listed with booleans and counts only; no on* attribute; other seams untouched', async () => {
  const p = page(dist);
  const before = JSON.stringify(['state', 'importState', 'remoteState', 'selectorState', 'catalogueState', 'runState', 'resultsState', 'exportState'].map((k) => p.w.ccisApp[k]()));
  assert.ok(Object.keys(p.w.ccisApp).includes('draftState'));
  p.fill();
  await p.draft();
  const s = p.w.ccisApp.draftState();
  assert.deepEqual(Object.keys(s), Object.keys(INITIAL));
  assert.ok(Object.values(s).every((v) => typeof v === 'boolean' || Number.isInteger(v)));
  for (const n of p.w.document.querySelectorAll('*')) for (const a of n.attributes) assert.ok(!/^on/i.test(a.name), a.name);
  const after = JSON.stringify(['state', 'importState', 'remoteState', 'selectorState', 'catalogueState', 'runState', 'resultsState', 'exportState'].map((k) => p.w.ccisApp[k]()));
  assert.equal(after, before);
});

test('4.3b.2: source scan of ccis-app.js: no fetch call of its own, timer, storage, innerHTML or window assignment of key, model, client', () => {
  const src = readFileSync(new URL('ccis-app.js', ROOT), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const bad of [/\bfetch\s*\(/, /setTimeout|setInterval/, /localStorage|sessionStorage|indexedDB/, /innerHTML/, /window\.(key|model|client|apiKey|draft)\b/i]) {
    assert.ok(!bad.test(src), String(bad));
  }
});

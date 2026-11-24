import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountSelectorView } from '../ccis-app-selector-view.js';

const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
const market = { index: idx, files: {} };
const CTX = 'snake.envenomation-timing@0.1.0';
const PATH = 'snake.documentation-path@0.1.0';
const entry = (type, id, version, references = []) => ({ type, id, version, status: 'draft', references });
const small = (entries) => ({ index: { format: 'ccis-market/1', entries }, files: {} });

function mount() {
  const w = new JSDOM('<div id="r"></div>').window;
  const states = [];
  const api = mountSelectorView({ document: w.document, root: w.document.getElementById('r'), onState: (s) => states.push(s) });
  const [c, p] = w.document.querySelectorAll('select');
  const pick = (select, value) => { select.value = value; select.dispatchEvent(new w.Event('change')); };
  return { w, d: w.document, api, states, c, p, pick, last: () => states[states.length - 1], line: () => w.document.querySelector('[aria-live]').textContent };
}

test('before a market: both selects are disabled with only the placeholder, and the load sentence shows', () => {
  const { c, p, line, last } = mount();
  for (const s of [c, p]) { assert.equal(s.disabled, true); assert.equal(s.options.length, 1); }
  assert.equal(line(), 'Load a market to choose a context and a pathway. Nothing has been run.');
  assert.equal(last().ready, false);
});

test('setMarket with the committed market: one option each beyond the placeholder, with the status', () => {
  const { api, c, p } = mount();
  api.setMarket(market);
  assert.equal(c.disabled, false);
  assert.deepEqual([...c.options].map((o) => o.value), ['', CTX]);
  assert.deepEqual([...p.options].map((o) => o.value), ['', PATH]);
  assert.match(c.options[1].textContent, /^snake\.envenomation-timing 0\.1\.0 \(draft\)$/);
});

test('choosing both gives ready and the fixed sentence', () => {
  const { api, c, p, pick, line, last } = mount();
  api.setMarket(market);
  pick(c, CTX);
  assert.equal(last().ready, false);
  pick(p, PATH);
  assert.deepEqual({ ...last(), message: undefined }, { contextChosen: true, pathwayChosen: true, mismatch: false, ready: true, message: undefined });
  assert.equal(line(), 'Context: snake.envenomation-timing 0.1.0. Pathway: snake.documentation-path 0.1.0. Nothing has been run.');
});

test('a context the pathway does not reference is flagged, not blocked', () => {
  const { api, c, p, pick, line, last } = mount();
  api.setMarket(small([entry('contextual-element', 'c1', '0.1.0'), entry('contextual-element', 'c2', '0.1.0'), entry('pathway', 'p', '0.1.0', [{ id: 'c1', type: 'contextual-element', version: '0.1.0' }])]));
  pick(p, 'p@0.1.0');
  pick(c, 'c2@0.1.0');
  assert.equal(last().mismatch, true);
  assert.equal(last().ready, false);
  assert.equal(line(), 'Context: c2 0.1.0. Pathway: p 0.1.0. This pathway does not reference the chosen context. Nothing has been run.');
});

test('setImport marks the applied option and keeps the selection; setMarket empties it', () => {
  const { api, c, pick, last } = mount();
  api.setMarket(market);
  pick(c, CTX);
  api.setImport([{ id: 'snake.envenomation-timing', type: 'contextual-element', version: '0.1.0', held: true }]);
  assert.match(c.options[1].textContent, /\(applied by import\)$/);
  assert.equal(c.value, CTX);
  assert.equal(last().contextChosen, true);
  api.setMarket(market);
  assert.equal(c.value, '');
  assert.equal(last().contextChosen, false);
  assert.doesNotMatch(c.options[1].textContent, /applied/);
});

test('Clear and reset empty both selects and report all false', () => {
  const { api, d, c, p, pick, last } = mount();
  api.setMarket(market);
  pick(c, CTX);
  pick(p, PATH);
  d.querySelector('button').click();
  assert.deepEqual([c.value, p.value], ['', '']);
  assert.deepEqual([last().contextChosen, last().pathwayChosen, last().mismatch, last().ready], [false, false, false, false]);
  pick(c, CTX);
  api.reset();
  assert.equal(c.disabled, true);
  assert.equal(c.options.length, 1);
  assert.deepEqual([last().contextChosen, last().ready], [false, false]);
});

test('a hostile id shows as text only', () => {
  const { api, d, c, pick, line } = mount();
  const bad = '<img src=x onerror=1>';
  api.setMarket(small([entry('contextual-element', bad, '0.1.0')]));
  pick(c, `${bad}@0.1.0`);
  assert.equal(d.querySelectorAll('img').length, 0);
  assert.ok(line().includes(bad));
  assert.equal([...d.querySelectorAll('*')].some((n) => [...n.attributes].some((a) => a.name.startsWith('on'))), false);
});

test('ccis-app-selector-view.js uses no markup injection, storage, network, clock or dynamic code', () => {
  const src = readFileSync('ccis-app-selector-view.js', 'utf8');
  for (const word of ['innerHTML', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'eval', 'Date', 'Math.random', 'import(', 'onclick']) {
    assert.equal(src.includes(word), false, word);
  }
});

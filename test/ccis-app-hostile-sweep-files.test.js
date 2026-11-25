// Row 3.10.1c: hostile-string sweep over the two file-fed views (market, import). Prototype. Synthetic data only. Not for clinical use.
// Hostile text reaches these views as file text, file names, index members and envelope members. It must end as text, nothing else,
// and a refused envelope or path never quotes what it refused. Failure messages name a string number, never the string.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountMarketView } from '../ccis-app-market-view.js';
import { mountImportView } from '../ccis-app-import-view.js';
import { HOSTILE, inert, feedFiles } from './hostile-kit.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
const FILES = idx.entries.map((e) => ({ path: e.path, text: readFileSync(`market/${e.path}`, 'utf8') }));
const market = { index: idx, files: Object.fromEntries(FILES.map((f) => [f.path, f.text])) };
const FIXTURE = JSON.parse(readFileSync('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json', 'utf8'));
const CUT = 120; // refusalView cuts each detail line at this length

const rig = (mountFn, extra = {}) => {
  const w = new JSDOM('<div id="r"></div>').window;
  const root = w.document.getElementById('r');
  const states = [];
  mountFn({ document: w.document, root, onState: (s) => states.push(s), ...extra });
  return { w, root, input: root.querySelector('input'), last: () => states[states.length - 1] };
};
const importRig = () => rig(mountImportView, { getMarket: () => market });
const marketItems = (index, omitPath) => [
  { name: 'index.json', path: 'market/index.json', text: JSON.stringify(index) },
  ...FILES.filter((f) => f.path !== omitPath).map((f) => ({ name: f.path.split('/').pop(), path: `market/${f.path}`, text: f.text })),
];
const lines = (root) => [...root.querySelectorAll('li')].map((li) => li.textContent);
const envelopeWith = (mutate) => {
  const e = clone(FIXTURE);
  mutate(e);
  return JSON.stringify(e);
};

test('market, loaded: a hostile status and validation outcome end as cell text', async () => {
  for (const [i, h] of HOSTILE.entries()) {
    const index = clone(idx);
    for (const e of index.entries) {
      e.status = h;
      e.validation.outcome = h;
    }
    const { w, root, input, last } = rig(mountMarketView);
    await feedFiles(w, input, marketItems(index));
    assert.equal(last().loaded, true, `string #${i}: the market loaded`);
    inert(root, `market table #${i}`);
    const rows = [...root.querySelectorAll('tbody tr')];
    assert.equal(rows.length, idx.entries.length, `string #${i}: row count`);
    assert.ok(rows.every((tr) => tr.children.length === root.querySelectorAll('th').length), `string #${i}: cells per row`);
    const cells = [...root.querySelectorAll('td')].map((td) => td.textContent);
    assert.equal(cells.filter((c) => c === h).length, idx.entries.length, `string #${i}: status cells hold the string as text`);
    assert.equal(cells.filter((c) => c.startsWith(`${h} (`)).length, idx.entries.length, `string #${i}: validation cells hold the string as text`);
  }
});

test('market, refused: a hostile id and version show only as text lines cut at 120 characters', async () => {
  for (const [i, h] of HOSTILE.entries()) {
    const index = clone(idx);
    const victim = index.entries[0];
    const gone = victim.path;
    victim.id = h;
    victim.version = h;
    const { w, root, input, last } = rig(mountMarketView);
    await feedFiles(w, input, marketItems(index, gone));
    assert.equal(last().refused, true, `string #${i}: the market was refused`);
    inert(root, `market refusal #${i}`);
    const shown = lines(root);
    assert.ok(shown.includes(`id: ${h.slice(0, CUT)}`), `string #${i}: id line`);
    assert.ok(shown.includes(`version: ${h.slice(0, CUT)}`), `string #${i}: version line`);
    if (h.length > CUT) assert.ok(!root.textContent.includes(h), `string #${i}: the long string was cut`);
  }
});

test('market, refused: a hostile file path is never echoed', async () => {
  for (const [i, h] of HOSTILE.entries()) {
    const { w, root, input, last } = rig(mountMarketView);
    await feedFiles(w, input, [{ name: h, path: `${h}/..`, text: '{}' }]);
    assert.equal(last().refused, true, `string #${i}: refused`);
    assert.deepEqual(lines(root), ['code: bad-path'], `string #${i}: only the fixed code line`);
    assert.ok(!root.textContent.includes(h), `string #${i}: the path was echoed`);
    inert(root, `market bad path #${i}`);
  }
});

test('import, hostile members: x- names at the top level and in a record are inert and never echoed in a refusal', async () => {
  for (const [i, h] of HOSTILE.entries()) {
    const text = envelopeWith((e) => {
      e[`x-${h}`] = 1;
      e.observations[0][`x-${h}`] = 1;
    });
    const { w, root, input, last } = importRig();
    await feedFiles(w, input, [{ name: 'envelope.json', text }]);
    const s = last();
    assert.ok(s.imported || s.refused, `string #${i}: an outcome was reached`);
    inert(root, `import members #${i}`);
    if (s.refused) assert.ok(!root.textContent.includes(h), `string #${i}: a refusal echoed the input`);
  }
});

test('import, hostile values: producer, exported time and a record id are inert and never echoed in a refusal', async () => {
  const FIELDS = [
    ['producer.system', true, (e, h) => { e.envelope.producer.system = h; }],
    ['producer.version', true, (e, h) => { e.envelope.producer.version = h; }],
    ['exportedAt', true, (e, h) => { e.envelope.exportedAt = h; }],
    ['record id', false, (e, h) => { e.observations[0].id = h; }],
  ];
  for (const [field, inHeader, set] of FIELDS) {
    for (const [i, h] of HOSTILE.entries()) {
      const { w, root, input, last } = importRig();
      await feedFiles(w, input, [{ name: 'envelope.json', text: envelopeWith((e) => set(e, h)) }]);
      const s = last();
      assert.ok(s.imported || s.refused, `${field} #${i}: an outcome was reached`);
      inert(root, `import ${field} #${i}`);
      if (s.refused) assert.ok(!root.textContent.includes(h), `${field} #${i}: a refusal echoed the input`);
      else if (inHeader) assert.ok(root.textContent.includes(h), `${field} #${i}: the header value is shown as text`);
    }
  }
});

test('import, not JSON: every hostile text gives the one fixed sentence and is never echoed', async () => {
  const base = importRig();
  await feedFiles(base.w, base.input, [{ name: 'x.json', text: 'not json {' }]);
  const fixed = base.root.textContent;
  assert.match(fixed, /not valid JSON/, 'baseline sentence');
  for (const [i, h] of HOSTILE.entries()) {
    const { w, root, input, last } = importRig();
    await feedFiles(w, input, [{ name: 'x.json', text: h }]);
    assert.equal(last().refused, true, `string #${i}: refused`);
    assert.ok(root.textContent === fixed, `string #${i}: the page differs from the fixed refusal`);
    inert(root, `import not json #${i}`);
  }
});

test('a failing inert check never quotes the string it found', () => {
  const w = new JSDOM('<div id="r"></div>').window;
  const root = w.document.getElementById('r');
  root.innerHTML = '<img src=x onerror="alert(1)">';
  assert.throws(() => inert(root, 'probe'), (err) => err instanceof assert.AssertionError && !String(err.message).includes('alert(1)'));
});

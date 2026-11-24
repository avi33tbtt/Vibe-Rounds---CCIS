// Row 3.8a: market folder loader, market view, refusal view. Prototype. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { marketInputFromFiles, loadFromFiles, marketView, refusalView } from '../ccis-app-market.js';

const ROOT = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', ROOT), 'utf8');
const INDEX = JSON.parse(readFileSync(new URL('market/index.json', ROOT), 'utf8'));

// The market/ folder as the browser would hand it over: folder name first, every file including .gitattributes.
function picked() {
  const out = [];
  const walk = (rel) => {
    for (const name of readdirSync(new URL(`market/${rel}`, ROOT)).sort()) {
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(new URL(`market/${r}`, ROOT)).isDirectory()) walk(r);
      else out.push({ path: `market/${r}`, text: readFileSync(new URL(`market/${r}`, ROOT), 'utf8') });
    }
  };
  walk('');
  return out;
}
const withChange = (items, path, fn) => items.map((i) => (i.path === path ? { ...i, text: fn(i.text) } : i));
const firstArtefact = () => `market/${INDEX.entries[0].path}`;

test('the committed market folder maps, loads and lists every entry in index order', () => {
  const items = picked();
  assert.ok(items.some((i) => i.path === 'market/.gitattributes'));
  const r = loadFromFiles(items);
  assert.equal(r.ok, true);
  const v = marketView(r.market);
  assert.deepEqual(v.rows.map((x) => [x.id, x.version]), INDEX.entries.map((e) => [e.id, e.version]));
  assert.equal(v.rows.length, 6);
  assert.equal(v.counts['analytics-package'] + v.counts['contextual-element'] + v.counts.pathway, 6);
  for (const row of v.rows) assert.match(row.checksumShort, /^sha256:[0-9a-f]{12}$/);
});

test('only a top-level .gitattributes is skipped; any other stray file refuses the whole market (M-011)', () => {
  const items = picked();
  const without = items.filter((i) => i.path !== 'market/.gitattributes');
  assert.deepEqual(loadFromFiles(without).market, loadFromFiles(items).market);
  for (const stray of ['market/notes.txt', 'market/artefacts/.gitattributes', 'market/__proto__']) {
    const r = loadFromFiles([...items, { path: stray, text: 'x' }]);
    assert.equal(r.ok, false, stray);
    assert.equal(refusalView(r.refusal).id, 'M-011', stray);
  }
});

test('a changed byte, a missing file, a byte-order mark: whole market refused with the id and version only (M-010)', () => {
  const items = picked();
  const path = firstArtefact();
  const flipped = loadFromFiles(withChange(items, path, (t) => t.replace('a', 'b')));
  const bom = loadFromFiles(withChange(items, path, (t) => `\uFEFF${t}`));
  const missing = loadFromFiles(items.filter((i) => i.path !== path));
  for (const r of [flipped, bom, missing]) {
    assert.equal(r.ok, false);
    const v = refusalView(r.refusal);
    assert.equal(v.id, 'M-010');
    assert.deepEqual(v.detail, [`id: ${INDEX.entries[0].id}`, `version: ${INDEX.entries[0].version}`]);
  }
});

test('bad picks are refused as M-001 and never partly loaded', () => {
  const items = picked();
  const noIndex = loadFromFiles(items.filter((i) => i.path !== 'market/index.json'));
  assert.deepEqual(refusalView(noIndex.refusal), { id: 'M-001', sentence: refusalView({ id: 'M-001' }).sentence, detail: ['code: no-index'] });
  assert.equal(loadFromFiles([]).ok, false);
  assert.equal(loadFromFiles(null).ok, false);
  assert.equal(marketInputFromFiles([{ path: 'index.json', text: '{}' }]).ok, false);
  assert.equal(marketInputFromFiles([{ path: 'a//b', text: '' }]).ok, false);
  assert.equal(marketInputFromFiles([...items, items[1]]).ok, false);
  assert.equal(marketInputFromFiles([{ path: 'market/index.json', text: 5 }]).ok, false);
});

test('views hold no artefact value: refusal detail is allow-listed and the market view is index data only', () => {
  const r = refusalView({ id: 'M-010', reason: 'x', detail: { id: 'a', version: '1', value: 'SECRET-ARTEFACT-VALUE', path: 7 } });
  assert.deepEqual(r.detail, ['id: a', 'version: 1']);
  assert.equal(refusalView({ id: 'nope' }).id, 'nope');
  const known = new Set();
  const collect = (x, into) => { if (typeof x === 'string') into.add(x); else if (x && typeof x === 'object') Object.values(x).forEach((y) => collect(y, into)); };
  collect(INDEX, known);
  const body = new Set();
  for (const e of INDEX.entries) collect(JSON.parse(readFileSync(new URL(`market/${e.path}`, ROOT), 'utf8')), body);
  const knownText = [...known];
  // Strings the index itself shows (or that sit inside an id) are legitimate; everything else must stay out.
  const secrets = [...body].filter((s) => s.length >= 12 && !knownText.some((k) => k.includes(s)));
  assert.ok(secrets.length >= 5, 'the scan needs real artefact strings to look for');
  const shown = JSON.stringify([marketView(loadFromFiles(picked()).market), refusalView(loadFromFiles(withChange(picked(), firstArtefact(), (t) => t + ' ')).refusal)]);
  for (const s of secrets) assert.ok(!shown.includes(s), s);
});

// ---- the page, in jsdom -------------------------------------------------------------------------------------------
const fake = (item) => ({ webkitRelativePath: item.path, name: item.path.split('/').pop(), text: async () => item.text });
async function until(w, cond) { for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => w.setTimeout(r, 0)); }
async function pick(w, items) {
  const input = w.document.querySelector('#market input[type=file]');
  Object.defineProperty(input, 'files', { value: items.map(fake), configurable: true });
  input.dispatchEvent(new w.Event('change'));
  await until(w, () => w.document.querySelector('#market table, #market [role=alert]'));
}
const page = () => new JSDOM(html, { runScripts: 'dangerously' }).window;

test('page: picking the folder shows the market; Clear empties the view and the state', async () => {
  const w = page();
  const d = w.document;
  assert.equal(d.querySelector('#market input[type=file]').hasAttribute('webkitdirectory'), true);
  await pick(w, picked());
  assert.equal(d.querySelectorAll('#market tbody tr').length, 6);
  assert.deepEqual(JSON.parse(JSON.stringify(w.ccisApp.state())), { marketLoaded: true, entries: 6, runs: 0, refused: false });
  assert.match(d.getElementById('status').textContent, /^Market loaded: 6 entries\. Nothing has been run\./);
  assert.match(d.getElementById('market').textContent, /not a trusted market/);
  d.querySelector('#market button').click();
  assert.equal(d.querySelectorAll('#market table').length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(w.ccisApp.state())), { marketLoaded: false, entries: 0, runs: 0, refused: false });
  assert.match(d.getElementById('status').textContent, /^Ready\./);
});

test('page: a changed or byte-order-marked file shows the refusal with its fixed sentence and nothing is loaded', async () => {
  for (const change of [(t) => t.replace('a', 'b'), (t) => `\uFEFF${t}`]) {
    const w = page();
    await pick(w, withChange(picked(), firstArtefact(), change));
    const box = w.document.querySelector('#market [role=alert]');
    assert.ok(box);
    assert.match(box.textContent, /M-010/);
    assert.match(box.textContent, /index and the stored file disagree/);
    assert.match(box.textContent, new RegExp(INDEX.entries[0].id.replace(/\./g, '\\.')));
    assert.equal(w.document.querySelectorAll('#market table').length, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(w.ccisApp.state())), { marketLoaded: false, entries: 0, runs: 0, refused: true });
    await pick(w, picked()); // a good pick afterwards replaces the refusal
    await until(w, () => w.document.querySelector('#market table'));
    assert.equal(w.ccisApp.state().marketLoaded, true);
    assert.equal(w.document.querySelectorAll('#market [role=alert]').length, 0);
  }
});

test('page: a file that cannot be read is a refusal, not a crash', async () => {
  const w = page();
  const input = w.document.querySelector('#market input[type=file]');
  Object.defineProperty(input, 'files', { value: [{ webkitRelativePath: 'market/index.json', text: async () => { throw new Error('no'); } }] });
  input.dispatchEvent(new w.Event('change'));
  await until(w, () => w.document.querySelector('#market [role=alert]'));
  assert.match(w.document.querySelector('#market [role=alert]').textContent, /code: read-failed/);
});

test('the new modules use no storage, no network, no innerHTML, no inline handlers', async () => {
  for (const f of ['ccis-app-market.js', 'ccis-app-market-view.js']) {
    const src = readFileSync(new URL(f, ROOT), 'utf8');
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|eval\(|new Function|import\(/.test(src), f);
    assert.ok(!/\bon[a-z]+\s*=/.test(src.replace(/\/\/.*$/gm, '')), f);
  }
  const w = page();
  await pick(w, picked());
  for (const el of w.document.querySelectorAll('*')) for (const a of el.attributes) assert.ok(!/^on/i.test(a.name), `${el.tagName} ${a.name}`);
});

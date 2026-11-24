import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { importEnvelope } from '../ccis-import.js';
import { heldFromMarket } from '../ccis-app-import-report.js';
import { PREVIEW_BANNER } from '../ccis-compat.js';
import { compatibilityFor, catalogueModel } from '../ccis-app-catalogue.js';
import { mountCatalogueView } from '../ccis-app-catalogue-view.js';

const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
const files = Object.fromEntries(idx.entries.map((e) => [e.path, readFileSync(`market/${e.path}`, 'utf8')]));
const market = { index: idx, files };
const KEY = 'snake.documentation-path@0.1.0';
const context = importEnvelope(JSON.parse(readFileSync('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json', 'utf8')), { held: heldFromMarket(market) }).context;
const result = (ctx) => compatibilityFor({ market, pathwayKey: KEY, context: ctx }).result;
const F12 = 'The pathway row does not check data. Packages marked Needs data cannot run without it.';

function mount() {
  const w = new JSDOM('<div id="r"></div>').window;
  const states = [];
  const api = mountCatalogueView({ document: w.document, root: w.document.getElementById('r'), onState: (s) => states.push(s) });
  return { w, d: w.document, api, last: () => states[states.length - 1], text: () => w.document.getElementById('r').textContent };
}
const fake = (outcome, detail = 'd') => ({ ref: { id: 'x', type: 'analytics-package', version: '1.0.0' }, outcome, checks: [{ name: 'artefact', findings: [{ reason: 'CMP-1-01', state: 'not-met', detail, needs: 'n' }] }], satisfied: [], needed: [], policy: { mayRun: false, banners: [] } });

test('start state shows the fixed sentence and nothing is shown', () => {
  const { text, last } = mount();
  assert.match(text(), /No compatibility result yet\./);
  assert.equal(last().shown, false);
});

test('showSentence draws the refusal paragraph and reset returns to the start', () => {
  const { api, d, last, text } = mount();
  api.showSentence('Choose a pathway first.');
  assert.equal(d.querySelector('p.refusal').textContent, 'Choose a pathway first.');
  assert.equal(last().shown, false);
  api.reset();
  assert.match(text(), /No compatibility result yet\./);
  assert.equal(d.querySelectorAll('p.refusal').length, 0);
});

test('showResult with the imported context: three rows, group headings, exact count line and banner', () => {
  const { api, d, last, text } = mount();
  const r = result(context);
  api.showResult(r);
  const m = catalogueModel(r);
  assert.equal(d.querySelectorAll('details').length, 3);
  const heads = [...d.querySelectorAll('h3')].map((h) => h.textContent);
  const expected = Object.keys(m.groups).filter((k) => m.groups[k].length).map((k) => `${m.rows[m.groups[k][0]].label} (${m.groups[k].length})`);
  assert.deepEqual(heads, expected);
  const c = m.counts;
  assert.ok(text().includes(`Compatible ${c.compatible}, Compatible with limitations ${c['compatible-with-limitations']}, Needs data ${c['needs-data']}, Incompatible ${c.incompatible}, Not eligible ${c['not-eligible']}, Unrecognised ${c.other}.`));
  assert.ok(text().includes(PREVIEW_BANNER));
  assert.deepEqual([last().shown, last().rows], [true, 3]);
});

test('without a context the package rows sit under Needs data, open, with the F-12 sentence', () => {
  const { api, d, text, last } = mount();
  api.showResult(result(null));
  const needs = [...d.querySelectorAll('h3')].find((h) => h.textContent.startsWith('Needs data'));
  assert.ok(needs);
  const rows = needs.parentNode.querySelectorAll('details');
  assert.equal(rows.length, 2);
  rows.forEach((x) => assert.equal(x.open, true));
  assert.ok(text().includes(F12));
  assert.equal(last().needsData, 2);
  api.showResult(result(context));
  const m = catalogueModel(result(context));
  assert.equal(text().includes(F12), m.rows[0].outcome !== 'needs-data' && m.rows.slice(1).some((x) => x.outcome === 'needs-data'));
});

test('a row lists its explanations with reason ids', () => {
  const { api, text } = mount();
  api.showResult(result(null));
  assert.match(text(), /data-readiness, CMP-4-01: No context has been imported/);
});

test('an unknown outcome shows as Unrecognised and never as a Compatible heading', () => {
  const { api, d, last } = mount();
  api.showResult({ pathway: fake('mystery'), packages: [] });
  assert.deepEqual([...d.querySelectorAll('h3')].map((h) => h.textContent), ['Unrecognised outcome (1)']);
  assert.equal(last().other, 1);
});

test('a hostile string shows as text only', () => {
  const { api, d, text } = mount();
  const bad = '<img src=x onerror=1>';
  api.showResult({ pathway: fake('incompatible', bad), packages: [] });
  assert.ok(text().includes(bad));
  assert.equal(d.querySelectorAll('img').length, 0);
  assert.equal([...d.querySelectorAll('*')].some((n) => [...n.attributes].some((a) => a.name.startsWith('on'))), false);
});

test('ccis-app-catalogue-view.js uses no markup injection, storage, network, clock or dynamic code', () => {
  const src = readFileSync('ccis-app-catalogue-view.js', 'utf8');
  for (const word of ['innerHTML', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'eval', 'Date', 'Math.random', 'import(', 'onclick']) assert.equal(src.includes(word), false, word);
});

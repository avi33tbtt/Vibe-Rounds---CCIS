// Row 3.9a.1: the results view. jsdom, real market and a real run record. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { importEnvelope } from '../ccis-import.js';
import { heldFromMarket } from '../ccis-app-import-report.js';
import { runForPage } from '../ccis-app-run.js';
import { mountResultsView } from '../ccis-app-results-view.js';

const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
const market = { index: idx, files: Object.fromEntries(idx.entries.map((e) => [e.path, readFileSync(`market/${e.path}`, 'utf8')])) };
const imp = (n) => importEnvelope(JSON.parse(readFileSync(`ccis/fixtures/snake/${n}.envelope.json`, 'utf8')), { held: heldFromMarket(market) });
const RUN = runForPage({ market, pathwayKey: 'snake.documentation-path@0.1.0', importResult: imp('boundary/boundary-01-edge-inside'), evaluationTime: '2026-01-01T00:00:00Z' });
const MISSING = runForPage({ market, pathwayKey: 'snake.documentation-path@0.1.0', importResult: imp('missing/missing-01-no-bite-time'), evaluationTime: '2026-01-01T00:00:00Z' });

function mount() {
  const w = new JSDOM('<div id="r"></div>').window;
  const states = [];
  const api = mountResultsView({ document: w.document, root: w.document.getElementById('r'), onState: (s) => states.push(s) });
  return { w, d: w.document, api, last: () => states[states.length - 1], text: () => w.document.getElementById('r').textContent };
}
const res = (o) => ({ outputId: 'a', kind: 'value', warnings: [], limitations: [], missingDataNotes: [], 'x-analytic': 'a.b', ...o });
const fake = (results, extra = {}) => ({ ok: true, skipped: [], record: { ...RUN.record, results, ...extra } });

test('start state shows the fixed sentence and nothing is shown', () => {
  const { text, last } = mount();
  assert.match(text(), /No run yet\./);
  assert.deepEqual(last(), { shown: false, state: 'none', groups: 0, items: 0, trace: 0, missing: 0 });
});

test('a completed run draws the headline, a heading per group and a value with its unit', () => {
  const { api, d, text, last } = mount();
  api.show(RUN);
  const want = RUN.record.results.find((r) => r.kind === 'value' && r.value.unit === 'min');
  assert.match(text(), /Run complete: \d+ results\./);
  assert.equal(d.querySelectorAll('h3').length, new Set(RUN.record.results.map((r) => r['x-analytic'])).size);
  assert.ok(text().includes(`${want.outputId}: ${want.value.amount} min`));
  assert.equal(last().shown, true);
});

test('a failed record shows its sentence and no group', () => {
  const { api, d, text, last } = mount();
  api.show({ ok: true, record: { ...RUN.record, status: 'failed', results: [] } });
  assert.match(text(), /The run failed\. No results\./);
  assert.equal(d.querySelectorAll('h3').length, 0);
  assert.equal(last().state, 'failed');
});

test('a table result draws a real table; 60 rows give "and 10 more"', () => {
  const { api, d, text } = mount();
  api.show(fake([res({ kind: 'table', value: { columns: ['c1', 'c2'], rows: Array.from({ length: 60 }, (_, i) => [`r${i}`, 'x']) } })]));
  assert.equal(d.querySelectorAll('table th').length, 2);
  assert.equal(d.querySelectorAll('table tr').length, 51);
  assert.match(text(), /and 10 more/);
});

test('an unmatched trace node reads indeterminate; the path is closed and a non-empty missing list is open', () => {
  const { api, d, text } = mount();
  const trace = [{ node: 'n1', inputs: [{ key: 'k', concept: 'c', state: 'absent', records: 0 }], outcomes: [{ id: 'x', matched: false }], taken: null }];
  api.show({ ok: true, skipped: MISSING.skipped, record: { ...MISSING.record, 'x-trace': trace } });
  assert.match(text(), /No outcome matched \(indeterminate\)\./);
  const by = (t) => [...d.querySelectorAll('details')].find((x) => x.querySelector('summary').textContent === t);
  assert.equal(by('Decision path').open, false);
  assert.equal(by('Missing').open, true);
  assert.match(by('Missing').textContent, /needs-data: CMP-4-02, CMP-4-04/);
});

test('hostile text appears as text and makes no element or handler', () => {
  const { api, d, text } = mount();
  const bad = '<img src=x onerror=1>';
  api.show(fake([res({ outputId: bad, kind: 'classification', value: { label: bad }, 'x-analytic': bad })]));
  assert.ok(text().includes(bad));
  assert.equal(d.querySelectorAll('img').length, 0);
  assert.equal([...d.querySelectorAll('*')].some((n) => [...n.attributes].some((a) => a.name.startsWith('on'))), false);
});

test('onState holds only booleans and counts', () => {
  const { api, last } = mount();
  api.show(RUN);
  const s = last();
  assert.ok(Object.values(s).every((v) => typeof v === 'boolean' || typeof v === 'number' || v === 'completed'));
  const j = JSON.stringify(s);
  assert.equal(j.includes('sha256') || j.includes(RUN.record.id), false);
  api.reset();
  assert.equal(last().shown, false);
});

test('source scan: no innerHTML, eval, network, storage, clock or inline handler', () => {
  const src = readFileSync('ccis-app-results-view.js', 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const w of ['innerHTML', 'eval', 'fetch', 'localStorage', 'Date', 'onclick', 'XMLHttpRequest']) assert.equal(new RegExp(`\\b${w}\\b`).test(src), false, w);
});

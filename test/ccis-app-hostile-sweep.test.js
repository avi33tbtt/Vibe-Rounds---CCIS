// Row 3.10.1b: hostile-string sweep over the five model-fed views. Prototype. Synthetic data only. Not for clinical use.
// Failure messages name an element or attribute kind and a count, never a hostile string.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { importEnvelope } from '../ccis-import.js';
import { heldFromMarket } from '../ccis-app-import-report.js';
import { runForPage } from '../ccis-app-run.js';
import { mountCatalogueView } from '../ccis-app-catalogue-view.js';
import { mountResultsView } from '../ccis-app-results-view.js';
import { mountExportView } from '../ccis-app-export-view.js';
import { mountRunView } from '../ccis-app-run-view.js';
import { mountSelectorView } from '../ccis-app-selector-view.js';
import { HOSTILE, inert } from './hostile-kit.js';

// COVERED: every view file must be named here. Market and import are swept in the files test (row 3.10.1c).
const COVERED = {
  'ccis-app-catalogue-view.js': 'here', 'ccis-app-export-view.js': 'here', 'ccis-app-results-view.js': 'here',
  'ccis-app-run-view.js': 'here', 'ccis-app-selector-view.js': 'here',
  'ccis-app-market-view.js': 'ccis-app-hostile-sweep-files.test.js', 'ccis-app-import-view.js': 'ccis-app-hostile-sweep-files.test.js',
};

const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
const market = { index: idx, files: Object.fromEntries(idx.entries.map((e) => [e.path, readFileSync(`market/${e.path}`, 'utf8')])) };
const importResult = importEnvelope(JSON.parse(readFileSync('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json', 'utf8')), { held: heldFromMarket(market) });
const RUN = runForPage({ market, pathwayKey: 'snake.documentation-path@0.1.0', importResult, evaluationTime: '2026-01-01T00:00:00Z' });
const rig = (mountFn, extra = {}) => {
  const w = new JSDOM('<div id="r"></div>').window;
  const root = w.document.getElementById('r');
  const api = mountFn({ document: w.document, root, onState: () => {}, ...extra });
  return { w, d: w.document, root, api };
};

test('catalogue view: hostile strings in a result stay text', () => {
  const fake = (bad) => ({ ref: { id: bad, type: 'analytics-package', version: bad }, outcome: 'incompatible',
    checks: [{ name: 'artefact', findings: [{ reason: 'CMP-1-01', state: 'not-met', detail: bad, needs: bad }] }],
    satisfied: [bad], needed: [bad], policy: { mayRun: false, banners: [bad] } });
  for (const bad of HOSTILE) {
    const { api, root } = rig(mountCatalogueView);
    api.showResult({ pathway: fake(bad), packages: [fake(bad)] });
    inert(root, 'catalogue result');
    api.showSentence(bad);
    inert(root, 'catalogue sentence');
    if (bad.length < 100) assert.ok(root.textContent.includes(bad));
  }
});

test('results view: hostile strings in results, notes and scope stay text', () => {
  for (const bad of HOSTILE) {
    const { api, root } = rig(mountResultsView);
    const r = { outputId: bad, kind: 'classification', value: { label: bad }, warnings: [bad], limitations: [bad], missingDataNotes: [bad], 'x-analytic': bad };
    api.show({ ok: true, skipped: [bad], record: { ...RUN.record, package: { ...RUN.record.package, id: bad, version: bad }, results: [r] } });
    inert(root, 'results');
    if (bad.length < 100) assert.ok(root.textContent.includes(bad));
  }
});

test('export view: a hostile record id is never echoed, and the page stays inert', () => {
  for (const bad of HOSTILE) {
    const { api, root } = rig(mountExportView, { save: () => true });
    api.show({ ...RUN.record, id: bad, package: { ...RUN.record.package, id: bad, version: bad } });
    inert(root, 'export hostile record');
    assert.ok(!root.textContent.includes(bad.slice(0, 20)), 'the record id must not be echoed');
    api.show(RUN.record);
    inert(root, 'export real record');
  }
});

test('run view: hostile package rows and a hostile refusal sentence stay text', () => {
  for (const bad of HOSTILE) {
    const { w, d, root, api } = rig(mountRunView, { run: () => ({ ok: false, sentence: bad }), onRun: () => {} });
    api.setChoices([{ id: bad, version: bad, label: bad, mayRun: true }, { id: 'b.two', version: '0.1.0', label: bad, mayRun: false }]);
    api.setReady(true);
    inert(root, 'run rows');
    const time = d.querySelector('input[type=text]');
    time.value = '2026-01-01T00:00:00Z';
    time.dispatchEvent(new w.Event('input', { bubbles: true }));
    const go = [...d.querySelectorAll('button')].find((b) => b.textContent === 'Run');
    go.click();
    inert(root, 'run refusal');
    if (bad.length < 100) assert.ok(root.textContent.includes(bad));
  }
});

test('selector view: hostile ids and versions stay text', () => {
  const entry = (type, id, version) => ({ type, id, version, status: 'draft', references: [] });
  for (const bad of HOSTILE) {
    const { w, d, root, api } = rig(mountSelectorView);
    api.setMarket({ index: { format: 'ccis-market/1', entries: [entry('contextual-element', bad, '0.1.0'), entry('pathway', bad, bad)] }, files: {} });
    inert(root, 'selector options');
    for (const s of d.querySelectorAll('select')) {
      for (const o of [...s.options].slice(1)) { s.value = o.value; s.dispatchEvent(new w.Event('change')); }
    }
    inert(root, 'selector picked');
  }
});

test('every view file is named in the COVERED table', () => {
  const files = readdirSync('.').filter((f) => /^ccis-app-.*-view\.js$/.test(f));
  const missing = files.filter((f) => !(f in COVERED));
  assert.deepEqual(missing, [], `view files not in COVERED: ${missing.join(', ')}`);
  for (const f of Object.keys(COVERED)) assert.ok(files.includes(f), `COVERED names a missing file: ${f}`);
});

test('the inert check itself fails on each kind of bad node', () => {
  for (const html of ['<img>', '<a href="#">x</a>', '<p onclick="1">x</p>', '<p style="a:b">x</p>', '<p title="javascript:1">x</p>']) {
    const w = new JSDOM(`<div id="r">${html}</div>`).window;
    assert.throws(() => inert(w.document.getElementById('r'), 'probe'), assert.AssertionError, html);
  }
});

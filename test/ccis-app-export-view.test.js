// Row 3.9b.1: the export view. jsdom, real market and a real run record. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { importEnvelope } from '../ccis-import.js';
import { heldFromMarket } from '../ccis-app-import-report.js';
import { runForPage } from '../ccis-app-run.js';
import { exportModel } from '../ccis-app-export.js';
import { mountExportView } from '../ccis-app-export-view.js';

const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
const market = { index: idx, files: Object.fromEntries(idx.entries.map((e) => [e.path, readFileSync(`market/${e.path}`, 'utf8')])) };
const importResult = importEnvelope(JSON.parse(readFileSync('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json', 'utf8')), { held: heldFromMarket(market) });
const REC = runForPage({ market, pathwayKey: 'snake.documentation-path@0.1.0', importResult, evaluationTime: '2026-01-01T00:00:00Z' }).record;
const MODEL = exportModel(REC);

function mount(save) {
  const w = new JSDOM('<div id="r"></div>').window;
  const states = [];
  const calls = [];
  const api = mountExportView({ document: w.document, root: w.document.getElementById('r'), onState: (s) => states.push(s), save: save === null ? undefined : (a) => { calls.push(a); return typeof save === 'function' ? save(a) : undefined; } });
  return { w, d: w.document, api, calls, last: () => states[states.length - 1], text: () => w.document.getElementById('r').textContent, button: () => w.document.querySelector('#r button') };
}

test('start state shows the fixed sentence and nothing is shown', () => {
  const { text, last } = mount();
  assert.match(text(), /Nothing to export yet\./);
  assert.deepEqual(last(), { shown: false, verified: false, saved: false });
});

test('show draws the verified sentence, the snapshot notice, the file line and one button', () => {
  const { api, d, text, last } = mount();
  api.show(REC);
  assert.ok(text().includes('Verified: id and results checksum match.'));
  assert.ok(text().includes('This file holds the input snapshot.'));
  assert.ok(text().includes(`File: ${REC.id}.json.`));
  assert.equal(d.querySelectorAll('button').length, 1);
  assert.deepEqual(last(), { shown: true, verified: true, saved: false });
});

test('click calls save once with exactly the model filename and text', () => {
  const { api, calls, button, text, last } = mount();
  api.show(REC);
  button().click();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { filename: MODEL.filename, text: MODEL.text });
  assert.match(text(), new RegExp(`Saved as ${REC.id}\\.json\\.`));
  assert.equal(last().saved, true);
});

test('save throwing and save returning false each give the failure sentence', () => {
  for (const fn of [() => { throw new Error('secret'); }, () => false]) {
    const { api, button, text, last } = mount(fn);
    api.show(REC);
    button().click();
    assert.match(text(), /The file could not be saved\./);
    assert.equal(text().includes('secret'), false);
    assert.equal(last().saved, false);
  }
});

test('a failed show gives the fixed sentence and no button; reset removes the button', () => {
  const { api, d, text } = mount();
  api.show(null);
  assert.match(text(), /No run to export\./);
  assert.equal(d.querySelectorAll('button').length, 0);
  api.show(REC);
  assert.equal(d.querySelectorAll('button').length, 1);
  api.reset();
  assert.equal(d.querySelectorAll('button').length, 0);
  assert.match(text(), /Nothing to export yet\./);
});

test('the DOM holds no snapshot text and onState holds only booleans', () => {
  const { api, text, last } = mount();
  api.show(REC);
  const obs = JSON.stringify(REC.snapshot.observations[0]).slice(1, 40);
  assert.equal(text().includes(obs), false);
  assert.equal(text().includes('"observations"'), false);
  assert.ok(Object.values(last()).every((v) => typeof v === 'boolean'));
  assert.equal(JSON.stringify(last()).includes('sha256'), false);
});

test('without a save function the button is disabled and the sentence shows', () => {
  const { api, button, text } = mount(null);
  api.show(REC);
  assert.equal(button().disabled, true);
  assert.match(text(), /Saving is not available here\./);
});

test('source scan: no innerHTML, Blob, URL, network, storage, clock or inline handler', () => {
  const src = readFileSync('ccis-app-export-view.js', 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const w of ['innerHTML', 'Blob', 'URL', 'createObjectURL', 'fetch', 'localStorage', 'Date', 'onclick', 'eval']) assert.equal(new RegExp(`\\b${w}\\b`).test(src), false, w);
});

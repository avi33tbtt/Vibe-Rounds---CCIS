// Row 3.9.1: the run view (jsdom over a bare div, a stub run) and the adapter's `only` filter. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { importEnvelope } from '../ccis-import.js';
import { heldFromMarket } from '../ccis-app-import-report.js';
import { runForPage } from '../ccis-app-run.js';
import { mountRunView } from '../ccis-app-run-view.js';

const NOT_READY = 'Load a market, choose a pathway and import an envelope first.';
const ROWS = [
  { id: 'a.one', version: '0.1.0', label: 'Compatible', mayRun: true },
  { id: 'b.two', version: '0.1.0', label: 'Needs data', mayRun: false },
];

function mount(run = () => ({ ok: true, record: { status: 'completed', results: [1, 2, 3] }, skipped: [1] })) {
  const w = new JSDOM('<div id="r"></div>').window;
  const states = [];
  const runs = [];
  const recs = [];
  const api = mountRunView({
    document: w.document,
    root: w.document.getElementById('r'),
    onState: (s) => states.push(s),
    run: (a) => { runs.push(a); return run(a); },
    onRun: (rec, sk) => recs.push([rec, sk]),
  });
  const d = w.document;
  const boxes = () => [...d.querySelectorAll('input[type=checkbox]')];
  const fire = (node, type) => node.dispatchEvent(new w.Event(type, { bubbles: true }));
  const time = () => d.querySelector('input[type=text]');
  const type = (v) => { time().value = v; fire(time(), 'input'); };
  const go = () => [...d.querySelectorAll('button')].find((b) => b.textContent === 'Run');
  return { w, d, api, states, runs, recs, boxes, fire, time, type, go, last: () => states[states.length - 1], text: () => d.getElementById('r').textContent };
}
const ready = (m) => { m.api.setChoices(ROWS); m.api.setReady(true); };

test('mounts with a heading and Run disabled; not ready shows the fixed sentence', () => {
  const m = mount();
  assert.equal(m.d.querySelector('h2').textContent, 'Run');
  assert.equal(m.go().disabled, true);
  assert.match(m.text(), new RegExp(NOT_READY));
  assert.equal(m.last().ready, false);
  ready(m);
  assert.doesNotMatch(m.text(), new RegExp(NOT_READY));
});

test('Run is enabled only when ready, one box is ticked and a time is typed', () => {
  const m = mount();
  ready(m);
  assert.equal(m.go().disabled, true); // no time yet
  m.type('2026-01-01T00:00:00Z');
  assert.equal(m.go().disabled, false);
  m.boxes()[0].checked = false;
  m.fire(m.boxes()[0], 'change');
  assert.equal(m.go().disabled, true); // nothing ticked
  m.boxes()[0].checked = true;
  m.fire(m.boxes()[0], 'change');
  m.type('   ');
  assert.equal(m.go().disabled, true); // blank time
  m.type('2026-01-01T00:00:00Z');
  m.api.setReady(false);
  assert.equal(m.go().disabled, true);
});

test('run gets exactly the ticked ids, the needs-data flag and the typed time unchanged', () => {
  const m = mount();
  ready(m);
  assert.deepEqual(m.boxes().map((b) => b.checked).slice(0, 2), [true, false]); // mayRun false starts unticked
  m.boxes()[1].checked = true;
  m.fire(m.boxes()[1], 'change');
  m.boxes()[2].checked = true; // the needs-data box is the last checkbox
  m.fire(m.boxes()[2], 'change');
  m.type(' 2026-01-01T00:00:00Z ');
  m.go().click();
  assert.deepEqual(JSON.parse(JSON.stringify(m.runs)), [{ only: ['a.one', 'b.two'], runNeedsData: true, evaluationTime: ' 2026-01-01T00:00:00Z ' }]);
});

test('a refusal shows its sentence and no count line, and onRun is not called', () => {
  const m = mount(() => ({ ok: false, sentence: 'Import an envelope first.' }));
  ready(m);
  m.type('2026-01-01T00:00:00Z');
  m.go().click();
  assert.equal(m.d.querySelector('p.refusal').textContent, 'Import an envelope first.');
  assert.doesNotMatch(m.text(), /Run complete/);
  assert.equal(m.recs.length, 0);
  assert.equal(m.last().refused, true);
  assert.equal(m.last().ran, false);
});

test('a completed run shows counts and hands the record over; a failed record shows the failure sentence', () => {
  const m = mount();
  ready(m);
  m.type('2026-01-01T00:00:00Z');
  m.go().click();
  assert.match(m.text(), /Run complete: 3 results, 1 skipped\./);
  assert.equal(m.recs.length, 1);
  assert.deepEqual({ ran: m.last().ran, results: m.last().results, skipped: m.last().skipped }, { ran: true, results: 3, skipped: 1 });
  const f = mount(() => ({ ok: true, record: { status: 'failed', results: [] }, skipped: [] }));
  ready(f);
  f.type('2026-01-01T00:00:00Z');
  f.go().click();
  assert.match(f.d.querySelector('p.refusal').textContent, /The run failed\./);
  assert.doesNotMatch(f.text(), /Run complete/);
  assert.equal(f.last().failed, true);
});

test('reset and setChoices clear the status, and the state holds only booleans and counts', () => {
  const m = mount();
  ready(m);
  m.type('2026-01-01T00:00:00Z');
  m.go().click();
  m.api.setChoices(ROWS);
  assert.doesNotMatch(m.text(), /Run complete/);
  m.go().click();
  m.api.reset();
  assert.equal(m.time().value, '');
  assert.doesNotMatch(m.text(), /Run complete/);
  for (const s of m.states) {
    assert.deepEqual(Object.keys(s), ['ready', 'selected', 'ran', 'failed', 'results', 'skipped', 'refused']);
    for (const v of Object.values(s)) assert.ok(typeof v === 'boolean' || typeof v === 'number');
  }
});

test('the adapter honours only: one package gives fewer results and another id; none gives the fixed sentence', () => {
  const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
  const files = Object.fromEntries(idx.entries.map((e) => [e.path, readFileSync(`market/${e.path}`, 'utf8')]));
  const market = { index: idx, files };
  const importResult = importEnvelope(JSON.parse(readFileSync('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json', 'utf8')), { held: heldFromMarket(market) });
  const base = { market, pathwayKey: 'snake.documentation-path@0.1.0', importResult, evaluationTime: '2026-01-01T00:00:00Z' };
  const all = runForPage(base);
  const one = runForPage({ ...base, only: ['snake.bite-to-antivenom-interval'] });
  assert.equal(all.ok && one.ok, true);
  assert.ok(one.record.results.length < all.record.results.length);
  assert.notEqual(one.record.id, all.record.id);
  assert.equal(runForPage({ ...base, only: [] }).sentence, 'Choose at least one package.');
  assert.equal(runForPage({ ...base, only: ['not.a.package'] }).sentence, 'Choose at least one package.');
});

test('the source uses no storage, network, clock or innerHTML, and no element has an on* attribute', () => {
  const src = readFileSync(new URL('../ccis-app-run-view.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|WebSocket|Date\b|Math\.random|innerHTML|outerHTML|insertAdjacentHTML|\.onclick|setAttribute\(\s*['"]on/);
  const m = mount();
  ready(m);
  m.type('x');
  m.go().click();
  for (const e of m.d.querySelectorAll('*')) for (const a of e.getAttributeNames()) assert.ok(!a.startsWith('on'), `${e.tagName} has ${a}`);
});

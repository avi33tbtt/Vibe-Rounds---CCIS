// Row 3.9a: the pure results model. Node only, real market and real fixture envelopes. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importEnvelope } from '../ccis-import.js';
import { heldFromMarket } from '../ccis-app-import-report.js';
import { runForPage } from '../ccis-app-run.js';
import { resultsModel, RESULTS_SENTENCES } from '../ccis-app-results.js';

const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
const market = { index: idx, files: Object.fromEntries(idx.entries.map((e) => [e.path, readFileSync(`market/${e.path}`, 'utf8')])) };
const KEY = 'snake.documentation-path@0.1.0';
const fixture = (n) => JSON.parse(readFileSync(`ccis/fixtures/snake/${n}.envelope.json`, 'utf8'));
const run = (n, o = {}) => runForPage({ market, pathwayKey: KEY, importResult: importEnvelope(fixture(n), { held: heldFromMarket(market) }), evaluationTime: '2026-01-01T00:00:00Z', ...o });
const INSIDE = run('boundary/boundary-01-edge-inside');
const rec = (over) => ({ ...INSIDE.record, ...over });

test('a completed record gives groups, values with units and a count that matches', () => {
  const m = resultsModel(INSIDE);
  assert.equal(m.state, 'completed');
  assert.equal(m.groups.length, new Set(INSIDE.record.results.map((r) => r['x-analytic'])).size);
  assert.ok(m.groups.length >= 2);
  const n = m.groups.reduce((a, g) => a + g.items.length, 0);
  assert.equal(m.headline, `Run complete: ${n} results.`);
  const want = INSIDE.record.results.find((r) => r.kind === 'value' && r.value.unit === 'min');
  const got = m.groups.flatMap((g) => g.items).find((i) => i.outputId === want.outputId);
  assert.equal(got.display, `${want.value.amount} min`);
  assert.equal(m.scope.pathway, 'snake.documentation-path 0.1.0');
  assert.equal(m.limitations[0], 'Prototype. Synthetic data only. Not for clinical use.');
});

test('a failed record and a missing run give the fixed sentences and no groups', () => {
  const f = resultsModel({ ok: true, record: rec({ status: 'failed', failure: { code: 'X' }, results: [] }) });
  assert.equal(f.state, 'failed'); assert.equal(f.headline, 'The run failed. No results.'); assert.deepEqual(f.groups, []);
  for (const bad of [undefined, null, {}, { ok: false }]) { const m = resultsModel(bad); assert.equal(m.state, 'none'); assert.equal(m.headline, 'No run yet.'); }
});

test('an unknown kind and a null value show fixed text, never 0 or normal', () => {
  const r = (o) => ({ outputId: 'a', warnings: [], limitations: [], missingDataNotes: [], 'x-analytic': 'a.b', ...o });
  const m = resultsModel({ ok: true, record: rec({ results: [r({ kind: 'weird', value: { x: 1 } }), r({ kind: 'value', value: null }), r({ kind: 'value', value: { amount: 0, unit: 'min' } })] }) });
  const d = m.groups[0].items.map((i) => i.display);
  assert.deepEqual(d, ['Not displayed: unknown result kind.', 'No value.', '0 min']);
});

test('the trace shows an unmatched node as indeterminate and never carries recordIds', () => {
  const t = [{ node: 'n1', inputs: [{ key: 'k', concept: 'c', state: 'absent', records: 0, recordIds: ['o9'] }], outcomes: [{ id: 'x', matched: false, tests: [{ v: 'secret' }] }], taken: null }];
  const m = resultsModel({ ok: true, record: rec({ 'x-trace': t }) });
  assert.equal(m.trace[0].takenText, 'No outcome matched (indeterminate).');
  assert.equal(m.trace[0].taken, null);
  assert.equal(JSON.stringify(resultsModel(INSIDE)).includes('recordIds'), false);
  assert.equal(JSON.stringify(m).includes('secret'), false);
});

test('skipped items and omitted keys appear in missing; the empty case has its sentence', () => {
  const r = run('missing/missing-01-no-bite-time');
  const m = resultsModel(r);
  assert.equal(m.missing.length, 1);
  assert.equal(m.missing[0].id, 'snake.bite-to-antivenom-interval');
  assert.match(m.missing[0].reason, /^needs-data: CMP-4-02, CMP-4-04$/);
  const o = resultsModel({ ok: true, record: rec({ 'x-omitted': { thing: 1 } }), skipped: [] });
  assert.equal(o.missing[0].reason, 'omitted');
  assert.equal(resultsModel(INSIDE).missingNote, 'Nothing skipped or omitted.');
  assert.equal(resultsModel(INSIDE).missing.length, 0);
});

test('the same input gives byte-identical output and the input is not changed', () => {
  const before = JSON.stringify(INSIDE);
  assert.equal(JSON.stringify(resultsModel(INSIDE)), JSON.stringify(resultsModel(INSIDE)));
  assert.equal(JSON.stringify(INSIDE), before);
});

test('the model holds no snapshot, context or identity text; provenance and test-only are plain', () => {
  const j = JSON.stringify(resultsModel({ ok: true, record: rec({ 'x-testOnly': true }) }));
  const obs = INSIDE.record.snapshot.observations[0];
  assert.equal(j.includes(JSON.stringify(obs).slice(1, 40)), false);
  assert.equal(j.includes('"snapshot"') || j.includes('"observations"') || j.includes('"elements"'), false);
  const m = resultsModel({ ok: true, record: rec({ 'x-testOnly': true }) });
  assert.equal(m.scope.testOnlyNote, 'Test-only parameters. Not clinical values.');
  assert.equal(m.provenance.id, INSIDE.record.id);
  assert.match(m.provenance.checksums.results, /^sha256:/);
  for (const s of RESULTS_SENTENCES) assert.doesNotMatch(s, /\b(normal|safe|ok)\b/i);
});

test('source scan: no DOM, storage, network, clock, randomness or eval', () => {
  const src = readFileSync('ccis-app-results.js', 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const w of ['document', 'window', 'fetch', 'localStorage', 'Date', 'Math.random', 'innerHTML', 'eval', 'import']) assert.equal(new RegExp(`\\b${w.replace('.', '\\.')}\\b`).test(src), false, w);
});

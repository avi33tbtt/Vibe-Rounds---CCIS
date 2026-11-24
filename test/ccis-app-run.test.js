// Row 3.9: the pure in-page run adapter. Node only, real market and real fixture envelopes. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { importEnvelope } from '../ccis-import.js';
import { planRun, executeRun, verifyRecord, runIdOf } from '../ccis-run.js';
import { heldFromMarket } from '../ccis-app-import-report.js';
import { APP_RUNTIME, compatibilityFor } from '../ccis-app-catalogue.js';
import { runForPage, RUN_SENTENCES } from '../ccis-app-run.js';

const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
const files = Object.fromEntries(idx.entries.map((e) => [e.path, readFileSync(`market/${e.path}`, 'utf8')]));
const market = { index: idx, files };
const KEY = 'snake.documentation-path@0.1.0';
const AT = '2026-01-01T00:00:00Z';
const fixture = (name) => JSON.parse(readFileSync(`ccis/fixtures/snake/${name}.envelope.json`, 'utf8'));
const imported = (name) => importEnvelope(fixture(name), { held: heldFromMarket(market) });
const INSIDE = imported('boundary/boundary-01-edge-inside');
const run = (o = {}) => runForPage({ market, pathwayKey: KEY, importResult: INSIDE, evaluationTime: AT, ...o });

test('a run gives a record that verifies, and its id is the address of its inputs', () => {
  const r = run();
  assert.equal(r.ok, true);
  assert.equal(r.record.status, 'completed');
  assert.equal(verifyRecord(r.record).ok, true);
  assert.equal(r.record.id, runIdOf(r.record));
  assert.ok(Object.isFrozen(r.record));
});

test('the same inputs give byte-identical records; another evaluation time gives another id', () => {
  assert.equal(JSON.stringify(run().record), JSON.stringify(run().record));
  assert.notEqual(run({ evaluationTime: '2026-01-02T00:00:00Z' }).record.id, run().record.id);
});

test('runNeedsData changes the id and runs the items the default skips, which are listed', () => {
  const importResult = imported('missing/missing-01-no-bite-time');
  const plain = run({ importResult });
  const more = run({ importResult, runNeedsData: true });
  assert.equal(plain.ok && more.ok, true);
  assert.notEqual(plain.record.id, more.record.id);
  assert.ok(more.record.results.length > plain.record.results.length);
  assert.deepEqual(plain.skipped.map((i) => i.id), ['snake.bite-to-antivenom-interval']);
  assert.deepEqual(more.skipped, []);
});

test('a refused import gives a failed record and no results', () => {
  const importResult = importEnvelope({}, { held: heldFromMarket(market) });
  assert.equal(importResult.ok, false);
  const r = run({ importResult });
  assert.equal(r.ok, true);
  assert.equal(r.record.status, 'failed');
  assert.equal(r.record.results.length, 0);
});

test('each missing input gives its fixed sentence, which echoes nothing and matches the catalogue sentences', () => {
  const probe = 'secret-probe-value-12345';
  const none = compatibilityFor({ market: null, pathwayKey: KEY });
  const nokey = compatibilityFor({ market, pathwayKey: null });
  const unknown = compatibilityFor({ market, pathwayKey: probe });
  assert.equal(runForPage({ pathwayKey: KEY, importResult: INSIDE, evaluationTime: AT }).sentence, none.sentence);
  assert.equal(run({ pathwayKey: '' }).sentence, nokey.sentence);
  assert.equal(run({ pathwayKey: probe }).sentence, unknown.sentence);
  assert.equal(run({ importResult: null }).sentence, 'Import an envelope first.');
  assert.equal(run({ evaluationTime: undefined }).sentence, 'An evaluation time is needed.');
  const bad = run({ evaluationTime: `${probe}` });
  assert.equal(bad.ok, false);
  for (const s of [run({ pathwayKey: probe }).sentence, bad.sentence]) {
    assert.ok(!s.includes(probe));
    assert.ok(RUN_SENTENCES.some((x) => s.startsWith(x)));
  }
  assert.match(bad.sentence, /^The run was refused\. Rule R-008\.$/);
  const apath = idx.entries.find((e) => e.type === 'analytics-package' && e.version === '0.1.1').path;
  const altered = run({ market: { index: idx, files: { ...files, [apath]: `${files[apath]} ` } } });
  assert.equal(altered.sentence, 'The market could not be checked against its pins.');
});

test('nothing passed in is changed', () => {
  const before = JSON.stringify([market, INSIDE, { supplied: {} }]);
  const supplied = {};
  run({ supplied });
  assert.equal(JSON.stringify([market, INSIDE, { supplied }]), before);
});

test('the record equals the one the CLI path composes from the same inputs, with the page runtime', () => {
  const entry = idx.entries.find((e) => `${e.id}@${e.version}` === KEY);
  const pathway = JSON.parse(files[entry.path]);
  const analytics = pathway.analytics.map((a) => {
    // the highest held version that satisfies the range (every range here is ^0.1.0), as resolve picks it
    const e = idx.entries.filter((x) => x.id === a.ref.id && x.type === a.ref.type).sort((p, q) => q.version.localeCompare(p.version, 'en', { numeric: true }))[0];
    return { analytic: JSON.parse(files[e.path]), checksum: e.checksum };
  });
  const planned = planRun({ pathway, analytics, held: heldFromMarket(market), importResult: INSIDE, runtime: APP_RUNTIME, request: { mode: 'preview', runNeedsData: false } });
  assert.equal(planned.ok, true);
  const done = executeRun({ plan: planned.plan, supplied: {}, evaluationTime: AT });
  assert.equal(JSON.stringify(run().record), JSON.stringify(done.record));
});

test('bundled alone the module has no node: import and stays under 1.6 MB, and its source touches nothing outside', () => {
  const r = buildSync({
    entryPoints: [fileURLToPath(new URL('../ccis-app-run.js', import.meta.url))],
    bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', minify: false, legalComments: 'none',
    alias: { 'node:crypto': fileURLToPath(new URL('../ccis-sha256.js', import.meta.url)) },
    logLevel: 'silent',
  });
  const text = r.outputFiles[0].text;
  assert.ok(!/["']node:\w+["']/.test(text), 'a node: import remains');
  assert.ok(text.length < 1.6 * 1024 * 1024, `bundle is ${text.length} characters`);
  const src = readFileSync(new URL('../ccis-app-run.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|WebSocket|Date\b|Math\.random|innerHTML|document\.|window\./);
});

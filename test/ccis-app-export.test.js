// Row 3.9b: the pure run record export. Node only, real market and real fixture envelope. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importEnvelope } from '../ccis-import.js';
import { heldFromMarket } from '../ccis-app-import-report.js';
import { runForPage } from '../ccis-app-run.js';
import { canonicalize } from '../ccis-compile.js';
import { verifyRecord } from '../ccis-run.js';
import { exportModel, EXPORT_SENTENCES } from '../ccis-app-export.js';

const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
const market = { index: idx, files: Object.fromEntries(idx.entries.map((e) => [e.path, readFileSync(`market/${e.path}`, 'utf8')])) };
const importResult = importEnvelope(JSON.parse(readFileSync('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json', 'utf8')), { held: heldFromMarket(market) });
const REC = runForPage({ market, pathwayKey: 'snake.documentation-path@0.1.0', importResult, evaluationTime: '2026-01-01T00:00:00Z' }).record;
const copy = () => JSON.parse(JSON.stringify(REC));
const OK_LINE = 'Verified: id and results checksum match.';

test('the text is the canonical record plus a newline and verifies when parsed', () => {
  const m = exportModel(REC);
  assert.equal(m.ok, true);
  assert.equal(m.text, `${canonicalize(REC).text}\n`);
  assert.equal(verifyRecord(JSON.parse(m.text)).ok, true);
  assert.equal(m.bytes, Buffer.byteLength(m.text, 'utf8'));
  assert.match(m.checksum, /^sha256:[0-9a-f]{64}$/);
});

test('the file name is the record id, and a hostile id falls back', () => {
  assert.equal(exportModel(REC).filename, `${REC.id}.json`);
  assert.equal(exportModel({ ...copy(), id: '../x' }).filename, 'ccis-run-record.json');
});

test('the verified line is the fixed sentence; a changed result is not verified', () => {
  assert.equal(exportModel(REC).verification.line, OK_LINE);
  const bad = copy();
  const r = bad.results.find((x) => x.kind === 'value');
  r.value.amount += 1;
  const v = exportModel(bad).verification;
  assert.equal(v.ok, false);
  assert.match(v.line, /^Not verified: .*results/);
  assert.doesNotMatch(v.line, /\bid\b/);
});

test('F-11 honesty: a changed context byte still verifies and the line claims nothing more', () => {
  const bad = copy();
  bad.context.pathways = []; // not part of the id, so it still verifies (F-11)
  const v = exportModel(bad).verification;
  assert.equal(v.line, OK_LINE);
  for (const w of ['context', 'snapshot', 'intact', 'all']) assert.equal(new RegExp(`\\b${w}\\b`, 'i').test(v.line), false, w);
});

test('a failed record exports; no run gives the fixed sentences', () => {
  const failed = { ...copy(), status: 'failed', failure: { code: 'X' }, results: [] };
  assert.equal(exportModel(failed).ok, true);
  for (const bad of [null, undefined, {}, 5]) {
    const m = exportModel(bad);
    assert.equal(m.ok, bad && typeof bad === 'object' ? m.ok : false);
  }
  assert.deepEqual(exportModel(null), { ok: false, sentence: 'No run to export.' });
});

test('the notices hold the snapshot line; a test-only copy adds the second', () => {
  assert.deepEqual(exportModel(REC).notices, ['This file holds the input snapshot. Synthetic data only. Not for clinical use.']);
  assert.equal(exportModel({ ...copy(), 'x-testOnly': true }).notices[1], 'Test-only parameters. Not clinical values.');
  for (const s of EXPORT_SENTENCES) assert.doesNotMatch(s, /\b(safe|normal)\b/i);
});

test('the same record gives identical output and the input is not changed', () => {
  const before = JSON.stringify(REC);
  assert.equal(JSON.stringify(exportModel(REC)), JSON.stringify(exportModel(REC)));
  assert.equal(JSON.stringify(REC), before);
});

test('source scan: no DOM, network, storage, clock, randomness or eval', () => {
  const src = readFileSync('ccis-app-export.js', 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const w of ['document', 'window', 'fetch', 'localStorage', 'Date', 'Math.random', 'innerHTML', 'eval']) assert.equal(new RegExp(`\\b${w.replace('.', '\\.')}\\b`).test(src), false, w);
});

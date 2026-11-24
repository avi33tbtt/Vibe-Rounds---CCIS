import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { importEnvelope } from '../ccis-import.js';
import { heldFromMarket, importReportView } from '../ccis-app-import-report.js';

const files = {};
const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
for (const e of idx.entries) files[e.path] = readFileSync(join('market', e.path), 'utf8');
const market = { index: idx, files };
const held = heldFromMarket(market);

const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.envelope.json') ? [p] : [];
});
const envelopes = walk('ccis/fixtures/snake');

test('view counts equal the importer counts for every committed snake envelope', () => {
  assert.ok(envelopes.length > 0);
  for (const p of envelopes) {
    const res = importEnvelope(JSON.parse(readFileSync(p, 'utf8')), { held });
    const v = importReportView(res);
    if (res.ok) {
      assert.equal(v.outcome, 'read', p);
      assert.deepEqual(v.counts, res.report.counts, p);
      assert.equal(v.applied.length, res.report.appliedVersions.length, p);
    } else {
      assert.equal(v.outcome, 'refused', p);
    }
  }
});

test('a refused result shows only its fixed sentence', () => {
  const res = importEnvelope({}, { held });
  const v = importReportView(res);
  assert.deepEqual(Object.keys(v).sort(), ['outcome', 'refusalSentence']);
  assert.equal(v.refusalSentence, res.report.refusalReason);
});

test('sentinel values, units, code text and concepts never enter the view', () => {
  const S = ['SENT-VALUE-91', 'SENT-UNIT-92', 'SENT-CODE-93', 'SENT-CONCEPT-94'];
  const result = {
    ok: true, outcome: 'read',
    report: {
      outcome: 'read',
      envelope: { version: '0.1.0', exportedAt: '2026-11-20T12:00:00Z', producer: { system: 'p', version: '1.0.0' } },
      appliedVersions: [{ id: 'a', type: 'contextual-element', version: '0.1.0', held: true }],
      counts: { accepted: 1, rejected: 1, unmapped: 1, ambiguous: 0, total: 3 },
      ignored: [{ path: '/x-ext', reason: 'r' }],
      records: [
        { ref: 'o1', recordKind: 'observation', category: 'accepted', notes: ['time-zone-unknown'] },
        { ref: 'o2', recordKind: 'observation', category: 'rejected', reasons: [{ code: 'unit-not-allowed', value: S[0], unit: S[1], codeText: S[2] }] },
        { ref: 'o3', recordKind: 'observation', category: 'unmapped', reasons: [{ code: 'concept-not-in-applied-element', concept: S[3] }] },
      ],
    },
  };
  const text = JSON.stringify(importReportView(result));
  for (const s of S) assert.ok(!text.includes(s), s);
  assert.ok(text.includes('o2') && text.includes('o3'));
});

test('ids are capped at 200 with a more count; unknown reason codes are handled', () => {
  const records = Array.from({ length: 205 }, (_, i) => ({
    ref: `r${i}`, recordKind: 'observation', category: 'rejected', reasons: [{ code: i === 0 ? 'brand-new-code' : 'kind-mismatch' }],
  }));
  const v = importReportView({
    ok: true,
    report: {
      outcome: 'read', envelope: { version: '0.1.0', exportedAt: 'x', producer: { system: 's', version: '1.0.0' } },
      appliedVersions: [], counts: { accepted: 0, rejected: 205, unmapped: 0, ambiguous: 0, total: 205 }, ignored: [], records,
    },
  });
  assert.equal(v.refs.rejected.ids.length, 200);
  assert.equal(v.refs.rejected.more, 5);
  const unk = v.reasons.find((r) => r.code === 'brand-new-code');
  assert.equal(unk.count, 1);
  assert.match(unk.sentence, /not recognised/);
});

test('heldFromMarket: null without a market, blocked entries left out', () => {
  assert.equal(heldFromMarket(null), null);
  const mk = (id) => JSON.stringify({ manifest: { id } });
  const m = {
    index: { entries: [
      { path: 'a', status: 'draft' }, { path: 'b', status: 'withdrawn' }, { path: 'c', status: 'rejected' },
    ] },
    files: { a: mk('a'), b: mk('b'), c: mk('c') },
  };
  assert.deepEqual(heldFromMarket(m).map((x) => x.manifest.id), ['a']);
  assert.equal(held.length, idx.entries.length);
});

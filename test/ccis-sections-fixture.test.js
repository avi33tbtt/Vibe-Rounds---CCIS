// Row E1c: the envelope 0.2.0 sections fixture, checked against its hand-calculated expected file. Prototype. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importEnvelope } from '../ccis-import.js';
import { contextEnvelope, importReport } from '../ccis/validators/ccis-validators.js';

const ex = new URL('../ccis/examples/snake/', import.meta.url);
const fx = new URL('../ccis/fixtures/snake/sections/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const held = [read(new URL('snake-envenomation.element.json', ex)), read(new URL('snake-documentation.pathway.json', ex))];
const env = () => read(new URL('sections-01.envelope.json', fx));
const exp = read(new URL('sections-01.expected.json', fx));
const imp = (x) => importEnvelope(x, { held });

test('the fixture envelope is valid and declares 0.2.0', () => {
  const e = env();
  assert.equal(contextEnvelope(e), true, JSON.stringify(contextEnvelope.errors));
  assert.equal(e.envelope.version, '0.2.0');
});

test('the import equals the expected file record by record and in counts', () => {
  const r = imp(env());
  assert.equal(r.ok, true);
  assert.deepEqual(r.report.counts, exp.counts);
  for (const x of exp.records) {
    const got = r.report.records.find((q) => q.ref === x.ref);
    assert.ok(got, x.ref);
    assert.equal(got.recordKind, x.recordKind, x.ref);
    assert.equal(got.category, x.category, x.ref);
    assert.equal(got.reasons?.[0]?.code, x.reasonCode, x.ref);
    assert.deepEqual(got.notes, x.notes, x.ref);
  }
});

test('the context holds exactly the accepted ids per section', () => {
  const r = imp(env());
  for (const [k, ids] of Object.entries(exp.context)) assert.deepEqual(r.context[k].map((q) => q.id), ids, k);
});

test('the report validates and a second import gives the same context checksum', () => {
  const a = imp(env()), b = imp(env());
  assert.equal(importReport(a.report), true, JSON.stringify(importReport.errors));
  assert.equal(a.contextChecksum, b.contextChecksum);
});

test('the same envelope declaring 0.1.0 is refused', () => {
  const e = env(); e.envelope.version = '0.1.0';
  const r = imp(e);
  assert.equal(r.ok, false); assert.equal(r.context, null);
});

test('no section carries a free-text member', () => {
  const e = env();
  const allowed = new Set(['id', 'concept', 'lifecycle', 'status', 'sourceClass', 'provenance', 'recorded', 'effective', 'period', 'correctionOf']);
  for (const k of ['problems', 'allergies', 'orders']) for (const it of e[k]) for (const m of Object.keys(it)) assert.ok(allowed.has(m), `${k}.${m}`);
});

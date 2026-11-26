// Row E2b: the importer reads the envelope 0.3.0 section `administrations`. Prototype. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importEnvelope } from '../ccis-import.js';
import { importReport } from '../ccis/validators/ccis-validators.js';

const ex = new URL('../ccis/examples/snake/', import.meta.url);
const fx = new URL('../ccis/fixtures/snake/normal/normal-01-all-enabled.envelope.json', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const clone = (x) => structuredClone(x);
const held = [read(new URL('snake-envenomation.element.json', ex)), read(new URL('snake-documentation.pathway.json', ex))];
const base = read(fx);
const prov = { roleClass: 'synthetic-clinical-system', origin: 'synthetic-source', verified: false, corrected: false };
const t = { value: '2026-11-20T08:00:00Z', zone: 'stated' };
const adm = (id, outcome, more = {}) => ({ id, concept: { id: 'snake.administration.antivenom', codes: [] }, outcome, status: 'final', sourceClass: 'clinician-entered', provenance: prov, recorded: t, ...more });
const order = (id) => ({ id, concept: { id: 'snake.order.antivenom', codes: [] }, lifecycle: 'active', status: 'final', sourceClass: 'clinician-entered', provenance: prov, recorded: t });
const v3 = () => {
  const x = clone(base); x.envelope.version = '0.3.0';
  x.orders = [order('r1')];
  x.administrations = [adm('m3', 'refused'), adm('m1', 'given', { orderRef: 'r1' }), adm('m2', 'held')];
  return x;
};
const imp = (x) => importEnvelope(x, { held });
const rec = (r, id) => r.report.records.find((q) => q.ref === id);

test('0.1.0 and 0.2.0 envelopes give a context with no administrations key and a stable checksum', () => {
  const v2 = clone(base); v2.envelope.version = '0.2.0'; v2.orders = [order('r1')];
  for (const x of [base, v2]) {
    const a = imp(x), b = imp(clone(x));
    assert.equal(a.ok, true); assert.equal('administrations' in a.context, false);
    assert.equal(a.contextChecksum, b.contextChecksum);
  }
});

test('a 0.3.0 envelope: administrations accepted, sorted by id, outcomes kept, counts add up, report validates', () => {
  const r = imp(v3());
  assert.equal(r.ok, true, JSON.stringify(r.report.refusalReason));
  assert.deepEqual(r.context.administrations.map((a) => a.id), ['m1', 'm2', 'm3']);
  assert.deepEqual(r.context.administrations.map((a) => a.outcome), ['given', 'held', 'refused']);
  const c = r.report.counts; assert.equal(c.accepted + c.rejected + c.unmapped + c.ambiguous, c.total);
  assert.equal(importReport(r.report), true, JSON.stringify(importReport.errors));
  assert.equal(rec(r, 'm1').recordKind, 'administration');
});

test('an entered-in-error administration is rejected and left out of the context', () => {
  const x = v3(); x.administrations[1].status = 'entered-in-error';
  const r = imp(x);
  assert.equal(rec(r, 'm1').category, 'rejected'); assert.equal(rec(r, 'm1').reasons[0].category, 'entered-in-error');
  assert.equal(r.context.administrations.some((a) => a.id === 'm1'), false);
});

test('an unclassified administration is unmapped and absent from the context', () => {
  const x = v3(); x.administrations[1].concept.id = 'unclassified';
  const r = imp(x);
  assert.equal(rec(r, 'm1').category, 'unmapped'); assert.equal(rec(r, 'm1').reasons[0].code, 'concept-unclassified');
  assert.equal(r.context.administrations.some((a) => a.id === 'm1'), false);
});

test('a correctionOf that points nowhere is rejected; one that points at a record in the envelope is accepted', () => {
  const x = v3(); x.administrations[0].correctionOf = 'nope'; x.administrations[2].correctionOf = 'm1';
  const r = imp(x);
  assert.equal(rec(r, 'm3').reasons[0].code, 'correction-target-missing');
  assert.equal(rec(r, 'm2').category, 'accepted');
});

test('an id reused across orders and administrations refuses the whole envelope (IMP-105)', () => {
  const x = v3(); x.administrations[0].id = 'r1';
  const r = imp(x); assert.equal(r.ok, false); assert.match(r.report.refusalReason, /IMP-105/);
});

test('a dangling orderRef does not drop the record of a dose', () => {
  const x = v3(); x.administrations[1].orderRef = 'no-such-order';
  const r = imp(x); assert.equal(rec(r, 'm1').category, 'accepted');
  assert.equal(r.context.administrations.find((a) => a.id === 'm1').orderRef, 'no-such-order');
});

test('a zone-unknown effective time adds the note', () => {
  const x = v3(); x.administrations[1].effective = { value: '2026-11-20T09:00:00', zone: 'unknown' };
  assert.ok(rec(imp(x), 'm1').notes.includes('time-zone-unknown'));
});

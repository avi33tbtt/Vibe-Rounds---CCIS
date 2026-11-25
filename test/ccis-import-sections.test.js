// Row E1b: the importer reads envelope 0.2.0 sections (problems, allergies, orders, results). Prototype. Synthetic data only.
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
const item = (id, concept, more = {}) => ({ id, concept: { id: concept, codes: [] }, lifecycle: 'active', status: 'final', sourceClass: 'clinician-entered', provenance: prov, recorded: t, ...more });
const v2 = () => {
  const x = clone(base); x.envelope.version = '0.2.0';
  x.problems = [item('p2', 'snake.problem.b'), item('p1', 'snake.problem.a')];
  x.allergies = [item('a1', 'snake.allergy.a')];
  x.orders = [item('r1', 'snake.order.a')];
  x.results = [{ ...clone(base.observations[0]), id: 'res1' }];
  return x;
};
const imp = (x) => importEnvelope(x, { held });
const rec = (r, id) => r.report.records.find((q) => q.ref === id);

test('a 0.1.0 envelope gives a context with no section keys, same checksum on re-import', () => {
  const a = imp(base), b = imp(clone(base));
  assert.equal(a.ok, true);
  for (const k of ['problems', 'allergies', 'orders', 'results']) assert.equal(k in a.context, false, k);
  assert.equal(a.contextChecksum, b.contextChecksum);
});

test('a 0.2.0 envelope: items accepted and sorted by id, counts add up, report validates', () => {
  const r = imp(v2());
  assert.equal(r.ok, true, JSON.stringify(r.report.refusalReason));
  assert.deepEqual(r.context.problems.map((p) => p.id), ['p1', 'p2']);
  assert.equal(r.context.allergies.length, 1); assert.equal(r.context.orders.length, 1); assert.equal(r.context.results.length, 1);
  const c = r.report.counts; assert.equal(c.accepted + c.rejected + c.unmapped + c.ambiguous, c.total);
  assert.equal(importReport(r.report), true, JSON.stringify(importReport.errors));
  assert.equal(rec(r, 'p1').recordKind, 'problem'); assert.equal(rec(r, 'a1').recordKind, 'allergy'); assert.equal(rec(r, 'r1').recordKind, 'order');
});

test('entered-in-error items and results are rejected and left out of the context', () => {
  const x = v2(); x.problems[0].status = 'entered-in-error'; x.results[0].status = 'entered-in-error';
  const r = imp(x);
  assert.equal(rec(r, 'p2').category, 'rejected'); assert.equal(rec(r, 'p2').reasons[0].code, 'excluded-by-policy');
  assert.equal(rec(r, 'res1').category, 'rejected');
  assert.deepEqual(r.context.problems.map((p) => p.id), ['p1']); assert.equal(r.context.results.length, 0);
});

test('an unclassified item is unmapped and absent from the context', () => {
  const x = v2(); x.allergies[0].concept.id = 'unclassified';
  const r = imp(x);
  assert.equal(rec(r, 'a1').category, 'unmapped'); assert.equal(rec(r, 'a1').reasons[0].code, 'concept-unclassified');
  assert.equal(r.context.allergies.length, 0);
});

test('a correctionOf that points nowhere is rejected; an id reused across sections refuses the envelope', () => {
  const x = v2(); x.orders[0].correctionOf = 'nowhere';
  const r = imp(x); assert.equal(rec(r, 'r1').reasons[0].code, 'correction-target-missing');
  const y = v2(); y.orders[0].id = 'p1';
  const z = imp(y); assert.equal(z.ok, false); assert.match(z.report.refusalReason, /IMP-105/);
});

test('a result in an applied element is accepted as a result; one outside is unmapped', () => {
  const x = v2(); x.results.push({ ...clone(base.observations[0]), id: 'res2', concept: { id: 'snake.other.thing', codes: [] } });
  const r = imp(x);
  assert.equal(rec(r, 'res1').recordKind, 'result'); assert.equal(rec(r, 'res1').category, 'accepted');
  assert.equal(rec(r, 'res2').category, 'unmapped'); assert.deepEqual(r.context.results.map((q) => q.id), ['res1']);
});

test('a zone-unknown time on an item adds a note', () => {
  const x = v2(); x.problems[0].effective = { value: '2026-11-20T00:00:00', zone: 'unknown' };
  assert.ok(rec(imp(x), 'p2').notes.includes('time-zone-unknown'));
});

test('a 0.1.0 envelope declaring a section is refused by the schema', () => {
  const x = v2(); x.envelope.version = '0.1.0';
  const r = imp(x); assert.equal(r.ok, false); assert.equal(r.context, null);
});

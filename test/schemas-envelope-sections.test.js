// Row E1a: envelope 0.2.0 optional sections (problems, allergies, orders, results), schema only. Prototype. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contextEnvelope } from '../ccis/validators/ccis-validators.js';

const root = new URL('../ccis/fixtures/snake/', import.meta.url);
const load = (f) => JSON.parse(readFileSync(new URL(f, root), 'utf8'));
const clone = (o) => structuredClone(o);
const ok = (x) => contextEnvelope(x) === true;
const base = load('normal/normal-01-all-enabled.envelope.json');
const prov = { roleClass: 'synthetic-clinical-system', origin: 'synthetic-source', verified: false, corrected: false };
const t = { value: '2026-11-20T08:00:00Z', zone: 'stated' };
const item = (id, concept) => ({ id, concept: { id: concept, codes: [] }, lifecycle: 'active', status: 'final', sourceClass: 'clinician-entered', provenance: prov, recorded: t });
const v2 = () => {
  const x = clone(base);
  x.envelope.version = '0.2.0';
  x.problems = [item('p1', 'snake.problem.envenomation')];
  x.allergies = [item('a1', 'unclassified')];
  x.orders = [item('r1', 'snake.order.coagulation-test')];
  x.results = [clone(base.observations[0])];
  return x;
};

test('every snake fixture envelope in the index still validates (additive change)', () => {
  const index = load('index.json');
  let n = 0;
  for (const c of index.cases) {
    const f = `${c.class}/${c.case}.envelope.json`;
    let env; try { env = load(f); } catch { continue; }
    assert.equal(ok(env), true, f); n += 1;
  }
  assert.ok(n >= 2);
});

test('a minimal 0.2.0 envelope with one item in each section validates', () => {
  assert.equal(ok(v2()), true, JSON.stringify(contextEnvelope.errors));
});

test('a 0.1.0 envelope without sections validates; with a section it is refused', () => {
  assert.equal(ok(base), true);
  for (const k of ['problems', 'allergies', 'orders', 'results']) {
    const x = v2(); x.envelope.version = '0.1.0';
    for (const o of ['problems', 'allergies', 'orders', 'results']) if (o !== k) delete x[o];
    assert.equal(ok(x), false, k);
  }
  const later = v2(); later.envelope.version = '1.0.0'; assert.equal(ok(later), true);
});

test('an item with an unknown member or a free-text member is refused; x- members pass', () => {
  for (const m of ['label', 'note', 'name', 'dose', 'bogus']) { const x = v2(); x.problems[0][m] = 'text'; assert.equal(ok(x), false, m); }
  const e = v2(); e.orders[0]['x-note'] = 'ok'; assert.equal(ok(e), true);
});

test('an item missing a required member is refused', () => {
  for (const k of ['id', 'concept', 'lifecycle', 'status', 'sourceClass', 'provenance', 'recorded']) {
    const x = v2(); delete x.allergies[0][k]; assert.equal(ok(x), false, k);
  }
});

test('a bad lifecycle, status or concept is refused; every lifecycle value is accepted', () => {
  const x = v2(); x.problems[0].lifecycle = 'maybe'; assert.equal(ok(x), false);
  const y = v2(); y.problems[0].status = 'draft'; assert.equal(ok(y), false);
  const z = v2(); delete z.problems[0].concept.codes; assert.equal(ok(z), false);
  for (const l of ['active', 'resolved', 'stopped', 'cancelled', 'replaced', 'unknown']) { const w = v2(); w.orders[0].lifecycle = l; assert.equal(ok(w), true, l); }
});

test('optional effective, period and correctionOf are checked; the period needs a start', () => {
  const x = v2(); Object.assign(x.problems[0], { effective: t, period: { start: t, end: t }, correctionOf: 'p0' });
  assert.equal(ok(x), true, JSON.stringify(contextEnvelope.errors));
  const y = v2(); y.problems[0].period = { end: t }; assert.equal(ok(y), false);
  const z = v2(); z.problems[0].effective = '2026-11-20'; assert.equal(ok(z), false);
});

test('results reuse the observation shape: a malformed observation is refused; sections must be arrays', () => {
  const x = v2(); x.results[0].kind = 'weird'; assert.equal(ok(x), false);
  const y = v2(); delete y.results[0].recorded; assert.equal(ok(y), false);
  const z = v2(); z.orders = item('r1', 'snake.order.x'); assert.equal(ok(z), false);
});

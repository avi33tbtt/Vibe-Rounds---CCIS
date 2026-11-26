// Row E2a: envelope 0.3.0 optional section `administrations`, schema only. Prototype. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contextEnvelope } from '../ccis/validators/ccis-validators.js';

const root = new URL('../ccis/fixtures/snake/', import.meta.url);
const load = (f) => JSON.parse(readFileSync(new URL(f, root), 'utf8'));
const ok = (x) => contextEnvelope(x) === true;
const base = load('normal/normal-01-all-enabled.envelope.json');
const prov = { roleClass: 'synthetic-clinical-system', origin: 'synthetic-source', verified: false, corrected: false };
const t = { value: '2026-11-20T08:00:00Z', zone: 'stated' };
const adm = (id, outcome = 'given') => ({ id, concept: { id: 'snake.administration.antivenom', codes: [] }, outcome, status: 'final', sourceClass: 'clinician-entered', provenance: prov, recorded: t });
const v3 = () => {
  const x = structuredClone(base);
  x.envelope.version = '0.3.0';
  x.orders = [{ id: 'r1', concept: { id: 'snake.order.antivenom', codes: [] }, lifecycle: 'active', status: 'final', sourceClass: 'clinician-entered', provenance: prov, recorded: t }];
  x.administrations = [adm('m1')];
  return x;
};

test('every snake fixture envelope in the index still validates (additive change)', () => {
  const index = load('index.json');
  let n = 0;
  for (const c of index.cases) {
    let env; try { env = load(`${c.class}/${c.case}.envelope.json`); } catch { continue; }
    assert.equal(ok(env), true, c.case); n += 1;
  }
  assert.ok(n >= 2);
});

test('a minimal 0.3.0 envelope with an order and an administration validates; a later major also validates', () => {
  assert.equal(ok(v3()), true, JSON.stringify(contextEnvelope.errors));
  const later = v3(); later.envelope.version = '1.0.0'; assert.equal(ok(later), true);
});

test('the section needs envelope 0.3.0 or later: 0.1.0 and 0.2.0 are refused; without the section they still validate', () => {
  for (const v of ['0.1.0', '0.2.0']) { const x = v3(); x.envelope.version = v; assert.equal(ok(x), false, v); }
  const y = v3(); delete y.administrations; y.envelope.version = '0.2.0'; assert.equal(ok(y), true);
  assert.equal(ok(base), true);
});

test('an unknown or free-text member is refused (no dose, reason, note, route, site); x- members pass', () => {
  for (const m of ['dose', 'reason', 'note', 'route', 'site', 'label', 'bogus']) { const x = v3(); x.administrations[0][m] = 'text'; assert.equal(ok(x), false, m); }
  const e = v3(); e.administrations[0]['x-note'] = 'ok'; assert.equal(ok(e), true);
});

test('an administration missing a required member is refused', () => {
  for (const k of ['id', 'concept', 'outcome', 'status', 'sourceClass', 'provenance', 'recorded']) {
    const x = v3(); delete x.administrations[0][k]; assert.equal(ok(x), false, k);
  }
});

test('a bad outcome is refused (lifecycle is not an outcome); all four outcomes are accepted', () => {
  for (const bad of ['maybe', 'active', 'stopped']) { const x = v3(); x.administrations[0].outcome = bad; assert.equal(ok(x), false, bad); }
  for (const o of ['given', 'held', 'refused', 'unknown']) { const x = v3(); x.administrations[0].outcome = o; assert.equal(ok(x), true, o); }
  const y = v3(); y.administrations[0].lifecycle = 'active'; assert.equal(ok(y), false, 'lifecycle is not a member here');
});

test('optional effective, orderRef and correctionOf are checked', () => {
  const x = v3(); Object.assign(x.administrations[0], { effective: t, orderRef: 'r1', correctionOf: 'm0' });
  assert.equal(ok(x), true, JSON.stringify(contextEnvelope.errors));
  const y = v3(); y.administrations[0].effective = '2026-11-20'; assert.equal(ok(y), false);
  const z = v3(); z.administrations[0].orderRef = 5; assert.equal(ok(z), false);
});

test('the section must be an array of administration items; a bad status or concept is refused', () => {
  const x = v3(); x.administrations = adm('m1'); assert.equal(ok(x), false);
  const y = v3(); y.administrations[0].status = 'draft'; assert.equal(ok(y), false);
  const z = v3(); delete z.administrations[0].concept.codes; assert.equal(ok(z), false);
});

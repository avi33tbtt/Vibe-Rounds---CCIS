import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importEnvelope, IMPORTER_VERSION, STANDARD_VERSION, CONTEXT_FORM, REJECTION_CODES } from '../ccis-import.js';
import { loadDemo, DEMO_IMPORTER_VERSION, DEMO_STANDARD_VERSION } from '../ccis-demo-loader.js';
import { canonicalize, checksumOf, COMPILER } from '../ccis-compile.js';
import { STANDARD_VERSION as RECORD_STANDARD, VALIDATOR } from '../ccis-validation-record.js';
import { importReport } from '../ccis/validators/ccis-validators.js';

const ex = new URL('../ccis/examples/snake/', import.meta.url);
const fx = new URL('../ccis/fixtures/snake/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const exa = (f) => read(new URL(f, ex));
const clone = (x) => JSON.parse(JSON.stringify(x));
const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };

const pkg = () => ({
  element: exa('snake-envenomation.element.json'),
  binding: exa('snake-demo-terminology.binding.json'),
  pathway: exa('snake-documentation.pathway.json'),
  nodes: [exa('snake-node-clotting.node.json'), exa('snake-node-antivenom.node.json')],
  analytics: [exa('snake-interval.analytics.0.1.1.json'), exa('snake-completeness.analytics.0.1.1.json')],
});
const heldOf = (p = pkg()) => [p.element, p.pathway];
const index = read(new URL('index.json', fx));
const envOf = (c) => read(new URL(`${c.class}/${c.case}.envelope.json`, fx));
const allEnvelopes = () => [...index.cases.map((c) => ({ name: c.case, env: envOf(c) })), { name: 'emr-export', env: read(new URL('emr-export/emr-demo-case.envelope.json', fx)) }];
const base = () => envOf(index.cases.find((c) => c.case === 'normal-01-all-enabled'));
const ID_BITE = 'snake.envenomation-timing.bite-time';

const validReport = (r) => assert.equal(importReport(r.report), true, JSON.stringify(importReport.errors));
const refused = (r, text) => {
  assert.equal(r.ok, false);
  assert.equal(r.outcome, 'refused');
  assert.equal(r.context, null, 'nothing reaches execution');
  assert.equal(r.contextChecksum, null);
  validReport(r);
  assert.equal(r.report.outcome, 'refused');
  assert.deepEqual(r.report.records, []);
  assert.equal(r.report.counts.total, 0);
  assert.ok(r.report.refusalReason.includes(text), r.report.refusalReason);
};
const rec = (r, ref) => { const m = r.report.records.filter((x) => x.ref === ref); assert.equal(m.length, 1, `${ref} is in exactly one record`); return m[0]; };

// A datetime observation to clone, with the usual provenance.
const obs = (id, over = {}) => ({
  id,
  concept: { id: ID_BITE, codes: [] },
  kind: 'datetime',
  value: { value: '2026-11-20T08:00:00Z', zone: 'stated' },
  effective: { value: '2026-11-20T08:00:00Z', zone: 'stated' },
  recorded: { value: '2026-11-20T08:05:00Z', zone: 'stated' },
  status: 'final',
  sourceClass: 'patient-reported',
  provenance: { roleClass: 'synthetic-clinical-system', origin: 'synthetic-source', verified: false, corrected: false },
  ...over,
});
const withObs = (extra) => { const e = base(); e.observations = [...e.observations, ...extra]; return e; };
const event = (id, over = {}) => ({
  id, type: 'unclassified', time: { value: '2026-11-20T09:00:00Z', zone: 'stated' }, status: 'final', sourceClass: 'clinician-entered',
  provenance: { roleClass: 'synthetic-clinical-system', origin: 'synthetic-source', verified: false, corrected: false }, ...over,
});
// A synthetic element with one added quantity field (the snake element has none).
const withQuantityField = () => {
  const p = pkg();
  p.element.fields.push({
    key: 'bodyWeight', label: 'Body weight', type: 'quantity', cardinality: { min: 0, max: 1 }, units: ['kg'],
    epistemic: ['absent', 'unknown', 'not-collected', 'not-applicable', 'explicitly-negative', 'entered-in-error'],
    sourceClasses: ['clinician-entered'], constraints: ['Synthetic test field.'],
  });
  return p;
};
const quantity = (id, unit, value = 60) => obs(id, { concept: { id: 'snake.envenomation-timing.body-weight', codes: [] }, kind: 'quantity', value, unit, sourceClass: 'clinician-entered' });

const reached = new Set();
const note = (r) => { for (const x of r.report.records) for (const reason of x.reasons ?? []) reached.add(reason.code); };

test('(a) oracle: all 32 fixture envelopes and the EMR export match the demo loader (outcome, counts, accepted ids)', () => {
  const envs = allEnvelopes();
  assert.equal(envs.length, 33);
  for (const { name, env } of envs) {
    const demo = loadDemo(pkg(), env);
    const r = importEnvelope(env, { held: heldOf() });
    assert.equal(r.ok, demo.ok, name);
    assert.equal(r.report.outcome, demo.importReport.outcome, name);
    validReport(r);
    assert.deepEqual(r.report.counts, demo.importReport.counts, name);
    const c = r.report.counts;
    assert.equal(c.accepted + c.rejected + c.unmapped + c.ambiguous, c.total, `${name}: counts add up`);
    assert.equal(c.ambiguous, 0, `${name}: ambiguous is not produced yet`);
    const ids = (rep) => rep.records.filter((x) => x.category === 'accepted').map((x) => x.ref).sort();
    assert.deepEqual(ids(r.report), ids(demo.importReport), name);
    assert.deepEqual(r.context.observations.map((o) => o.id), demo.envelope.observations.map((o) => o.id).sort(), name);
    assert.deepEqual(r.context.events.map((e) => e.id), demo.envelope.events.map((e) => e.id).sort(), name);
    assert.equal(r.context.contextForm, CONTEXT_FORM);
  }
});

test('(b) each whole-envelope refusal is reached once, with its reason, no records and no context', () => {
  const held = heldOf();
  for (const bad of [null, [], 'text', 7]) refused(importEnvelope(bad, { held }), 'not an object');

  let e = base(); e.envelope.version = '1.0.0';
  refused(importEnvelope(e, { held }), 'major version not supported');
  assert.equal(importEnvelope(e, { held }).report.envelope.version, '1.0.0');
  e = base(); e.envelope.version = 'banana';
  refused(importEnvelope(e, { held }), 'major version not supported');
  assert.equal(importEnvelope(e, { held }).report.envelope.exportedAt, 'unreadable');
  assert.equal(importEnvelope(e, { held, supportedEnvelopeMajors: [0, 1] }).report.outcome, 'refused', 'a version that is not semver is still refused');
  e = base(); e.envelope.version = '1.0.0';
  assert.equal(importEnvelope(e, { held, supportedEnvelopeMajors: [0, 1] }).ok, true, 'the supported majors are an option');

  e = base(); delete e.observations;
  refused(importEnvelope(e, { held }), 'does not conform');

  e = base(); e.patientName = 'ZZSENTINELZZ';
  let r = importEnvelope(e, { held });
  refused(r, 'unrecognised critical field');
  assert.equal(JSON.stringify(r).includes('ZZSENTINELZZ'), false, 'the refusal names no member and no content');
  e = base(); e.observations[0].narrative = 'ZZSENTINELZZ';
  r = importEnvelope(e, { held });
  refused(r, 'unrecognised critical field');
  assert.equal(JSON.stringify(r).includes('ZZSENTINELZZ'), false);

  r = importEnvelope(base(), { held: [] });
  refused(r, 'not held');
  assert.equal(r.report.appliedVersions.length, 2);
  assert.ok(r.report.appliedVersions.every((a) => a.held === false));
  r = importEnvelope(base(), { held: [held[0]] });
  assert.deepEqual(r.report.appliedVersions.map((a) => a.held), [true, false], 'every applied version is listed with held true or false');
  r = importEnvelope(base(), {});
  refused(r, 'not held');
  const other = pkg(); other.element.manifest.version = '0.2.0';
  refused(importEnvelope(base(), { held: [other.element, other.pathway] }), 'not held');

  const noFields = pkg(); delete noFields.element.fields;
  refused(importEnvelope(base(), { held: [noFields.element, noFields.pathway] }), 'no readable fields');
  const badField = pkg(); badField.element.fields[0] = 'x';
  refused(importEnvelope(base(), { held: [badField.element, badField.pathway] }), 'no readable fields');

  e = withObs([obs('o1')]);
  refused(importEnvelope(e, { held }), 'used more than once');
  e = base(); e.events = [event('o1')];
  refused(importEnvelope(e, { held }), 'used more than once');

  const good = importEnvelope(base(), { held });
  refused(importEnvelope(base(), { held, expectedChecksum: checksumOf('something else') }), 'checksum does not match');
  refused(importEnvelope(base(), { held, expectedChecksum: 'sha256:short' }), 'checksum does not match');
  refused(importEnvelope(base(), { held, expectedChecksum: 7 }), 'checksum does not match');
  assert.equal(importEnvelope(base(), { held, expectedChecksum: good.envelopeChecksum }).ok, true);

  e = withObs([obs('o50', { value: { value: 'x', zone: 'stated' } })]); e.observations[9].x = Infinity;
  refused(importEnvelope(e, { held }), 'canonical form');
});

test('(c) each rejection code is reached once by mutating a good envelope; every record is in exactly one category', () => {
  const held = heldOf();

  let r = importEnvelope(withObs([obs('oe1', { status: 'entered-in-error' })]), { held });
  let x = rec(r, 'oe1');
  assert.equal(x.category, 'rejected'); assert.deepEqual(x.reasons, [{ code: 'excluded-by-policy', category: 'entered-in-error' }]); note(r);
  assert.equal(r.context.observations.some((o) => o.id === 'oe1'), false);

  r = importEnvelope(withObs([obs('ou1', { concept: { id: 'snake.envenomation-timing.not-a-field', codes: [] } })]), { held });
  x = rec(r, 'ou1');
  assert.equal(x.category, 'unmapped'); assert.deepEqual(x.reasons, [{ code: 'concept-not-in-applied-element' }]); note(r);
  assert.equal(r.context.observations.some((o) => o.id === 'ou1'), false, 'unmapped records stay out of the context');

  r = importEnvelope(withObs([obs('os1', { sourceClass: 'device' })]), { held });
  x = rec(r, 'os1'); assert.equal(x.category, 'rejected'); assert.deepEqual(x.reasons, [{ code: 'source-class-not-allowed' }]); note(r);

  const narrow = pkg(); narrow.element.fields[0].epistemic = ['absent'];
  const stateObs = obs('ot1', { state: 'unknown' }); delete stateObs.value;
  r = importEnvelope(withObs([stateObs]), { held: heldOf(narrow) });
  x = rec(r, 'ot1'); assert.equal(x.category, 'rejected'); assert.deepEqual(x.reasons, [{ code: 'state-not-allowed' }]); note(r);

  r = importEnvelope(withObs([obs('ok1', { kind: 'string', value: 'text' })]), { held });
  x = rec(r, 'ok1'); assert.equal(x.category, 'rejected'); assert.deepEqual(x.reasons, [{ code: 'kind-mismatch' }]); note(r);

  const q = withQuantityField();
  r = importEnvelope(withObs([quantity('oq1', 'kg'), quantity('oq2', 'lb')]), { held: heldOf(q) });
  assert.equal(rec(r, 'oq1').category, 'accepted', 'a permitted unit is accepted');
  x = rec(r, 'oq2'); assert.equal(x.category, 'rejected'); assert.deepEqual(x.reasons, [{ code: 'unit-not-allowed' }]); note(r);
  assert.equal(r.context.observations.find((o) => o.id === 'oq1').value, 60, 'no conversion');

  r = importEnvelope(withObs([obs('oc1', { correctionOf: 'does-not-exist' }), obs('oc2', { correctionOf: 'o1' })]), { held });
  x = rec(r, 'oc1'); assert.equal(x.category, 'rejected'); assert.deepEqual(x.reasons, [{ code: 'correction-target-missing' }]); note(r);
  assert.equal(rec(r, 'oc2').category, 'accepted', 'a correction of an id in the envelope is accepted');

  // Events: entered-in-error rejected, otherwise accepted.
  const e = base(); e.events = [event('ev1'), event('ev2', { status: 'entered-in-error' })];
  r = importEnvelope(e, { held });
  assert.equal(rec(r, 'ev1').category, 'accepted'); assert.equal(rec(r, 'ev1').recordKind, 'event');
  assert.equal(rec(r, 'ev2').category, 'rejected'); note(r);
  assert.deepEqual(r.context.events.map((v) => v.id), ['ev1']);

  for (const code of Object.keys(REJECTION_CODES)) assert.ok(reached.has(code), `${code} was reached`);
  for (const code of reached) assert.ok(code in REJECTION_CODES, `${code} is in the catalogue`);
  for (const meaning of Object.values(REJECTION_CODES)) assert.match(meaning, /^\S.*\.$/);
  assert.ok(Object.isFrozen(REJECTION_CODES));

  // Every record of a mixed envelope is in exactly one category and the counts add up (IMP-105).
  const mixed = withObs([obs('m1', { status: 'entered-in-error' }), obs('m2', { sourceClass: 'device' }), obs('m3', { concept: { id: 'snake.envenomation-timing.zzz', codes: [] } }), obs('m4')]);
  mixed.events = [event('mv1'), event('mv2', { status: 'entered-in-error' })];
  r = importEnvelope(mixed, { held });
  const refs = r.report.records.map((v) => v.ref);
  assert.equal(new Set(refs).size, refs.length);
  assert.equal(r.report.counts.total, mixed.observations.length + mixed.events.length + 2);
  assert.equal(r.report.counts.accepted + r.report.counts.rejected + r.report.counts.unmapped + r.report.counts.ambiguous, r.report.counts.total);
  assert.ok(r.report.records.every((v) => ['accepted', 'rejected', 'unmapped', 'ambiguous'].includes(v.category)));
  validReport(r);
});

test('(c2) time notes: unknown recorded time and unknown zone are noted; no time is rejected or filled in', () => {
  const held = heldOf();
  const a = obs('n1', { recorded: { state: 'unknown' } });
  const b = obs('n2', { effective: { value: '2026-11-20T08:00:00', zone: 'unknown' } });
  const c = obs('n3', { value: { value: '2026-11-20T08:00:00', zone: 'unknown' } });
  const d = obs('n4');
  const r = importEnvelope(withObs([a, b, c, d]), { held });
  assert.deepEqual(rec(r, 'n1').notes, ['recorded-time-unknown']);
  assert.deepEqual(rec(r, 'n2').notes, ['time-zone-unknown']);
  assert.deepEqual(rec(r, 'n3').notes, ['time-zone-unknown']);
  assert.equal('notes' in rec(r, 'n4'), false);
  const kept = r.context.observations.find((o) => o.id === 'n1');
  assert.deepEqual(kept.recorded, { state: 'unknown' }, 'the recorded time is not copied from the effective time (IMP-044)');
  assert.deepEqual(r.context.observations.find((o) => o.id === 'n2').effective, { value: '2026-11-20T08:00:00', zone: 'unknown' }, 'no zone is assumed (IMP-046)');
});

test('(d) the five states and entered-in-error are never merged or turned into a value', () => {
  const held = heldOf();
  for (const state of ['absent', 'unknown', 'not-collected', 'not-applicable', 'explicitly-negative']) {
    const o = obs(`st-${state}`, { state }); delete o.value;
    const r = importEnvelope(withObs([o]), { held });
    assert.equal(rec(r, o.id).category, 'accepted', state);
    const kept = r.context.observations.find((v) => v.id === o.id);
    assert.equal(kept.state, state);
    assert.equal('value' in kept, false, `${state}: an absent value stays absent`);
    assert.equal('unit' in kept, false);
  }
  const ee = obs('st-eie', { status: 'entered-in-error' });
  const r = importEnvelope(withObs([ee]), { held });
  assert.equal(rec(r, 'st-eie').category, 'rejected');
  assert.equal(r.context.observations.some((v) => v.id === 'st-eie'), false, 'excluded by policy, not turned into absent or false');
  const states = ['absent', 'unknown', 'not-collected', 'not-applicable', 'explicitly-negative'].map((s) => { const o = obs(`sx-${s}`, { state: s }); delete o.value; return o; });
  const all = importEnvelope(withObs(states), { held });
  const seen = all.context.observations.filter((o) => o.id.startsWith('sx-')).map((o) => o.state).sort();
  assert.deepEqual(seen, ['absent', 'explicitly-negative', 'not-applicable', 'not-collected', 'unknown']);
});

test('(e) no coercion, no leak, no input mutation', () => {
  const held = heldOf(withQuantityField());
  const sentinelCode = obs('lk1', { concept: { id: 'snake.envenomation-timing.bite-time-certainty', codes: [] }, kind: 'code', value: { system: 'ccis-demo', code: 'SENTINELCODE' } });
  const sentinelUnit = quantity('lk2', 'SENTINELUNIT', 9999.5);
  const e = withObs([sentinelCode, sentinelUnit]);
  const frozen = deepFreeze(clone(e));
  const frozenHeld = deepFreeze(clone(held));
  const before = JSON.stringify(frozen);
  const r = importEnvelope(frozen, { held: frozenHeld });
  assert.equal(JSON.stringify(frozen), before, 'the input is not mutated');
  assert.equal(rec(r, 'lk1').category, 'accepted');
  assert.equal(rec(r, 'lk2').category, 'rejected');
  const rep = JSON.stringify(r.report);
  for (const s of ['SENTINELCODE', 'SENTINELUNIT', '9999.5', 'ccis-demo']) assert.equal(rep.includes(s), false, `the report does not hold ${s}`);

  // Accepted records equal the input records field for field.
  for (const o of r.context.observations) assert.deepEqual(o, e.observations.find((v) => v.id === o.id));
  assert.equal(r.context.observations.some((o) => o.id === 'lk2'), false, 'a rejected record is not in the context');

  // The context owns its data.
  const e2 = base();
  const a = importEnvelope(e2, { held: heldOf() });
  const snapshot = JSON.stringify(a.context);
  e2.observations[0].kind = 'string'; e2.applied.elements[0].version = '9.9.9'; e2.case.ref = 'changed';
  assert.equal(JSON.stringify(a.context), snapshot);
});

test('(f) determinism: same bytes, record order does not matter, checksums are canonical, expectedChecksum', () => {
  const held = heldOf();
  for (const { name, env } of allEnvelopes()) {
    const a = importEnvelope(env, { held });
    const b = importEnvelope(clone(env), { held });
    assert.equal(JSON.stringify(a), JSON.stringify(b), name);
    const shuffled = clone(env);
    shuffled.observations.reverse(); shuffled.events.reverse();
    const s = importEnvelope(shuffled, { held });
    assert.equal(s.contextChecksum, a.contextChecksum, `${name}: record order does not change the context`);
    assert.equal(JSON.stringify(s.context), JSON.stringify(a.context));
    assert.equal(a.contextChecksum, checksumOf(canonicalize(a.context).text));
    assert.equal(a.envelopeChecksum, checksumOf(canonicalize(env).text));
    assert.match(a.contextChecksum, /^sha256:[0-9a-f]{64}$/);
  }
  const first = importEnvelope(base(), { held });
  const accepted = importEnvelope(base(), { held, expectedChecksum: first.envelopeChecksum });
  assert.equal(accepted.ok, true);
  const changed = base(); changed.observations[0].id = 'oz9';
  refused(importEnvelope(changed, { held, expectedChecksum: first.envelopeChecksum }), 'checksum does not match');
  assert.notEqual(importEnvelope(changed, { held }).envelopeChecksum, first.envelopeChecksum);
  const m = importEnvelope(withObs([obs('zz2'), obs('zz1')]), { held });
  assert.deepEqual(m.context.observations.map((o) => o.id), [...m.context.observations.map((o) => o.id)].sort(), 'sorted by id in code-unit order');
});

test('(f2) x- members are never used and are listed by JSON pointer at any depth', () => {
  const e = base();
  e['x-note'] = { a: 1 };
  e.observations[0]['x-extra'] = true;
  e.envelope.producer['x-build'] = 'b';
  e.observations[1].provenance['x-a/b'] = 1;
  const r = importEnvelope(e, { held: heldOf() });
  assert.equal(r.ok, true);
  assert.deepEqual(r.report.ignored.map((i) => i.path), ['/envelope/producer/x-build', '/observations/0/x-extra', '/observations/1/provenance/x-a~1b', '/x-note']);
  assert.ok(r.report.ignored.every((i) => /IMP-112/.test(i.reason)));
  validReport(r);
  assert.deepEqual(importEnvelope(base(), { held: heldOf() }).report.ignored, []);
});

test('(g) constants agree with the other modules, and the module is pure', () => {
  assert.equal(IMPORTER_VERSION, '0.1.0');
  assert.equal(STANDARD_VERSION, RECORD_STANDARD);
  assert.equal(STANDARD_VERSION, DEMO_STANDARD_VERSION);
  assert.equal(IMPORTER_VERSION, DEMO_IMPORTER_VERSION);
  assert.equal(IMPORTER_VERSION, VALIDATOR.version);
  assert.equal(IMPORTER_VERSION, COMPILER.version);
  const r = importEnvelope(base(), { held: heldOf() });
  assert.equal(r.report.importer.version, IMPORTER_VERSION);
  assert.equal(r.report.standard.version, STANDARD_VERSION);

  const src = readFileSync(new URL('../ccis-import.js', import.meta.url), 'utf8');
  const code = src.replace(/^\s*\/\/.*$/gm, '');
  const imports = [...code.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['./ccis-compile.js', './ccis/validators/ccis-validators.js']);
  for (const bad of [/\bDate\b/, /Math\.random/, /\bfetch\b/, /XMLHttpRequest/, /node:/, /readFile/, /\beval\b/, /new Function/, /\bimport\(/, /\bprocess\b/, /localStorage/, /\brequire\b/]) {
    assert.equal(bad.test(code), false, String(bad));
  }
});

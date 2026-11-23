import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildRunRecord, runIdInput, canonicalJson, DEMO_PLACEHOLDER_NOTE } from '../ccis-demo-record.js';
import { loadDemo } from '../ccis-demo-loader.js';
import { evaluateAnalytic } from '../ccis-demo-exec.js';
import { evaluatePathway } from '../ccis-demo-pathway.js';
import { runRecord } from '../ccis/validators/ccis-validators.js';

const ex = new URL('../ccis/examples/snake/', import.meta.url);
const fx = new URL('../ccis/fixtures/snake/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const exa = (f) => read(new URL(f, ex));
const clone = (x) => JSON.parse(JSON.stringify(x));
const index = read(new URL('index.json', fx));
const sha = (s) => `run-${createHash('sha256').update(s).digest('hex')}`;

const ARTEFACTS = () => ({
  element: exa('snake-envenomation.element.json'),
  binding: exa('snake-demo-terminology.binding.json'),
  pathway: exa('snake-documentation.pathway.json'),
  nodes: [exa('snake-node-clotting.node.json'), exa('snake-node-antivenom.node.json')],
  analytics: [exa('snake-interval.analytics.0.1.1.json'), exa('snake-completeness.analytics.0.1.1.json')],
});

// The whole demo pipeline, as the CLI (DS4) will run it, then the record.
function runCase(c, { mutate } = {}) {
  const want = read(new URL(`${c.class}/${c.case}.expected.json`, fx));
  let envelope = read(new URL(`${c.class}/${c.case}.envelope.json`, fx));
  if (mutate) envelope = mutate(clone(envelope));
  const loaded = loadDemo(ARTEFACTS(), envelope);
  assert.equal(loaded.ok, true, c.case);
  const parameters = want.parameters;
  const route = evaluatePathway(loaded.package.pathway, loaded.envelope);
  assert.equal(route.ok, true, c.case);
  const results = [...route.results];
  for (const a of loaded.package.analytics) {
    const r = evaluateAnalytic(a, loaded.envelope, parameters, want.evaluationTime);
    assert.equal(r.ok, true, `${c.case}: ${r.refusal}`);
    results.push(...r.results);
  }
  const base = { package: loaded.package, envelope, parameters, evaluationTime: want.evaluationTime };
  const id = sha(runIdInput(base));
  const record = buildRunRecord({ ...base, id, importReport: loaded.importReport, results });
  return { record, base, id, loaded, want, results };
}

test('source: header label, and no clock, randomness, network, file access, hashing, eval or dynamic import', () => {
  const src = readFileSync(new URL('../ccis-demo-record.js', import.meta.url), 'utf8');
  assert.ok(src.startsWith('// DEMO RUNNER: replaced by rows 2.x and 3.x.'));
  const code = src.replace(/^\s*\/\/.*$/gm, '');
  for (const bad of [/new Date/, /Date\.now/, /Math\.random/, /\bfetch\b/, /XMLHttpRequest/, /node:/, /readFile/, /\bcrypto\b/, /\beval\b/, /new Function/, /\bimport\(/, /\bprocess\b/, /localStorage/]) {
    assert.equal(bad.test(code), false, String(bad));
  }
});

test('oracle: every fixture produces a schema-valid record, built twice to the same bytes', () => {
  assert.ok(index.cases.length >= 32);
  for (const c of index.cases) {
    const a = runCase(c);
    const b = runCase(c);
    assert.equal(runRecord(a.record), true, `${c.case}: ${JSON.stringify(runRecord.errors)}`);
    assert.equal(a.record.status, 'completed', c.case);
    assert.equal(canonicalJson(a.record), canonicalJson(b.record), c.case);
    assert.equal(JSON.stringify(a.record), JSON.stringify(b.record), c.case);
    assert.equal(a.record.id, b.record.id, c.case);
    assert.equal(a.record.results.length, a.results.length, c.case);
    assert.deepEqual(a.record.snapshot.observations, read(new URL(`${c.class}/${c.case}.envelope.json`, fx)).observations, c.case);
  }
});

test('identity: package, versions, evaluation time and context are recorded', () => {
  const { record } = runCase(index.cases[0]);
  assert.deepEqual(record.package, { id: 'snake.documentation-path', version: '0.1.0' });
  assert.deepEqual(record['x-analytics'], [{ id: 'snake.bite-to-antivenom-interval', version: '0.1.1' }, { id: 'snake.clotting-documentation-completeness', version: '0.1.1' }]);
  assert.deepEqual(record.standard, { version: '0.1.0' });
  assert.deepEqual(record.engine, { version: '0.1.0' });
  assert.deepEqual(record.operatorSet, { name: 'ccis-core-ops', version: '0.1.0' });
  assert.equal(record.outputContractVersion, '0.1.0');
  assert.deepEqual(record.evaluationTime, { value: '2026-11-20T12:00:00Z', zone: 'stated' });
  assert.equal(record.context.elements[0].id, 'snake.envenomation-timing');
  assert.equal(record.context.pathways[0].id, 'snake.documentation-path');
  assert.equal(record.limitations[0], 'Prototype. Synthetic data only. Not for clinical use.');
});

test('parameters: enabled carry value, units and role; disabled carry none of them', () => {
  const all = runCase(index.cases.find((c) => c.case.startsWith('normal-01'))).record;
  const byId = Object.fromEntries(all.parameters.map((p) => [p.id, p]));
  assert.equal(byId.targetIntervalDuration.enabled, true);
  assert.equal(byId.targetIntervalDuration.value, 120);
  assert.equal(byId.targetIntervalDuration.units, 'min');
  assert.equal(byId.acceptedCertainty.value, 'accept');
  assert.deepEqual(byId.expectedItems.value, ['clottingTestStatus', 'clottingTestStartTime', 'clottingResultReadTime', 'clottingResult']);
  for (const p of all.parameters.filter((x) => x.enabled)) assert.match(p.suppliedBy, /\S/, p.id);
  assert.equal(byId.populationScope.enabled, false);
  assert.deepEqual(Object.keys(byId.populationScope), ['id', 'enabled']);
  assert.equal(new Set(all.parameters.map((p) => p.id)).size, all.parameters.length, 'each declared parameter once');

  const none = runCase(index.cases.find((c) => c.case.startsWith('normal-02'))).record;
  assert.equal(none.parameters.length, all.parameters.length);
  for (const p of none.parameters) assert.deepEqual(Object.keys(p), ['id', 'enabled'], p.id);
  assert.equal(none.parameters.every((p) => p.enabled === false), true);
  assert.equal(JSON.stringify(none).includes('testOnly'), false, 'no placeholder marker against a disabled parameter');
  assert.deepEqual(none.warnings, []);
  assert.equal('x-demo' in none, false);
});

test('demo placeholders: warned in the record, marked on each placeholder, never invented', () => {
  const rec = runCase(index.cases.find((c) => c.case.startsWith('normal-01'))).record;
  assert.deepEqual(rec.warnings, [DEMO_PLACEHOLDER_NOTE]);
  assert.equal(DEMO_PLACEHOLDER_NOTE, 'demo placeholders, not clinical values');
  assert.deepEqual(rec['x-demo'], { placeholders: true });
  assert.equal(rec.parameters.filter((p) => p.enabled).every((p) => p['x-testOnly'] === true), true);
  assert.equal(rec.parameters.filter((p) => !p.enabled).some((p) => 'x-testOnly' in p), false);
});

test('the id is an input: used as given, and one changed observation changes the address', () => {
  const c = index.cases.find((x) => x.case.startsWith('normal-01'));
  const a = runCase(c);
  assert.equal(a.record.id, a.id);
  const b = runCase(c, { mutate: (e) => { e.observations[0].value = { value: '2026-11-20T07:59:00Z', zone: 'stated' }; return e; } });
  assert.notEqual(b.id, a.id);
  const params = clone(a.base.parameters);
  params.edgeRule.value = 'outside';
  assert.notEqual(sha(runIdInput({ ...a.base, parameters: params })), a.id, 'a parameter change changes the id');
  assert.notEqual(sha(runIdInput({ ...a.base, evaluationTime: '2026-11-20T12:01:00Z' })), a.id, 'the evaluation time changes the id');
  const bumped = ARTEFACTS();
  bumped.analytics[0].manifest.version = '0.1.2';
  assert.notEqual(sha(runIdInput({ ...a.base, package: { pathway: a.base.package.pathway, analytics: bumped.analytics } })), a.id, 'an artefact version changes the id');
  assert.throws(() => buildRunRecord({ ...a.base, importReport: a.loaded.importReport, results: a.results }), /id is an input/);
});

test('the record is a copy and is frozen: later changes to the inputs cannot alter it', () => {
  const c = index.cases.find((x) => x.case.startsWith('normal-01'));
  const { record, base, results } = runCase(c);
  const before = canonicalJson(record);
  base.envelope.observations[0].status = 'entered-in-error';
  results[0].warnings.push('later edit');
  assert.equal(canonicalJson(record), before);
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.snapshot.observations[0]), true);
  assert.throws(() => { 'use strict'; record.status = 'failed'; }, TypeError);
});

test('snapshot is the received envelope: entered-in-error records stay in it and are reported as rejected', () => {
  const c = index.cases.find((x) => x.case.startsWith('normal-01'));
  const { loaded, base } = runCase(c, {});
  const env = clone(base.envelope);
  env.observations[0].status = 'entered-in-error';
  const l2 = loadDemo(ARTEFACTS(), env);
  assert.equal(l2.ok, true);
  const r = evaluatePathway(l2.package.pathway, l2.envelope);
  const results = [...r.results];
  for (const a of l2.package.analytics) results.push(...evaluateAnalytic(a, l2.envelope, base.parameters, base.evaluationTime).results);
  const b2 = { ...base, envelope: env };
  const rec = buildRunRecord({ ...b2, id: sha(runIdInput(b2)), importReport: l2.importReport, results });
  assert.equal(rec.snapshot.observations.length, env.observations.length);
  assert.equal(rec.snapshot.observations[0].status, 'entered-in-error');
  assert.equal(rec.importReport.records.some((x) => x.category === 'rejected'), true);
  assert.equal(loaded.ok, true);
});

test('failed: a refused envelope gives a failed record with a failure, no results, and nothing echoed', () => {
  const c = index.cases[0];
  const env = read(new URL(`${c.class}/${c.case}.envelope.json`, fx));
  env.observations[0].note = '<script>alert(1)</script> Jane Doe';
  const arte = ARTEFACTS();
  const loaded = loadDemo(arte, env);
  assert.equal(loaded.ok, false);
  const base = { package: arte, envelope: env, parameters: 'none', evaluationTime: '2026-11-20T12:00:00Z' };
  const rec = buildRunRecord({ ...base, id: sha(runIdInput({ ...base, envelope: null })), importReport: loaded.importReport, results: [] });
  assert.equal(runRecord(rec), true, JSON.stringify(runRecord.errors));
  assert.equal(rec.status, 'failed');
  assert.equal(rec.failure.rule, 'validation');
  assert.equal(rec.failure.message, loaded.importReport.refusalReason);
  assert.deepEqual(rec.results, []);
  assert.deepEqual(rec.snapshot, { case: { ref: 'unreadable-case-ref' }, observations: [], events: [] });
  assert.deepEqual(rec.context, { elements: [], pathways: [] });
  assert.equal(JSON.stringify(rec).includes('Jane Doe'), false);
  assert.equal(JSON.stringify(rec).includes('script'), false);
  assert.equal(rec.importReport.outcome, 'refused');
});

test('failed: with no readable artefacts the record still validates, with placeholder package and no parameters', () => {
  const loaded = loadDemo(null, {});
  assert.equal(loaded.ok, false);
  const rec = buildRunRecord({ id: 'run-0001', package: null, envelope: {}, parameters: { edgeRule: { value: 'inside' } }, evaluationTime: '2026-11-20T12:00:00Z', importReport: loaded.importReport });
  assert.equal(runRecord(rec), true, JSON.stringify(runRecord.errors));
  assert.deepEqual(rec.package, { id: 'unreadable', version: '0.0.0' });
  assert.deepEqual(rec.parameters, []);
  assert.equal(rec.status, 'failed');
});

test('failed: a failure after a good import keeps the snapshot and names the rule', () => {
  const c = index.cases[0];
  const a = runCase(c);
  const rec = buildRunRecord({ ...a.base, id: a.id, importReport: a.loaded.importReport, failure: { rule: 'other', message: 'analytic refused: a duration is outside the technical bound' } });
  assert.equal(runRecord(rec), true, JSON.stringify(runRecord.errors));
  assert.equal(rec.status, 'failed');
  assert.deepEqual(rec.failure, { rule: 'other', message: 'analytic refused: a duration is outside the technical bound' });
  assert.deepEqual(rec.results, []);
  assert.equal(rec.snapshot.observations.length > 0, true);
  assert.throws(() => buildRunRecord({ ...a.base, id: a.id, importReport: a.loaded.importReport, failure: { rule: 'other', message: 'x' }, results: a.results }), /no results/);
});

test('refusals: missing id or report, unstated zone, undeclared parameter, unrecordable value', () => {
  const a = runCase(index.cases[0]);
  const ok = { ...a.base, id: a.id, importReport: a.loaded.importReport, results: a.results };
  assert.throws(() => buildRunRecord({ ...ok, importReport: undefined }), /import report/);
  assert.throws(() => buildRunRecord({ ...ok, evaluationTime: { value: '2026-11-20T12:00:00', zone: 'unknown' } }), /state its zone/);
  assert.throws(() => buildRunRecord({ ...ok, evaluationTime: undefined }), /state its zone/);
  assert.throws(() => buildRunRecord({ ...ok, parameters: { invented: { value: 'x' } } }), /not declared/);
  assert.throws(() => buildRunRecord({ ...ok, parameters: { edgeRule: { value: 5 } } }), /no value the record can hold/);
  assert.throws(() => buildRunRecord({ ...ok, parameters: { populationScope: { value: 'x' } } }), /no value the record can hold/);
  assert.throws(() => buildRunRecord({ ...ok, results: undefined }), /results are missing/);
  assert.throws(() => buildRunRecord({ ...ok, results: [{ outputId: 'x' }] }), /fails its schema/);
  assert.throws(() => buildRunRecord({ ...ok, envelope: undefined }), /envelope is missing/);
  assert.throws(() => buildRunRecord(null), /no input/);
});

test('canonicalJson: sorted keys, stable bytes, undefined left out', () => {
  assert.equal(canonicalJson({ b: 1, a: [{ d: 1, c: undefined }] }), '{"a":[{"d":1}],"b":1}');
  assert.equal(canonicalJson({ a: 1, b: 2 }), canonicalJson({ b: 2, a: 1 }));
});

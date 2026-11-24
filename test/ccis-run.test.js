import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { importEnvelope } from '../ccis-import.js';
import { canonicalize, checksumOf } from '../ccis-compile.js';
import { walkPathway } from '../ccis-walk.js';
import { PREVIEW_BANNER } from '../ccis-compat.js';
import { planRun, executeRun, runIdOf, verifyRecord, rerunFromRecord, compareRerun, RUN_REFUSALS, TEST_ONLY_NOTE, RUNNER_VERSION } from '../ccis-run.js';
import { runRecord as vRecord } from '../ccis/validators/ccis-validators.js';

const ex = new URL('../ccis/examples/snake/', import.meta.url);
const fx = new URL('../ccis/fixtures/snake/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const exa = (f) => read(new URL(f, ex));
const clone = (x) => JSON.parse(JSON.stringify(x));
const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };

const RUNTIME = { standardMajors: [0], engine: { version: '0.1.0' }, operatorSet: { name: 'ccis-core-ops', majors: [0] }, limits: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 }, understoodExtensions: [] };
const V = { '0.1.0': ['snake-interval.analytics.json', 'snake-completeness.analytics.json'], '0.1.1': ['snake-interval.analytics.0.1.1.json', 'snake-completeness.analytics.0.1.1.json'] };
const ELEMENT = exa('snake-envenomation.element.json');
const PATH = exa('snake-documentation.pathway.json');
const T = '2026-11-20T12:00:00Z';
const index = read(new URL('index.json', fx));
const caseFile = (c, kind) => read(new URL(`${c.class}/${c.case}.${kind}.json`, fx));
const allCases = () => [...index.cases.map((c) => ({ name: c.case, env: caseFile(c, 'envelope'), want: caseFile(c, 'expected') })),
  { name: 'emr-export', env: read(new URL('emr-export/emr-demo-case.envelope.json', fx)), want: read(new URL('emr-export/emr-demo-case.expected.json', fx)) }];
const named = (name) => allCases().find((c) => c.name === name);
const ver = (want) => want['x-analyticVersion'] ?? '0.1.0';
const packs = (v = '0.1.1') => V[v].map((f) => exa(f));
const withSum = (a) => ({ analytic: a, checksum: checksumOf(canonicalize(a).text) });
const suppliedOf = (want) => (want.parameters === 'none' ? {} : want.parameters);
const PARAMS = { targetIntervalDuration: { value: { amount: 120, unit: 'min' } }, acceptedCertainty: { value: 'accept' }, edgeRule: { value: 'inside' }, expectedItems: { value: ['clottingTestStatus', 'clottingTestStartTime', 'clottingResultReadTime', 'clottingResult'] }, readTimeWindow: { value: { amount: 30, unit: 'min' } } };

// One whole run of a case, on the analytics version its expected file names.
function scenario(c, over = {}) {
  const an = over.packs ?? packs(ver(c.want));
  const held = over.held ?? [ELEMENT, PATH, ...an];
  const importResult = over.importResult ?? importEnvelope(c.env, { held });
  const analytics = over.analytics ?? an.map(withSum);
  const input = { pathway: PATH, analytics, held, importResult, runtime: RUNTIME, request: over.request };
  const planned = planRun(input);
  return { an, held, importResult, analytics, input, planned };
}
const run = (c, supplied = suppliedOf(c.want), time = c.want.evaluationTime, over = {}) => {
  const s = scenario(c, over);
  assert.equal(s.planned.ok, true, JSON.stringify(s.planned.refusal));
  const r = executeRun({ plan: s.planned.plan, supplied, evaluationTime: time, corrects: over.corrects });
  assert.equal(r.ok, true, JSON.stringify(r.refusal));
  return { ...s, record: r.record };
};
const NORMAL = () => named('normal-01-all-enabled');
const refusedWith = (r, id) => {
  assert.equal(r.ok, false);
  assert.equal('plan' in r || 'record' in r, false, 'a refusal carries no plan or record');
  assert.equal(r.refusal.id, id, JSON.stringify(r.refusal));
  assert.equal(r.refusal.meaning, RUN_REFUSALS.find((x) => x.id === id).meaning);
};
const outputIds = (a) => new Set(a.outputs.map((o) => o.id));

// =============================================================================================
// (a) The oracle: 32 cases plus the EMR export
// =============================================================================================

test('(a) oracle: every case gives a valid record whose results, route and rerun match', () => {
  const cases = allCases();
  assert.equal(cases.length, 33, '32 fixture cases plus the EMR export');
  let skipped = 0;
  for (const c of cases) {
    const { an, held, importResult, analytics, planned, record } = run(c);
    assert.equal(vRecord(record), true, c.name);
    assert.equal(record.status, 'completed', c.name);
    assert.equal(verifyRecord(record).ok, true, c.name);
    // node results and route: exactly what the walker gives on its own
    const w = walkPathway({ pathway: PATH, context: importResult.context });
    assert.deepEqual(record.results.filter((r) => r['x-node']), w.results, c.name);
    assert.deepEqual(record['x-trace'], w.trace, c.name);
    assert.deepEqual(w.route, c.want.pathwayRoute, c.name);
    // analytic results: equal to the expected file for every package that ran
    for (const a of an) {
      const ids = outputIds(a);
      const item = planned.plan.items.find((i) => i.id === a.manifest.id);
      const got = record.results.filter((r) => !r['x-node'] && ids.has(r.outputId));
      if (item.action === 'run') assert.deepEqual(got, c.want.results.filter((r) => ids.has(r.outputId)), `${c.name} ${a.manifest.id}`);
      else {
        skipped += 1;
        assert.equal(item.outcome, 'needs-data', `${c.name}: only Needs data is skipped here`);
        assert.equal(got.length, 0, c.name);
      }
    }
    // rerun from the record alone is byte-identical, id included
    const again = rerunFromRecord({ record, pathway: PATH, analytics, held, runtime: RUNTIME });
    assert.equal(again.ok, true, c.name);
    assert.deepEqual(compareRerun(record, again.record), { ok: true }, c.name);
    assert.equal(canonicalize(record).text, canonicalize(again.record).text, c.name);
  }
  assert.ok(skipped > 0, 'the oracle includes cases where a package is skipped as Needs data');
});

test('(a) oracle with the opt-in: Needs data items run too, and every analytic result equals its expected file', () => {
  for (const c of allCases()) {
    const over = { request: { runNeedsData: true } };
    const { an, planned, record, held, analytics } = run(c, suppliedOf(c.want), c.want.evaluationTime, over);
    assert.equal(planned.plan.items.every((i) => i.action === 'run'), true, c.name);
    assert.deepEqual(record.results.filter((r) => !r['x-node']), c.want.results, c.name);
    assert.equal(record['x-plan'].runNeedsData, true);
    const again = rerunFromRecord({ record, pathway: PATH, analytics, held, runtime: RUNTIME });
    assert.deepEqual(compareRerun(record, again.record), { ok: true }, c.name);
    assert.equal(an.length, 2);
  }
});

// =============================================================================================
// (b) Addressing
// =============================================================================================

test('(b) the id is the SHA-256 address of the run inputs, calculated here independently', () => {
  const { record } = run(NORMAL());
  const input = {
    form: 'ccis-run-id/1', package: record.package, pathwayChecksum: record['x-pathwayChecksum'], analytics: record['x-analytics'],
    standard: record.standard, engine: record.engine, operatorSet: record.operatorSet, outputContract: record.outputContractVersion,
    snapshot: record.snapshot, parameters: record.parameters.map(({ id, enabled, value, units }) => ({ id, enabled, ...(value !== undefined ? { value } : {}), ...(units !== undefined ? { units } : {}) })),
    evaluationTime: record.evaluationTime, plan: { mode: 'preview', runNeedsData: false }, corrects: null, status: 'completed', failure: null, envelopeChecksum: record['x-checksums'].envelope,
  };
  assert.equal(record.id, `run-${createHash('sha256').update(canonicalize(input).text, 'utf8').digest('hex')}`);
  assert.equal(runIdOf(record), record.id);
});

test('(b) same inputs give the same id and bytes; any change to a run input gives a distinct id', () => {
  const c = NORMAL();
  const base = run(c).record;
  assert.equal(canonicalize(run(c).record).text, canonicalize(base).text);
  const ids = new Set([base.id]);
  const add = (rec, what) => { assert.equal(ids.has(rec.id), false, what); ids.add(rec.id); };
  add(run(c, suppliedOf(c.want), c.want.evaluationTime, { packs: packs('0.1.1') }).record, 'package version');
  const edited = clone(c.env);
  edited.observations.find((o) => o.concept.id.endsWith('bite-time')).value.value = '2026-11-19T01:00:00Z';
  add(run({ ...c, env: edited }).record, 'one observation');
  add(run(c, { ...suppliedOf(c.want), edgeRule: { value: 'outside' } }).record, 'one parameter');
  add(run(c, suppliedOf(c.want), '2026-11-20T12:00:01Z').record, 'evaluation time');
  add(run(c, suppliedOf(c.want), c.want.evaluationTime, { corrects: base.id }).record, 'corrects');
  add(run(c, suppliedOf(c.want), c.want.evaluationTime, { request: { runNeedsData: true } }).record, 'the opt-in');
});

test('(b) a correction is a new record that names the original, and the original is untouched', () => {
  const c = NORMAL();
  const original = run(c).record;
  const before = canonicalize(original).text;
  const fix = run(c, suppliedOf(c.want), c.want.evaluationTime, { corrects: original.id }).record;
  assert.equal(fix.corrects, original.id);
  assert.notEqual(fix.id, original.id);
  assert.equal(canonicalize(original).text, before);
  assert.equal(verifyRecord(fix).ok, true);
});

test('(b) every declared parameter is listed once; a disabled one carries no value; test-only values are labelled', () => {
  const c = NORMAL();
  const { record } = run(c);
  assert.deepEqual(record.parameters.map((p) => p.id).sort(), ['acceptedCertainty', 'edgeRule', 'expectedItems', 'populationScope', 'readTimeWindow', 'targetIntervalDuration']);
  const pop = record.parameters.find((p) => p.id === 'populationScope');
  assert.deepEqual(pop, { id: 'populationScope', enabled: false });
  const dur = record.parameters.find((p) => p.id === 'targetIntervalDuration');
  assert.equal(dur.enabled, true);
  assert.equal(dur.value, 120);
  assert.equal(dur.units, 'min');
  assert.equal(typeof dur.suppliedBy, 'string');
  assert.equal(record['x-testOnly'], true);
  assert.ok(record.warnings.includes(TEST_ONLY_NOTE));
  assert.ok(record.warnings.includes(PREVIEW_BANNER));
  const none = run(named('normal-02-nothing-enabled'), {}).record;
  assert.equal(none.parameters.every((p) => p.enabled === false), true);
  assert.equal('x-testOnly' in none, false);
  assert.equal(none.warnings.includes(TEST_ONLY_NOTE), false);
});

// =============================================================================================
// (c) Planning
// =============================================================================================

test('(c) a package that needs data is skipped and listed; the others run (D-110)', () => {
  const c = named('missing-01-no-bite-time');
  const { record, planned } = run(c);
  const skip = planned.plan.items.find((i) => i.action === 'skip');
  assert.equal(skip.id, 'snake.bite-to-antivenom-interval');
  assert.equal(skip.outcome, 'needs-data');
  assert.ok(skip.reasons.length > 0);
  assert.deepEqual(record['x-plan'].items.map((i) => [i.kind, i.action]), [['pathway', 'run'], ['analytic', 'skip'], ['analytic', 'run']]);
  assert.equal(record.results.some((r) => r.outputId === 'interval'), false);
  assert.equal(record.results.some((r) => r.outputId === 'overallStatus'), true);
});

test('(c) the order of results does not depend on the order of the request', () => {
  const c = NORMAL();
  const an = packs(ver(c.want));
  const a = run(c, suppliedOf(c.want), c.want.evaluationTime, { analytics: an.map(withSum) }).record;
  const b = run(c, suppliedOf(c.want), c.want.evaluationTime, { analytics: [...an].reverse().map(withSum) }).record;
  assert.equal(canonicalize(a).text, canonicalize(b).text);
  const nodeEnd = a.results.findIndex((r) => !r['x-node']);
  assert.ok(a.results.slice(0, nodeEnd).every((r) => r['x-node']));
  assert.deepEqual(a['x-analytics'].map((x) => x.id), ['snake.bite-to-antivenom-interval', 'snake.clotting-documentation-completeness']);
});

test('(c) each R- id is reached once, and a refusal carries no plan or record', () => {
  const c = NORMAL();
  const s = scenario(c);
  const base = s.input;
  refusedWith(planRun({}), 'R-001');
  refusedWith(planRun({ ...base, analytics: [] }), 'R-001');
  refusedWith(planRun({ ...base, analytics: [s.analytics[0], s.analytics[0]] }), 'R-001');
  refusedWith(planRun({ ...base, analytics: [{ analytic: s.an[0], checksum: 'sha256:00' }, s.analytics[1]] }), 'R-002');
  const stranger = clone(s.an[0]); stranger.manifest.id = 'other.analytic';
  refusedWith(planRun({ ...base, analytics: [withSum(stranger), s.analytics[1]] }), 'R-003');
  const odd = clone(s.an[1]); odd.parameters.find((p) => p.id === 'edgeRule').allowedChoices = ['inside'];
  refusedWith(planRun({ ...base, analytics: [s.analytics[0], withSum(odd)] }), 'R-004');
  const ok = (extra) => executeRun({ plan: s.planned.plan, evaluationTime: T, ...extra });
  refusedWith(ok({ supplied: { notDeclared: { value: 'x' } } }), 'R-005');
  refusedWith(ok({ supplied: { populationScope: { value: 'anything' } } }), 'R-005');
  refusedWith(planRun({ ...base, runtime: undefined }), 'R-006');
  const broken = clone(s.an[0]); broken.computation = [...broken.computation, clone(broken.computation[0])];
  refusedWith(planRun({ ...base, analytics: [withSum(broken), s.analytics[1]] }), 'R-007');
  for (const bad of [undefined, '2026-11-20T12:00:00', '2026-02-31T00:00:00Z', '2026-11-20T25:00:00Z', 5]) refusedWith(ok({ evaluationTime: bad }), 'R-008');
  const { record } = run(c);
  const again = (over) => rerunFromRecord({ record, pathway: PATH, analytics: s.analytics, held: s.held, runtime: RUNTIME, ...over });
  const otherPath = clone(PATH); otherPath.scope = 'changed';
  refusedWith(again({ pathway: otherPath }), 'R-009');
  refusedWith(again({ analytics: [s.analytics[0]] }), 'R-009');
  const bent = clone(record); bent.snapshot.observations.pop();
  refusedWith(again({ record: bent }), 'R-010');
  const failedImport = run(c, {}, T, { importResult: importEnvelope({ envelope: 'no' }, { held: s.held }) }).record;
  refusedWith(again({ record: failedImport }), 'R-011');
  assert.deepEqual(RUN_REFUSALS.map((r) => r.id), ['R-001', 'R-002', 'R-003', 'R-004', 'R-005', 'R-006', 'R-007', 'R-008', 'R-009', 'R-010', 'R-011']);
});

// =============================================================================================
// (d) Failed runs
// =============================================================================================

test('(d) a refused import gives a failed record with no results, no snapshot and no echo of the input', () => {
  const c = NORMAL();
  const hostile = clone(c.env);
  hostile.envelope.version = '9.0.0';
  hostile.case.ref = 'SENTINEL-PATIENT-4417';
  const { record, importResult } = run(c, suppliedOf(c.want), T, { importResult: importEnvelope(hostile, { held: [ELEMENT, PATH, ...packs()] }) });
  assert.equal(importResult.ok, false);
  assert.equal(record.status, 'failed');
  assert.equal(record.failure.rule, 'validation');
  assert.equal(record.failure.message, importResult.report.refusalReason);
  assert.deepEqual(record.results, []);
  assert.deepEqual(record.parameters, []);
  assert.deepEqual(record.snapshot, { case: { ref: 'unreadable-case-ref' }, observations: [], events: [] });
  assert.equal(JSON.stringify(record).includes('SENTINEL-PATIENT-4417'), false);
  assert.equal(verifyRecord(record).ok, true);
});

test('(d) a refusal by the binder gives a failed record, never partial results', () => {
  const c = NORMAL();
  const { record } = run(c, { ...PARAMS, targetIntervalDuration: { value: { amount: 999999, unit: 'min' } } });
  assert.equal(record.status, 'failed');
  assert.equal(record.failure.rule, 'other');
  assert.match(record.failure.message, /^B-\d{3}: /);
  assert.deepEqual(record.results, []);
  assert.equal('x-trace' in record, false);
  assert.equal(record.snapshot.observations.length > 0, true, 'the snapshot is kept after a successful import');
  assert.equal(verifyRecord(record).ok, true);
});

// =============================================================================================
// (e) Verify, rerun, immutability
// =============================================================================================

test('(e) verifyRecord catches an altered result, snapshot, parameter, time and id', () => {
  const { record } = run(NORMAL());
  const alter = (f) => { const r = clone(record); f(r); return verifyRecord(r); };
  assert.deepEqual(verifyRecord(record), { ok: true, problems: [] });
  assert.deepEqual(alter((r) => { r.results[0].warnings = ['changed']; }).problems, ['results']);
  assert.deepEqual(alter((r) => { r.snapshot.observations.pop(); }).problems, ['id']);
  assert.deepEqual(alter((r) => { r.parameters[0].enabled = !r.parameters[0].enabled; }).ok, false);
  assert.deepEqual(alter((r) => { r.evaluationTime.value = '2026-11-21T12:00:00Z'; }).problems, ['id']);
  assert.deepEqual(alter((r) => { r.id = 'run-0'; }).problems, ['id']);
  assert.equal(verifyRecord({}).ok, false);
});

test('(e) the record is frozen, and the inputs are not changed by planning, running or rerunning', () => {
  const c = NORMAL();
  const an = packs();
  const held = [ELEMENT, PATH, ...an];
  const importResult = deepFreeze(importEnvelope(c.env, { held }));
  const analytics = deepFreeze(an.map(withSum));
  const before = JSON.stringify([PATH, analytics, held, importResult]);
  const supplied = deepFreeze(clone(suppliedOf(c.want)));
  const p = planRun({ pathway: deepFreeze(clone(PATH)), analytics, held: deepFreeze(clone(held)), importResult, runtime: deepFreeze(clone(RUNTIME)) });
  assert.equal(p.ok, true);
  const r = executeRun({ plan: p.plan, supplied, evaluationTime: T });
  assert.equal(r.ok, true);
  assert.equal(rerunFromRecord({ record: r.record, pathway: PATH, analytics, held, runtime: RUNTIME }).ok, true);
  assert.equal(JSON.stringify([PATH, analytics, held, importResult]), before);
  assert.equal(Object.isFrozen(r.record), true);
  assert.equal(Object.isFrozen(r.record.results[0]), true);
  assert.throws(() => { r.record.results.push({}); }, TypeError);
  assert.throws(() => { r.record.snapshot.observations[0].id = 'x'; }, TypeError);
});

test('(e) compareRerun names the first differing path', () => {
  const { record } = run(NORMAL());
  const other = clone(record);
  other.results[1].warnings = ['x'];
  assert.deepEqual(compareRerun(record, record), { ok: true });
  assert.deepEqual(compareRerun(record, other), { ok: false, path: '/results/1/warnings/0' });
});

// =============================================================================================
// (f) Purity
// =============================================================================================

test('(f) the module is pure: committed modules only, no clock, file, network, randomness or eval', () => {
  const src = readFileSync(new URL('../ccis-run.js', import.meta.url), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const imports = [...code.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['./ccis/validators/ccis-validators.js', './ccis-compile.js', './ccis-exec.js', './ccis-bind.js', './ccis-walk.js', './ccis-compat.js', './ccis-import.js']);
  for (const banned of [/\beval\s*\(/, /\bnew Function\b/, /\bFunction\s*\(/, /\bimport\s*\(/, /\bDate\b/, /Math\.random/, /\bprocess\b/, /\bfs\b/, /\brequire\b/, /\bfetch\s*\(/, /setTimeout/, /performance\./, /crypto/]) {
    assert.equal(banned.test(code), false, String(banned));
  }
  assert.equal(RUNNER_VERSION, '0.1.0');
});

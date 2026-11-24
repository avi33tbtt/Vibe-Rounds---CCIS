import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareAnalytic } from '../ccis-exec.js';
import { importEnvelope, CONTEXT_FORM } from '../ccis-import.js';
import { canonicalize, checksumOf } from '../ccis-compile.js';
import { bindContext, bindParameters, runAnalytic, BIND_REFUSALS, BINDER_VERSION, WORDING } from '../ccis-bind.js';
import { runResult } from '../ccis/validators/ccis-validators.js';

const ex = new URL('../ccis/examples/snake/', import.meta.url);
const fx = new URL('../ccis/fixtures/snake/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const exa = (f) => read(new URL(f, ex));
const clone = (x) => JSON.parse(JSON.stringify(x));
const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };

const RUNTIME = { limits: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 } };
const V = { '0.1.0': ['snake-interval.analytics.json', 'snake-completeness.analytics.json'], '0.1.1': ['snake-interval.analytics.0.1.1.json', 'snake-completeness.analytics.0.1.1.json'] };
const prep = (analytic) => { const r = prepareAnalytic({ analytic, checksum: checksumOf(canonicalize(analytic).text), runtime: RUNTIME }); assert.equal(r.ok, true, JSON.stringify(r)); return r.prepared; };
const INTERVAL = exa('snake-interval.analytics.0.1.1.json');
const COMPLETE = exa('snake-completeness.analytics.0.1.1.json');
const T = '2026-11-20T12:00:00Z';

const index = read(new URL('index.json', fx));
const caseFile = (c, kind) => read(new URL(`${c.class}/${c.case}.${kind}.json`, fx));
const held = () => [exa('snake-envenomation.element.json'), exa('snake-documentation.pathway.json')];
const contextOf = (env) => { const r = importEnvelope(env, { held: held() }); assert.equal(r.ok, true); return r.context; };
const normalEnv = () => caseFile({ class: 'normal', case: 'normal-01-all-enabled' }, 'envelope');
const normalCtx = () => contextOf(normalEnv());
const concept = (key) => `snake.envenomation-timing.${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;
const only = (analytic, supplied) => { const declared = new Set(analytic.parameters.map((p) => p.id)); return Object.fromEntries(Object.entries(supplied ?? {}).filter(([k]) => declared.has(k))); };
const PARAMS = { targetIntervalDuration: { value: { amount: 120, unit: 'min' } }, acceptedCertainty: { value: 'accept' }, edgeRule: { value: 'inside' }, expectedItems: { value: ['clottingTestStatus', 'clottingTestStartTime', 'clottingResultReadTime', 'clottingResult'] }, readTimeWindow: { value: { amount: 30, unit: 'min' } } };
const run = (analytic, context = normalCtx(), supplied = PARAMS) => runAnalytic({ prepared: prep(analytic), context, supplied: only(analytic, supplied), evaluationTime: T });
const by = (r) => Object.fromEntries(r.results.map((x) => [x.outputId, x]));
const refusedWith = (r, id) => { assert.equal(r.ok, false); assert.equal('results' in r, false, 'a refusal carries no results'); assert.equal(r.refusal.id, id, JSON.stringify(r.refusal)); };

// A tiny analytic of our own, to reach the output-contract refusals.
const tiny = (outputs, computation, inputs = INTERVAL.inputs) => ({ ...clone(INTERVAL), inputs: clone(inputs), outputs, computation });

// =============================================================================================
// (a) The oracle: 32 fixture cases plus the EMR export, on the version each expected file names
// =============================================================================================

test('(a) oracle: every case equals its expected results on the version its expected file names', () => {
  const cases = [...index.cases.map((c) => ({ name: c.case, env: caseFile(c, 'envelope'), want: caseFile(c, 'expected') })),
    { name: 'emr-export', env: read(new URL('emr-export/emr-demo-case.envelope.json', fx)), want: read(new URL('emr-export/emr-demo-case.expected.json', fx)) }];
  assert.equal(cases.length, 33, '32 fixture cases plus the EMR export');
  for (const { name, env, want } of cases) {
    const v = want['x-analyticVersion'] ?? '0.1.0';
    const ctx = contextOf(env);
    const got = [];
    for (const f of V[v]) {
      const a = exa(f);
      const r = runAnalytic({ prepared: prep(a), context: ctx, supplied: only(a, want.parameters), evaluationTime: want.evaluationTime });
      assert.equal(r.ok, true, `${name}: ${JSON.stringify(r.refusal)}`);
      for (const x of r.results) assert.equal(runResult(x), true, JSON.stringify(runResult.errors));
      got.push(...r.results);
    }
    assert.deepEqual(got, want.results, name);
  }
});

test('(a) conflicting-03: count, status and window are omitted, never filled (D-050); on 0.1.0 itemStates too', () => {
  const c = index.cases.find((x) => x.case.startsWith('conflicting-03'));
  const want = caseFile(c, 'expected');
  const ctx = contextOf(caseFile(c, 'envelope'));
  const r11 = runAnalytic({ prepared: prep(COMPLETE), context: ctx, supplied: only(COMPLETE, want.parameters), evaluationTime: want.evaluationTime });
  assert.deepEqual(r11.results.map((x) => [x.outputId, x.state]), [['itemStates', 'conflict']]);
  assert.deepEqual(r11.omitted, ['expectedDocumentedCount', 'overallStatus', 'readTimeInWindow']);
  const old = exa(V['0.1.0'][1]);
  const r10 = runAnalytic({ prepared: prep(old), context: ctx, supplied: only(old, want.parameters), evaluationTime: want.evaluationTime });
  assert.deepEqual(r10.results, []);
  assert.deepEqual(r10.omitted, ['itemStates', 'expectedDocumentedCount', 'overallStatus', 'readTimeInWindow']);
});

test('(a) finding F-6 (D-052) stays: an expected item recorded not-collected still reads complete', { todo: 'F-6: needs analytic 0.1.2' }, () => {
  const ctx = normalCtx();
  ctx.observations = ctx.observations.map((o) => (o.concept.id === concept('clottingResult') ? { id: o.id, concept: o.concept, kind: o.kind, status: o.status, sourceClass: o.sourceClass, provenance: o.provenance, state: 'not-collected' } : o));
  const r = run(COMPLETE, ctx);
  assert.notEqual(by(r).overallStatus.value?.label, 'complete');
});

// =============================================================================================
// (b) Binding: records, time, parameters
// =============================================================================================

test('(b) bindContext: none is absent, one is present, two agreeing records are conflicting', () => {
  const p = prep(INTERVAL);
  const ctx = normalCtx();
  let b = bindContext({ prepared: p, context: ctx });
  assert.equal(b.ok, true);
  assert.equal(b.inputs.biteTime.state, 'present');
  assert.equal(b.inputs.biteTime.value.t, 'instant');
  assert.deepEqual(b.inputs.biteTimeCertainty.value.t, 'text');
  const noBite = clone(ctx); noBite.observations = noBite.observations.filter((o) => o.concept.id !== concept('biteTime'));
  assert.deepEqual(bindContext({ prepared: p, context: noBite }).inputs.biteTime, { state: 'absent' });
  const twice = clone(ctx); twice.observations.push({ ...clone(twice.observations.find((o) => o.concept.id === concept('biteTime'))), id: 'dup1' });
  b = bindContext({ prepared: p, context: twice });
  assert.deepEqual(b.inputs.biteTime, { state: 'conflicting' });
  assert.equal(b.readings.biteTime.state, 'conflicting');
});

test('(b) record order does not matter: a shuffled context gives the same bytes', () => {
  const ctx = normalCtx();
  const shuffled = clone(ctx); shuffled.observations.reverse();
  for (const a of [INTERVAL, COMPLETE]) assert.equal(JSON.stringify(run(a, shuffled)), JSON.stringify(run(a, ctx)));
  const p = prep(INTERVAL);
  assert.deepEqual(bindContext({ prepared: p, context: shuffled }).inputs, bindContext({ prepared: p, context: ctx }).inputs);
});

test('(b) a time with no stated zone is unreadable: never a number, never zero', () => {
  const ctx = normalCtx();
  const bite = ctx.observations.find((o) => o.concept.id === concept('biteTime'));
  bite.value = { value: '2026-11-20T08:00:00', zone: 'unknown' };
  const b = bindContext({ prepared: prep(INTERVAL), context: ctx });
  assert.deepEqual(b.inputs.biteTime, { state: 'present' });
  assert.equal(b.readings.biteTime.unreadable, true);
  const r = by(run(INTERVAL, ctx));
  assert.equal('value' in r.interval, false);
  assert.equal(r.interval.state, 'needs-data');
  assert.deepEqual(r.interval.missingDataNotes, ['Bite time is recorded but cannot be read as a time.']);
  // an impossible date and an impossible offset are unreadable too
  for (const bad of ['2026-02-30T08:00:00Z', '2026-11-20T08:00:00+25:00', '2026-11-20T24:00:00Z']) {
    bite.value = { value: bad, zone: 'stated' };
    assert.equal(bindContext({ prepared: prep(INTERVAL), context: ctx }).readings.biteTime.unreadable, true, bad);
  }
});

test('(b) valid times are exact integer UTC milliseconds, offsets applied (hand-calculated)', () => {
  const ctx = normalCtx();
  const bite = ctx.observations.find((o) => o.concept.id === concept('biteTime'));
  const ms = (s) => { bite.value = { value: s, zone: 'stated' }; return bindContext({ prepared: prep(INTERVAL), context: ctx }).inputs.biteTime.value.ms; };
  assert.equal(ms('1970-01-01T00:00:00Z'), 0);
  assert.equal(ms('1970-01-02T00:00:00Z'), 86400000);
  assert.equal(ms('2000-03-01T00:00:00Z'), 951868800000);
  assert.equal(ms('2024-02-29T12:30:15Z'), 1709209815000);
  assert.equal(ms('2026-11-20T08:00:00+05:45'), ms('2026-11-20T02:15:00Z'));
  assert.equal(ms('2026-11-20T08:00:00.500Z'), ms('2026-11-20T08:00:00Z') + 500);
});

test('(b) parameters: disabled unless supplied; enabled values are bound by kind', () => {
  const p = prep(INTERVAL);
  let b = bindParameters({ prepared: p, supplied: undefined });
  assert.equal(b.ok, true);
  assert.ok(Object.values(b.parameters).every((x) => x.enabled === false));
  b = bindParameters({ prepared: p, supplied: only(INTERVAL, PARAMS) });
  assert.deepEqual(b.parameters.targetIntervalDuration, { enabled: true, value: { t: 'number', v: 120, unit: 'min' } });
  assert.deepEqual(b.parameters.edgeRule, { enabled: true, value: { t: 'text', v: 'inside' } });
  assert.equal(b.parameters.populationScope.enabled, false);
  const c = prep(COMPLETE);
  assert.deepEqual(bindParameters({ prepared: c, supplied: only(COMPLETE, PARAMS) }).parameters.expectedItems.value.t, 'set');
});

test('(b) a disabled parameter gives parameter-not-enabled, naming it (hand-checked on the normal record)', () => {
  const r = by(run(INTERVAL, normalCtx(), {}));
  assert.equal(r.comparison.state, 'parameter-not-enabled');
  assert.deepEqual(r.comparison.dependsOnParameters, ['targetIntervalDuration', 'edgeRule']);
  assert.equal(r.interval.value.amount, 90, 'the interval needs no parameter when the certainty is exact');
  const only1 = by(run(INTERVAL, normalCtx(), { edgeRule: PARAMS.edgeRule }));
  assert.deepEqual(only1.comparison.dependsOnParameters, ['targetIntervalDuration']);
});

test('(b) hours and minutes compare through convert: target 2 h against 90 min is within; 1 h is outside', () => {
  assert.equal(by(run(INTERVAL, normalCtx(), { ...PARAMS, targetIntervalDuration: { value: { amount: 2, unit: 'h' } } })).comparison.value.label, 'within-target');
  assert.equal(by(run(INTERVAL, normalCtx(), { ...PARAMS, targetIntervalDuration: { value: { amount: 1, unit: 'h' } } })).comparison.value.label, 'outside-target');
});

test('(b) malformed, undeclared and unusable supplied parameters are refused, never read as disabled', () => {
  const p = prep(INTERVAL);
  const refuse = (supplied, id) => refusedWith(bindParameters({ prepared: p, supplied }), id);
  refuse('text', 'B-006');
  refuse([], 'B-006');
  refuse({ notAParameter: { value: 'x' } }, 'B-006');
  refuse({ edgeRule: { value: 'sideways' } }, 'B-008');
  refuse({ edgeRule: 'inside' }, 'B-008');
  refuse({ edgeRule: {} }, 'B-008');
  refuse({ targetIntervalDuration: { value: { amount: 'ten', unit: 'min' } } }, 'B-008');
  refuse({ targetIntervalDuration: { value: { amount: 5, unit: 'days' } } }, 'B-008');
  refuse({ targetIntervalDuration: { value: { amount: -1, unit: 'min' } } }, 'B-008');
  refuse({ targetIntervalDuration: { value: { amount: 9e9, unit: 'h' } } }, 'B-008');
  refuse({ populationScope: { value: 'anything' } }, 'B-007');
  const c = prep(COMPLETE);
  const refuseC = (supplied) => refusedWith(bindParameters({ prepared: c, supplied }), 'B-008');
  refuseC({ expectedItems: { value: [] } });
  refuseC({ expectedItems: { value: ['clottingResult', 'clottingResult'] } });
  refuseC({ expectedItems: { value: ['somethingElse'] } });
});

// =============================================================================================
// (c) The output contract and refusals
// =============================================================================================

test('(c) an unknown result needs the indeterminate state: declared gives indeterminate, undeclared refuses the whole analytic', () => {
  const tree = [{ output: 'o', expr: { ref: 'input', id: 'biteTime' } }];
  const withIndeterminate = tiny([{ id: 'o', kind: 'classification', labels: ['a'], states: ['indeterminate'] }], tree);
  const noBite = clone(normalCtx()); noBite.observations = noBite.observations.filter((o) => o.concept.id !== concept('biteTime'));
  const r = runAnalytic({ prepared: prep(withIndeterminate), context: noBite, supplied: {}, evaluationTime: T });
  assert.equal(r.results[0].state, 'indeterminate');
  const without = tiny([{ id: 'o', kind: 'classification', labels: ['a'], states: ['needs-data'] }], tree);
  refusedWith(runAnalytic({ prepared: prep(without), context: noBite, supplied: {}, evaluationTime: T }), 'B-010');
});

test('(c) a result the output does not declare refuses everything: no partial results', () => {
  const a = clone(INTERVAL);
  a.outputs.find((o) => o.id === 'comparison').states = ['indeterminate'];
  refusedWith(runAnalytic({ prepared: prep(a), context: normalCtx(), supplied: {}, evaluationTime: T }), 'B-010');
  const noLabel = clone(INTERVAL);
  noLabel.outputs.find((o) => o.id === 'comparison').labels = ['outside-target'];
  refusedWith(runAnalytic({ prepared: prep(noLabel), context: normalCtx(), supplied: only(noLabel, PARAMS), evaluationTime: T }), 'B-010');
  const wrongUnit = clone(INTERVAL);
  wrongUnit.outputs.find((o) => o.id === 'interval').unit = 'h';
  refusedWith(runAnalytic({ prepared: prep(wrongUnit), context: normalCtx(), supplied: {}, evaluationTime: T }), 'B-010');
});

test('(c) a not-enabled value read straight from a disabled parameter is parameter-not-enabled, naming it', () => {
  const a = tiny([{ id: 'o', kind: 'classification', labels: ['a'], states: ['parameter-not-enabled', 'indeterminate'] }], [{ output: 'o', expr: { ref: 'parameter', id: 'edgeRule' } }]);
  const r = runAnalytic({ prepared: prep(a), context: normalCtx(), supplied: {}, evaluationTime: T });
  assert.equal(r.results[0].state, 'parameter-not-enabled');
  assert.deepEqual(r.results[0].dependsOnParameters, ['edgeRule']);
});

test('(c) every refusal id is reached once, with a fixed sentence that quotes nothing', () => {
  assert.deepEqual(BIND_REFUSALS.map((x) => x.id), ['B-001', 'B-002', 'B-003', 'B-004', 'B-005', 'B-006', 'B-007', 'B-008', 'B-009', 'B-010', 'B-011']);
  const reached = new Set();
  const note = (r) => { assert.equal(r.ok, false); reached.add(r.refusal.id); assert.equal(r.refusal.meaning, BIND_REFUSALS.find((x) => x.id === r.refusal.id).meaning); };
  const p = prep(INTERVAL);
  note(runAnalytic({}));
  note(runAnalytic({ prepared: p, context: { contextForm: 'other/1', observations: [] }, supplied: {}, evaluationTime: T }));
  note(runAnalytic({ prepared: p, context: normalCtx(), supplied: {}, evaluationTime: '2026-11-20T12:00:00' }));
  const kind = normalCtx(); kind.observations.find((o) => o.concept.id === concept('biteTime')).kind = 'code';
  note(runAnalytic({ prepared: p, context: kind, supplied: {}, evaluationTime: T }));
  const quantity = tiny(INTERVAL.outputs, INTERVAL.computation, INTERVAL.inputs.map((i) => (i.key === 'biteTime' ? { ...i, type: 'quantity' } : i)));
  note(runAnalytic({ prepared: prep(quantity), context: normalCtx(), supplied: {}, evaluationTime: T }));
  note(runAnalytic({ prepared: p, context: normalCtx(), supplied: { nope: { value: 1 } }, evaluationTime: T }));
  note(runAnalytic({ prepared: p, context: normalCtx(), supplied: { populationScope: { value: 'x' } }, evaluationTime: T }));
  note(runAnalytic({ prepared: p, context: normalCtx(), supplied: { edgeRule: { value: 'sideways' } }, evaluationTime: T }));
  const bad = tiny([{ id: 'o', kind: 'classification', labels: ['a'], states: ['indeterminate'] }], [{ output: 'o', expr: { op: 'add', args: [{ literal: true }, { literal: true }] } }]);
  const x = runAnalytic({ prepared: prep(bad), context: normalCtx(), supplied: {}, evaluationTime: T });
  note(x); assert.equal(x.refusal.cause, 'X-010');
  const undeclared = clone(INTERVAL);
  undeclared.outputs.find((o) => o.id === 'comparison').states = ['indeterminate'];
  note(runAnalytic({ prepared: prep(undeclared), context: normalCtx(), supplied: {}, evaluationTime: T }));
  const noParam = tiny([{ id: 'o', kind: 'classification', labels: ['a'], states: ['parameter-not-enabled'] }], [{ output: 'o', expr: { literal: 'parameter-not-enabled' } }]);
  note(runAnalytic({ prepared: prep(noParam), context: normalCtx(), supplied: {}, evaluationTime: T }));
  assert.deepEqual([...reached].sort(), BIND_REFUSALS.map((r) => r.id));
  const sentinel = normalCtx(); sentinel.observations.find((o) => o.concept.id === concept('biteTime')).value = { value: 'ZZSENTINELZZ', zone: 'stated' };
  const r = run(INTERVAL, sentinel);
  assert.equal(JSON.stringify(r).includes('ZZSENTINELZZ'), false, 'nothing from the record is echoed');
});

// =============================================================================================
// (d) Purity and determinism
// =============================================================================================

test('(d) the module is pure: it imports only the executor, the compiler and the validators', () => {
  const src = readFileSync(new URL('../ccis-bind.js', import.meta.url), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const imports = [...code.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['./ccis-exec.js', './ccis-compile.js', './ccis/validators/ccis-validators.js']);
  for (const banned of [/\beval\s*\(/, /\bnew Function\b/, /\bFunction\s*\(/, /\bimport\s*\(/, /\bDate\b/, /Math\.random/, /\bprocess\b/, /\bfs\b/, /\brequire\b/, /\bfetch\s*\(/, /setTimeout/, /performance\./, /crypto\.random/]) {
    assert.equal(banned.test(code), false, String(banned));
  }
});

test('(d) same input gives identical bytes; the context, supplied values and prepared analytic are not mutated', () => {
  const ctx = deepFreeze(normalCtx());
  const supplied = deepFreeze(clone(only(INTERVAL, PARAMS)));
  const p = prep(INTERVAL);
  const one = JSON.stringify(runAnalytic({ prepared: p, context: ctx, supplied, evaluationTime: T }));
  const two = JSON.stringify(runAnalytic({ prepared: p, context: ctx, supplied, evaluationTime: T }));
  assert.equal(one, two);
  assert.equal(JSON.parse(one).ok, true);
});

test('(d) constants: context form matches the importer; versions and wording table are labelled', () => {
  assert.equal(CONTEXT_FORM, 'ccis-context/1');
  assert.equal(BINDER_VERSION, '0.1.0');
  assert.equal(WORDING.version, '0.1.0');
  assert.deepEqual([...WORDING.analytics], ['snake.bite-to-antivenom-interval', 'snake.clotting-documentation-completeness']);
  assert.equal(Object.isFrozen(WORDING), true);
});

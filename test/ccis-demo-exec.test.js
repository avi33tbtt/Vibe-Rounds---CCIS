import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateAnalytic } from '../ccis-demo-exec.js';
import { loadDemo } from '../ccis-demo-loader.js';
import { runResult } from '../ccis/validators/ccis-validators.js';

const ex = new URL('../ccis/examples/snake/', import.meta.url);
const fx = new URL('../ccis/fixtures/snake/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const exa = (f) => read(new URL(f, ex));
const clone = (x) => JSON.parse(JSON.stringify(x));
const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };

const A0 = exa('snake-interval.analytics.json');
const A1 = exa('snake-interval.analytics.0.1.1.json');
const B1 = exa('snake-completeness.analytics.0.1.1.json');
const pkg = () => ({
  element: exa('snake-envenomation.element.json'), binding: exa('snake-demo-terminology.binding.json'), pathway: exa('snake-documentation.pathway.json'),
  nodes: [exa('snake-node-clotting.node.json'), exa('snake-node-antivenom.node.json')], analytics: [A1, B1],
});
const index = read(new URL('index.json', fx));
const caseFile = (c, kind) => read(new URL(`${c.class}/${c.case}.${kind}.json`, fx));
const ID = 'snake.bite-to-antivenom-interval';
const T = '2026-11-20T12:00:00Z';
const ALL = { targetIntervalDuration: { value: { amount: 120, unit: 'min' } }, acceptedCertainty: { value: 'accept' }, edgeRule: { value: 'inside' } };
const normal = () => caseFile({ class: 'normal', case: 'normal-01-all-enabled' }, 'envelope');
const concept = (key) => `snake.envenomation-timing.${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;
const obs = (env, key) => env.observations.filter((o) => o.concept.id === concept(key));
const drop = (env, key) => { env.observations = env.observations.filter((o) => o.concept.id !== concept(key)); return env; };
const by = (r) => Object.fromEntries(r.results.map((x) => [x.outputId, x]));
const run = (env, params = ALL, a = A1) => evaluateAnalytic(a, env, params, T);
const refused = (r, text) => {
  assert.equal(r.ok, false);
  assert.equal('results' in r, false, 'a refusal carries no results');
  assert.ok(r.refusal.includes(text), r.refusal);
};

test('source: header label, and no clock, randomness, network, file access, eval or dynamic import', () => {
  const src = readFileSync(new URL('../ccis-demo-exec.js', import.meta.url), 'utf8');
  assert.ok(src.startsWith('// DEMO RUNNER: replaced by rows 2.x and 3.x.'));
  const code = src.replace(/^\/\/.*$/gm, '');
  for (const bad of [/new Date/, /Date\.now/, /Date\.parse/, /Math\.random/, /\bfetch\b/, /XMLHttpRequest/, /node:fs/, /readFile/, /\beval\b/, /new Function/, /\bimport\(/, /\bprocess\b/, /localStorage/]) {
    assert.equal(bad.test(code), false, String(bad));
  }
});

test('oracle: every fixture case, run through the loader and the executor on 0.1.1, equals its expected interval results', () => {
  assert.ok(index.cases.length >= 32);
  for (const c of index.cases) {
    const env = caseFile(c, 'envelope'); const want = caseFile(c, 'expected');
    const loaded = loadDemo(pkg(), env);
    assert.equal(loaded.ok, true, c.case);
    const r = evaluateAnalytic(A1, loaded.envelope, want.parameters, want.evaluationTime);
    assert.equal(r.ok, true, `${c.case}: ${r.refusal}`);
    assert.deepEqual(r.results, want.results.filter((x) => x['x-analytic'] === ID), c.case);
    for (const x of r.results) assert.equal(runResult(x), true, JSON.stringify(runResult.errors));
  }
});

test('oracle: the 23 cases built for 0.1.0 also equal their expected results on the 0.1.0 trees', () => {
  const old = index.cases.filter((c) => !caseFile(c, 'expected')['x-analyticVersion']);
  assert.equal(old.length, 23);
  for (const c of old) {
    const want = caseFile(c, 'expected');
    const r = evaluateAnalytic(A0, caseFile(c, 'envelope'), want.parameters, want.evaluationTime);
    assert.deepEqual(r.results, want.results.filter((x) => x['x-analytic'] === ID), c.case);
  }
});

test('nothing enabled: the comparison is not enabled and names every parameter it needed, in declared order', () => {
  const r = by(run(normal(), 'none'));
  assert.deepEqual(r.interval.value, { amount: 90, unit: 'min' });
  assert.equal(r.comparison.state, 'parameter-not-enabled');
  assert.deepEqual(r.comparison.dependsOnParameters, ['targetIntervalDuration', 'edgeRule']);
  assert.equal('value' in r.comparison, false);
  for (const none of [undefined, null, {}]) assert.deepEqual(evaluateAnalytic(A1, normal(), none, T), run(normal(), 'none'));
});

test('unknown never becomes false, zero or a value: every non-present state gives a declared state and no value', () => {
  for (const key of ['biteTime', 'biteTimeCertainty', 'antivenomStartTime']) {
    for (const state of ['unknown', 'not-collected', 'not-applicable']) {
      const env = normal(); const o = obs(env, key)[0]; delete o.value; o.state = state;
      const r = by(run(env));
      for (const out of ['interval', 'comparison']) {
        assert.equal(r[out].state, 'needs-data', `${key} ${state} ${out}`);
        assert.equal('value' in r[out], false);
        assert.deepEqual(r[out].missingDataNotes, [`${key === 'biteTime' ? 'Bite time' : key === 'biteTimeCertainty' ? 'Certainty of the bite time' : 'Anti-snake-venom start time'} is recorded as ${state}.`]);
      }
    }
  }
  const env = normal(); const o = obs(env, 'antivenomStatus')[0]; delete o.value; o.state = 'not-collected';
  assert.deepEqual(by(run(env)).interval.missingDataNotes, ['Anti-snake-venom administration status is recorded as not-collected.']);
  assert.equal(by(run(env)).interval.state, 'indeterminate');
});

test('two records for one field are conflicting and never give a value, even when they agree', () => {
  const env = normal(); env.observations.push({ ...clone(obs(env, 'biteTime')[0]), id: 'dup1' });
  const r = by(run(env));
  assert.equal(r.interval.state, 'needs-data'); assert.equal(r.comparison.state, 'needs-data');
  assert.deepEqual(r.interval.missingDataNotes, ['Bite time is recorded as conflicting.']);
  const env2 = normal(); env2.observations.push({ ...clone(obs(env2, 'antivenomStatus')[0]), id: 'dup2' });
  assert.equal(by(run(env2)).interval.state, 'indeterminate');
});

test('entered-in-error records are ignored, never counted as present', () => {
  const env = normal(); obs(env, 'biteTime')[0].status = 'entered-in-error';
  const r = by(run(env));
  assert.equal(r.interval.state, 'needs-data');
  assert.deepEqual(r.interval.missingDataNotes, ['Bite time is not documented.']);
});

test('a time with no stated zone, or an impossible date, is unknown: indeterminate, never a number', () => {
  const noZone = normal(); const o = obs(noZone, 'biteTime')[0]; o.value = { value: '2026-11-20T08:00:00', zone: 'unknown' };
  for (const env of [noZone]) {
    const r = by(run(env));
    for (const out of ['interval', 'comparison']) {
      assert.equal(r[out].state, 'indeterminate'); assert.equal('value' in r[out], false);
      assert.deepEqual(r[out].missingDataNotes, ['A time in the record has no stated zone or cannot be read, so no times were compared.']);
    }
  }
  for (const bad of ['2026-13-40T08:00:00Z', '2026-02-30T08:00:00Z', '2026-11-20T24:00:00Z', '2026-11-20T08:00:00+25:00']) {
    const env = normal(); obs(env, 'biteTime')[0].value = { value: bad, zone: 'stated' };
    const r = run(env);
    if (r.ok) { assert.equal(by(r).interval.state, 'indeterminate', bad); assert.equal('value' in by(r).interval, false); } else assert.ok(r.refusal.includes('envelope refused'), bad);
  }
  // an unknown time never reaches the comparison as a number or a false
  assert.equal(by(run(noZone, 'none')).comparison.state, 'parameter-not-enabled');
});

test('the certainty choice is honoured and the estimate stays visible', () => {
  const env = normal(); obs(env, 'biteTimeCertainty')[0].value.code = 'estimated';
  assert.deepEqual(by(run(env, ALL)).interval.warnings, ['Bite time is estimated.']);
  assert.deepEqual(by(run(env, { ...ALL, acceptedCertainty: { value: 'flag-only' } })).interval.warnings, ['Bite time is estimated.', 'Flag only: the result rests on an estimated bite time.']);
  assert.equal(by(run(env, { ...ALL, acceptedCertainty: { value: 'needs-data' } })).comparison.state, 'needs-data');
  const off = by(run(env, { targetIntervalDuration: ALL.targetIntervalDuration, edgeRule: ALL.edgeRule }));
  assert.equal(off.interval.state, 'parameter-not-enabled'); assert.deepEqual(off.interval.dependsOnParameters, ['acceptedCertainty']);
  assert.equal('value' in off.comparison, false);
});

test('hours: a duration in hours is compared only after the declared conversion, and a bound is read in minutes', () => {
  const hours = (amount) => ({ ...ALL, targetIntervalDuration: { value: { amount, unit: 'h' } } });
  assert.equal(by(run(normal(), hours(2))).comparison.value.label, 'within-target'); // 120 min, edge inside, interval 90
  assert.equal(by(run(normal(), hours(1))).comparison.value.label, 'outside-target'); // 60 min; unconverted 1 would also be outside, so check the edge
  const edge = normal(); // interval is 90 min: 1.5 h is exactly on the limit; the edge rule decides
  assert.equal(by(run(edge, { ...hours(1.5), edgeRule: { value: 'inside' } })).comparison.value.label, 'within-target');
  assert.equal(by(run(edge, { ...hours(1.5), edgeRule: { value: 'outside' } })).comparison.value.label, 'outside-target');
  refused(run(normal(), hours(9000)), 'outside the technical bound'); // 540000 min > 525600
  assert.equal(run(normal(), { ...ALL, targetIntervalDuration: { value: { amount: 525600, unit: 'min' } } }).ok, true);
  refused(run(normal(), { ...ALL, targetIntervalDuration: { value: { amount: 525601, unit: 'min' } } }), 'outside the technical bound');
});

test('whitelist: any operator outside the subset refuses the whole analytic (select and count: see the completeness tests)', () => {
  for (const op of ['ne', 'gt', 'ge', 'add', 'sub']) {
    const a = clone(A1); a.computation[0].expr = { op, args: [{ literal: 'x' }] };
    refused(run(normal(), 'none', a), 'operator not supported');
  }
  const unknownOp = clone(A1); unknownOp.computation[0].expr = { op: 'exec', args: [{ literal: 'x' }] };
  refused(run(normal(), 'none', unknownOp), 'does not conform to its schema');
  const fn = clone(A1); fn.computation[0].expr = { op: 'if', args: [{ literal: true }, { literal: 'needs-data' }, { op: 'constructor', args: [{ literal: 'x' }] }] };
  refused(run(normal(), 'none', fn), 'does not conform to its schema');
});

test('malformed analytics are refused: undeclared names, bad arity, a conversion outside convert, a result the output does not declare', () => {
  const mutate = (f) => { const a = clone(A1); f(a); return a; };
  refused(run(normal(), 'none', mutate((a) => { a.computation[0].expr = { ref: 'input', id: 'nothing' }; })), 'does not declare');
  refused(run(normal(), 'none', mutate((a) => { a.computation[0].expr = { op: 'if', args: [{ literal: true }, { literal: 'needs-data' }] }; })), 'wrong number of arguments');
  refused(run(normal(), 'none', mutate((a) => { a.computation[0].expr = { op: 'eq', args: [{ ref: 'conversion', id: 'hoursToMinutes' }, { literal: 'x' }] }; })), 'outside convert');
  refused(run(normal(), 'none', mutate((a) => { a.computation[0].expr = { literal: 'surprise' }; })), 'the output declares');
  refused(run(normal(), 'none', mutate((a) => { a.computation[0].expr = { literal: true }; })), 'the output declares');
  refused(run(normal(), 'none', mutate((a) => { a.computation.pop(); })), 'do not match');
  refused(run(normal(), 'none', mutate((a) => { a.computation.push(clone(a.computation[0])); })), 'two computations');
  refused(run(normal(), 'none', mutate((a) => { a.computation[0].expr = { op: 'if', args: [{ ref: 'input', id: 'biteTime' }, { literal: 'needs-data' }, { literal: 'needs-data' }] }; })), 'condition is not true, false or unknown');
  refused(run(normal(), 'none', null), 'does not conform');
  const deep = { literal: 'needs-data' }; let d = deep; for (let i = 0; i < 80; i++) { const n = { op: 'not', args: [{ literal: true }] }; n.args[0] = d; d = n; }
  refused(run(normal(), 'none', mutate((a) => { a.computation[0].expr = d; })), 'too deep');
});

test('hostile parameters are refused, never read as a value or silently disabled', () => {
  const bad = [
    { targetIntervalDuration: { value: { amount: '120', unit: 'min' } } },
    { targetIntervalDuration: { value: { amount: -1, unit: 'min' } } },
    { targetIntervalDuration: { value: { amount: 1e999, unit: 'min' } } },
    { targetIntervalDuration: { value: { amount: 5, unit: 'parsec' } } },
    { targetIntervalDuration: { value: null } },
    { targetIntervalDuration: { amount: 120, unit: 'min' } },
    { targetIntervalDuration: 120 },
    { targetIntervalDuration: null },
    { acceptedCertainty: { value: 'maybe' } },
    { acceptedCertainty: { value: ['accept'] } },
    { edgeRule: { value: 'INSIDE' } },
    { populationScope: { value: 'anything' } },
  ];
  for (const p of bad) refused(run(normal(), p), 'parameters refused');
  refused(run(normal(), [ALL]), 'parameters refused');
  refused(run(normal(), 'enabled'), 'parameters refused');
  // undeclared names, including prototype names, are ignored and never reach the interpreter
  const sneaky = JSON.parse('{"__proto__":{"edgeRule":{"value":"inside"}},"constructor":{"value":"x"},"toString":1,"unrelated":{"value":1}}');
  const r = run(normal(), sneaky);
  assert.equal(r.ok, true);
  assert.equal(by(r).comparison.state, 'parameter-not-enabled');
  assert.equal({}.edgeRule, undefined);
});

test('hostile envelopes: schema breakers and kind mismatches are refused with fixed sentences that echo nothing', () => {
  const hostile = '<img src=x onerror=alert(1)> {{7*7}} ${process.exit()}';
  const unknownField = normal(); unknownField.observations[0].patientName = hostile;
  const r1 = run(unknownField); refused(r1, 'envelope refused');
  assert.equal(r1.refusal.includes('onerror'), false);
  const mismatch = normal(); obs(mismatch, 'biteTime')[0].kind = 'code'; obs(mismatch, 'biteTime')[0].value = { system: 'x', code: 'exact' };
  refused(run(mismatch), 'does not match the kind');
  refused(run('text'), 'envelope refused');
  refused(run(null), 'envelope refused');
  for (const t of [undefined, null, 5, '2026-11-20T12:00:00', '2026-11-20', '2026-13-20T12:00:00Z', hostile]) refused(evaluateAnalytic(A1, normal(), 'none', t), 'evaluation time refused');
});

test('pure and deterministic: frozen inputs are not touched, same input gives byte-identical output', () => {
  const env = deepFreeze(normal()); const a = deepFreeze(clone(A1)); const p = deepFreeze(clone(ALL));
  const one = JSON.stringify(evaluateAnalytic(a, env, p, T));
  assert.equal(one, JSON.stringify(evaluateAnalytic(a, env, p, T)));
  assert.equal(JSON.parse(one).ok, true);
  const bad = deepFreeze({ targetIntervalDuration: { value: { amount: 5, unit: 'parsec' } } });
  assert.equal(JSON.stringify(evaluateAnalytic(a, env, bad, T)), JSON.stringify(evaluateAnalytic(a, env, bad, T)));
});

test('the evaluation time is an input: a different time with the same record gives the same results', () => {
  const env = normal();
  assert.deepEqual(evaluateAnalytic(A1, env, ALL, '2026-11-20T12:00:00Z'), evaluateAnalytic(A1, env, ALL, '2030-01-01T00:00:00+05:45'));
});

test('three-valued logic: comparing an unknown gives unknown, which picks no branch (indeterminate), never false', () => {
  const tree = (certainty) => ({ op: 'if', args: [{ op: 'eq', args: [{ ref: 'input', id: 'biteTimeCertainty' }, { literal: 'estimated' }] }, { literal: 'needs-data' }, { literal: 'conflict' }] });
  const a = clone(A1); a.computation[0].expr = tree();
  const withCert = (code) => { const env = normal(); obs(env, 'biteTimeCertainty')[0].value.code = code; return env; };
  assert.equal(by(run(withCert('estimated'), 'none', a)).interval.state, 'needs-data');
  assert.equal(by(run(withCert('exact'), 'none', a)).interval.state, 'conflict');
  assert.equal(by(run(drop(normal(), 'biteTimeCertainty'), 'none', a)).interval.state, 'indeterminate', 'absent: unknown, not false');
  const b = clone(A1); b.computation[0].expr = { op: 'if', args: [{ op: 'not', args: [{ op: 'eq', args: [{ ref: 'input', id: 'biteTimeCertainty' }, { literal: 'estimated' }] }] }, { literal: 'needs-data' }, { literal: 'conflict' }] };
  assert.equal(by(run(drop(normal(), 'biteTimeCertainty'), 'none', b)).interval.state, 'indeterminate', 'not of unknown is unknown');
  const c = clone(A1); c.computation[0].expr = { op: 'if', args: [{ op: 'and', args: [{ literal: true }, { op: 'eq', args: [{ ref: 'input', id: 'biteTimeCertainty' }, { literal: 'estimated' }] }] }, { literal: 'needs-data' }, { literal: 'conflict' }] };
  assert.equal(by(run(drop(normal(), 'biteTimeCertainty'), 'none', c)).interval.state, 'indeterminate', 'true and unknown is unknown');
  const d = clone(A1); d.computation[0].expr = { op: 'if', args: [{ op: 'or', args: [{ literal: true }, { op: 'eq', args: [{ ref: 'input', id: 'biteTimeCertainty' }, { literal: 'estimated' }] }] }, { literal: 'needs-data' }, { literal: 'conflict' }] };
  assert.equal(by(run(drop(normal(), 'biteTimeCertainty'), 'none', d)).interval.state, 'needs-data', 'true or unknown is true');
  // an output that does not declare indeterminate cannot carry an unknown result: the analytic is refused
  const e = clone(A1); e.outputs[0].states = e.outputs[0].states.filter((s) => s !== 'indeterminate');
  refused(run(drop(normal(), 'biteTimeCertainty'), 'none', Object.assign(clone(a), { outputs: e.outputs })), 'state the output does not declare');
});

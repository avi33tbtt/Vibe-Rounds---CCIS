import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveCompatibility, executionPolicy, COMPAT_REASONS, OUTCOMES, CHECK_NAMES, PREVIEW_BANNER, versionSatisfies, RESULT_FORM } from '../ccis-compat.js';
import { importEnvelope } from '../ccis-import.js';
import { satisfiesRange } from '../ccis-validator.js';

const ex = new URL('../ccis/examples/snake/', import.meta.url);
const fx = new URL('../ccis/fixtures/snake/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const exa = (f) => read(new URL(f, ex));
const clone = (x) => JSON.parse(JSON.stringify(x));
const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };

const ELEMENT = exa('snake-envenomation.element.json');
const PATHWAY = exa('snake-documentation.pathway.json');
const INTERVAL = exa('snake-interval.analytics.0.1.1.json');
const COMPLETE = exa('snake-completeness.analytics.0.1.1.json');
const HELD = [ELEMENT, PATHWAY, INTERVAL, COMPLETE];
const RUNTIME = { standardMajors: [0], engine: { version: '0.1.0' }, operatorSet: { name: 'ccis-core-ops', majors: [0] }, limits: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 }, understoodExtensions: [] };
const index = read(new URL('index.json', fx));
const envPath = (name) => (name === 'emr-demo-case' ? 'emr-export/emr-demo-case' : `${index.cases.find((c) => c.case === name).class}/${name}`);
const envOf = (name) => read(new URL(`${envPath(name)}.envelope.json`, fx));
const ctxOf = (name) => { const r = importEnvelope(envOf(name), { held: HELD }); assert.equal(r.ok, true, name); return r.context; };
const ALL_CASES = [...index.cases.map((c) => c.case), 'emr-demo-case'];

const setup = (over = {}) => ({ pathway: clone(PATHWAY), held: clone(HELD), context: ctxOf('normal-01-all-enabled'), runtime: clone(RUNTIME), request: undefined, ...over });
const run = (s) => resolveCompatibility(s);
const pkg = (r, part) => { const p = r.packages.find((x) => x.ref.id.includes(part)); assert.ok(p, `package ${part}`); return p; };
const check = (entry, n) => entry.checks[n - 1];
const reasons = (entry) => entry.checks.flatMap((c) => c.findings.map((f) => f.reason));
const findHeld = (s, id) => s.held.find((d) => d.manifest.id === id);
const interval = (s) => findHeld(s, 'snake.bite-to-antivenom-interval');
const complete = (s) => findHeld(s, 'snake.clotting-documentation-completeness');
const element = (s) => findHeld(s, 'snake.envenomation-timing');
const BITE = 'snake.envenomation-timing.bite-time';
const withoutConcept = (ctx, suffix) => { ctx.observations = ctx.observations.filter((o) => o.concept.id !== `snake.envenomation-timing.${suffix}`); return ctx; };
const setState = (ctx, suffix, state) => { for (const o of ctx.observations) if (o.concept.id === `snake.envenomation-timing.${suffix}`) { o.state = state; delete o.value; } return ctx; };
// A synthetic package with no parameters at all: the only way to reach "Compatible" without a clinician (parameters are disabled by schema).
const noParams = (s) => { for (const d of s.held) if (d.manifest.type === 'analytics-package') d.parameters = []; return s; };

// -------------------------------------------------------------------------------------------------
// (a) The snake oracle
// -------------------------------------------------------------------------------------------------

// Independent of the resolver: which inputs are missing, read straight from the raw envelope.
const MISSING = ['absent', 'unknown', 'not-collected'];
function missingFromEnvelope(env, analytics) {
  const out = [];
  for (const i of analytics.inputs) {
    const concept = `${i.element}.${i.field.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;
    const obs = env.observations.filter((o) => o.concept.id === concept && o.status !== 'entered-in-error');
    if (obs.length === 0 || obs.every((o) => MISSING.includes(o.state))) out.push(i);
  }
  return out;
}

test('oracle: all 33 envelopes, both packages, against an independent reading of the envelope', () => {
  assert.equal(ALL_CASES.length, 33);
  for (const name of ALL_CASES) {
    const r = run(setup({ context: ctxOf(name) }));
    for (const [part, analytics] of [['interval', INTERVAL], ['completeness', COMPLETE]]) {
      const miss = missingFromEnvelope(envOf(name), analytics);
      const want = miss.some((i) => i.onMissing === 'needs-data') ? 'needs-data' : 'compatible-with-limitations';
      const p = pkg(r, part);
      assert.equal(p.outcome, want, `${name} ${part}`);
      assert.deepEqual(p.missingData.map((m) => m.key), miss.map((i) => i.key), `${name} ${part} missing`);
    }
    // Both packages are optional in the snake pathway, so the pathway can only be lowered to "with limitations".
    assert.equal(r.pathway.outcome, 'compatible-with-limitations', name);
  }
});

test('oracle: hand-calculated outcomes for named cases', () => {
  // Interval needs biteTime, biteTimeCertainty, antivenomStartTime (needs-data) and antivenomStatus (indeterminate).
  // Completeness needs all four clotting inputs (needs-data). All parameters are disabled, so nothing is better than "with limitations".
  const want = {
    'normal-01-all-enabled': { interval: 'compatible-with-limitations', completeness: 'compatible-with-limitations', iMissing: [], cMissing: [] },
    'missing-01-no-bite-time': { interval: 'needs-data', completeness: 'compatible-with-limitations', iMissing: ['biteTime'], cMissing: [] },
    'missing-03-no-antivenom-status': { interval: 'compatible-with-limitations', completeness: 'compatible-with-limitations', iMissing: ['antivenomStatus'], cMissing: [] },
    'missing-05-no-clotting-status': { interval: 'compatible-with-limitations', completeness: 'needs-data', iMissing: [], cMissing: ['clottingTestStatus'] },
    // This envelope holds only the clotting status, and it is unknown; the start time, read time and result have no record at all.
    'missing-08-clotting-status-unknown': { interval: 'compatible-with-limitations', completeness: 'needs-data', iMissing: [], cMissing: ['clottingTestStatus', 'clottingTestStartTime', 'clottingResultReadTime', 'clottingResult'] },
    'missing-10-antivenom-status-unknown': { interval: 'needs-data', completeness: 'compatible-with-limitations', iMissing: ['antivenomStatus', 'antivenomStartTime'], cMissing: [] },
    // Two observations of one concept, one a value: answered. Conflicts are not detected here (a finding of this row).
    'conflicting-04-two-status-records-conflict': { interval: 'compatible-with-limitations', completeness: 'compatible-with-limitations', iMissing: [], cMissing: [] },
    // Documented "explicitly negative" and "not applicable" are answers, not missing data.
    'out-of-scope-01-antivenom-not-given': { interval: 'compatible-with-limitations', completeness: 'compatible-with-limitations', iMissing: [], cMissing: [] },
    // The EMR export has an unknown clotting result and no antivenom start time.
    'emr-demo-case': { interval: 'needs-data', completeness: 'needs-data', iMissing: ['antivenomStartTime'], cMissing: ['clottingResult'] },
  };
  for (const [name, w] of Object.entries(want)) {
    const r = run(setup({ context: ctxOf(name) }));
    assert.equal(pkg(r, 'interval').outcome, w.interval, `${name} interval`);
    assert.equal(pkg(r, 'completeness').outcome, w.completeness, `${name} completeness`);
    assert.deepEqual(pkg(r, 'interval').missingData.map((m) => m.key), w.iMissing, `${name} interval missing`);
    assert.deepEqual(pkg(r, 'completeness').missingData.map((m) => m.key), w.cMissing, `${name} completeness missing`);
  }
  const r = run(setup({ context: ctxOf('missing-08-clotting-status-unknown') }));
  assert.deepEqual(pkg(r, 'completeness').missingData[0], { key: 'clottingTestStatus', concept: 'snake.envenomation-timing.clotting-test-status', onMissing: 'needs-data', observed: ['unknown'] });
  const none = run(setup({ context: ctxOf('missing-05-no-clotting-status') }));
  assert.deepEqual(pkg(none, 'completeness').missingData[0].observed, [], 'no observation at all');
});

test('oracle: the catalogue view (no context) needs data for every package, and the pathway is only limited', () => {
  const r = run(setup({ context: null }));
  for (const p of r.packages) {
    assert.equal(p.outcome, 'needs-data');
    assert.ok(reasons(p).includes('CMP-4-01'));
    assert.equal(p.missingData.length, p.checks[3].findings.filter((f) => f.reason !== 'CMP-4-01' && f.reason !== 'CMP-4-04').length === 0 ? p.missingData.length : -1);
  }
  assert.equal(pkg(r, 'interval').missingData.length, 4, 'every input is listed as missing');
  assert.equal(r.pathway.outcome, 'compatible-with-limitations');
  assert.equal(r.pathway.checks[3].state, 'limited', 'optional packages lower check 4 only to limited');
  assert.equal(r.pathway.missingData.length, 8, 'the pathway lists the missing data of its packages');
});

test('oracle: the five outcomes are each reached once, with the result shape', () => {
  const reached = {};
  reached.limited = run(setup()).packages[0].outcome;
  reached.needs = run(setup({ context: null })).packages[0].outcome;
  const comp = run(noParams(setup()));
  reached.compatible = comp.packages[0].outcome;
  const inc = setup(); inc.held = inc.held.filter((d) => d.manifest.type !== 'contextual-element'); inc.context = null;
  reached.incompatible = run(inc).packages[0].outcome;
  const ne = setup({ request: { mode: 'governed' } });
  reached.notEligible = run(ne).packages[0].outcome;
  assert.deepEqual(reached, { limited: 'compatible-with-limitations', needs: 'needs-data', compatible: 'compatible', incompatible: 'incompatible', notEligible: 'not-eligible' });
  assert.deepEqual(Object.keys(OUTCOMES), ['compatible', 'compatible-with-limitations', 'needs-data', 'incompatible', 'not-eligible']);
  assert.equal(comp.pathway.outcome, 'compatible');
  // Shape: six checks in order, every entry, whatever the outcome (REQ-055, 057).
  for (const r of [run(setup()), run(inc), run(ne), comp]) {
    assert.equal(r.resultForm, RESULT_FORM);
    for (const e of [r.pathway, ...r.packages]) {
      assert.deepEqual(e.checks.map((c) => c.name), [...CHECK_NAMES]);
      assert.deepEqual(e.checks.map((c) => c.check), [1, 2, 3, 4, 5, 6]);
      assert.equal(e.outcomeLabel, OUTCOMES[e.outcome]);
      assert.ok(Array.isArray(e.satisfied) && Array.isArray(e.missingData) && Array.isArray(e.needed));
    }
  }
  // Outcomes are explained (REQ-057): the limited case says what was satisfied and what would be needed.
  const lim = pkg(run(setup()), 'interval');
  assert.ok(lim.satisfied.length > 5);
  assert.ok(lim.needed.some((n) => n.includes('targetIntervalDuration')));
});

// -------------------------------------------------------------------------------------------------
// (b) Every check reaches its states, and every reason code is reached, by mutating one thing
// -------------------------------------------------------------------------------------------------
const UNIT_FIELD = { key: 'bodyWeight', label: 'Body weight', type: 'quantity', cardinality: { min: 0, max: 1 }, units: ['kg'], epistemic: ['absent', 'unknown', 'not-collected', 'not-applicable', 'explicitly-negative', 'entered-in-error'], sourceClasses: ['clinician-entered'], constraints: ['Synthetic test field.'] };
const addWeight = (s, unit, withConversion) => {
  element(s).fields.push(clone(UNIT_FIELD));
  const a = interval(s);
  a.inputs.push({ key: 'weight', element: 'snake.envenomation-timing', field: 'bodyWeight', type: 'quantity', units: [unit], onMissing: 'indeterminate' });
  if (withConversion) a.conversions.push({ id: 'lbToKg', version: '0.1.0', from: 'lb', to: 'kg', kind: 'linear', factor: 0.45359237 });
  return s;
};
const validation = (m, version = m.version) => ({ version, population: 'Synthetic test population.', setting: 'Synthetic test setting.', intendedUse: 'Synthetic test use.' });
const valid = (d, status = 'validated', version) => { d.manifest.status = status; d.manifest.validation = validation(d.manifest, version); };

// [reason, which entry, check number, state, mutate(setup)]
const CASES = [
  ['CMP-0-01', 'interval', 2, 'not-evaluable', (s) => { s.held = s.held.filter((d) => d.manifest.id !== 'snake.bite-to-antivenom-interval'); }],
  ['CMP-1-01', 'interval', 1, 'not-met', (s) => { s.held = s.held.filter((d) => d.manifest.type !== 'contextual-element'); }, 'pathway', 1, 'not-met'],
  ['CMP-1-02', 'pathway', 1, 'not-met', (s) => { element(s).manifest.version = '0.2.0'; }],
  ['CMP-1-03', 'pathway', 1, 'not-met', (s) => { element(s).manifest.type = 'element-group'; }],
  ['CMP-1-04', 'pathway', 1, 'not-evaluable', (s) => { s.held.push(clone(element(s))); }],
  ['CMP-1-05', 'pathway', 1, 'not-met', (s) => { s.pathway.transitions[1].via = 'no-such-node'; }],
  ['CMP-1-06', 'interval', 1, 'not-met', (s) => { interval(s).manifest.mandatoryExtensions = ['x-needed']; }],
  ['CMP-1-07', 'pathway', 1, 'limited', (s) => { s.held = s.held.filter((d) => d.manifest.id !== 'snake.clotting-documentation-completeness'); }],
  ['CMP-1-08', 'pathway', 1, 'not-evaluable', (s) => { s.pathway = null; }],
  ['CMP-2-01', 'interval', 2, 'not-met', (s) => { interval(s).inputs[0].field = 'biteTim'; }],
  ['CMP-2-02', 'interval', 2, 'not-met', (s) => { interval(s).inputs[0].element = 'snake.other-element'; }],
  ['CMP-2-03', 'interval', 2, 'not-met', (s) => { interval(s).inputs[0].type = 'string'; }],
  ['CMP-2-04', 'interval', 2, 'not-met', (s) => { addWeight(s, 'lb', false); }],
  ['CMP-2-05', 'interval', 2, 'not-met', (s) => { s.context.applied.elements[0].version = '0.1.1'; }],
  ['CMP-2-06', 'interval', 2, 'not-met', (s) => { s.context.applied.elements = []; }],
  ['CMP-2-07', 'interval', 2, 'not-evaluable', (s) => { element(s).fields = 'none'; }],
  ['CMP-3-01', 'interval', 3, 'not-met', (s) => { delete interval(s).question; }],
  // The pathway itself now fails its schema (that type is not allowed in a pathway reference); the package has no validator at all.
  ['CMP-3-02', 'pathway', 3, 'not-met', (s) => { const d = clone(COMPLETE); d.manifest.type = 'test-validation-package'; d.manifest.id = 'snake.other-package'; s.held.push(d); s.pathway.analytics[1].ref = { id: 'snake.other-package', type: 'test-validation-package', range: '^0.1.0' }; }, 'other-package', 3, 'not-evaluable'],
  ['CMP-3-03', 'interval', 3, 'not-met', (s) => { s.context.contextForm = 'ccis-context/2'; }],
  ['CMP-3-04', 'interval', 3, 'not-evaluable', (s) => { s.context = { applied: 'nothing' }; }],
  ['CMP-3-05', 'interval', 3, 'not-met', (s) => { interval(s).manifest.standard.version = '1.0.0'; }],
  ['CMP-3-06', 'interval', 3, 'not-evaluable', (s) => { s.runtime.standardMajors = 'zero'; }],
  ['CMP-4-01', 'interval', 4, 'needs-data', (s) => { s.context = null; }],
  ['CMP-4-02', 'interval', 4, 'needs-data', (s) => { withoutConcept(s.context, 'bite-time'); }],
  ['CMP-4-03', 'interval', 4, 'limited', (s) => { withoutConcept(s.context, 'antivenom-status'); }],
  ['CMP-4-04', 'interval', 4, 'limited', () => {}],
  ['CMP-5-01', 'interval', 5, 'not-met', (s) => { interval(s).manifest.requires = { engine: '^1.0.0' }; }],
  ['CMP-5-02', 'interval', 5, 'not-evaluable', (s) => { delete s.runtime.limits; }],
  ['CMP-5-03', 'interval', 5, 'not-met', (s) => { s.runtime.operatorSet.name = 'other-ops'; }],
  ['CMP-5-04', 'interval', 5, 'not-met', (s) => { s.runtime.limits.maxSteps = 10; }],
  ['CMP-5-05', 'interval', 5, 'not-met', (s) => { interval(s).manifest.requires = { fhir: '>=4.0.0' }; }],
  ['CMP-6-01', 'interval', 6, 'not-met', (s) => { interval(s).manifest.status = 'rejected'; }],
  ['CMP-6-02', 'interval', 6, 'limited', (s) => { interval(s).manifest.status = 'deprecated'; }],
  ['CMP-6-03', 'interval', 6, 'not-met', (s) => { s.request = { mode: 'governed' }; }],
  ['CMP-6-04', 'interval', 6, 'not-met', (s) => { s.request = { mode: 'governed' }; valid(interval(s), 'validated', '0.1.0'); }],
  ['CMP-6-05', 'interval', 6, 'not-evaluable', (s) => { s.request = { mode: 'strict' }; }],
  ['CMP-6-06', 'interval', 6, 'limited', (s) => { valid(interval(s), 'validated', '0.1.0'); }],
];

test('each reason code is reached once, by changing one thing, at the check and state the catalogue names', () => {
  const reached = new Set();
  for (const [code, who, n, state, mutate, who2, n2, state2] of CASES) {
    const s = setup();
    mutate(s);
    const r = run(s);
    const targets = [[who, n, state]];
    if (who2) targets.push([who2, n2, state2]);
    for (const [w, nn, st] of targets) {
      const e = w === 'pathway' ? r.pathway : pkg(r, w);
      assert.equal(check(e, nn).state, st, `${code}: ${w} check ${nn}`);
    }
    const all = [r.pathway, ...r.packages].flatMap(reasons);
    assert.ok(all.includes(code), `${code} is reported`);
    reached.add(code);
    // The catalogue and the finding agree about the check and the state.
    const cat = COMPAT_REASONS.find((c) => c.id === code);
    for (const e of [r.pathway, ...r.packages]) {
      for (const c of e.checks) for (const f of c.findings) {
        const k = COMPAT_REASONS.find((x) => x.id === f.reason);
        assert.ok(k, f.reason);
        assert.equal(f.state, k.state);
        assert.ok(k.check === 'any' || k.check === c.name, `${f.reason} sits in check ${c.name}`);
      }
    }
    assert.ok(cat);
  }
  assert.deepEqual([...reached].sort(), COMPAT_REASONS.map((c) => c.id).sort(), 'every code in the catalogue is reached');
});

test('the five check states are each reached, and a met check has no findings', () => {
  const states = new Set();
  for (const [, who, , , mutate] of CASES) {
    const s = setup();
    mutate(s);
    const r = run(s);
    for (const e of [r.pathway, ...r.packages]) for (const c of e.checks) { states.add(c.state); if (c.state === 'met') assert.deepEqual(c.findings, []); }
    void who;
  }
  assert.deepEqual([...states].sort(), ['limited', 'met', 'needs-data', 'not-evaluable', 'not-met']);
});

test('the catalogue is frozen, unique, and every id is well formed', () => {
  assert.equal(Object.isFrozen(COMPAT_REASONS), true);
  assert.equal(new Set(COMPAT_REASONS.map((c) => c.id)).size, COMPAT_REASONS.length);
  for (const c of COMPAT_REASONS) {
    assert.match(c.id, /^CMP-[0-6]-\d\d$/);
    assert.ok([...CHECK_NAMES, 'any'].includes(c.check));
    assert.ok(['not-met', 'limited', 'needs-data', 'not-evaluable'].includes(c.state));
    assert.ok(c.meaning.length > 20);
  }
  assert.equal(Object.isFrozen(OUTCOMES), true);
});

test('findings name ids, keys and versions; they never quote an observation value or time', () => {
  const s = setup({ context: ctxOf('missing-08-clotting-status-unknown') });
  const r = run(s);
  const text = JSON.stringify(r);
  for (const bad of ['2026-11-20', 'T08:00', '"exact"', 'ccis-demo']) assert.equal(text.includes(bad), false, bad);
});

// -------------------------------------------------------------------------------------------------
// (c) Precedence
// -------------------------------------------------------------------------------------------------
test('precedence: Not eligible beats Incompatible beats Needs data beats limited, and all six checks are listed', () => {
  const s = setup({ context: null });
  interval(s).manifest.status = 'rejected'; // check 6 not-met
  s.held = s.held.filter((d) => d.manifest.type !== 'contextual-element'); // check 1 not-met
  let p = pkg(run(s), 'interval');
  assert.equal(p.outcome, 'not-eligible');
  assert.equal(p.checks.length, 6);
  assert.equal(check(p, 1).state, 'not-met');
  assert.equal(check(p, 6).state, 'not-met');

  const t = setup({ context: null });
  t.runtime.limits.maxSteps = 10; // check 5 not-met, no context (check 4 needs-data), parameters disabled (limited)
  p = pkg(run(t), 'interval');
  assert.equal(p.outcome, 'incompatible');
  assert.equal(check(p, 4).state, 'needs-data');

  const u = setup({ context: null });
  p = pkg(run(u), 'interval');
  assert.equal(p.outcome, 'needs-data', 'needs data beats the limitation of disabled parameters');
});

test('precedence: a check that cannot be evaluated is Incompatible, never Compatible (REQ-061)', () => {
  // Everything else is met: no parameters, all answered. Only check 1 cannot be evaluated (a duplicate held document).
  const s = noParams(setup());
  assert.equal(pkg(run(s), 'interval').outcome, 'compatible');
  s.held.push(clone(element(s)));
  const p = pkg(run(s), 'interval');
  assert.equal(check(p, 1).state, 'not-evaluable');
  assert.equal(p.outcome, 'incompatible');
  assert.ok(reasons(p).includes('CMP-1-04'));
  // Not evaluable at check 6 or check 4 alone also fails closed.
  const m = noParams(setup({ request: { mode: 'sometimes' } }));
  assert.equal(pkg(run(m), 'interval').outcome, 'incompatible');
  const bad = noParams(setup({ context: { applied: 'x' } }));
  const q = pkg(run(bad), 'interval');
  assert.equal(check(q, 4).state, 'not-evaluable');
  assert.equal(q.outcome, 'incompatible');
});

test('pathway roll-up: a required package counts in full; an optional package only lowers to "with limitations"', () => {
  const opt = noParams(setup());
  opt.held = opt.held.filter((d) => d.manifest.id !== 'snake.clotting-documentation-completeness');
  let r = run(opt);
  assert.equal(pkg(r, 'completeness').outcome, 'incompatible');
  assert.equal(r.pathway.outcome, 'compatible-with-limitations');
  assert.deepEqual(check(r.pathway, 1).fromPackages, [{ id: 'snake.clotting-documentation-completeness', requirement: 'optional', state: 'not-met' }]);

  const req = noParams(setup());
  req.pathway.analytics[1].requirement = 'required';
  req.held = req.held.filter((d) => d.manifest.id !== 'snake.clotting-documentation-completeness');
  r = run(req);
  assert.equal(r.pathway.outcome, 'incompatible');
  assert.ok(reasons(r.pathway).includes('CMP-1-01'));

  const needs = noParams(setup({ context: ctxOf('missing-05-no-clotting-status') }));
  needs.pathway.analytics[1].requirement = 'required';
  assert.equal(run(needs).pathway.outcome, 'needs-data');
  const needsOpt = noParams(setup({ context: ctxOf('missing-05-no-clotting-status') }));
  assert.equal(run(needsOpt).pathway.outcome, 'compatible-with-limitations');

  const gov = noParams(setup({ request: { mode: 'governed' } }));
  valid(gov.pathway, 'validated');
  valid(interval(gov), 'validated');
  valid(complete(gov), 'validated');
  r = run(gov);
  assert.equal(r.pathway.outcome, 'compatible');
  complete(gov).manifest.status = 'draft';
  assert.equal(run(gov).pathway.outcome, 'compatible-with-limitations', 'an optional package that is not eligible only limits the pathway');
});

// -------------------------------------------------------------------------------------------------
// (d) No guessing (REQ-060)
// -------------------------------------------------------------------------------------------------
test('no guessing: a similar field name, a case change, a near id or a near version never matches', () => {
  for (const wrong of ['biteTim', 'BiteTime', 'bitetime', 'bite-time', 'biteTime ', 'bite_time']) {
    const s = setup();
    interval(s).inputs[0].field = wrong;
    const p = pkg(run(s), 'interval');
    assert.equal(check(p, 2).state, 'not-met', wrong);
    assert.ok(reasons(p).includes('CMP-2-01'), wrong);
    assert.equal(p.outcome, 'incompatible');
  }
  for (const wrongId of ['Snake.Envenomation-Timing', 'snake.envenomation-timing ', 'snake.envenomation_timing', 'snake.envenomation']) {
    const s = setup();
    element(s).manifest.id = wrongId;
    const r = run(s);
    assert.ok(reasons(r.pathway).includes('CMP-1-01'), wrongId);
    assert.equal(pkg(r, 'interval').outcome, 'incompatible');
  }
  for (const wrongVersion of ['0.2.0', '0.0.9', '1.1.0', '0.1.0-rc.1', '0.1.0-0', '0.1']) {
    const s = setup();
    element(s).manifest.version = wrongVersion;
    const r = run(s);
    assert.ok(reasons(r.pathway).includes('CMP-1-02'), wrongVersion);
  }
  // A concept id of another case never matches data: the context must hold the derived id exactly.
  const c = ctxOf('normal-01-all-enabled');
  for (const o of c.observations) if (o.concept.id === BITE) o.concept.id = BITE.toUpperCase();
  assert.equal(pkg(run(setup({ context: c })), 'interval').outcome, 'needs-data');
});

test('no guessing: the unit rule rejects a different unit and accepts a declared conversion only', () => {
  const same = setup(); addWeight(same, 'kg', false);
  assert.equal(check(pkg(run(same), 'interval'), 2).state, 'met', 'a permitted unit');
  const diff = setup(); addWeight(diff, 'lb', false);
  const p = pkg(run(diff), 'interval');
  assert.equal(check(p, 2).state, 'not-met');
  assert.ok(reasons(p).includes('CMP-2-04'));
  const conv = setup(); addWeight(conv, 'lb', true);
  assert.equal(check(pkg(run(conv), 'interval'), 2).state, 'met', 'a declared conversion covers lb and kg');
  const wrong = setup(); addWeight(wrong, 'lb', false);
  interval(wrong).conversions.push({ id: 'gToMg', version: '0.1.0', from: 'g', to: 'mg', kind: 'linear', factor: 1000 });
  assert.equal(check(pkg(run(wrong), 'interval'), 2).state, 'not-met', 'a conversion between other units does not cover it');
  const near = setup(); addWeight(near, 'KG', false);
  assert.equal(check(pkg(run(near), 'interval'), 2).state, 'not-met', 'a case-changed unit is a different unit');
});

test('version ranges behave exactly as the validator does (REQ-045)', () => {
  const ranges = ['^0.1.0', '^0.0.3', '^1.2.0', '~0.1.0', '~1.2.3', '>=0.1.0', '>0.1.0', '<0.2.0', '<=0.1.0', '0.1.0', '>=0.1.0 <0.2.0', '>=1.0.0 <2.0.0', '^0.1', '', 'x', '^0.1.0 ', '>=0.1.0  <0.2.0'];
  const versions = ['0.0.2', '0.0.3', '0.0.4', '0.1.0', '0.1.1', '0.2.0', '1.0.0', '1.2.0', '1.2.3', '1.9.9', '2.0.0', '0.1.0-rc.1', '0.1.0+build', '0.1', 'zero', '', '1.2.3-alpha'];
  let n = 0;
  for (const r of ranges) for (const v of versions) { assert.equal(versionSatisfies(r, v), satisfiesRange(r, v), `${r} / ${v}`); n += 1; }
  assert.ok(n > 250);
  assert.equal(versionSatisfies(undefined, '0.1.0'), false);
});

// -------------------------------------------------------------------------------------------------
// (e) Unknown stays unknown
// -------------------------------------------------------------------------------------------------
test('unknown stays unknown: absent, unknown and not-collected are missing; documented answers are not', () => {
  for (const st of ['absent', 'unknown', 'not-collected']) {
    const c = setState(ctxOf('normal-01-all-enabled'), 'bite-time', st);
    const p = pkg(run(setup({ context: c })), 'interval');
    assert.equal(p.outcome, 'needs-data', st);
    assert.deepEqual(p.missingData.map((m) => [m.key, m.observed]), [['biteTime', [st]]]);
  }
  for (const st of ['not-applicable', 'explicitly-negative']) {
    const c = setState(ctxOf('normal-01-all-enabled'), 'bite-time', st);
    const p = pkg(run(setup({ context: c })), 'interval');
    assert.equal(p.outcome, 'compatible-with-limitations', st);
    assert.deepEqual(p.missingData, []);
  }
  // One answering record among unanswered ones is an answer; two unanswered records are still missing.
  const c = ctxOf('normal-01-all-enabled');
  const bite = c.observations.find((o) => o.concept.id === BITE);
  const extra = clone(bite); extra.id = 'zz-extra'; extra.state = 'unknown'; delete extra.value;
  c.observations.push(extra);
  assert.deepEqual(pkg(run(setup({ context: c })), 'interval').missingData, []);
  const d = ctxOf('normal-01-all-enabled');
  setState(d, 'bite-time', 'unknown');
  const two = clone(d.observations.find((o) => o.concept.id === BITE)); two.id = 'zz-two'; two.state = 'absent';
  d.observations.push(two);
  assert.deepEqual(pkg(run(setup({ context: d })), 'interval').missingData[0].observed, ['absent', 'unknown']);
  // A state that is not one of the known ones is not an answer.
  const e = ctxOf('normal-01-all-enabled');
  setState(e, 'bite-time', 'something-new');
  assert.equal(pkg(run(setup({ context: e })), 'interval').outcome, 'needs-data');
});

test('unknown stays unknown: an entered-in-error record is not in the context and counts as missing', () => {
  const env = envOf('normal-01-all-enabled');
  const o = env.observations.find((x) => x.concept.id === BITE);
  o.status = 'entered-in-error';
  const imp = importEnvelope(env, { held: HELD });
  assert.equal(imp.ok, true);
  assert.equal(imp.context.observations.some((x) => x.id === o.id), false);
  const p = pkg(run(setup({ context: imp.context })), 'interval');
  assert.equal(p.outcome, 'needs-data');
  assert.deepEqual(p.missingData.map((m) => [m.key, m.observed]), [['biteTime', []]]);
});

test('data readiness is not read when checks 1 to 3 are not all met', () => {
  const s = setup({ context: ctxOf('missing-01-no-bite-time') });
  delete interval(s).question;
  const p = pkg(run(s), 'interval');
  assert.equal(check(p, 3).state, 'not-met');
  assert.equal(check(p, 4).state, 'not-evaluable');
  assert.deepEqual(p.missingData, []);
  assert.equal(p.outcome, 'incompatible');
});

// -------------------------------------------------------------------------------------------------
// (f) Execution policy v0
// -------------------------------------------------------------------------------------------------
const entry = (status, over = {}) => ({ outcome: 'compatible', assurance: { status, version: '1.0.0', validation: null, ...over } });
const scope = { version: '1.0.0', population: 'Adults, synthetic.', setting: 'A test ward.', intendedUse: 'Process review.' };

test('policy: preview mode runs every status except rejected and withdrawn, with the banner', () => {
  for (const st of ['draft', 'submitted', 'in-review', 'reviewed', 'deprecated']) {
    const p = executionPolicy(entry(st), { mode: 'preview' });
    assert.equal(p.mayRun, true, st);
    assert.deepEqual(p.banners, [{ id: 'preview-not-validated', text: PREVIEW_BANNER }], st);
  }
  assert.equal(PREVIEW_BANNER, 'Preview. Prototype, synthetic data only, not validated, not for clinical use.');
  for (const st of ['rejected', 'withdrawn']) {
    const p = executionPolicy(entry(st), { mode: 'preview' });
    assert.deepEqual(p, { mayRun: false, banners: [] }, st);
  }
  assert.deepEqual(executionPolicy(entry('draft')), executionPolicy(entry('draft'), { mode: 'preview' }), 'preview is the default');
  assert.equal(executionPolicy(entry('not-a-status'), { mode: 'preview' }).mayRun, false);
});

test('policy: validated shows its whole scope; conditionally validated also shows the conditions notice; reviewed never reads as validated', () => {
  const v = executionPolicy(entry('validated', { validation: scope }), { mode: 'preview' });
  assert.equal(v.mayRun, true);
  assert.deepEqual(v.banners.map((b) => b.id), ['validated-scope']);
  for (const part of ['1.0.0', 'Adults, synthetic.', 'A test ward.', 'Process review.']) assert.ok(v.banners[0].text.includes(part), part);
  const c = executionPolicy(entry('conditionally-validated', { validation: scope }), { mode: 'preview' });
  assert.deepEqual(c.banners.map((b) => b.id), ['conditionally-validated-scope', 'conditions-must-be-shown']);
  assert.ok(c.banners[1].text.includes('conditions'));
  const rev = executionPolicy(entry('reviewed', { validation: scope }), { mode: 'preview' });
  assert.deepEqual(rev.banners.map((b) => b.id), ['preview-not-validated']);
  assert.equal(/\bvalidated\b/i.test(rev.banners[0].text.replace('not validated', '')), false);
  // A validated status whose scope names another version is not credited (REQ-052).
  const other = executionPolicy(entry('validated', { validation: { ...scope, version: '0.9.0' } }), { mode: 'preview' });
  assert.deepEqual(other.banners.map((b) => b.id), ['preview-not-validated']);
  const none = executionPolicy(entry('validated'), { mode: 'preview' });
  assert.deepEqual(none.banners.map((b) => b.id), ['preview-not-validated']);
});

test('policy: governed mode needs a validated status whose scope names the exact version', () => {
  for (const st of ['draft', 'submitted', 'in-review', 'reviewed', 'deprecated', 'withdrawn', 'rejected']) {
    assert.deepEqual(executionPolicy(entry(st, { validation: scope }), { mode: 'governed' }), { mayRun: false, banners: [] }, st);
  }
  assert.equal(executionPolicy(entry('validated', { validation: { ...scope, version: '0.9.0' } }), { mode: 'governed' }).mayRun, false);
  assert.equal(executionPolicy(entry('validated'), { mode: 'governed' }).mayRun, false);
  const ok = executionPolicy(entry('validated', { validation: scope }), { mode: 'governed' });
  assert.equal(ok.mayRun, true);
  assert.deepEqual(ok.banners.map((b) => b.id), ['validated-scope']);
  assert.equal(executionPolicy(entry('conditionally-validated', { validation: scope }), { mode: 'governed' }).banners.length, 2);
  assert.equal(executionPolicy(entry('validated', { validation: scope }), { mode: 'strict' }).mayRun, false);
});

test('policy: only Compatible and Compatible with limitations run, whatever the status', () => {
  for (const [outcome, want] of [['compatible', true], ['compatible-with-limitations', true], ['needs-data', false], ['incompatible', false], ['not-eligible', false], ['made-up', false]]) {
    assert.equal(executionPolicy({ outcome, assurance: { status: 'draft', version: '1.0.0', validation: null } }, { mode: 'preview' }).mayRun, want, outcome);
  }
  assert.deepEqual(executionPolicy(null, {}), { mayRun: false, banners: [] });
});

test('policy end to end: governed mode refuses draft, reviewed and a validation of another version as Not eligible', () => {
  for (const [label, prep] of [
    ['draft', () => {}],
    ['reviewed', (d) => { valid(d, 'reviewed'); }],
    ['another version', (d) => { valid(d, 'validated', '0.1.0'); }],
  ]) {
    const s = noParams(setup({ request: { mode: 'governed' } }));
    prep(interval(s));
    const p = pkg(run(s), 'interval');
    assert.equal(p.outcome, 'not-eligible', label);
    assert.equal(p.policy.mayRun, false, label);
    assert.ok(reasons(p).some((x) => x === 'CMP-6-03' || x === 'CMP-6-04'), label);
  }
  const s = noParams(setup({ request: { mode: 'governed' } }));
  valid(interval(s), 'validated');
  const p = pkg(run(s), 'interval');
  assert.equal(p.outcome, 'compatible');
  assert.equal(p.policy.mayRun, true);
  assert.equal(p.policy.banners[0].id, 'validated-scope');
  // Preview mode on a draft package: runs, with the banner and the limitation for the disabled parameters.
  const d = pkg(run(setup()), 'interval');
  assert.equal(d.policy.mayRun, true);
  assert.equal(d.policy.banners[0].text, PREVIEW_BANNER);
  // Needs data does not run, even in preview (listed with what is missing, not executed).
  assert.equal(pkg(run(setup({ context: null })), 'interval').policy.mayRun, false);
  // Deprecated runs in preview with a limitation.
  const dep = noParams(setup());
  interval(dep).manifest.status = 'deprecated';
  const q = pkg(run(dep), 'interval');
  assert.equal(q.outcome, 'compatible-with-limitations');
  assert.equal(q.policy.mayRun, true);
  // Nothing here claims clinical safety or recommends anything.
  assert.equal(/recommend|safe|should/i.test(JSON.stringify(q.policy)), false);
});

// -------------------------------------------------------------------------------------------------
// (g) Determinism, no mutation, purity
// -------------------------------------------------------------------------------------------------
test('determinism: same bytes twice; held order and context record order do not matter', () => {
  const a = JSON.stringify(run(setup()));
  assert.equal(JSON.stringify(run(setup())), a);
  const s = setup();
  s.held.reverse();
  s.context.observations.reverse();
  s.context.events.reverse();
  assert.equal(JSON.stringify(run(s)), a);
  const t = setup({ context: ctxOf('missing-05-no-clotting-status') });
  const b = JSON.stringify(run(t));
  t.held.reverse();
  t.context.observations.reverse();
  assert.equal(JSON.stringify(run(t)), b);
  // With two held versions in range the highest is used, whatever the order.
  const v = setup();
  const older = clone(interval(v)); older.manifest.version = '0.1.0';
  v.held.push(older);
  const x = pkg(run(v), 'interval');
  assert.equal(x.ref.version, '0.1.1');
  v.held.reverse();
  assert.equal(JSON.stringify(run(v)), JSON.stringify(run(JSON.parse(JSON.stringify(v)))));
  assert.equal(pkg(run(v), 'interval').ref.version, '0.1.1');
});

test('the version the context applies is the one used, when it is held and in range', () => {
  const s = setup();
  const older = clone(element(s)); older.manifest.version = '0.1.0';
  const newer = clone(element(s)); newer.manifest.version = '0.1.1';
  s.held = [older, newer, s.pathway, interval(s), complete(s)];
  // The context applies 0.1.0 (held): it is used, and it matches. Highest-in-range alone would have given a false mismatch.
  const r = run(s);
  assert.equal(check(pkg(r, 'interval'), 2).state, 'met');
  assert.equal(check(r.pathway, 2).state, 'met');
});

test('no input is changed: frozen inputs give the same result and nothing throws', () => {
  const plain = JSON.stringify(run(setup()));
  const s = setup();
  deepFreeze(s);
  assert.equal(JSON.stringify(run(s)), plain);
  const n = setup({ context: ctxOf('emr-demo-case'), request: { mode: 'governed' } });
  deepFreeze(n);
  assert.doesNotThrow(() => run(n));
  const before = JSON.stringify(setup());
  const m = setup();
  run(m);
  assert.equal(JSON.stringify(m), before, 'the caller\'s objects are unchanged');
});

test('garbage in never throws and never gives a runnable outcome', () => {
  for (const input of [undefined, null, {}, { pathway: 'x' }, { pathway: PATHWAY }, { pathway: PATHWAY, held: 'x', context: 5, runtime: 'x', request: 7 }]) {
    let r;
    assert.doesNotThrow(() => { r = resolveCompatibility(input); });
    assert.equal(r.pathway.policy.mayRun, false);
    for (const p of r.packages) assert.equal(p.policy.mayRun, false);
    assert.notEqual(r.pathway.outcome, 'compatible');
  }
});

test('purity: the library imports only the validators bundle and the importer, and reads nothing from outside', () => {
  const src = readFileSync(new URL('../ccis-compat.js', import.meta.url), 'utf8');
  const code = src.replace(/^\s*\/\/.*$/gm, '');
  const imports = [...code.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['./ccis-import.js', './ccis/validators/ccis-validators.js']);
  for (const bad of [/\bDate\b/, /Math\.random/, /\bfetch\b/, /XMLHttpRequest/, /node:/, /readFile/, /\beval\b/, /new Function/, /\bimport\(/, /\bprocess\b/, /localStorage/, /\brequire\b/, /structuredClone/]) {
    assert.equal(bad.test(code), false, String(bad));
  }
});

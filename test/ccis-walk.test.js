import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importEnvelope } from '../ccis-import.js';
import { loadDemo } from '../ccis-demo-loader.js';
import { evaluatePathway } from '../ccis-demo-pathway.js';
import { walkPathway, WALK_REFUSALS, WALKER_VERSION } from '../ccis-walk.js';
import { runResult } from '../ccis/validators/ccis-validators.js';

const ex = new URL('../ccis/examples/snake/', import.meta.url);
const fx = new URL('../ccis/fixtures/snake/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const exa = (f) => read(new URL(f, ex));
const clone = (x) => JSON.parse(JSON.stringify(x));
const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };

const PATH = exa('snake-documentation.pathway.json');
const CLOT = 'clotting-test-documented';
const ANTI = 'antivenom-documented';
const index = read(new URL('index.json', fx));
const caseOf = (name) => index.cases.find((x) => x.case.startsWith(name));
const envOf = (name) => { const c = caseOf(name); return read(new URL(`${c.class}/${c.case}.envelope.json`, fx)); };
const held = () => [exa('snake-envenomation.element.json'), PATH];
const ctxOf = (env) => { const r = importEnvelope(env, { held: held() }); assert.equal(r.ok, true); return r.context; };
const ctx = (name) => ctxOf(envOf(name));
const concept = (key) => `snake.envenomation-timing.${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;
const find = (c, key) => c.observations.find((o) => o.concept.id === concept(key));
const walk = (context, pathway = PATH) => walkPathway({ pathway, context });
const by = (r) => Object.fromEntries(r.results.map((x) => [x['x-node'], x]));
const refusedWith = (r, id) => {
  assert.equal(r.ok, false);
  assert.equal('route' in r || 'results' in r || 'trace' in r, false, 'a refusal carries no route, results or trace');
  assert.equal(r.refusal.id, id, JSON.stringify(r.refusal));
  assert.equal(r.refusal.meaning, WALK_REFUSALS.find((x) => x.id === id).meaning);
};
const mut = (f) => { const p = clone(PATH); f(p); return p; };

// =============================================================================================
// (a) The oracle: 32 cases plus the EMR export
// =============================================================================================

test('(a) oracle: every case takes the expected route, and its results equal the demo walker on the same accepted records', () => {
  const pk = { element: exa('snake-envenomation.element.json'), binding: exa('snake-demo-terminology.binding.json'), pathway: PATH, nodes: [exa('snake-node-clotting.node.json'), exa('snake-node-antivenom.node.json')], analytics: [exa('snake-interval.analytics.json'), exa('snake-completeness.analytics.json')] };
  const cases = [...index.cases.map((c) => ({ name: c.case, env: read(new URL(`${c.class}/${c.case}.envelope.json`, fx)), want: read(new URL(`${c.class}/${c.case}.expected.json`, fx)) })),
    { name: 'emr-export', env: read(new URL('emr-export/emr-demo-case.envelope.json', fx)), want: read(new URL('emr-export/emr-demo-case.expected.json', fx)) }];
  assert.equal(cases.length, 33, '32 fixture cases plus the EMR export');
  for (const { name, env, want } of cases) {
    const r = walk(ctxOf(env));
    assert.equal(r.ok, true, name);
    assert.deepEqual(r.route, want.pathwayRoute, name);
    const demo = evaluatePathway(PATH, loadDemo(pk, env).envelope);
    assert.deepEqual(r.results, demo.results, name);
    assert.equal(r.results.length, r.route.filter((s) => s.node).length, name);
    assert.equal(r.trace.length, r.results.length, name);
    for (const x of r.results) assert.equal(runResult(x), true, JSON.stringify(runResult.errors));
  }
});

// =============================================================================================
// (b) Hand-written behaviour
// =============================================================================================

test('(b) every epistemic state of the clotting status takes its own outcome, and none is read as false or documented', () => {
  for (const [name, outcome] of [['missing-05', 'nothing-recorded'], ['missing-08', 'status-unknown'], ['conflicting-03', 'records-conflict'], ['out-of-scope-02', 'documented-not-performed'], ['normal-01', 'result-documented']]) {
    assert.equal(by(walk(ctx(name)))[CLOT]['x-outcome'], outcome, name);
  }
  const nc = ctx('missing-08');
  find(nc, 'clottingTestStatus').state = 'not-collected';
  const r = walk(nc);
  assert.equal(by(r)[CLOT]['x-outcome'], 'status-not-collected');
  assert.equal(by(r)[CLOT].state, 'indeterminate');
  assert.deepEqual(r.route.at(-1), { stage: 'gap-report' });
});

test('(b) no outcome matches: indeterminate, outcome null, the route stops at the report stage (D-053)', () => {
  const c = ctx('normal-01');
  const o = find(c, 'clottingResultReadTime');
  delete o.value; o.state = 'not-collected';
  const r = walk(c);
  assert.equal(r.ok, true);
  const x = by(r)[CLOT];
  assert.equal(x.state, 'indeterminate');
  assert.equal(x['x-outcome'], null);
  assert.equal('value' in x, false);
  assert.deepEqual(r.route, [{ stage: 'presentation' }, { stage: 'clotting-documentation', node: CLOT, outcome: null }, { stage: 'gap-report' }]);
  assert.equal(r.results.length, 1, 'the antivenom node is not evaluated after an unmatched branch');
  assert.equal(r.trace[0].taken, null);
  assert.ok(r.trace[0].outcomes.every((t) => t.matched === false));
});

test('(b) two matching outcomes refuse the whole pathway', () => {
  const p = mut((x) => x.nodes[0].outcomes.push({ id: 'duplicate', kind: 'answer', when: [{ input: 'clottingTestStatus', is: 'present' }, { input: 'readTime', is: 'present' }, { input: 'result', is: 'present' }], next: { stage: 'antivenom-documentation' } }));
  refusedWith(walk(ctx('normal-01'), p), 'W-007');
});

test('(b) two agreeing records are still conflicting; the pathway tests records only (D-018)', () => {
  const c = ctx('normal-01');
  c.observations.push({ ...clone(find(c, 'clottingTestStatus')), id: 'dup-status' });
  const x = by(walk(c))[CLOT];
  assert.equal(x.state, 'conflict');
  assert.deepEqual(x.warnings, ['Two records disagree about clotting test status.']);
  for (const name of ['conflicting-01', 'conflicting-02']) assert.deepEqual(by(walk(ctx(name)))[CLOT].value, { label: 'result-documented' }, name);
});

test('(b) record order does not matter: a shuffled context gives the same bytes', () => {
  for (const name of ['normal-01', 'conflicting-03', 'missing-06']) {
    const c = ctx(name);
    const s = clone(c); s.observations.reverse();
    assert.equal(JSON.stringify(walk(s)), JSON.stringify(walk(c)), name);
  }
});

test('(b) out of scope is not-applicable: never a value, never missing', () => {
  for (const [name, node, outcome] of [['out-of-scope-01', ANTI, 'documented-not-given'], ['out-of-scope-02', CLOT, 'documented-not-performed']]) {
    const x = by(walk(ctx(name)))[node];
    assert.equal(x['x-outcome'], outcome);
    assert.equal(x.state, 'not-applicable');
    assert.equal('value' in x, false);
    assert.equal(x.missingDataNotes.length, 0);
  }
});

test('(b) missing-data outcomes give needs-data with the outcome note and the route goes on', () => {
  const r = walk(ctx('missing-06'));
  assert.equal(by(r)[CLOT].state, 'needs-data');
  assert.deepEqual(by(r)[CLOT].missingDataNotes, ['Flagged: no read time is documented']);
  assert.deepEqual(r.route.at(-1), { end: true });
});

// =============================================================================================
// (c) The rule trace
// =============================================================================================

const summary = (t) => ({ inputs: t.inputs.map((i) => [i.key, i.state, i.records, i.recordIds]), taken: t.taken, bits: t.outcomes.map((o) => `${o.id}:${o.matched}:${o.tests.map((x) => (x.passed ? 1 : 0)).join('')}`) });
const ORDER = ['result-documented', 'result-without-read-time', 'read-time-without-result', 'no-result-no-read-time', 'documented-not-performed', 'records-conflict', 'nothing-recorded', 'status-unknown', 'status-not-collected'];

test('(c) hand-written traces: a normal, a missing and a conflicting case (clotting node)', () => {
  assert.deepEqual(summary(walk(ctx('normal-01')).trace[0]), {
    inputs: [['clottingTestStatus', 'present', 1, ['o4']], ['readTime', 'present', 1, ['o6']], ['result', 'present', 1, ['o7']]],
    taken: 'result-documented',
    bits: ['result-documented:true:111', 'result-without-read-time:false:101', 'read-time-without-result:false:110', 'no-result-no-read-time:false:100', 'documented-not-performed:false:0', 'records-conflict:false:0', 'nothing-recorded:false:0', 'status-unknown:false:0', 'status-not-collected:false:0'],
  });
  assert.deepEqual(summary(walk(ctx('missing-06')).trace[0]), {
    inputs: [['clottingTestStatus', 'present', 1, ['o4']], ['readTime', 'absent', 0, []], ['result', 'present', 1, ['o6']]],
    taken: 'result-without-read-time',
    bits: ['result-documented:false:101', 'result-without-read-time:true:111', 'read-time-without-result:false:100', 'no-result-no-read-time:false:110', 'documented-not-performed:false:0', 'records-conflict:false:0', 'nothing-recorded:false:0', 'status-unknown:false:0', 'status-not-collected:false:0'],
  });
  assert.deepEqual(summary(walk(ctx('conflicting-03')).trace[0]), {
    inputs: [['clottingTestStatus', 'conflicting', 2, ['o4', 'o5']], ['readTime', 'present', 1, ['o7']], ['result', 'present', 1, ['o8']]],
    taken: 'records-conflict',
    bits: ['result-documented:false:011', 'result-without-read-time:false:001', 'read-time-without-result:false:010', 'no-result-no-read-time:false:000', 'documented-not-performed:false:0', 'records-conflict:true:1', 'nothing-recorded:false:0', 'status-unknown:false:0', 'status-not-collected:false:0'],
  });
});

test('(c) every outcome is listed in package order, each with its tests in package order', () => {
  const t = walk(ctx('normal-01')).trace[0];
  assert.deepEqual(t.outcomes.map((o) => o.id), ORDER);
  assert.deepEqual(t.outcomes.map((o) => o.id), PATH.nodes[0].outcomes.map((o) => o.id));
  assert.deepEqual(t.outcomes[0].tests[0], { input: 'clottingTestStatus', is: 'present', found: 'present', passed: true });
});

test('(c) the trace holds states, counts and ids only: no record value appears anywhere in the output', () => {
  const c = ctx('normal-01');
  find(c, 'clottingResult').value = { system: 'ccis-demo', code: 'ZZSENTINELZZ', verification: 'unverified' };
  find(c, 'clottingTestStartTime').value = { value: 'ZZSENTINELZZ', zone: 'unknown' };
  const text = JSON.stringify(walk(c));
  assert.equal(text.includes('ZZSENTINELZZ'), false);
});

// =============================================================================================
// (d) Refusals
// =============================================================================================

test('(d) every refusal id is reached once, with a fixed sentence and nothing echoed', () => {
  assert.deepEqual(WALK_REFUSALS.map((x) => x.id), ['W-001', 'W-002', 'W-003', 'W-004', 'W-005', 'W-006', 'W-007', 'W-008']);
  const c = ctx('normal-01');
  const reached = new Map();
  const note = (r, id) => { refusedWith(r, id); reached.set(id, (reached.get(id) ?? 0) + 1); };
  note(walkPathway({}), 'W-001');
  note(walk(c, { hostile: '<img onerror=alert(1)>' }), 'W-001');
  note(walk({ contextForm: 'other/1', observations: [] }), 'W-002');
  note(walk(null), 'W-002');
  note(walk(c, mut((p) => { p.stages[1].id = 'presentation'; })), 'W-003');
  note(walk(c, mut((p) => { p.nodes[0].outcomes[0].next = { stage: 'nowhere' }; })), 'W-004');
  note(walk(c, mut((p) => { p.nodes[0].outcomes[0].when[0].input = 'nothing'; })), 'W-004');
  note(walk(c, mut((p) => { p.transitions[1].via = 'no-such-node'; })), 'W-004');
  note(walk(c, mut((p) => { p.nodes[0].inputs[0].element = 'snake.other'; })), 'W-004');
  note(walk(c, mut((p) => { p.transitions.push({ from: 'clotting-documentation', to: 'gap-report' }); })), 'W-005');
  note(walk(c, mut((p) => { p.transitions.find((t) => t.from === 'clotting-documentation').via = ANTI; })), 'W-005');
  note(walk(ctx('missing-05'), mut((p) => { p.transitions.push({ from: 'gap-report', to: 'presentation' }); })), 'W-006');
  note(walk(c, mut((p) => p.nodes[0].outcomes.push({ id: 'duplicate', kind: 'answer', when: [{ input: 'clottingTestStatus', is: 'present' }], next: { stage: 'antivenom-documentation' } }))), 'W-007');
  note(walk(c, mut((p) => { p.nodes[0].outcomes[0].next = { stage: 'gap-report' }; p.transitions = p.transitions.filter((t) => !(t.from === 'clotting-documentation' && t.to === 'gap-report')); })), 'W-008');
  assert.deepEqual([...reached.keys()].sort(), WALK_REFUSALS.map((x) => x.id));
  assert.equal(JSON.stringify(walk(c, { hostile: 'ZZSENTINELZZ' })).includes('ZZSENTINELZZ'), false);
});

// =============================================================================================
// (e) Purity and determinism
// =============================================================================================

test('(e) the module is pure: it imports only the validators', () => {
  const src = readFileSync(new URL('../ccis-walk.js', import.meta.url), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const imports = [...code.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['./ccis/validators/ccis-validators.js']);
  for (const banned of [/\beval\s*\(/, /\bnew Function\b/, /\bFunction\s*\(/, /\bimport\s*\(/, /\bDate\b/, /Math\.random/, /\bprocess\b/, /\bfs\b/, /\brequire\b/, /\bfetch\s*\(/, /setTimeout/, /performance\./, /crypto\.random/]) {
    assert.equal(banned.test(code), false, String(banned));
  }
});

test('(e) same input gives identical bytes; the context and pathway are not changed', () => {
  const c = deepFreeze(ctx('missing-05'));
  const p = deepFreeze(clone(PATH));
  const a = JSON.stringify(walk(c, p));
  assert.equal(JSON.stringify(walk(c, p)), a);
  assert.equal(JSON.parse(a).ok, true);
});

test('(e) the nodes embedded in the pathway equal the node files; the version is labelled', () => {
  assert.deepEqual(PATH.nodes, [exa('snake-node-clotting.node.json'), exa('snake-node-antivenom.node.json')]);
  assert.equal(WALKER_VERSION, '0.1.0');
});

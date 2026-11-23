import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluatePathway } from '../ccis-demo-pathway.js';
import { loadDemo } from '../ccis-demo-loader.js';
import { runResult } from '../ccis/validators/ccis-validators.js';

const ex = new URL('../ccis/examples/snake/', import.meta.url);
const fx = new URL('../ccis/fixtures/snake/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const exa = (f) => read(new URL(f, ex));
const clone = (x) => JSON.parse(JSON.stringify(x));
const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };

const PATH = exa('snake-documentation.pathway.json');
const index = read(new URL('index.json', fx));
const caseFile = (name, kind) => { const c = index.cases.find((x) => x.case.startsWith(name)); return read(new URL(`${c.class}/${c.case}.${kind}.json`, fx)); };
const env = (name) => caseFile(name, 'envelope');
const concept = (key) => `snake.envenomation-timing.${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;
const find = (e, key) => e.observations.find((o) => o.concept.id === concept(key));
const run = (e, p = PATH) => evaluatePathway(p, e);
const by = (r) => Object.fromEntries(r.results.map((x) => [x['x-node'], x]));
const CLOT = 'clotting-test-documented';
const ANTI = 'antivenom-documented';
const refused = (r, text) => {
  assert.equal(r.ok, false);
  assert.equal('results' in r || 'route' in r, false, 'a refusal carries no route and no results');
  assert.ok(r.refusal.includes(text), r.refusal);
};

test('source: header label, and no clock, randomness, network, file access, eval or dynamic import', () => {
  const src = readFileSync(new URL('../ccis-demo-pathway.js', import.meta.url), 'utf8');
  assert.ok(src.startsWith('// DEMO RUNNER: replaced by rows 2.x and 3.x.'));
  const code = src.replace(/^\/\/.*$/gm, '');
  for (const bad of [/new Date/, /Date\.now/, /Math\.random/, /\bfetch\b/, /XMLHttpRequest/, /node:fs/, /readFile/, /\beval\b/, /new Function/, /\bimport\(/, /\bprocess\b/, /localStorage/]) {
    assert.equal(bad.test(code), false, String(bad));
  }
});

test('oracle: every fixture case, through the loader, takes the hand-calculated route and every result validates', () => {
  assert.ok(index.cases.length >= 32);
  for (const c of index.cases) {
    const want = read(new URL(`${c.class}/${c.case}.expected.json`, fx));
    const loaded = loadDemo({ element: exa('snake-envenomation.element.json'), binding: exa('snake-demo-terminology.binding.json'), pathway: PATH, nodes: [exa('snake-node-clotting.node.json'), exa('snake-node-antivenom.node.json')], analytics: [exa('snake-interval.analytics.json'), exa('snake-completeness.analytics.json')] }, read(new URL(`${c.class}/${c.case}.envelope.json`, fx)));
    assert.equal(loaded.ok, true, c.case);
    const r = run(loaded.envelope);
    assert.equal(r.ok, true, `${c.case}: ${r.refusal}`);
    assert.deepEqual(r.route, want.pathwayRoute, c.case);
    assert.equal(r.results.length, r.route.filter((s) => s.node).length, c.case);
    for (const x of r.results) assert.equal(runResult(x), true, JSON.stringify(runResult.errors));
  }
});

test('the node files equal the nodes embedded in the pathway', () => {
  assert.deepEqual(PATH.nodes, [exa('snake-node-clotting.node.json'), exa('snake-node-antivenom.node.json')]);
});

test('indeterminate outcomes route to the gap report, carry a state and never a value', () => {
  for (const [name, node, outcome] of [['missing-03', ANTI, 'nothing-recorded'], ['missing-05', CLOT, 'nothing-recorded'], ['missing-08', CLOT, 'status-unknown'], ['missing-10', ANTI, 'status-unknown']]) {
    const r = run(env(name));
    const x = by(r)[node];
    assert.equal(x['x-outcome'], outcome, name);
    assert.equal(x.state, 'indeterminate', name);
    assert.equal('value' in x, false, name);
    assert.deepEqual(r.route.at(-1), { stage: 'gap-report' }, name);
    assert.equal(x.missingDataNotes.length > 0, true, name);
  }
});

test('missing-data outcomes give needs-data with the outcome note and the path goes on', () => {
  const r = run(env('missing-06'));
  const x = by(r)[CLOT];
  assert.equal(x.state, 'needs-data');
  assert.deepEqual(x.missingDataNotes, ['Flagged: no read time is documented']);
  assert.deepEqual(r.route.at(-1), { end: true });
  const r2 = run(env('missing-04'));
  assert.equal(by(r2)[ANTI].state, 'needs-data');
  assert.deepEqual(r2.route.at(-1), { stage: 'gap-report' });
});

test('conflicting records give conflict with a warning and route to the gap report', () => {
  const r = run(env('conflicting-03'));
  const x = by(r)[CLOT];
  assert.equal(x.state, 'conflict');
  assert.deepEqual(x.warnings, ['Two records disagree about clotting test status.']);
  assert.equal('value' in x, false);
  assert.deepEqual(r.route.at(-1), { stage: 'gap-report' });
});

test('the pathway tests records only (D-018): a time conflict is not seen here, the analytics see it', () => {
  for (const name of ['conflicting-01', 'conflicting-02']) {
    const r = run(env(name));
    assert.deepEqual(by(r)[CLOT].value, { label: 'result-documented' }, name);
    assert.deepEqual(by(r)[ANTI].value, { label: 'given-time-documented' }, name);
  }
});

test('out-of-scope cases are reported as out of scope: not-applicable, never a value, never missing', () => {
  for (const [name, node, outcome] of [['out-of-scope-01', ANTI, 'documented-not-given'], ['out-of-scope-02', CLOT, 'documented-not-performed']]) {
    const r = run(env(name));
    const x = by(r)[node];
    assert.equal(x['x-outcome'], outcome);
    assert.equal(x.state, 'not-applicable');
    assert.equal('value' in x, false);
    assert.equal(x.missingDataNotes.length, 0);
    assert.ok(x.warnings[0].includes('out of scope'));
  }
});

test('every epistemic state of the clotting status takes its own outcome, and none is read as false or documented', () => {
  const table = [['missing-05', 'nothing-recorded'], ['missing-08', 'status-unknown'], ['conflicting-03', 'records-conflict'], ['out-of-scope-02', 'documented-not-performed'], ['normal-01', 'result-documented']];
  for (const [name, outcome] of table) assert.equal(by(run(env(name)))[CLOT]['x-outcome'], outcome, name);
  const nc = env('missing-08');
  find(nc, 'clottingTestStatus').state = 'not-collected';
  const r = run(nc);
  assert.equal(by(r)[CLOT]['x-outcome'], 'status-not-collected');
  assert.equal(by(r)[CLOT].state, 'indeterminate');
  assert.deepEqual(r.route.at(-1), { stage: 'gap-report' });
  const eie = env('normal-01');
  find(eie, 'clottingTestStatus').status = 'entered-in-error';
  assert.equal(by(run(eie))[CLOT]['x-outcome'], 'nothing-recorded', 'an entered-in-error record is ignored, not read as present');
});

test('a record state no outcome covers stops the route: indeterminate, outcome null, never as documented (D-053)', () => {
  const e = env('normal-01');
  const o = find(e, 'clottingResultReadTime');
  delete o.value; o.state = 'not-collected';
  const r = run(e);
  assert.equal(r.ok, true);
  const x = by(r)[CLOT];
  assert.equal(x.state, 'indeterminate');
  assert.equal(x['x-outcome'], null);
  assert.equal('value' in x, false);
  assert.deepEqual(r.route, [{ stage: 'presentation' }, { stage: 'clotting-documentation', node: CLOT, outcome: null }, { stage: 'gap-report' }]);
  assert.equal(r.results.length, 1, 'the antivenom node is not evaluated after an unmatched branch');
});

test('the evaluator is pure: same input, byte-identical output, and the inputs are not changed', () => {
  const e = deepFreeze(env('missing-05'));
  const p = deepFreeze(clone(PATH));
  const a = JSON.stringify(run(e, p));
  assert.equal(JSON.stringify(run(e, p)), a);
});

test('bad input is refused with a fixed sentence and no content echoed', () => {
  refused(run({ hostile: '<img onerror=alert(1)>' }), 'does not conform to the context envelope schema');
  refused(run(env('normal-01'), { hostile: '<img onerror=alert(1)>' }), 'does not conform to its schema');
  refused(run(null), 'does not conform to the context envelope schema');
  const e = env('normal-01');
  e.observations[0].value = '<script>alert(1)</script>';
  const r = run(e);
  if (!r.ok) assert.equal(r.refusal.includes('script'), false);
});

test('malformed pathways are refused whole, with no partial route', () => {
  const mut = (f) => { const p = clone(PATH); f(p); return p; };
  refused(run(env('normal-01'), mut((p) => { p.nodes[0].outcomes[0].next = { stage: 'nowhere' }; })), 'a stage the pathway does not declare');
  refused(run(env('normal-01'), mut((p) => { p.nodes[0].outcomes[0].when[0].input = 'nothing'; })), 'an input the node does not declare');
  refused(run(env('normal-01'), mut((p) => { p.transitions[1].via = 'no-such-node'; })), 'a node the pathway does not declare');
  refused(run(env('missing-05'), mut((p) => { p.transitions.push({ from: 'gap-report', to: 'presentation' }); })), 'loop back');
  refused(run(env('normal-01'), mut((p) => { p.stages[1].id = 'presentation'; })), 'share an id');
  refused(run(env('normal-01'), mut((p) => { p.nodes[0].inputs[0].element = 'snake.other'; })), 'an element the pathway does not list');
  refused(run(env('normal-01'), mut((p) => { p.nodes[0].outcomes[0].next = { stage: 'gap-report' }; p.transitions = p.transitions.filter((t) => !(t.from === 'clotting-documentation' && t.to === 'gap-report')); })), 'no transition allows');
});

test('two outcomes matching the same record refuse the pathway', () => {
  const p = clone(PATH);
  p.nodes[0].outcomes.push({ id: 'duplicate', kind: 'answer', when: [{ input: 'clottingTestStatus', is: 'present' }], next: { stage: 'antivenom-documentation' } });
  refused(run(env('normal-01'), p), 'more than one outcome');
});

test('no outcome id or note carries an action, order or number (descriptive only)', () => {
  const r = run(env('missing-06'));
  const text = JSON.stringify(r.results);
  for (const bad of [/\border\b/i, /\badminister\b/i, /\bgive\b/i, /\brecommend/i, /\bshould\b/i, /\bmust\b/i]) assert.equal(bad.test(text), false, String(bad));
});

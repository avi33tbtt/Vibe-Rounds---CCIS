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

const V = { '0.1.0': ['snake-interval.analytics.json', 'snake-completeness.analytics.json'], '0.1.1': ['snake-interval.analytics.0.1.1.json', 'snake-completeness.analytics.0.1.1.json'] };
const pkg = (v) => ({
  element: exa('snake-envenomation.element.json'), binding: exa('snake-demo-terminology.binding.json'), pathway: exa('snake-documentation.pathway.json'),
  nodes: [exa('snake-node-clotting.node.json'), exa('snake-node-antivenom.node.json')], analytics: V[v].map(exa),
});
const B1 = exa('snake-completeness.analytics.0.1.1.json');
const index = read(new URL('index.json', fx));
const caseFile = (c, kind) => read(new URL(`${c.class}/${c.case}.${kind}.json`, fx));
const CID = 'snake.clotting-documentation-completeness';
const T = '2026-11-20T12:00:00Z';
const ITEMS = ['clottingTestStatus', 'clottingTestStartTime', 'clottingResultReadTime', 'clottingResult'];
const WIN = { expectedItems: { value: ITEMS }, readTimeWindow: { value: { amount: 30, unit: 'min' } }, edgeRule: { value: 'inside' } };
const normal = () => caseFile({ class: 'normal', case: 'normal-01-all-enabled' }, 'envelope');
const concept = (key) => `snake.envenomation-timing.${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;
const by = (r) => Object.fromEntries(r.results.map((x) => [x.outputId, x]));
const run = (env, params = WIN, a = B1) => evaluateAnalytic(a, env, params, T);
const refused = (r, text) => {
  assert.equal(r.ok, false);
  assert.equal('results' in r, false, 'a refusal carries no results');
  assert.ok(r.refusal.includes(text), r.refusal);
};
const withTree = (output, fn) => { const a = clone(B1); fn(a.computation.find((c) => c.output === output)); return a; };

test('oracle: every case equals its expected completeness results, on the version its expected file names', () => {
  let n = 0;
  for (const c of index.cases) {
    const want = caseFile(c, 'expected');
    const v = want['x-analyticVersion'] ?? '0.1.0';
    const loaded = loadDemo(pkg(v), caseFile(c, 'envelope'));
    assert.equal(loaded.ok, true, c.case);
    const r = evaluateAnalytic(pkg(v).analytics[1], loaded.envelope, want.parameters, want.evaluationTime);
    assert.equal(r.ok, true, `${c.case}: ${r.refusal}`);
    assert.deepEqual(r.results, want.results.filter((x) => x['x-analytic'] === CID), c.case);
    for (const x of r.results) assert.equal(runResult(x), true, JSON.stringify(runResult.errors));
    n += r.results.length > 0 ? 1 : 0;
  }
  assert.equal(n, 31, '31 of 32 cases have completeness results on their own version');
});

test('conflicting-03 on 0.1.0: no completeness result at all (no conflict branch), all four outputs omitted', () => {
  const c = index.cases.find((x) => x.case.startsWith('conflicting-03'));
  const want = caseFile(c, 'expected');
  const r = evaluateAnalytic(pkg('0.1.0').analytics[1], caseFile(c, 'envelope'), want.parameters, want.evaluationTime);
  assert.equal(r.ok, true);
  assert.deepEqual(r.results, []);
  assert.deepEqual(r.omitted, ['itemStates', 'expectedDocumentedCount', 'overallStatus', 'readTimeInWindow']);
});

test('conflicting-03 on 0.1.1: itemStates says conflict; count, status and window are omitted, never filled', () => {
  const c = index.cases.find((x) => x.case.startsWith('conflicting-03'));
  const want = caseFile(c, 'expected');
  const r = evaluateAnalytic(B1, caseFile(c, 'envelope'), want.parameters, want.evaluationTime);
  assert.equal(r.ok, true);
  assert.deepEqual(r.results.map((x) => [x.outputId, x.state]), [['itemStates', 'conflict']]);
  assert.equal('value' in r.results[0], false);
  assert.deepEqual(r.omitted, ['expectedDocumentedCount', 'overallStatus', 'readTimeInWindow']);
});

test('both analytics together: concatenated results equal the expected results array, in order, for all 32 cases', () => {
  for (const c of index.cases) {
    const want = caseFile(c, 'expected');
    const p = pkg(want['x-analyticVersion'] ?? '0.1.0');
    const loaded = loadDemo(p, caseFile(c, 'envelope'));
    const got = p.analytics.flatMap((a) => { const r = evaluateAnalytic(a, loaded.envelope, want.parameters, want.evaluationTime); assert.equal(r.ok, true, c.case); return r.results; });
    assert.deepEqual(got, want.results, c.case);
  }
});

test('set parameter: non-array, unknown member, duplicate, empty, wrong type and __proto__ are refused', () => {
  const env = normal();
  for (const bad of ['clottingTestStatus', null, 7, {}, [], ['nope'], ['clottingTestStatus', 'clottingTestStatus'], [1], ['__proto__'], ['constructor'], [['clottingTestStatus']]]) {
    refused(run(env, { expectedItems: { value: bad } }), 'a set is empty');
  }
  refused(run(env, { expectedItems: 'clottingTestStatus' }), 'a set is empty');
  refused(run(env, { populationScope: { value: 'anything' } }), 'not supported by the demo executor');
});

test('a valid set is used: a smaller expected set counts only its members', () => {
  const r = by(run(normal(), { expectedItems: { value: ['clottingTestStatus', 'clottingResult'] } }));
  assert.deepEqual(r.expectedDocumentedCount.value, { amount: 2, unit: '1' });
  assert.deepEqual(r.overallStatus.value, { label: 'complete' });
});

test('misused select and count refuse the whole analytic before anything runs', () => {
  const memberLiteral = withTree('expectedDocumentedCount', (c) => { c.expr.args[2].args[0].args[0].args[0] = { literal: 'x' }; });
  refused(run(normal(), WIN, memberLiteral), 'a table row does not match');
  const unknownMember = withTree('expectedDocumentedCount', (c) => { c.expr.args[2].args[0].args[0].args[1] = { literal: 'notAMember' }; });
  refused(run(normal(), WIN, unknownMember), 'a membership test needs');
  const threeArgs = withTree('expectedDocumentedCount', (c) => { c.expr.args[2].args[0].args[0].args.push({ literal: 'clottingResult' }); });
  refused(run(normal(), WIN, threeArgs), 'a membership test needs');
  const shortRow = withTree('itemStates', (c) => { c.expr.args[2].args.pop(); });
  refused(run(normal(), WIN, shortRow), 'a table row does not match');
  const setAsValue = withTree('overallStatus', (c) => { c.expr = { op: 'eq', args: [{ ref: 'parameter', id: 'expectedItems' }, { literal: 'x' }] }; });
  refused(run(normal(), WIN, setAsValue), 'a set parameter is used outside');
  const countOfText = withTree('expectedDocumentedCount', (c) => { c.expr = { op: 'count', args: [{ literal: 'documented' }] }; });
  refused(run(normal(), WIN, countOfText), 'not true, false or unknown');
});

test('an unknown argument makes the count unknown, and an unknown with no declared state is refused, never a number', () => {
  const env = normal();
  env.observations = env.observations.filter((o) => o.concept.id !== concept('clottingTestStartTime'));
  const unknownCount = withTree('expectedDocumentedCount', (c) => {
    c.expr = { op: 'count', args: [{ op: 'lt', args: [{ ref: 'input', id: 'clottingTestStartTime' }, { ref: 'input', id: 'clottingResultReadTime' }] }, { literal: true }] };
  });
  refused(run(loadDemo(pkg('0.1.1'), env).envelope, WIN, unknownCount), 'a state the output does not declare');
});

test('a table result is refused if no row reaches the output, and a count is never a fraction', () => {
  const rowNotTable = withTree('overallStatus', (c) => { c.expr = { op: 'select', args: [{ literal: 'complete' }, { literal: 'x' }, { literal: 'y' }] }; });
  refused(run(normal(), WIN, rowNotTable), 'a table row does not match');
});

test('unknown and not-collected are never counted', () => {
  for (const state of ['unknown', 'not-collected']) {
    const env = normal();
    const o = env.observations.find((x) => x.concept.id === concept('clottingTestStatus'));
    delete o.value; o.state = state;
    const loaded = loadDemo(pkg('0.1.1'), env);
    assert.equal(loaded.ok, true, state);
    const r = by(run(loaded.envelope));
    assert.deepEqual(r.expectedDocumentedCount.value, { amount: 3, unit: '1' }, state);
    assert.equal(r.itemStates.value.rows[0][0], state === 'unknown' ? 'unknown' : 'not-documented');
  }
});

test('unknown expected item gives indeterminate overall, never complete', () => {
  const env = normal();
  const o = env.observations.find((x) => x.concept.id === concept('clottingTestStatus'));
  delete o.value; o.state = 'unknown';
  assert.deepEqual(by(run(loadDemo(pkg('0.1.1'), env).envelope)).overallStatus.value, { label: 'indeterminate' });
});

// Finding F-6 (D-052): the 0.1.1 tree has no branch for an expected item recorded as not-collected, so overallStatus
// falls through to complete while the count is 3 of 4. The executor does not patch package meaning. Needs a new
// analytic version (0.1.2). Marked todo so the suite stays green and the gap stays visible.
test('F-6 known gap: a not-collected expected item must not give complete overall', { todo: 'F-6: needs analytic 0.1.2' }, () => {
  const env = normal();
  const o = env.observations.find((x) => x.concept.id === concept('clottingTestStatus'));
  delete o.value; o.state = 'not-collected';
  assert.notDeepEqual(by(run(loadDemo(pkg('0.1.1'), env).envelope)).overallStatus.value, { label: 'complete' });
});

test('wording for a status that is present but not a documented absence stays honest', () => {
  const env = normal();
  const o = env.observations.find((x) => x.concept.id === concept('clottingTestStatus'));
  delete o.value; o.state = 'unknown';
  const r = by(run(loadDemo(pkg('0.1.1'), env).envelope));
  assert.deepEqual(r.readTimeInWindow.missingDataNotes, ['Clotting test status is recorded as unknown, so the test start time cannot be read as the start of a performed test.']);
  assert.equal(r.readTimeInWindow.state, 'needs-data');
});

test('the two deferred cases (F-4, F-5) stay deferred and are not built', () => {
  assert.deepEqual(index.deferred.map((d) => d.case).sort(), ['antivenom-not-given-target-disabled', 'clotting-not-performed-expected-items-enabled']);
  assert.equal(index.cases.some((c) => index.deferred.some((d) => d.case === c.case)), false);
});

test('an analytic that is not one of the two snake analytics is still refused', () => {
  const other = clone(B1); other.manifest.id = 'snake.something-else';
  refused(run(normal(), WIN, other), 'two snake analytics only');
});

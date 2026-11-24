import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { prepareAnalytic, evaluateOutput, EXEC_REFUSALS, IMPLEMENTED_OPS, WHITELIST_OPS, ENGINE, OPERATOR_SET, RUNTIME_LIMIT_FIELDS } from '../ccis-exec.js';
import { canonicalize, checksumOf } from '../ccis-compile.js';

const ex = new URL('../ccis/examples/snake/', import.meta.url);
const clone = (x) => JSON.parse(JSON.stringify(x));
const RUNTIME = { limits: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 } };
const sumOf = (a) => checksumOf(canonicalize(a).text);

// ---- builders ----
const I = (id) => ({ ref: 'input', id });
const P = (id) => ({ ref: 'parameter', id });
const L = (literal) => ({ literal });
const op = (name, ...args) => ({ op: name, args });
const T = L(true);
const F = L(false);

const base = (trees, over = {}) => ({
  inputs: ['a', 'b', 'c', 'n1', 'n2', 'i1', 'i2', 't1', 'toString'].map((key) => ({ key, type: 'code' })),
  parameters: [{ id: 'p', kind: 'choice' }, { id: 'q', kind: 'duration' }, { id: 'setp', kind: 'set' }],
  conversions: [{ id: 'cv' }],
  operatorSet: { name: 'ccis-core-ops', version: '0.1.0' },
  computation: Object.entries(trees).map(([output, expr]) => ({ output, expr })),
  outputs: Object.keys(trees).map((id) => ({ id })),
  executionProfile: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 },
  ...over,
});
const prep = (analytic, runtime = RUNTIME) => prepareAnalytic({ analytic, checksum: sumOf(analytic), runtime });
const mustPrep = (analytic, runtime) => { const r = prep(analytic, runtime); assert.equal(r.ok, true, JSON.stringify(r)); return r.prepared; };
const ids = (r) => r.refusals.map((x) => x.id);

const bv = (v) => ({ state: 'present', value: { t: 'bool', v } });
const tv = (v) => ({ state: 'present', value: { t: 'text', v } });
const nv = (v, unit = 'min') => ({ state: 'present', value: { t: 'number', v, unit } });
const iv = (ms) => ({ state: 'present', value: { t: 'instant', ms } });
const st = (state) => ({ state });
const DISABLED = { enabled: false };
const IN = (over = {}) => ({ a: bv(true), b: bv(true), c: bv(true), n1: nv(5), n2: nv(7), i1: iv(1000), i2: iv(2000), t1: tv('x'), toString: tv('y'), ...over });
const PAR = (over = {}) => ({ p: DISABLED, q: DISABLED, setp: DISABLED, ...over });
const run = (analytic, out, inputs = IN(), parameters = PAR()) => evaluateOutput({ prepared: mustPrep(analytic), outputId: out, inputs, parameters });
const val = (expr, inputs, parameters) => { const r = run(base({ o: expr }), 'o', inputs, parameters); assert.equal(r.ok, true, JSON.stringify(r)); return r.value; };
const refusalOf = (expr, inputs, parameters) => { const r = run(base({ o: expr }), 'o', inputs, parameters); assert.equal(r.ok, false); assert.equal('value' in r, false); return r.refusal.id; };

// ---------------------------------------------------------------------------------------------
test('catalogue and constants', () => {
  assert.deepEqual(EXEC_REFUSALS.map((r) => r.id), Array.from({ length: 14 }, (_, i) => `X-${String(i + 1).padStart(3, '0')}`));
  assert.ok(EXEC_REFUSALS.every((r) => r.meaning.endsWith('.') && Object.isFrozen(r)));
  assert.equal(WHITELIST_OPS.length, 18);
  assert.equal(IMPLEMENTED_OPS.length, 12);
  assert.ok(IMPLEMENTED_OPS.every((o) => WHITELIST_OPS.includes(o)));
  assert.deepEqual(ENGINE, { name: 'ccis-exec', version: '0.1.0' });
  assert.deepEqual(OPERATOR_SET, { name: 'ccis-core-ops', version: '0.1.0' });
  assert.deepEqual(RUNTIME_LIMIT_FIELDS, ['maxSteps', 'maxDepth', 'maxOutputBytes']);
});

// (a) truth tables ------------------------------------------------------------------------
const TRI = { T: bv(true), F: bv(false), U: st('unknown') };
const TABLE_AND = { TT: 'T', TF: 'F', TU: 'U', FT: 'F', FF: 'F', FU: 'F', UT: 'U', UF: 'F', UU: 'U' };
const TABLE_OR = { TT: 'T', TF: 'T', TU: 'T', FT: 'T', FF: 'F', FU: 'U', UT: 'T', UF: 'U', UU: 'U' };
const show = (v) => (v.t === 'unknown' ? 'U' : v.v ? 'T' : 'F');

test('(a) and, or: Kleene truth tables for every pair', () => {
  for (const [pair, want] of Object.entries(TABLE_AND)) {
    assert.equal(show(val(op('and', I('a'), I('b')), IN({ a: TRI[pair[0]], b: TRI[pair[1]] }))), want, `and ${pair}`);
  }
  for (const [pair, want] of Object.entries(TABLE_OR)) {
    assert.equal(show(val(op('or', I('a'), I('b')), IN({ a: TRI[pair[0]], b: TRI[pair[1]] }))), want, `or ${pair}`);
  }
});

test('(a) not, and three arguments', () => {
  assert.equal(show(val(op('not', I('a')), IN({ a: TRI.T }))), 'F');
  assert.equal(show(val(op('not', I('a')), IN({ a: TRI.F }))), 'T');
  assert.equal(show(val(op('not', I('a')), IN({ a: TRI.U }))), 'U');
  assert.equal(show(val(op('and', I('a'), I('b'), I('c')), IN({ a: TRI.T, b: TRI.U, c: TRI.F }))), 'F');
  assert.equal(show(val(op('or', I('a'), I('b'), I('c')), IN({ a: TRI.F, b: TRI.U, c: TRI.F }))), 'U');
});

test('(a) if: true and false pick a branch; unknown picks none and visits neither', () => {
  const bad = op('lt', L('text'), L(true)); // would be refused (X-010) if it were visited
  const tree = op('if', I('a'), L('then'), bad);
  assert.deepEqual(val(tree, IN({ a: TRI.T })), { t: 'text', v: 'then' });
  assert.equal(refusalOf(tree, IN({ a: TRI.F })), 'X-010');
  const none = run(base({ o: op('if', I('a'), bad, bad) }), 'o', IN({ a: TRI.U }));
  assert.equal(none.ok, true);
  assert.equal(none.value.t, 'unknown');
  assert.deepEqual(none.value.because, [{ kind: 'input', id: 'a', state: 'unknown' }]);
  assert.equal(none.steps, 2); // the if node and its condition leaf only
  assert.equal(refusalOf(op('if', L('not boolean'), T, F)), 'X-010');
});

test('(a) no short-circuit: every argument is evaluated, so a type error after a decisive one still refuses', () => {
  assert.equal(refusalOf(op('and', F, op('lt', L('x'), L(true)))), 'X-010');
  assert.equal(refusalOf(op('or', T, op('lt', L('x'), L(true)))), 'X-010');
  const r = run(base({ o: op('and', F, I('a'), I('b')) }), 'o');
  assert.equal(r.steps, 4);
});

// (b) unknown stays unknown ------------------------------------------------------------------
const NONPRESENT = ['absent', 'unknown', 'not-collected', 'conflicting', 'not-applicable', 'explicitly-negative'];

test('(b) a non-present input is unknown with its own state; is-present is false; state-of names it', () => {
  for (const s of NONPRESENT) {
    const v = val(I('a'), IN({ a: st(s) }));
    assert.deepEqual(v, { t: 'unknown', because: [{ kind: 'input', id: 'a', state: s }] }, s);
    assert.deepEqual(val(op('is-present', I('a')), IN({ a: st(s) })), { t: 'bool', v: false }, s);
    assert.deepEqual(val(op('state-of', I('a')), IN({ a: st(s) })), { t: 'text', v: s }, s);
    assert.deepEqual(val(op('eq', op('state-of', I('a')), L(s)), IN({ a: st(s) })), { t: 'bool', v: true }, s);
  }
  assert.deepEqual(val(op('state-of', I('a'))), { t: 'text', v: 'present' });
  assert.deepEqual(val(op('is-present', I('a'))), { t: 'bool', v: true });
});

test('(b) a present input without a usable value is unknown (unreadable), never empty or zero', () => {
  const inputs = IN({ a: { state: 'present' } });
  assert.deepEqual(val(I('a'), inputs), { t: 'unknown', because: [{ kind: 'input', id: 'a', state: 'unreadable' }] });
  assert.deepEqual(val(op('is-present', I('a')), inputs), { t: 'bool', v: false });
  assert.deepEqual(val(op('state-of', I('a')), inputs), { t: 'unknown', because: [{ kind: 'input', id: 'a', state: 'unreadable' }] });
});

test('(b) a disabled parameter is unknown (parameter-not-enabled) and not present; an enabled one is its value', () => {
  assert.deepEqual(val(P('p')), { t: 'unknown', because: [{ kind: 'parameter', id: 'p', state: 'parameter-not-enabled' }] });
  assert.deepEqual(val(op('is-present', P('p'))), { t: 'bool', v: false });
  assert.deepEqual(val(P('p'), IN(), PAR({ p: { enabled: true, value: { t: 'text', v: 'inside' } } })), { t: 'text', v: 'inside' });
  assert.deepEqual(val(op('is-present', P('p')), IN(), PAR({ p: { enabled: true, value: { t: 'text', v: 'inside' } } })), { t: 'bool', v: true });
  assert.deepEqual(val(op('is-present', P('setp')), IN(), PAR({ setp: { enabled: true, value: { t: 'text', v: 'm' } } })), { t: 'bool', v: true });
});

test('(b) unknown never becomes false, zero or a default through any implemented operator', () => {
  const inputs = IN({ a: st('absent'), n1: st('not-collected'), i1: st('unknown') });
  for (const tree of [op('eq', I('n1'), I('n2')), op('ne', I('n1'), I('n2')), op('lt', I('n1'), I('n2')), op('le', I('i1'), I('i2')), op('gt', I('n1'), I('n2')), op('ge', I('i1'), I('i2')), op('not', I('a'))]) {
    assert.equal(val(tree, inputs).t, 'unknown', JSON.stringify(tree));
  }
});

test('(b) merged reasons are deduplicated and sorted, with the distinct states kept', () => {
  const v = val(op('and', I('b'), I('a'), I('b'), P('p')), IN({ a: st('absent'), b: st('conflicting') }));
  assert.deepEqual(v, { t: 'unknown', because: [{ kind: 'input', id: 'a', state: 'absent' }, { kind: 'input', id: 'b', state: 'conflicting' }, { kind: 'parameter', id: 'p', state: 'parameter-not-enabled' }] });
});

// (c) comparison rules -----------------------------------------------------------------------
test('(c) comparisons: same type, same unit; instants and numbers order; no coercion', () => {
  assert.deepEqual(val(op('lt', I('n1'), I('n2'))), { t: 'bool', v: true });
  assert.deepEqual(val(op('le', I('n1'), I('n1'))), { t: 'bool', v: true });
  assert.deepEqual(val(op('gt', I('n1'), I('n2'))), { t: 'bool', v: false });
  assert.deepEqual(val(op('ge', I('n2'), I('n1'))), { t: 'bool', v: true });
  assert.deepEqual(val(op('lt', I('i1'), I('i2'))), { t: 'bool', v: true });
  assert.deepEqual(val(op('ge', I('i1'), I('i2'))), { t: 'bool', v: false });
  assert.deepEqual(val(op('eq', I('t1'), L('x'))), { t: 'bool', v: true });
  assert.deepEqual(val(op('eq', I('a'), T)), { t: 'bool', v: true });
  assert.deepEqual(val(op('eq', I('i1'), I('i1'))), { t: 'bool', v: true });
  assert.deepEqual(val(op('ne', I('t1'), L('x'))), { t: 'bool', v: false });
  assert.deepEqual(val(op('ne', I('t1'), L('z'))), { t: 'bool', v: true });
});

test('(c) unlike types or units are X-010, never converted and never unknown', () => {
  assert.equal(refusalOf(op('eq', I('t1'), I('n1'))), 'X-010');
  assert.equal(refusalOf(op('lt', I('n1'), I('i1'))), 'X-010');
  assert.equal(refusalOf(op('lt', I('n1'), I('n2')), IN({ n2: nv(7, 'h') })), 'X-010');
  assert.equal(refusalOf(op('eq', I('n1'), I('n2')), IN({ n2: nv(5, 'h') })), 'X-010');
  assert.equal(refusalOf(op('lt', I('t1'), L('y'))), 'X-010');
  assert.equal(refusalOf(op('gt', I('a'), I('b'))), 'X-010');
  assert.equal(refusalOf(op('and', I('t1'), T)), 'X-010');
  assert.equal(refusalOf(op('not', I('t1'))), 'X-010');
});

// (d) static checks --------------------------------------------------------------------------
const refuseWith = (analytic, runtime) => { const r = prep(analytic, runtime); assert.equal(r.ok, false); return r; };

test('(d) each static refusal is reached, and nothing is evaluated when one exists', () => {
  assert.deepEqual(ids(refuseWith(base({ o: op('eval', T) }))), ['X-001']);
  assert.deepEqual(ids(refuseWith(base({ o: op('add', T, T) }))), ['X-002']);
  assert.deepEqual(ids(refuseWith(base({ o: op('not', T, T) }))), ['X-003']);
  assert.deepEqual(ids(refuseWith(base({ o: op('if', T, T) }))), ['X-003']);
  assert.deepEqual(ids(refuseWith(base({ o: op('and') }))), ['X-003']);
  assert.deepEqual(ids(refuseWith(base({ o: I('nope') }))), ['X-004']);
  assert.deepEqual(ids(refuseWith(base({ o: P('nope') }))), ['X-004']);
  assert.deepEqual(ids(refuseWith(base({ o: { ref: 'conversion', id: 'nope' } }))), ['X-004']);
  assert.deepEqual(ids(refuseWith(base({ o: T }, { outputs: [{ id: 'o' }, { id: 'extra' }] }))), ['X-004']);
  assert.deepEqual(ids(refuseWith(base({ o: T }, { computation: [{ output: 'o', expr: T }, { output: 'o', expr: F }] }))), ['X-004']);
  assert.deepEqual(ids(refuseWith(base({ o: T }, { computation: [{ output: 'o', expr: T }, { output: 'ghost', expr: F }] }))), ['X-004']);
  assert.deepEqual(ids(refuseWith(base({ o: op('is-present', L('x')) }))), ['X-005']);
  assert.deepEqual(ids(refuseWith(base({ o: op('state-of', P('p')) }))), ['X-005']);
  assert.deepEqual(ids(refuseWith(base({ o: op('state-of', { ref: 'conversion', id: 'cv' }) }))), ['X-005', 'X-005']);
  assert.deepEqual(ids(refuseWith(base({ o: op('eq', { ref: 'conversion', id: 'cv' }, L('x')) }))), ['X-005']);
  assert.deepEqual(ids(refuseWith(base({ o: op('eq', P('setp'), L('x')) }))), ['X-005']);
  const deep = (n) => (n === 0 ? T : op('not', deep(n - 1)));
  assert.deepEqual(ids(refuseWith(base({ o: deep(24) }))), ['X-006']); // 25 nodes deep, limit 24
  assert.deepEqual(ids(refuseWith(base({ o: T }, { operatorSet: { name: 'other-ops', version: '0.1.0' } }))), ['X-007']);
  assert.deepEqual(ids(refuseWith(base({ o: T }, { operatorSet: { name: 'ccis-core-ops', version: '1.0.0' } }))), ['X-007']);
  assert.deepEqual(ids(refuseWith(base({ o: T }, { executionProfile: { maxSteps: 1001, maxDepth: 24, maxOutputBytes: 65536 } }))), ['X-008']);
  assert.deepEqual(ids(refuseWith(base({ o: T }, { executionProfile: { maxSteps: 0, maxDepth: 24, maxOutputBytes: 65536 } }))), ['X-008']);
  assert.deepEqual(ids(refuseWith(base({ o: T }), { limits: { maxSteps: 1000, maxDepth: 24 } })), ['X-008']);
  assert.deepEqual(ids(refuseWith(base({ o: T }), null)), ['X-008']);
});

test('(d) a depth at exactly the limit prepares', () => {
  const deep = (n) => (n === 0 ? T : op('not', deep(n - 1)));
  mustPrep(base({ o: deep(23) })); // 24 nodes deep
});

test('(d) the pinned form: a mismatched checksum, a mutated clone, a non-object or an unprepared copy is X-012', () => {
  const a = base({ o: T });
  assert.deepEqual(ids(prepareAnalytic({ analytic: a, checksum: sumOf(base({ o: F })), runtime: RUNTIME })), ['X-012']);
  assert.deepEqual(ids(prepareAnalytic({ analytic: a, checksum: undefined, runtime: RUNTIME })), ['X-012']);
  assert.deepEqual(ids(prepareAnalytic({ analytic: a, checksum: 'sha256:' + '0'.repeat(64), runtime: RUNTIME })), ['X-012']);
  const mutated = clone(a); mutated.computation[0].expr = F;
  assert.deepEqual(ids(prepareAnalytic({ analytic: mutated, checksum: sumOf(a), runtime: RUNTIME })), ['X-012']);
  assert.deepEqual(ids(prepareAnalytic({ analytic: 'text', checksum: 'x', runtime: RUNTIME })), ['X-012']);
  assert.deepEqual(ids(prepareAnalytic({ analytic: { ...a, inputs: 'no' }, checksum: sumOf({ ...a, inputs: 'no' }), runtime: RUNTIME })), ['X-012']);
  assert.deepEqual(ids(prepareAnalytic()), ['X-012']);
  const p = mustPrep(a);
  for (const bad of [a, clone(p), { ...p }, null, undefined, 'x']) {
    const r = evaluateOutput({ prepared: bad, outputId: 'o', inputs: IN(), parameters: PAR() });
    assert.equal(r.ok, false);
    assert.equal(r.refusal.id, 'X-012');
  }
});

test('(d) malformed nodes are X-012; the prepared object cannot be changed', () => {
  assert.deepEqual(ids(refuseWith(base({ o: { nothing: 1 } }))), ['X-012']);
  assert.deepEqual(ids(refuseWith(base({ o: { literal: 5 } }))), ['X-012']);
  assert.deepEqual(ids(refuseWith(base({ o: { op: 'and', args: 'x' } }))), ['X-012']);
  const p = mustPrep(base({ o: T }));
  assert.throws(() => { p.analytic.computation[0].output = 'x'; }, TypeError);
  assert.throws(() => { p.limits.maxSteps = 5; }, TypeError);
  assert.throws(() => { p.trees[0].expr = F; }, TypeError);
});

test('(d) all refusals are listed together, sorted by output then path, and nothing runs', () => {
  const a = base({
    z: op('eval', T),
    m: op('and', I('nope'), op('add', T, T), op('not', T, T)),
    k: op('is-present', L('x')),
  });
  const r = refuseWith(a);
  assert.deepEqual(r.refusals.map((x) => [x.output, x.path, x.id]), [
    ['k', 'computation[2].expr.args[0]', 'X-005'],
    ['m', 'computation[1].expr.args[0]', 'X-004'],
    ['m', 'computation[1].expr.args[1]', 'X-002'],
    ['m', 'computation[1].expr.args[2]', 'X-003'],
    ['z', 'computation[0].expr', 'X-001'],
  ]);
  assert.equal(r.refusals.find((x) => x.id === 'X-002').op, 'add');
  assert.equal('prepared' in r, false);
  assert.ok(r.refusals.every((x) => EXEC_REFUSALS.find((c) => c.id === x.id).meaning === x.meaning));
});

test('(d) the same input gives the same refusals', () => {
  const a = base({ z: op('eval', T), m: op('add', T, T) });
  assert.deepEqual(refuseWith(a), refuseWith(clone(a)));
});

// (e) real packages --------------------------------------------------------------------------
const snakeFiles = readdirSync(ex).filter((f) => f.includes('.analytics')).sort();

test('(e) the four snake analytics prepare with only X-002, naming the operators 3.4 must add', () => {
  const expected = {
    'snake-completeness.analytics.0.1.1.json': ['convert', 'count', 'select', 'time-diff'],
    'snake-completeness.analytics.json': ['count', 'select', 'time-diff'],
    'snake-interval.analytics.0.1.1.json': ['convert', 'time-diff'],
    'snake-interval.analytics.json': ['time-diff'],
  };
  assert.equal(snakeFiles.length, 4);
  for (const f of snakeFiles) {
    const a = JSON.parse(readFileSync(new URL(f, ex), 'utf8'));
    const r = prepareAnalytic({ analytic: a, checksum: sumOf(a), runtime: RUNTIME });
    assert.equal(r.ok, false, f);
    assert.deepEqual([...new Set(ids(r))], ['X-002'], f);
    assert.deepEqual([...new Set(r.refusals.map((x) => x.op))].sort(), expected[f], f);
  }
});

// The interval output of 0.1.0, with the one operator this row does not have (time-diff) replaced by a label,
// is evaluated for each input-state combination. Expected values are hand-calculated from the tree.
const LATER = new Set(['add', 'sub', 'time-diff', 'convert', 'count', 'select']);
const stub = (e) => (e.op ? (LATER.has(e.op) ? L('computed') : { op: e.op, args: e.args.map(stub) }) : e);

test('(e) the interval tree (time-diff stubbed) gives the hand-calculated result for each state combination', () => {
  const a = JSON.parse(readFileSync(new URL('snake-interval.analytics.json', ex), 'utf8'));
  a.computation = a.computation.map((c) => ({ ...c, expr: stub(c.expr) }));
  const prepared = mustPrep(a);
  const ok = (extra = {}) => ({ antivenomStatus: tv('given'), biteTime: iv(1000), antivenomStartTime: iv(5000), biteTimeCertainty: tv('recorded'), antivenomStartTimeX: undefined, ...extra });
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const par = (over = {}) => ({ targetIntervalDuration: DISABLED, acceptedCertainty: DISABLED, edgeRule: DISABLED, populationScope: DISABLED, ...over });
  const accepted = (v) => par({ acceptedCertainty: { enabled: true, value: { t: 'text', v } } });
  const cases = [
    ['explicitly negative status', ok({ antivenomStatus: st('explicitly-negative') }), par(), 'not-applicable'],
    ['status absent', ok({ antivenomStatus: st('absent') }), par(), 'indeterminate'],
    ['status not collected', ok({ antivenomStatus: st('not-collected') }), par(), 'indeterminate'],
    ['bite time absent', ok({ biteTime: st('absent') }), par(), 'needs-data'],
    ['start time unknown', ok({ antivenomStartTime: st('unknown') }), par(), 'needs-data'],
    ['certainty absent', ok({ biteTimeCertainty: st('absent') }), par(), 'needs-data'],
    ['start before bite', ok({ biteTime: iv(5000), antivenomStartTime: iv(1000) }), par(), 'conflict'],
    ['estimated, parameter disabled', ok({ biteTimeCertainty: tv('estimated') }), par(), 'parameter-not-enabled'],
    ['estimated, parameter says needs-data', ok({ biteTimeCertainty: tv('estimated') }), accepted('needs-data'), 'needs-data'],
    ['estimated, parameter says accept', ok({ biteTimeCertainty: tv('estimated') }), accepted('accept'), 'computed'],
    ['recorded, parameter disabled: and(false, unknown) is false', ok(), par(), 'computed'],
    ['same time twice is not before', ok({ antivenomStartTime: iv(1000) }), par(), 'computed'],
  ];
  for (const [name, inputs, parameters, want] of cases) {
    const r = evaluateOutput({ prepared, outputId: 'interval', inputs: clean(inputs), parameters });
    assert.equal(r.ok, true, name);
    assert.deepEqual(r.value, { t: 'text', v: want }, name);
  }
});

// (f) limits ---------------------------------------------------------------------------------
test('(f) the step limit: exactly at the limit runs, one over gives X-009 and no value', () => {
  const tree = op('and', I('a'), I('b'), I('c')); // 4 nodes
  const at = base({ o: tree }, { executionProfile: { maxSteps: 4, maxDepth: 24, maxOutputBytes: 65536 } });
  const over = base({ o: tree }, { executionProfile: { maxSteps: 3, maxDepth: 24, maxOutputBytes: 65536 } });
  assert.equal(run(at, 'o').ok, true);
  const r = run(over, 'o');
  assert.deepEqual(r, { ok: false, refusal: { id: 'X-009', meaning: EXEC_REFUSALS[8].meaning } });
});

test('(f) the output limit: the canonical bytes of the value are counted', () => {
  const small = base({ o: I('t1') }, { executionProfile: { maxSteps: 10, maxDepth: 24, maxOutputBytes: 5 } });
  const r = run(small, 'o');
  assert.equal(r.ok, false);
  assert.equal(r.refusal.id, 'X-011');
  const fits = base({ o: I('t1') }, { executionProfile: { maxSteps: 10, maxDepth: 24, maxOutputBytes: 20 } });
  assert.equal(canonicalize({ t: 'text', v: 'x' }).text.length, 20);
  assert.equal(run(fits, 'o').ok, true);
  assert.equal(run(base({ o: I('t1') }, { executionProfile: { maxSteps: 10, maxDepth: 24, maxOutputBytes: 19 } }), 'o').refusal.id, 'X-011');
});

test('(f) a number that cannot be written in canonical form is X-013', () => {
  assert.equal(run(base({ o: I('n1') }), 'o', IN({ n1: nv(1e20) })).refusal.id, 'X-013');
  assert.equal(run(base({ o: I('n1') }), 'o', IN({ n1: nv(12.5) })).ok, true);
});

test('(f) limits above the ceilings or the hard depth are refused at prepare; the runtime ceiling is honoured', () => {
  const a = base({ o: T }, { executionProfile: { maxSteps: 10, maxDepth: 300, maxOutputBytes: 100 } });
  assert.deepEqual(ids(refuseWith(a, { limits: { maxSteps: 1000, maxDepth: 1000, maxOutputBytes: 1000 } })), ['X-008']);
  mustPrep(base({ o: T }, { executionProfile: { maxSteps: 10, maxDepth: 24, maxOutputBytes: 100 } }), { limits: { maxSteps: 10, maxDepth: 24, maxOutputBytes: 100 } });
});

// bound inputs -------------------------------------------------------------------------------
test('bound inputs and parameters: missing, malformed or contradictory bindings are X-014', () => {
  const tree = T;
  assert.equal(refusalOf(tree, (() => { const i = IN(); delete i.a; return i; })()), 'X-014');
  assert.equal(refusalOf(tree, IN({ a: { state: 'made-up' } })), 'X-014');
  assert.equal(refusalOf(tree, IN({ a: { state: 'absent', value: { t: 'bool', v: true } } })), 'X-014');
  assert.equal(refusalOf(tree, IN({ a: { state: 'entered-in-error' } })), 'X-014');
  assert.equal(refusalOf(tree, IN({ a: { state: 'present', value: { t: 'number', v: NaN, unit: 'min' } } })), 'X-014');
  assert.equal(refusalOf(tree, IN({ a: { state: 'present', value: { t: 'number', v: 1 } } })), 'X-014');
  assert.equal(refusalOf(tree, IN({ a: { state: 'present', value: { t: 'instant', ms: 1.5 } } })), 'X-014');
  assert.equal(refusalOf(tree, IN({ a: { state: 'present', value: { t: 'mystery', v: 1 } } })), 'X-014');
  assert.equal(refusalOf(tree, 'inputs'), 'X-014');
  assert.equal(refusalOf(tree, IN(), (() => { const p = PAR(); delete p.p; return p; })()), 'X-014');
  assert.equal(refusalOf(tree, IN(), PAR({ p: { enabled: true } })), 'X-014');
  assert.equal(refusalOf(tree, IN(), PAR({ p: { enabled: 'yes' } })), 'X-014');
  assert.equal(refusalOf(tree, IN(), null), 'X-014');
  const r = evaluateOutput({ prepared: mustPrep(base({ o: T })), outputId: 'nope', inputs: IN(), parameters: PAR() });
  assert.equal(r.refusal.id, 'X-004');
});

// (g) determinism and safety ---------------------------------------------------------------------
test('(g) same bytes twice; key order of inputs and parameters is irrelevant', () => {
  const a = base({ o: op('and', I('a'), I('b'), P('p')) });
  const inputs = IN({ a: st('absent') });
  const one = run(a, 'o', inputs, PAR());
  const two = run(clone(a), 'o', clone(inputs), clone(PAR()));
  assert.equal(JSON.stringify(one), JSON.stringify(two));
  const reversed = Object.fromEntries(Object.entries(inputs).reverse());
  const preversed = Object.fromEntries(Object.entries(PAR()).reverse());
  assert.equal(JSON.stringify(run(a, 'o', reversed, preversed)), JSON.stringify(one));
});

test('(g) inputs, parameters and the prepared object are not changed; results are frozen', () => {
  const a = base({ o: op('and', I('a'), I('b')) });
  const p = mustPrep(a);
  const inputs = IN(); const parameters = PAR();
  const snapIn = JSON.stringify(inputs); const snapPar = JSON.stringify(parameters); const snapP = JSON.stringify(p);
  const r = evaluateOutput({ prepared: p, outputId: 'o', inputs, parameters });
  assert.equal(JSON.stringify(inputs), snapIn);
  assert.equal(JSON.stringify(parameters), snapPar);
  assert.equal(JSON.stringify(p), snapP);
  assert.ok(Object.isFrozen(r.value));
  const frozenIn = JSON.parse(snapIn); Object.values(frozenIn).forEach(Object.freeze); Object.freeze(frozenIn);
  assert.equal(evaluateOutput({ prepared: p, outputId: 'o', inputs: frozenIn, parameters: Object.freeze(clone(parameters)) }).ok, true);
  assert.equal(Object.isFrozen(a), false);
  const keep = JSON.stringify(a);
  prep(a);
  assert.equal(JSON.stringify(a), keep);
});

test('(g) package-supplied names are never dispatched as properties', () => {
  for (const name of ['__proto__', 'constructor', 'hasOwnProperty', 'valueOf']) {
    assert.deepEqual(ids(refuseWith(base({ o: I(name) }))), ['X-004'], name);
    assert.deepEqual(ids(refuseWith(base({ o: P(name) }))), ['X-004'], name);
    assert.deepEqual(ids(refuseWith(base({ o: op(name, T) }))), ['X-001'], name);
  }
  assert.deepEqual(val(I('toString')), { t: 'text', v: 'y' }); // a declared input with such a name works
  const a = base({ o: I('__proto__') }, { inputs: [{ key: '__proto__', type: 'code' }] });
  const inputs = JSON.parse('{"__proto__":{"state":"present","value":{"t":"text","v":"ok"}}}');
  assert.deepEqual(run(a, 'o', inputs, PAR()).value, { t: 'text', v: 'ok' });
  assert.equal(({}).polluted, undefined);
});

test('(g) the module is a pure library: it imports only the compiler and uses no dynamic code, clock, randomness or I/O', () => {
  const src = readFileSync(new URL('../ccis-exec.js', import.meta.url), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const imports = [...code.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['./ccis-compile.js']);
  for (const banned of [/\beval\s*\(/, /\bnew Function\b/, /\bFunction\s*\(/, /\bimport\s*\(/, /\bDate\b/, /Math\.random/, /\bprocess\b/, /\bfs\b/, /\brequire\b/, /\bfetch\s*\(/, /setTimeout/, /performance\./, /crypto\.random/]) {
    assert.equal(banned.test(code), false, String(banned));
  }
});

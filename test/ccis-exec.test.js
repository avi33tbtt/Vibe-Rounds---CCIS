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
  assert.deepEqual(EXEC_REFUSALS.map((r) => r.id), Array.from({ length: 16 }, (_, i) => `X-${String(i + 1).padStart(3, '0')}`));
  assert.ok(EXEC_REFUSALS.every((r) => r.meaning.endsWith('.') && Object.isFrozen(r)));
  assert.equal(WHITELIST_OPS.length, 18);
  assert.equal(IMPLEMENTED_OPS.length, 18); // row 3.4: every whitelisted operator is implemented
  assert.deepEqual([...IMPLEMENTED_OPS], [...WHITELIST_OPS]);
  // X-002 stays in the catalogue for a future whitelist growth, but cannot be reached now.
  assert.ok(EXEC_REFUSALS.some((r) => r.id === 'X-002'));
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
  mustPrep(base({ o: op('add', I('n1'), I('n2')) })); // formerly X-002; now implemented
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
    m: op('and', I('nope'), op('eval', T), op('not', T, T)),
    k: op('is-present', L('x')),
  });
  const r = refuseWith(a);
  assert.deepEqual(r.refusals.map((x) => [x.output, x.path, x.id]), [
    ['k', 'computation[2].expr.args[0]', 'X-005'],
    ['m', 'computation[1].expr.args[0]', 'X-004'],
    ['m', 'computation[1].expr.args[1]', 'X-001'],
    ['m', 'computation[1].expr.args[2]', 'X-003'],
    ['z', 'computation[0].expr', 'X-001'],
  ]);
  assert.equal('prepared' in r, false);
  assert.ok(r.refusals.every((x) => EXEC_REFUSALS.find((c) => c.id === x.id).meaning === x.meaning));
});

test('(d) the same input gives the same refusals', () => {
  const a = base({ z: op('eval', T), m: op('nope', T) });
  assert.deepEqual(refuseWith(a), refuseWith(clone(a)));
});

// (e) real packages --------------------------------------------------------------------------
const snakeFiles = readdirSync(ex).filter((f) => f.includes('.analytics')).sort();

test('(e) the four snake analytics now prepare, and report the operators they use', () => {
  const used = {
    'snake-completeness.analytics.0.1.1.json': ['convert', 'count', 'select', 'time-diff'],
    'snake-completeness.analytics.json': ['count', 'select', 'time-diff'],
    'snake-interval.analytics.0.1.1.json': ['convert', 'time-diff'],
    'snake-interval.analytics.json': ['time-diff'],
  };
  assert.equal(snakeFiles.length, 4);
  for (const f of snakeFiles) {
    const a = JSON.parse(readFileSync(new URL(f, ex), 'utf8'));
    const r = prepareAnalytic({ analytic: a, checksum: sumOf(a), runtime: RUNTIME });
    assert.equal(r.ok, true, f + JSON.stringify(r.refusals));
    for (const o of used[f]) assert.ok(r.operators.includes(o), `${f} ${o}`);
    assert.ok(r.operators.every((o) => WHITELIST_OPS.includes(o)));
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

// =============================================================================================
// Row 3.4: the six remaining operators
// =============================================================================================
const CONV = [{ id: 'h2m', from: 'h', to: 'min', kind: 'linear', factor: 60 }, { id: 'tz', from: 'x', to: 'y', kind: 'time-zone' }];
const C = (id) => ({ ref: 'conversion', id });
const SETDECL = [{ id: 'p', kind: 'choice' }, { id: 'q', kind: 'duration' }, { id: 'setp', kind: 'set', allowedMembers: ['m1', 'm2'] }];
const TABLE2 = [{ id: 'o', kind: 'table', columns: [{ key: 'x' }, { key: 'y' }] }];
const X = { conversions: CONV, parameters: SETDECL };
const vx = (expr, inputs, parameters, over = {}) => { const r = run(base({ o: expr }, { ...X, ...over }), 'o', inputs, parameters); assert.equal(r.ok, true, JSON.stringify(r)); return r.value; };
const rx = (expr, inputs, parameters, over = {}) => { const r = run(base({ o: expr }, { ...X, ...over }), 'o', inputs, parameters); assert.equal(r.ok, false); assert.equal('value' in r, false); return r.refusal.id; };
const num = (v, unit = 'min') => ({ t: 'number', v, unit });
const dur = (v, unit) => ({ q: { enabled: true, value: { t: 'number', v, unit } } });
const SET = (...m) => ({ setp: { enabled: true, value: { t: 'set', members: m } } });
const ABSENT = (k) => ({ [k]: st('absent') });
const bec = (k, state, kind = 'input') => ({ t: 'unknown', because: [{ kind, id: k, state }] });

test('(3.4 a) time-diff is end minus start in minutes, unrounded; unknown stays unknown; other types are X-010', () => {
  assert.deepEqual(vx(op('time-diff', I('i1'), I('i2')), IN({ i1: iv(0), i2: iv(60000) })), num(1));
  assert.deepEqual(vx(op('time-diff', I('i1'), I('i2')), IN({ i1: iv(0), i2: iv(90000) })), num(1.5));
  assert.deepEqual(vx(op('time-diff', I('i1'), I('i2')), IN({ i1: iv(60000), i2: iv(0) })), num(-1));
  assert.deepEqual(vx(op('time-diff', I('i1'), I('i1')), IN()), num(0));
  assert.deepEqual(vx(op('time-diff', I('i1'), I('i2')), IN({ i1: st('absent') })), bec('i1', 'absent'));
  assert.deepEqual(vx(op('time-diff', I('i1'), I('i2')), IN({ i1: st('absent'), i2: st('unknown') })).because.length, 2);
  assert.equal(rx(op('time-diff', I('n1'), I('i2'))), 'X-010');
  assert.equal(rx(op('time-diff', I('i1'), I('t1'))), 'X-010');
  assert.equal(run(base({ o: op('time-diff', I('i1'), I('i2')) }), 'o').steps, 3);
});

test('(3.4 a) add and sub: numbers of one unit only', () => {
  assert.deepEqual(vx(op('add', I('n1'), I('n2'))), num(12));
  assert.deepEqual(vx(op('add', I('n1'), I('n1'), I('n2'))), num(17));
  assert.deepEqual(vx(op('sub', I('n2'), I('n1'))), num(2));
  assert.deepEqual(vx(op('sub', I('n1'), I('n2'))), num(-2));
  assert.equal(rx(op('add', I('n1'), I('n2')), IN({ n2: nv(7, 'h') })), 'X-010');
  assert.equal(rx(op('sub', I('n1'), I('n2')), IN({ n2: nv(7, 'h') })), 'X-010');
  assert.equal(rx(op('add', I('i1'), I('i2'))), 'X-010');
  assert.equal(rx(op('add', I('n1'), I('t1'))), 'X-010');
  assert.deepEqual(vx(op('add', I('n1'), I('n2')), IN({ n2: st('not-collected') })), bec('n2', 'not-collected'));
  assert.deepEqual(vx(op('sub', I('n1'), I('n2')), IN({ n1: st('absent') })), bec('n1', 'absent'));
  assert.equal(rx(op('add', I('n1'), I('n2')), IN({ n1: nv(1e308), n2: nv(1e308) })), 'X-013');
  assert.deepEqual(ids(refuseWith(base({ o: op('sub', I('n1'), I('n2'), I('n1')) }, X))), ['X-003']);
  assert.deepEqual(ids(refuseWith(base({ o: op('add', I('n1')) }, X))), ['X-003']);
});

test('(3.4 a) convert: express in the target unit (D-042)', () => {
  assert.deepEqual(vx(op('convert', P('q'), C('h2m')), IN(), PAR(dur(2, 'h'))), num(120));
  assert.deepEqual(vx(op('convert', P('q'), C('h2m')), IN(), PAR(dur(2.5, 'h'))), num(150));
  assert.deepEqual(vx(op('convert', P('q'), C('h2m')), IN(), PAR(dur(90, 'min'))), num(90));
  assert.deepEqual(vx(op('convert', I('n1'), C('h2m'))), num(5));
  assert.equal(rx(op('convert', P('q'), C('h2m')), IN(), PAR(dur(2, 'd'))), 'X-010');
  assert.equal(rx(op('convert', I('t1'), C('h2m'))), 'X-010');
  assert.equal(rx(op('convert', I('i1'), C('h2m'))), 'X-010');
  assert.deepEqual(vx(op('convert', P('q'), C('h2m')), IN(), PAR()), bec('q', 'parameter-not-enabled', 'parameter'));
  assert.deepEqual(vx(op('convert', I('n1'), C('h2m')), IN({ n1: st('absent') })), bec('n1', 'absent'));
  assert.equal(run(base({ o: op('convert', P('q'), C('h2m')) }, X), 'o', IN(), PAR(dur(2, 'h'))).steps, 3);
  assert.equal(rx(op('convert', P('q'), C('h2m')), IN(), PAR(dur(1e308, 'h'))), 'X-013');
});

test('(3.4 a) convert: static refusals (X-015 kind, X-005 shape, X-004 undeclared)', () => {
  assert.deepEqual(ids(refuseWith(base({ o: op('convert', I('n1'), C('tz')) }, X))), ['X-015']);
  assert.deepEqual(ids(refuseWith(base({ o: op('convert', I('n1'), I('n2')) }, X))), ['X-005']);
  assert.deepEqual(ids(refuseWith(base({ o: op('convert', I('n1'), C('zzz')) }, X))), ['X-004']);
  assert.deepEqual(ids(refuseWith(base({ o: op('convert', I('n1')) }, X))), ['X-003']);
  assert.deepEqual(ids(refuseWith(base({ o: op('convert', I('n1'), { ref: 'conversion', id: 'h2m' }, I('n2')) }, X))), ['X-003']);
});

test('(3.4 a) count: trues counted in unit 1; any unknown argument makes it unknown', () => {
  const c3 = op('count', I('a'), I('b'), I('c'));
  assert.deepEqual(vx(c3, IN()), num(3, '1'));
  assert.deepEqual(vx(c3, IN({ b: bv(false), c: bv(false) })), num(1, '1'));
  assert.deepEqual(vx(c3, IN({ a: bv(false), b: bv(false), c: bv(false) })), num(0, '1'));
  assert.deepEqual(vx(c3, IN({ b: st('absent') })), bec('b', 'absent')); // a true is present, still unknown
  assert.equal(vx(c3, IN({ a: st('unknown'), b: st('absent') })).because.length, 2);
  assert.deepEqual(vx(op('count', I('a')), IN()), num(1, '1'));
  assert.equal(rx(op('count', I('a'), I('t1'))), 'X-010');
  assert.equal(rx(op('count', I('a'), I('n1'))), 'X-010');
  assert.deepEqual(ids(refuseWith(base({ o: op('count') }, X))), ['X-003']);
});

test('(3.4 a) select, membership: a declared member of an enabled set; a disabled set is unknown', () => {
  const sel = (m) => op('select', P('setp'), L(m));
  assert.deepEqual(vx(sel('m1'), IN(), PAR(SET('m2', 'm1'))), { t: 'bool', v: true });
  assert.deepEqual(vx(sel('m2'), IN(), PAR(SET('m1'))), { t: 'bool', v: false });
  assert.deepEqual(vx(sel('m1'), IN(), PAR()), bec('setp', 'parameter-not-enabled', 'parameter'));
  assert.equal(run(base({ o: sel('m1') }, X), 'o', IN(), PAR(SET('m1'))).steps, 3);
  assert.deepEqual(ids(refuseWith(base({ o: sel('zz') }, X))), ['X-016']);
  assert.deepEqual(ids(refuseWith(base({ o: op('select', P('setp'), L('m1'), L('m2')) }, X))), ['X-016']);
  assert.deepEqual(ids(refuseWith(base({ o: op('select', P('setp')) }, X))), ['X-016']);
  assert.deepEqual(ids(refuseWith(base({ o: op('select', P('setp'), I('t1')) }, X))), ['X-016']);
  mustPrep(base({ o: op('is-present', P('setp')) }, X));
});

test('(3.4 a) select, table row: width must match the output columns; an unknown cell makes the row unknown', () => {
  const T2 = { ...X, outputs: TABLE2 };
  assert.deepEqual(vx(op('select', L('a'), L('b')), IN(), PAR(), T2), { t: 'row', cells: ['a', 'b'] });
  assert.deepEqual(vx(op('select', I('t1'), L('b')), IN(), PAR(), T2), { t: 'row', cells: ['x', 'b'] });
  assert.deepEqual(vx(op('select', op('state-of', I('a')), op('state-of', I('b'))), IN({ b: st('absent') }), PAR(), T2), { t: 'row', cells: ['present', 'absent'] });
  assert.deepEqual(vx(op('select', I('a'), L('b')), IN({ a: st('absent') }), PAR(), T2), { t: 'unknown', because: [{ kind: 'input', id: 'a', state: 'absent' }] });
  assert.equal(rx(op('select', I('n1'), L('b')), IN(), PAR(), T2), 'X-010');
  assert.equal(rx(op('select', I('a'), L('b')), IN(), PAR(), T2), 'X-010'); // booleans are not cells
  assert.deepEqual(ids(refuseWith(base({ o: op('select', L('a')) }, T2))), ['X-016']);
  assert.deepEqual(ids(refuseWith(base({ o: op('select', L('a'), L('b'), L('c')) }, T2))), ['X-016']);
  assert.deepEqual(ids(refuseWith(base({ o: op('select', L('a'), P('setp')) }, T2))), ['X-016']);
  assert.deepEqual(ids(refuseWith(base({ o: op('select', L('a'), L('b')) }, X))), ['X-016']); // output is not a table
  assert.deepEqual(ids(refuseWith(base({ o: op('select', L('a'), L('b')) }, { ...X, outputs: [{ id: 'o', kind: 'table' }] }))), ['X-016']);
});

test('(3.4 a) bound set values: sorted, unique strings; sets only for parameters', () => {
  const sel = op('select', P('setp'), L('m1'));
  assert.equal(rx(sel, IN(), PAR(SET())), 'X-014');
  assert.equal(rx(sel, IN(), PAR(SET('m1', 'm1'))), 'X-014');
  assert.equal(rx(sel, IN(), PAR(SET('m1', 5))), 'X-014');
  assert.equal(rx(sel, IN(), PAR({ setp: { enabled: true, value: { t: 'set', members: 'm1' } } })), 'X-014');
  assert.equal(rx(T, IN({ a: { state: 'present', value: { t: 'set', members: ['m1'] } } })), 'X-014');
  assert.equal(rx(T, IN({ a: { state: 'present', value: { t: 'row', cells: ['x'] } } })), 'X-014');
  assert.deepEqual(vx(op('select', P('setp'), L('m2')), IN(), PAR(SET('m2', 'm1'))), { t: 'bool', v: true });
  assert.deepEqual(ids(refuseWith(base({ o: P('setp') }, X))), ['X-005']); // a set is never a value
});

test('(3.4 c) the new operators keep the limits: steps counted, no partial value', () => {
  const tree = op('time-diff', I('i1'), I('i2')); // 3 nodes
  const mk = (n) => base({ o: tree }, { executionProfile: { maxSteps: n, maxDepth: 24, maxOutputBytes: 65536 } });
  assert.equal(run(mk(3), 'o').ok, true);
  const r = run(mk(2), 'o');
  assert.equal(r.ok, false);
  assert.equal(r.refusal.id, 'X-009');
  assert.equal('value' in r, false);
});

// ---- the real packages, 0.1.1, hand-calculated ----
const real = (f) => { const a = JSON.parse(readFileSync(new URL(f, ex), 'utf8')); return mustPrep(a); };
const MIN = 60000;
const BITE = 10 * MIN;
const IV_IN = (over = {}) => ({ antivenomStatus: tv('given'), biteTime: iv(BITE), antivenomStartTime: iv(BITE + 185 * MIN), biteTimeCertainty: tv('recorded'), ...over });
const IV_PAR = (over = {}) => ({ targetIntervalDuration: DISABLED, acceptedCertainty: DISABLED, edgeRule: DISABLED, populationScope: DISABLED, ...over });
const target = (v, unit) => ({ targetIntervalDuration: { enabled: true, value: { t: 'number', v, unit } } });
const edge = (v) => ({ edgeRule: { enabled: true, value: { t: 'text', v } } });
const evalReal = (prepared, outputId, inputs, parameters) => { const r = evaluateOutput({ prepared, outputId, inputs, parameters }); assert.equal(r.ok, true, JSON.stringify(r)); return r.value; };

test('(3.4 b) interval 0.1.1: bite to start in minutes, hand-calculated', () => {
  const pk = real('snake-interval.analytics.0.1.1.json');
  assert.deepEqual(evalReal(pk, 'interval', IV_IN(), IV_PAR()), num(185));
  assert.deepEqual(evalReal(pk, 'interval', IV_IN({ antivenomStartTime: iv(BITE + 90000) }), IV_PAR()), num(1.5));
  assert.deepEqual(evalReal(pk, 'interval', IV_IN({ antivenomStartTime: iv(BITE) }), IV_PAR()), num(0));
  assert.deepEqual(evalReal(pk, 'interval', IV_IN({ antivenomStartTime: iv(BITE - MIN) }), IV_PAR()), { t: 'text', v: 'conflict' });
  assert.deepEqual(evalReal(pk, 'interval', IV_IN({ biteTime: st('absent') }), IV_PAR()), { t: 'text', v: 'needs-data' });
  assert.deepEqual(evalReal(pk, 'interval', IV_IN({ antivenomStatus: st('explicitly-negative') }), IV_PAR()), { t: 'text', v: 'not-applicable' });
  assert.deepEqual(evalReal(pk, 'interval', IV_IN({ antivenomStatus: st('unknown') }), IV_PAR()), { t: 'text', v: 'indeterminate' });
});

test('(3.4 b) interval 0.1.1 comparison: target in hours or minutes, each edge rule, at and either side of the edge', () => {
  const pk = real('snake-interval.analytics.0.1.1.json');
  const at = (minutes) => IV_IN({ antivenomStartTime: iv(BITE + minutes * MIN) });
  const cmp3 = (minutes, rule, tgt) => evalReal(pk, 'comparison', at(minutes), IV_PAR({ ...tgt, ...edge(rule) })).v;
  for (const tgt of [target(3, 'h'), target(180, 'min')]) {
    assert.equal(cmp3(179, 'inside', tgt), 'within-target');
    assert.equal(cmp3(180, 'inside', tgt), 'within-target');
    assert.equal(cmp3(181, 'inside', tgt), 'outside-target');
    assert.equal(cmp3(179, 'outside', tgt), 'within-target');
    assert.equal(cmp3(180, 'outside', tgt), 'outside-target');
    assert.equal(cmp3(181, 'outside', tgt), 'outside-target');
  }
  assert.equal(cmp3(185, 'inside', target(3.5, 'h')), 'within-target'); // 3.5 h = 210 min
  assert.deepEqual(evalReal(pk, 'comparison', at(180), IV_PAR(edge('inside'))), { t: 'text', v: 'parameter-not-enabled' });
  assert.equal(evaluateOutput({ prepared: pk, outputId: 'comparison', inputs: at(180), parameters: IV_PAR({ ...target(3, 'd'), ...edge('inside') }) }).refusal.id, 'X-010');
});

const CP_PAR = (over = {}) => ({ expectedItems: { enabled: true, value: { t: 'set', members: ['clottingTestStatus', 'clottingTestStartTime', 'clottingResultReadTime', 'clottingResult'] } }, readTimeWindow: DISABLED, edgeRule: DISABLED, populationScope: DISABLED, ...over });
const CP_IN = (over = {}) => ({ clottingTestStatus: tv('performed'), clottingTestStartTime: iv(BITE), clottingResultReadTime: iv(BITE + 60 * MIN), clottingResult: tv('r'), ...over });
const items = (...m) => ({ expectedItems: { enabled: true, value: { t: 'set', members: m } } });

test('(3.4 b) completeness 0.1.1: count, table row and statuses, hand-calculated', () => {
  const pk = real('snake-completeness.analytics.0.1.1.json');
  const D = 'documented';
  assert.deepEqual(evalReal(pk, 'expectedDocumentedCount', CP_IN(), CP_PAR()), num(4, '1'));
  assert.deepEqual(evalReal(pk, 'itemStates', CP_IN(), CP_PAR()), { t: 'row', cells: [D, D, D, D] });
  assert.deepEqual(evalReal(pk, 'overallStatus', CP_IN(), CP_PAR()), { t: 'text', v: 'complete' });
  // only two items expected
  assert.deepEqual(evalReal(pk, 'expectedDocumentedCount', CP_IN(), CP_PAR(items('clottingResult', 'clottingTestStatus'))), num(2, '1'));
  // result absent
  assert.deepEqual(evalReal(pk, 'expectedDocumentedCount', CP_IN({ clottingResult: st('absent') }), CP_PAR()), num(3, '1'));
  assert.deepEqual(evalReal(pk, 'itemStates', CP_IN({ clottingResult: st('absent') }), CP_PAR()), { t: 'row', cells: [D, D, D, 'not-documented'] });
  assert.deepEqual(evalReal(pk, 'overallStatus', CP_IN({ clottingResult: st('absent') }), CP_PAR()), { t: 'text', v: 'incomplete' });
  // result recorded as unknown
  assert.deepEqual(evalReal(pk, 'itemStates', CP_IN({ clottingResult: st('unknown') }), CP_PAR()), { t: 'row', cells: [D, D, D, 'unknown'] });
  assert.deepEqual(evalReal(pk, 'overallStatus', CP_IN({ clottingResult: st('unknown') }), CP_PAR()), { t: 'text', v: 'indeterminate' });
  // test explicitly not done
  assert.deepEqual(evalReal(pk, 'itemStates', CP_IN({ clottingTestStatus: st('explicitly-negative'), clottingTestStartTime: st('absent'), clottingResultReadTime: st('absent'), clottingResult: st('absent') }), CP_PAR()), { t: 'row', cells: ['explicitly-negative', 'not-applicable', 'not-applicable', 'not-applicable'] });
  // two records disagree
  assert.deepEqual(evalReal(pk, 'itemStates', CP_IN({ clottingResult: st('conflicting') }), CP_PAR()), { t: 'text', v: 'conflict' });
  // expected items not enabled
  assert.deepEqual(evalReal(pk, 'expectedDocumentedCount', CP_IN(), CP_PAR({ expectedItems: DISABLED })), { t: 'text', v: 'parameter-not-enabled' });
  assert.deepEqual(evalReal(pk, 'overallStatus', CP_IN(), CP_PAR({ expectedItems: DISABLED })), { t: 'text', v: 'parameter-not-enabled' });
});

test('(3.4 b) completeness 0.1.1 readTimeInWindow: window in hours converted to minutes, each edge rule', () => {
  const pk = real('snake-completeness.analytics.0.1.1.json');
  const win = (v, unit) => ({ readTimeWindow: { enabled: true, value: { t: 'number', v, unit } } });
  const at = (minutes) => CP_IN({ clottingResultReadTime: iv(BITE + minutes * MIN) });
  const res = (minutes, rule, w) => evalReal(pk, 'readTimeInWindow', at(minutes), CP_PAR({ ...w, ...edge(rule) })).v;
  for (const w of [win(1, 'h'), win(60, 'min')]) {
    assert.equal(res(59, 'inside', w), 'in-time');
    assert.equal(res(60, 'inside', w), 'in-time');
    assert.equal(res(61, 'inside', w), 'not-in-time');
    assert.equal(res(59, 'outside', w), 'in-time');
    assert.equal(res(60, 'outside', w), 'not-in-time');
  }
  assert.equal(res(-1, 'inside', win(1, 'h')), 'conflict');
  assert.equal(evalReal(pk, 'readTimeInWindow', CP_IN({ clottingResultReadTime: st('absent') }), CP_PAR({ ...win(1, 'h'), ...edge('inside') })).v, 'needs-data');
});

test('(3.4 b) the real packages are deterministic and leave their inputs alone', () => {
  const pk = real('snake-interval.analytics.0.1.1.json');
  const inputs = IV_IN(); const params = IV_PAR({ ...target(3, 'h'), ...edge('inside') });
  const snap = JSON.stringify([inputs, params]);
  const one = JSON.stringify(evaluateOutput({ prepared: pk, outputId: 'comparison', inputs, parameters: params }));
  const two = JSON.stringify(evaluateOutput({ prepared: real('snake-interval.analytics.0.1.1.json'), outputId: 'comparison', inputs: clone(inputs), parameters: clone(params) }));
  assert.equal(one, two);
  assert.equal(JSON.stringify([inputs, params]), snap);
});

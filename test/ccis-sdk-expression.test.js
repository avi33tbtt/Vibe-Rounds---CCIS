// Row 4.2d.1: the expression tree and the computation member, proved on the snake examples. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { expr, computation, input, param, conv, lit, op, OPERATORS, REF_KINDS } from '../ccis-sdk-analytics.js';
import { SdkError } from '../ccis-sdk.js';
import { compareRoutes } from '../ccis-compile.js';

const dir = new URL('../ccis/examples/snake/', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('../ccis/schemas/analytics.schema.json', import.meta.url), 'utf8'));
const refused = (fn, code, path) => {
  try { fn(); } catch (e) { assert.ok(e instanceof SdkError); if (code) assert.equal(e.code, code); if (path !== undefined) assert.equal(e.path, path); return e; }
  assert.fail('not refused');
};
const deep = (n) => { let e = { literal: true }; for (let i = 1; i < n; i += 1) e = { op: 'not', args: [e] }; return e; };
const depthOf = (e) => (e.args ? 1 + Math.max(...e.args.map(depthOf)) : 1);

test('4.2d.1: every computation of the snake examples is identical on the code route', () => {
  let deepest = 0;
  for (const f of readdirSync(dir).filter((n) => n.includes('analytics'))) {
    const doc = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    const r = compareRoutes([{ name: 'json', input: JSON.stringify(doc.computation) }, { name: 'code', input: computation(doc.computation) }]);
    assert.equal(r.identical, true, f);
    assert.equal(r.routes[0].checksum, r.routes[1].checksum);
    deepest = Math.max(deepest, ...doc.computation.map((c) => depthOf(c.expr)));
  }
  assert.ok(deepest >= 9);
});

test('4.2d.1: helpers build the same tree as the JSON form, frozen', () => {
  const json = { op: 'if', args: [{ op: 'eq', args: [{ op: 'state-of', args: [{ ref: 'input', id: 'biteTime' }] }, { literal: 'explicitly-negative' }] }, { literal: 'not-applicable' }, { ref: 'parameter', id: 'targetInterval' }] };
  const built = op('if', op('eq', op('state-of', input('biteTime')), lit('explicitly-negative')), lit('not-applicable'), param('targetInterval'));
  assert.deepEqual(built, json);
  assert.ok(Object.isFrozen(built) && Object.isFrozen(built.args) && Object.isFrozen(built.args[0].args[0]));
  assert.deepEqual(conv('minToH'), { ref: 'conversion', id: 'minToH' });
});

test('4.2d.1: operators and reference kinds equal the schema; unknown ones are refused', () => {
  assert.deepEqual(OPERATORS, schema.$defs.expr.oneOf[0].properties.op.enum);
  assert.deepEqual(REF_KINDS, schema.$defs.expr.oneOf[1].properties.ref.enum);
  refused(() => expr({ op: 'exec', args: [{ literal: true }] }), 'S-003', 'op');
  refused(() => expr({ op: 'not', args: [] }), 'S-003', 'args');
  refused(() => expr({ ref: 'file', id: 'k' }), 'S-003', 'ref');
  refused(() => expr({ op: 'not' }), 'S-002', 'args');
});

test('4.2d.1: no number can be built', () => {
  refused(() => lit(30), 'S-003', 'literal');
  for (const bad of [30, null, [], {}, undefined]) refused(() => expr({ literal: bad }), undefined, 'literal');
  refused(() => op('add', lit(false), { literal: 1.5 }), 'S-003', 'args.1.literal');
  assert.equal(lit(false).literal, false);
  assert.equal(lit('needs-data').literal, 'needs-data');
});

test('4.2d.1: node kinds are closed and exclusive', () => {
  refused(() => expr({}), 'S-003', '');
  refused(() => expr({ op: 'not', args: [lit(true)], ref: 'input' }), 'S-001', 'ref');
  refused(() => expr({ ref: 'input', id: 'k', 'x-a': 1 }), 'S-001', 'x-a');
  refused(() => expr({ literal: true, 'x-a': 1 }), 'S-001', 'x-a');
  refused(() => expr({ op: 'not', args: [lit(true)], 'x-a': 1 }), 'S-001', 'x-a');
  refused(() => expr('not'), 'S-003', '');
  refused(() => expr({ ref: 'input', id: 'Bad Id' }), 'S-003', 'id');
});

test('4.2d.1: argument order is kept and paths carry indices', () => {
  assert.deepEqual(op('sub', input('zKey'), input('aKey')).args.map((a) => a.id), ['zKey', 'aKey']);
  refused(() => expr({ op: 'and', args: [lit(true), { op: 'or', args: [{ ref: 'input', id: 'k' }, { ref: 'input', id: 'bad key' }] }] }), 'S-003', 'args.1.args.1.id');
  refused(() => computation([{ output: 'o', expr: { op: 'not', args: [{ op: 'nope', args: [lit(true)] }] } }]), 'S-003', '0.expr.args.0.op');
});

test('4.2d.1: depth is guarded; computation needs an item with a key', () => {
  assert.equal(depthOf(expr(deep(100))), 100);
  refused(() => expr(deep(101)), 'S-003');
  refused(() => computation([]), 'S-003', '');
  refused(() => computation([{ output: 'Bad', expr: lit(true) }]), 'S-003', '0.output');
  refused(() => computation([{ output: 'o', expr: lit(true), 'x-a': 1 }]), 'S-001', '0.x-a');
  assert.equal(computation([{ output: 'o', expr: lit(true) }])[0].output, 'o');
});

test('4.2d.1: a hostile string is never in a message, and the module stays pure', () => {
  const H = '<script>alert(1)</script>';
  assert.equal(refused(() => expr({ op: H, args: [lit(true)] }), 'S-003').message.includes(H), false);
  assert.equal(refused(() => expr({ literal: true, [H]: 1 }), 'S-001').message.includes(H), false);
  const src = readFileSync(new URL('../ccis-sdk-analytics.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['node:', 'Date', 'Math.random', 'fetch', 'eval', 'Function(', 'import(', 'process', 'require(']) assert.equal(src.includes(bad), false, bad);
});

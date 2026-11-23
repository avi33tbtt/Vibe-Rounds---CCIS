import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { analytics as validate } from '../ccis/validators/ccis-validators.js';

// Row 1.5b: analytics 0.1.1 of the two snake packages. Published content never changes (CCIS-REQ-013),
// so the 0.1.0 files are pinned by hash and 0.1.1 is checked against them part by part.

const dir = new URL('../ccis/examples/snake/', import.meta.url);
const text = (f) => readFileSync(new URL(f, dir), 'utf8');
const load = (f) => JSON.parse(text(f));
const clone = (x) => JSON.parse(JSON.stringify(x));
const sha = (f) => createHash('sha256').update(text(f).replace(/\r\n/g, '\n')).digest('hex');

const A0 = load('snake-interval.analytics.json');
const B0 = load('snake-completeness.analytics.json');
const A1 = load('snake-interval.analytics.0.1.1.json');
const B1 = load('snake-completeness.analytics.0.1.1.json');
const el = load('snake-envenomation.element.json');
const pw = load('snake-documentation.pathway.json');

const walk = (x, fn, path = '') => {
  if (Array.isArray(x)) x.forEach((v, i) => walk(v, fn, `${path}/${i}`));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { fn(k, v, `${path}/${k}`); walk(v, fn, `${path}/${k}`); }
};
const exprNodes = (e, f, parent = null) => { f(e, parent); if (e.args) e.args.forEach((a) => exprNodes(a, f, e)); };
const caret = (range, v) => { const [a] = range.slice(1).split('.'); return range[0] === '^' && v.split('.')[0] === a; };
const tree = (pkg, id) => pkg.computation.find((c) => c.output === id).expr;

test('0.1.0 files are exactly as published (CCIS-REQ-013): pinned by hash', () => {
  assert.equal(sha('snake-interval.analytics.json'), 'a5e91052530bf6266063cc7bc9e9b53b9f51b16e98fd738b37a83d3621b68bd8', 'snake-interval 0.1.0 changed; a change is a new version');
  assert.equal(sha('snake-completeness.analytics.json'), '8127bf1a8aec26240c0689bb05df873672724efeae934a1517c7046fd7f48583', 'snake-completeness 0.1.0 changed; a change is a new version');
  assert.equal(A0.manifest.version, '0.1.0'); assert.equal(B0.manifest.version, '0.1.0');
});

test('both 0.1.1 files validate and keep the identity of their 0.1.0 files', () => {
  for (const [n, a, b] of [['interval', A0, A1], ['completeness', B0, B1]]) {
    assert.equal(validate(b), true, `${n} ${JSON.stringify(validate.errors)}`);
    assert.equal(b.manifest.id, a.manifest.id); assert.equal(b.manifest.version, '0.1.1');
    assert.equal(b.manifest.status, 'draft'); assert.equal(b.manifest.standard.version, '0.1.0');
    assert.deepEqual(b.manifest.publisher, a.manifest.publisher); assert.deepEqual(b.manifest.references, a.manifest.references);
    assert.match(b.provenance.basis, /no clinical review/i); assert.match(b.provenance.basis, /0\.1\.1/);
    assert.match(b.provenance.basis, /0\.1\.0 file is unchanged/);
  }
  // the pathway's range ^0.1.0 accepts 0.1.1, so the pathway file does not change
  for (const ref of pw.analytics) assert.ok(caret(ref.ref.range, '0.1.1'), ref.ref.id);
});

test('every field not named in the chunk is identical to 0.1.0 (deep compare of the untouched parts)', () => {
  const back = (n1, n0, edits) => { const c = clone(n1); edits(c); delete c.conversions; return c; };
  const a = back(A1, A0, (c) => {
    c.manifest.version = A0.manifest.version;
    c.parameters.find((p) => p.id === 'targetIntervalDuration').units = A0.parameters.find((p) => p.id === 'targetIntervalDuration').units;
    c.computation.find((x) => x.output === 'comparison').expr = tree(A0, 'comparison');
    c.outputs.find((o) => o.id === 'comparison').states = A0.outputs.find((o) => o.id === 'comparison').states;
    c.provenance = A0.provenance;
  });
  assert.deepEqual(a, A0, 'analytic A: something other than the named parts changed');
  const b = back(B1, B0, (c) => {
    c.manifest.version = B0.manifest.version;
    c.parameters.find((p) => p.id === 'readTimeWindow').units = B0.parameters.find((p) => p.id === 'readTimeWindow').units;
    for (const id of ['itemStates', 'readTimeInWindow']) c.computation.find((x) => x.output === id).expr = tree(B0, id);
    c.outputs.find((o) => o.id === 'itemStates').states = B0.outputs.find((o) => o.id === 'itemStates').states;
    c.provenance = B0.provenance;
  });
  assert.deepEqual(b, B0, 'analytic B: something other than the named parts changed');
  // the interval tree and the count and overall-status trees are untouched, word for word
  assert.deepEqual(tree(A1, 'interval'), tree(A0, 'interval'));
  for (const id of ['expectedDocumentedCount', 'overallStatus']) assert.deepEqual(tree(B1, id), tree(B0, id));
});

test('the new output states are declared and the trees can reach them (findings F-1 and F-3)', () => {
  assert.ok(A1.outputs.find((o) => o.id === 'comparison').states.includes('indeterminate'));
  assert.ok(B1.outputs.find((o) => o.id === 'itemStates').states.includes('conflict'));
  const literals = (e) => { const s = new Set(); exprNodes(e, (n) => { if ('literal' in n) s.add(n.literal); }); return s; };
  assert.ok(literals(tree(A1, 'comparison')).has('indeterminate'));
  assert.ok(literals(tree(B1, 'itemStates')).has('conflict'));
  // every literal a tree can RETURN (the then and else branches of `if`, not the conditions) is a declared label or state of its output
  const returns = (e) => (e.op === 'if' ? [...returns(e.args[1]), ...returns(e.args[2])] : 'literal' in e ? [e.literal] : []);
  for (const pkg of [A1, B1]) for (const o of pkg.outputs) {
    if (o.kind === 'table') continue; // the table tree returns per-item states inside a select; the fixtures check those
    const declared = new Set([...(o.labels ?? []), ...o.states]);
    const got = returns(tree(pkg, o.id));
    assert.ok(got.length > 0, `${pkg.manifest.id}/${o.id} returns something`);
    for (const l of got) assert.ok(declared.has(l), `${pkg.manifest.id}/${o.id} returns undeclared ${l}`);
  }
  // the table tree's outermost branch returns the declared conflict state
  assert.equal(tree(B1, 'itemStates').op, 'if'); assert.deepEqual(tree(B1, 'itemStates').args[1], { literal: 'conflict' });
  // F-1: the comparison now reads the certainty and the anti-snake-venom status like the interval does
  const reads = (pkg, id) => { const s = new Set(); exprNodes(tree(pkg, id), (n) => { if (n.ref) s.add(`${n.ref}:${n.id}`); }); return s; };
  for (const need of ['input:biteTimeCertainty', 'input:antivenomStatus', 'parameter:acceptedCertainty']) assert.ok(reads(A1, 'comparison').has(need), need);
  for (const need of ['input:biteTimeCertainty', 'parameter:acceptedCertainty']) assert.equal(reads(A0, 'comparison').has(need), false, `0.1.0 did not read ${need}`);
  // F-2: the window reads whether F3 is documented, which 0.1.0 did only for the explicitly-not-performed case
  let f3Present = false;
  exprNodes(tree(B1, 'readTimeInWindow'), (n, p) => { if (n.op === 'is-present' && n.args[0].id === 'clottingTestStatus') f3Present = true; });
  assert.ok(f3Present, 'readTimeInWindow tests whether F3 is present');
});

test('the declared conversion is the only place the factor appears, and trees reach it only through convert', () => {
  for (const pkg of [A1, B1]) {
    assert.equal(pkg.conversions.length, 1);
    const k = pkg.conversions[0];
    assert.deepEqual({ id: k.id, version: k.version, from: k.from, to: k.to, kind: k.kind, factor: k.factor }, { id: 'hoursToMinutes', version: '0.1.0', from: 'h', to: 'min', kind: 'linear', factor: 60 });
    assert.match(k['x-note'], /not a clinical value/);
    // no number anywhere in any tree, and the factor (60) appears nowhere outside `conversions`
    for (const c of pkg.computation) walk(c.expr, (key, v, p) => assert.notEqual(typeof v, 'number', `${pkg.manifest.id}: number at ${p}`));
    const rest = clone(pkg); delete rest.conversions;
    walk(rest, (key, v, p) => { if (typeof v === 'number') assert.notEqual(v, k.factor, `${pkg.manifest.id}: the factor appears at ${p}`); });
    assert.equal(JSON.stringify(rest).includes('"factor"'), false);
    // every convert node: [duration parameter, declared conversion]; every duration parameter compared in a tree is converted first
    const durations = pkg.parameters.filter((p) => p.kind === 'duration');
    let converts = 0; const comparedRaw = [];
    for (const c of pkg.computation) exprNodes(c.expr, (n) => {
      if (n.op === 'convert') {
        converts += 1;
        assert.equal(n.args.length, 2);
        assert.equal(n.args[0].ref, 'parameter'); assert.ok(durations.some((d) => d.id === n.args[0].id), 'convert applies to a duration parameter');
        assert.deepEqual(n.args[1], { ref: 'conversion', id: k.id });
      }
      if (['lt', 'le', 'gt', 'ge', 'eq', 'ne'].includes(n.op)) for (const a of n.args) if (a.ref === 'parameter' && durations.some((d) => d.id === a.id)) comparedRaw.push(`${n.op}:${a.id}`);
    });
    assert.ok(converts >= 2, `${pkg.manifest.id}: both edge-rule branches convert`);
    assert.deepEqual(comparedRaw, [], `${pkg.manifest.id}: a duration parameter is compared without conversion`);
    for (const d of durations) assert.deepEqual(d.units, [k.to, k.from], `${d.id} lists the minutes and hours units`);
    // references resolve
    const ins = new Set(pkg.inputs.map((i) => i.key)); const ps = new Set(pkg.parameters.map((p) => p.id));
    for (const c of pkg.computation) exprNodes(c.expr, (n) => {
      if (n.ref === 'input') assert.ok(ins.has(n.id), n.id);
      if (n.ref === 'parameter') assert.ok(ps.has(n.id), n.id);
      if (n.ref === 'conversion') assert.equal(n.id, k.id);
    });
    assert.deepEqual(pkg.computation.map((c) => c.output).sort(), pkg.outputs.map((o) => o.id).sort(), 'one tree per output');
  }
});

test('0.1.1 artefacts keep the safety rules: parameters disabled and valueless, no placeholder, no banned key, fields exist in the element', () => {
  const banned = new Set(['recommendation', 'recommendations', 'threshold', 'dose', 'default', 'defaultValue', 'band', 'action', 'order']);
  const keys = new Set(el.fields.map((f) => f.key));
  for (const pkg of [A1, B1]) {
    for (const p of pkg.parameters) {
      assert.equal(p.enabledByDefault, false, p.id);
      for (const k of ['value', 'default', 'defaultValue', 'suggested', 'suggestedValue']) assert.equal(k in p, false, `${p.id}.${k}`);
    }
    walk(pkg, (k, _v, p) => assert.equal(banned.has(k), false, `${k} at ${p}`));
    assert.equal(JSON.stringify(pkg).includes('testOnly'), false); assert.equal(JSON.stringify(pkg).includes('test-only placeholder'), false);
    for (const i of pkg.inputs) assert.ok(keys.has(i.field), i.field);
    assert.ok(caret(pkg.context[0].ref.range, el.manifest.version));
  }
  assert.match(B1.limitations.statement, /does not mean the test was not done/);
});

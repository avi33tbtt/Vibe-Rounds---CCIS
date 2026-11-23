import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { element, terminologyBinding, decisionNode, pathway, analytics } from '../ccis/validators/ccis-validators.js';

const dir = new URL('../ccis/examples/snake/', import.meta.url);
const load = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
const el = load('snake-envenomation.element.json');
const bnd = load('snake-demo-terminology.binding.json');
const pw = load('snake-documentation.pathway.json');
const nodes = [load('snake-node-clotting.node.json'), load('snake-node-antivenom.node.json')];
const analyticsPkgs = [load('snake-interval.analytics.json'), load('snake-completeness.analytics.json')];
const all = [el, bnd, pw, ...nodes, ...analyticsPkgs];
const EL_ID = el.manifest.id;
const fieldKeys = new Set(el.fields.map((f) => f.key));

const check = (v, d) => { assert.equal(v(d), true, JSON.stringify(v.errors)); };
const walk = (x, fn, path = '') => {
  if (Array.isArray(x)) x.forEach((v, i) => walk(v, fn, `${path}/${i}`));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { fn(k, v, `${path}/${k}`); walk(v, fn, `${path}/${k}`); }
};
const exprNodes = (e, f) => { f(e); if (e.args) e.args.forEach((a) => exprNodes(a, f)); };
const caret = (range, v) => { const [a] = range.slice(1).split('.'); return range[0] === '^' && v.split('.')[0] === a; };

test('schema: every artefact validates against its own schema', () => {
  check(element, el); check(terminologyBinding, bnd); check(pathway, pw);
  nodes.forEach((n) => check(decisionNode, n));
  analyticsPkgs.forEach((a) => check(analytics, a));
});

test('cross-check: element field keys are unique and relationships and bindings resolve', () => {
  assert.equal(fieldKeys.size, el.fields.length);
  for (const r of el.relationships) { assert.ok(fieldKeys.has(r.from), r.from); assert.ok(fieldKeys.has(r.to), r.to); }
  for (const f of el.fields.filter((x) => x.type === 'code')) assert.ok(f.binding.codeSystem.id === 'ccis-demo' && f.binding.mapping.note.includes('Unverified'), f.key);
  const f3 = el.fields.find((f) => f.key === 'clottingTestStatus');
  assert.deepEqual(f3.binding, bnd, 'the standalone binding equals the field binding');
});

test('cross-check: every field names its source classes, six states and F1 allows an informant', () => {
  for (const f of el.fields) assert.deepEqual(f.epistemic.length, 6, f.key);
  assert.ok(el.fields.find((f) => f.key === 'biteTime').sourceClasses.includes('informant-reported'));
});

test('cross-check: pathway stages, nodes, transitions, needs and element version resolve', () => {
  const stages = new Set(pw.stages.map((s) => s.id));
  const nodeIds = new Set(pw.nodes.map((n) => n.id));
  for (const s of pw.stages) for (const k of s.needs ?? []) assert.ok(fieldKeys.has(k), `needs ${k}`);
  for (const t of pw.transitions) { assert.ok(stages.has(t.from) && stages.has(t.to), JSON.stringify(t)); if (t.via) assert.ok(nodeIds.has(t.via), t.via); }
  for (const n of pw.nodes) for (const oc of n.outcomes) if (oc.next.stage) assert.ok(stages.has(oc.next.stage), `${n.id}/${oc.id}`);
  assert.ok(caret(pw.elements[0].range, el.manifest.version));
  assert.equal(pw.elements[0].id, EL_ID);
  assert.ok(pw.manifest.references.some((r) => r.id === EL_ID && r.version === el.manifest.version), 'exact pin in manifest');
});

test('cross-check: every node transition it can cause is declared, and node files equal the pathway copies', () => {
  nodes.forEach((n, i) => assert.deepEqual(pw.nodes[i], n));
  for (const n of nodes) for (const oc of n.outcomes) if (oc.next.stage) assert.ok(pw.transitions.some((t) => t.via === n.id && t.to === oc.next.stage), `${n.id}/${oc.id}`);
});

test('cross-check: every node has an indeterminate outcome and a next on every outcome', () => {
  for (const n of nodes) {
    assert.ok(n.outcomes.some((o) => o.kind === 'indeterminate'), n.id);
    for (const o of n.outcomes) assert.ok(o.next.stage || o.next.end === true, `${n.id}/${o.id}`);
    assert.equal(new Set(n.outcomes.map((o) => o.id)).size, n.outcomes.length, `${n.id} outcome ids unique`);
    const inKeys = new Set(n.inputs.map((i) => i.key));
    for (const i of n.inputs) { assert.equal(i.element, EL_ID); assert.ok(fieldKeys.has(i.field), i.field); }
    for (const o of n.outcomes) for (const w of o.when) assert.ok(inKeys.has(w.input), `${n.id}/${o.id}/${w.input}`);
  }
});

test('cross-check: analytics reference the element at its exact version and every input field exists', () => {
  for (const a of analyticsPkgs) {
    assert.ok(caret(a.context[0].ref.range, el.manifest.version));
    assert.ok(a.manifest.references.some((r) => r.id === EL_ID && r.version === el.manifest.version));
    for (const i of a.inputs) { assert.equal(i.element, EL_ID); assert.ok(fieldKeys.has(i.field), i.field); assert.ok(a.context[0].fields.includes(i.field)); }
    const ft = Object.fromEntries(el.fields.map((f) => [f.key, f.type]));
    for (const i of a.inputs) assert.equal(i.type, ft[i.field], `${a.manifest.id}/${i.key} type matches the element`);
  }
});

test('cross-check: expression refs, output ids and parameter members resolve; the pathway timing parameter exists', () => {
  const paramIds = new Set(analyticsPkgs.flatMap((a) => a.parameters.map((p) => p.id)));
  for (const a of analyticsPkgs) {
    const ins = new Set(a.inputs.map((i) => i.key)); const ps = new Set(a.parameters.map((p) => p.id));
    const outs = new Set(a.outputs.map((o) => o.id));
    assert.deepEqual(a.computation.map((c) => c.output).sort(), [...outs].sort(), `${a.manifest.id} one tree per output`);
    const used = new Set();
    for (const c of a.computation) exprNodes(c.expr, (e) => {
      if (e.ref === 'input') assert.ok(ins.has(e.id), `input ${e.id}`);
      if (e.ref === 'parameter') { assert.ok(ps.has(e.id), `parameter ${e.id}`); used.add(e.id); }
    });
    for (const p of a.parameters) if (p.id !== 'populationScope') assert.ok(used.has(p.id), `${p.id} is used by ${a.manifest.id}`);
    for (const p of a.parameters.filter((x) => x.kind === 'set')) for (const m of p.allowedMembers) assert.ok(a.inputs.some((i) => i.key === m), m);
  }
  for (const t of pw.timing) assert.ok(paramIds.has(t.parameter));
  for (const ref of pw.analytics) assert.ok(analyticsPkgs.some((a) => a.manifest.id === ref.ref.id && caret(ref.ref.range, a.manifest.version)));
});

test('cross-check: every parameter is disabled and carries no value, default or suggestion', () => {
  for (const a of analyticsPkgs) for (const p of a.parameters) {
    assert.equal(p.enabledByDefault, false, p.id);
    for (const k of ['value', 'default', 'defaultValue', 'suggested', 'suggestedValue']) assert.equal(k in p, false, `${p.id}.${k}`);
  }
});

test('cross-check: no numeric literal in any expression tree', () => {
  for (const a of analyticsPkgs) for (const c of a.computation) exprNodes(c.expr, (e) => { if ('literal' in e) assert.notEqual(typeof e.literal, 'number'); });
});

test('cross-check: no artefact contains a recommendation, threshold, dose or default key', () => {
  const banned = new Set(['recommendation', 'recommendations', 'threshold', 'dose', 'default', 'defaultValue', 'band', 'action', 'order']);
  for (const doc of all) walk(doc, (k, _v, p) => assert.equal(banned.has(k), false, `${k} at ${p}`));
});

test('cross-check: all artefacts are draft, demonstration, unreviewed and standard 0.1.0', () => {
  for (const d of [el, pw, ...analyticsPkgs]) {
    assert.equal(d.manifest.status, 'draft'); assert.equal(d.manifest.version, '0.1.0'); assert.equal(d.manifest.standard.version, '0.1.0');
    assert.equal(d.manifest.publisher.name, 'Synthetic test publisher');
    if (d.provenance) assert.match(d.provenance.basis, /no clinical review/i);
  }
  assert.match(pw.intendedUse, /does not authorise/);
});

test('cross-check: analytic B states the record-not-care distinction (D-014)', () => {
  const b = analyticsPkgs[1];
  assert.match(b.limitations.statement, /does not mean the test was not done/);
  assert.ok(b.interpretation.prohibited.some((t) => /not documented as the test not having been done/.test(t)));
});

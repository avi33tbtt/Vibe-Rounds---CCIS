// Prototype. Synthetic data only. Not for clinical use.
//
// CCIS executor, part 1 (row 3.3): the whitelist expression interpreter. Pure: no network, file access, clock
// read, randomness, eval, Function or dynamic import (CCIS-REQ-063, 067, 068). It evaluates one declarative
// expression tree to one value. It does not read the context, walk decision nodes or build run results; those
// are rows 3.4a, 3.4b and 3.5. All 18 whitelisted operators are implemented (row 3.4).
//
//   prepareAnalytic({ analytic, checksum, runtime })
//     -> { ok: true, prepared, checksum, operators } | { ok: false, refusals: [{ id, meaning, output, path, op? }] }
//   evaluateOutput({ prepared, outputId, inputs, parameters })
//     -> { ok: true, value, steps } | { ok: false, refusal: { id, meaning } }
//
// - The engine runs only a prepared, pinned form (REQ-064): prepare recomputes the canonical checksum and
//   refuses a mismatch, lists EVERY static refusal (sorted), and returns a deep-frozen object that is
//   registered in a WeakSet. evaluateOutput accepts nothing else.
// - Values are plain frozen objects: bool, text, instant, number (with unit), unknown. Unknown carries the
//   input or parameter states it came from, deduplicated and sorted, and never becomes false or a default.
// - Three-valued (Kleene) logic. `and` and `or` evaluate every argument (no short-circuit). `if` with an unknown
//   condition is unknown and evaluates neither branch.
// - Limits (REQ-069): steps are counted per node visited, depth is checked at prepare, output bytes on the
//   returned value. A refusal discards everything: never a partial value.
// - Package-supplied names are looked up only in Maps and with Object.hasOwn, never as property dispatch.

import { canonicalize, checksumOf } from './ccis-compile.js';

export const ENGINE = Object.freeze({ name: 'ccis-exec', version: '0.1.0' });
export const OPERATOR_SET = Object.freeze({ name: 'ccis-core-ops', version: '0.1.0' });
export const RUNTIME_LIMIT_FIELDS = Object.freeze(['maxSteps', 'maxDepth', 'maxOutputBytes']);
export const UNKNOWN_KIND = Object.freeze(['input', 'parameter']);

// The 18 operators the analytics schema allows (D-006). Since row 3.4 this engine version implements all 18.
export const WHITELIST_OPS = Object.freeze(['and', 'or', 'not', 'is-present', 'state-of', 'eq', 'ne', 'lt', 'le', 'gt', 'ge', 'add', 'sub', 'time-diff', 'convert', 'if', 'count', 'select']);
export const IMPLEMENTED_OPS = Object.freeze([...WHITELIST_OPS]);

const HARD_MAX_DEPTH = 256; // protects the JavaScript stack whatever a package asks for
const ARITY = new Map([
  ['and', [1, Infinity]], ['or', [1, Infinity]], ['not', [1, 1]], ['is-present', [1, 1]], ['state-of', [1, 1]],
  ['eq', [2, 2]], ['ne', [2, 2]], ['lt', [2, 2]], ['le', [2, 2]], ['gt', [2, 2]], ['ge', [2, 2]], ['if', [3, 3]],
  ['add', [2, Infinity]], ['sub', [2, 2]], ['time-diff', [2, 2]], ['convert', [2, 2]], ['count', [1, Infinity]], ['select', [1, Infinity]],
]);
const WHITELIST = new Set(WHITELIST_OPS);
const IMPLEMENTED = new Set(IMPLEMENTED_OPS);
const STATES = new Set(['present', 'absent', 'unknown', 'not-collected', 'not-applicable', 'explicitly-negative', 'conflicting']);

export const EXEC_REFUSALS = Object.freeze([
  ['X-001', 'An expression uses an operator that is not on the whitelist.'],
  ['X-002', 'An expression uses an operator that is on the whitelist but not implemented in this engine version.'],
  ['X-003', 'An operator has the wrong number of arguments.'],
  ['X-004', 'An expression names an input, parameter or conversion the package does not declare, or an output has no computation or two.'],
  ['X-005', 'A reference is used where its kind is not allowed.'],
  ['X-006', 'An expression is deeper than the depth limit.'],
  ['X-007', 'The package asks for an operator set this engine does not support.'],
  ['X-008', 'The execution limits are invalid or above the runtime ceilings.'],
  ['X-009', 'The step limit was exceeded.'],
  ['X-010', 'Operands have unlike types or units.'],
  ['X-011', 'The value is larger than the output limit.'],
  ['X-012', 'The analytic is not a prepared, pinned and well-formed compiled form.'],
  ['X-013', 'A number is not finite or cannot be written in canonical form.'],
  ['X-014', 'A bound input or parameter is malformed or missing.'],
  ['X-015', 'A conversion of a kind this engine does not apply in convert is used.'],
  ['X-016', 'A select is not a valid membership test or table row for its output.'],
].map(([id, meaning]) => Object.freeze({ id, meaning })));
const MEANING = new Map(EXEC_REFUSALS.map((r) => [r.id, r.meaning]));
const refusalOf = (id) => ({ id, meaning: MEANING.get(id) });

class Refusal extends Error {
  constructor(id) { super(id); this.refusalId = id; }
}
const fail = (id) => { throw new Refusal(id); };

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const isInt = (x) => Number.isInteger(x) && x >= 1;
const major = (v) => (typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v) ? Number(v.split('.')[0]) : null);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function deepFreeze(x) {
  if (x !== null && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const k of Object.keys(x)) deepFreeze(x[k]);
  }
  return x;
}

// ---------------------------------------------------------------------------------------------
// Prepare: pinned form, static checks, every refusal listed
// ---------------------------------------------------------------------------------------------

const PREPARED = new WeakSet();

const limitsProblem = (profile, runtime) => {
  const ceilings = isObj(runtime) && isObj(runtime.limits) ? runtime.limits : null;
  if (!ceilings || !RUNTIME_LIMIT_FIELDS.every((k) => isInt(ceilings[k]))) return true;
  if (!isObj(profile) || !RUNTIME_LIMIT_FIELDS.every((k) => isInt(profile[k]) && profile[k] <= ceilings[k])) return true;
  return profile.maxDepth > HARD_MAX_DEPTH;
};

export function prepareAnalytic({ analytic, checksum, runtime } = {}) {
  const one = (id, extra = {}) => ({ ok: false, refusals: [{ ...refusalOf(id), output: null, path: '', ...extra }] });

  if (!isObj(analytic)) return one('X-012');
  const canon = canonicalize(analytic);
  if (!canon.ok || typeof checksum !== 'string' || checksumOf(canon.text) !== checksum) return one('X-012');
  const doc = JSON.parse(canon.text); // a private copy, from the pinned bytes
  if (!Array.isArray(doc.inputs) || !Array.isArray(doc.parameters) || !Array.isArray(doc.computation) || !Array.isArray(doc.outputs)) return one('X-012');
  if (!doc.inputs.every((i) => isObj(i) && typeof i.key === 'string') || !doc.parameters.every((p) => isObj(p) && typeof p.id === 'string') || !doc.outputs.every((o) => isObj(o) && typeof o.id === 'string')) return one('X-012');
  const convList = Array.isArray(doc.conversions) ? doc.conversions : [];
  if (!convList.every((c) => isObj(c) && typeof c.id === 'string')) return one('X-012');

  const refusals = [];
  const add = (id, output, path, extra = {}) => refusals.push({ ...refusalOf(id), output, path, ...extra });

  const os = doc.operatorSet;
  if (!isObj(os) || os.name !== OPERATOR_SET.name || major(os.version) !== major(OPERATOR_SET.version)) add('X-007', null, 'operatorSet');
  const badLimits = limitsProblem(doc.executionProfile, runtime);
  if (badLimits) add('X-008', null, 'executionProfile');

  const inputs = new Set(doc.inputs.map((i) => i.key));
  const paramKind = new Map(doc.parameters.map((p) => [p.id, p.kind]));
  const convs = new Set(convList.map((c) => c.id));
  const outputIds = new Set(doc.outputs.map((o) => o.id));
  const outputDecl = new Map(doc.outputs.map((o) => [o.id, o]));
  const convDecl = new Map(convList.map((c) => [c.id, c]));
  const paramDecl = new Map(doc.parameters.map((p) => [p.id, p]));

  const seen = new Set();
  const trees = [];
  doc.computation.forEach((c, i) => {
    if (!isObj(c) || typeof c.output !== 'string' || !isObj(c.expr)) { add('X-012', null, `computation[${i}]`); return; }
    if (seen.has(c.output) || !outputIds.has(c.output)) add('X-004', c.output, `computation[${i}]`);
    seen.add(c.output);
    trees.push({ output: c.output, expr: c.expr, at: `computation[${i}].expr` });
  });
  for (const id of outputIds) if (!seen.has(id)) add('X-004', id, 'computation');

  const maxDepth = badLimits ? HARD_MAX_DEPTH : doc.executionProfile.maxDepth;
  const used = new Set();
  const walk = (e, depth, path, parentOp, argIndex, output) => {
    if (depth > maxDepth) { add('X-006', output, path); return; }
    if (!isObj(e)) { add('X-012', output, path); return; }
    if (Object.hasOwn(e, 'literal')) {
      if (typeof e.literal !== 'boolean' && typeof e.literal !== 'string') add('X-012', output, path);
      return;
    }
    if (Object.hasOwn(e, 'ref')) {
      if (typeof e.id !== 'string' || !['input', 'parameter', 'conversion'].includes(e.ref)) { add('X-012', output, path); return; }
      const declared = e.ref === 'input' ? inputs.has(e.id) : e.ref === 'parameter' ? paramKind.has(e.id) : convs.has(e.id);
      if (!declared) { add('X-004', output, path); return; }
      if (e.ref === 'conversion' && !(parentOp === 'convert' && argIndex === 1)) add('X-005', output, path);
      if (e.ref === 'parameter' && paramKind.get(e.id) === 'set' && parentOp !== 'select' && parentOp !== 'is-present') add('X-005', output, path);
      return;
    }
    if (typeof e.op !== 'string' || !Array.isArray(e.args)) { add('X-012', output, path); return; }
    if (!WHITELIST.has(e.op)) { add('X-001', output, path); return; }
    used.add(e.op);
    if (!IMPLEMENTED.has(e.op)) add('X-002', output, path, { op: e.op });
    else {
      const [lo, hi] = ARITY.get(e.op);
      if (e.args.length < lo || e.args.length > hi) add('X-003', output, path);
      else if (e.op === 'convert') {
        const c = e.args[1];
        if (!(isObj(c) && c.ref === 'conversion')) add('X-005', output, `${path}.args[1]`);
        else if (convDecl.has(c.id)) {
          const d = convDecl.get(c.id);
          if (d.kind !== 'linear' || typeof d.factor !== 'number' || !Number.isFinite(d.factor)) add('X-015', output, `${path}.args[1]`);
        }
      } else if (e.op === 'select') {
        const a0 = e.args[0];
        const isSet = (x) => isObj(x) && x.ref === 'parameter' && paramKind.get(x.id) === 'set';
        if (isSet(a0)) {
          const members = paramDecl.get(a0.id).allowedMembers;
          const lit = e.args[1];
          if (e.args.length !== 2 || !isObj(lit) || typeof lit.literal !== 'string' || !Array.isArray(members) || !members.includes(lit.literal)) add('X-016', output, path);
        } else {
          const decl = outputDecl.get(output);
          if (!decl || decl.kind !== 'table' || !Array.isArray(decl.columns) || e.args.length !== decl.columns.length || e.args.some(isSet)) add('X-016', output, path);
        }
      } else if (e.op === 'is-present' || e.op === 'state-of') {
        const a = e.args[0];
        const okRef = isObj(a) && Object.hasOwn(a, 'ref') && (e.op === 'state-of' ? a.ref === 'input' : a.ref === 'input' || a.ref === 'parameter');
        if (!okRef) add('X-005', output, `${path}.args[0]`);
      }
    }
    e.args.forEach((a, i) => walk(a, depth + 1, `${path}.args[${i}]`, e.op, i, output));
  };
  for (const t of trees) walk(t.expr, 1, t.at, null, 0, t.output);

  if (refusals.length > 0) {
    refusals.sort((a, b) => cmp(a.output ?? '', b.output ?? '') || cmp(a.path, b.path) || cmp(a.id, b.id));
    return { ok: false, refusals };
  }
  const prepared = deepFreeze({
    analytic: doc,
    checksum,
    limits: { maxSteps: doc.executionProfile.maxSteps, maxDepth: doc.executionProfile.maxDepth, maxOutputBytes: doc.executionProfile.maxOutputBytes },
    trees: trees.map((t) => ({ output: t.output, expr: t.expr })),
  });
  PREPARED.add(prepared);
  return { ok: true, prepared, checksum, operators: [...used].sort() };
}

// ---------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------

const bool = (v) => ({ t: 'bool', v });
const text = (v) => ({ t: 'text', v });
const unknownOf = (because) => ({ t: 'unknown', because });

function mergeBecause(unknowns) {
  const byKey = new Map();
  for (const u of unknowns) for (const b of u.because) byKey.set(`${b.kind}\u0000${b.id}\u0000${b.state}`, b);
  return unknownOf([...byKey.values()].sort((a, b) => cmp(a.kind, b.kind) || cmp(a.id, b.id) || cmp(a.state, b.state)).map((b) => ({ kind: b.kind, id: b.id, state: b.state })));
}

// A bound value is read field by field into a fresh object; anything else is malformed (X-014).
function readValue(v, allowSet = false) {
  if (!isObj(v)) fail('X-014');
  if (allowSet && v.t === 'set') {
    if (!Array.isArray(v.members) || v.members.length === 0 || !v.members.every((m) => typeof m === 'string' && m !== '') || new Set(v.members).size !== v.members.length) fail('X-014');
    return { t: 'set', members: [...v.members].sort() };
  }
  if (v.t === 'bool' && typeof v.v === 'boolean') return bool(v.v);
  if (v.t === 'text' && typeof v.v === 'string') return text(v.v);
  if (v.t === 'instant' && Number.isSafeInteger(v.ms)) return { t: 'instant', ms: v.ms };
  if (v.t === 'number' && typeof v.v === 'number' && Number.isFinite(v.v) && typeof v.unit === 'string' && v.unit !== '') return { t: 'number', v: v.v, unit: v.unit };
  return fail('X-014');
}

function bindInputs(prepared, inputs) {
  if (!isObj(inputs)) fail('X-014');
  const map = new Map();
  for (const decl of prepared.analytic.inputs) {
    if (!Object.hasOwn(inputs, decl.key)) fail('X-014');
    const b = inputs[decl.key];
    if (!isObj(b) || typeof b.state !== 'string' || !STATES.has(b.state)) fail('X-014');
    if (b.state !== 'present') {
      if (Object.hasOwn(b, 'value') && b.value !== undefined) fail('X-014');
      map.set(decl.key, { state: b.state });
    } else if (!Object.hasOwn(b, 'value') || b.value === undefined) map.set(decl.key, { state: 'present', unreadable: true });
    else map.set(decl.key, { state: 'present', value: readValue(b.value) });
  }
  return map;
}

function bindParameters(prepared, parameters) {
  if (!isObj(parameters)) fail('X-014');
  const map = new Map();
  for (const decl of prepared.analytic.parameters) {
    if (!Object.hasOwn(parameters, decl.id)) fail('X-014');
    const b = parameters[decl.id];
    if (!isObj(b) || typeof b.enabled !== 'boolean') fail('X-014');
    if (!b.enabled) map.set(decl.id, { enabled: false });
    else {
      if (!Object.hasOwn(b, 'value') || b.value === undefined) fail('X-014');
      map.set(decl.id, { enabled: true, value: readValue(b.value, true) });
    }
  }
  return map;
}

// ---------------------------------------------------------------------------------------------
// Evaluate
// ---------------------------------------------------------------------------------------------

function compareKnown(op, a, b) {
  if (a.t !== b.t) fail('X-010');
  if (a.t === 'number' && a.unit !== b.unit) fail('X-010');
  const x = a.t === 'instant' ? a.ms : a.v;
  const y = b.t === 'instant' ? b.ms : b.v;
  if (op === 'eq') return x === y;
  if (op === 'ne') return x !== y;
  if (a.t !== 'number' && a.t !== 'instant') fail('X-010');
  if (op === 'lt') return x < y;
  if (op === 'le') return x <= y;
  if (op === 'gt') return x > y;
  return x >= y;
}

export function evaluateOutput({ prepared, outputId, inputs, parameters } = {}) {
  try {
    if (!isObj(prepared) || !PREPARED.has(prepared)) fail('X-012');
    const tree = prepared.trees.find((t) => t.output === outputId);
    if (typeof outputId !== 'string' || !tree) fail('X-004');
    const inMap = bindInputs(prepared, inputs);
    const parMap = bindParameters(prepared, parameters);
    const { maxSteps, maxOutputBytes } = prepared.limits;
    const paramKinds = new Map(prepared.analytic.parameters.map((p) => [p.id, p.kind]));
    const convs = new Map((prepared.analytic.conversions ?? []).map((c) => [c.id, c]));
    let steps = 0;
    const tick = () => { steps += 1; if (steps > maxSteps) fail('X-009'); };

    const refValue = (e) => {
      if (e.ref === 'input') {
        const b = inMap.get(e.id);
        if (b.state !== 'present') return unknownOf([{ kind: 'input', id: e.id, state: b.state }]);
        if (b.unreadable) return unknownOf([{ kind: 'input', id: e.id, state: 'unreadable' }]);
        return b.value;
      }
      const p = parMap.get(e.id);
      if (!p.enabled) return unknownOf([{ kind: 'parameter', id: e.id, state: 'parameter-not-enabled' }]);
      return p.value;
    };

    const ev = (e) => {
      tick();
      if (Object.hasOwn(e, 'literal')) return typeof e.literal === 'boolean' ? bool(e.literal) : text(e.literal);
      if (Object.hasOwn(e, 'ref')) return refValue(e);
      const op = e.op;
      if (op === 'is-present') {
        tick();
        const r = e.args[0];
        if (r.ref === 'input') { const b = inMap.get(r.id); return bool(b.state === 'present' && !b.unreadable); }
        return bool(parMap.get(r.id).enabled);
      }
      if (op === 'state-of') {
        tick();
        const b = inMap.get(e.args[0].id);
        return b.unreadable ? unknownOf([{ kind: 'input', id: e.args[0].id, state: 'unreadable' }]) : text(b.state);
      }
      if (op === 'if') {
        const c = ev(e.args[0]);
        if (c.t === 'unknown') return c;
        if (c.t !== 'bool') fail('X-010');
        return ev(e.args[c.v ? 1 : 2]);
      }
      if (op === 'convert') {
        const x = ev(e.args[0]);
        tick(); // the conversion reference leaf
        if (x.t === 'unknown') return x;
        if (x.t !== 'number') fail('X-010');
        const c = convs.get(e.args[1].id);
        if (x.unit === c.to) return x;
        if (x.unit !== c.from) fail('X-010');
        const v = x.v * c.factor;
        if (!Number.isFinite(v)) fail('X-013');
        return { t: 'number', v, unit: c.to };
      }
      const vals = e.args.map(ev); // every argument, always (no short-circuit)
      if (op === 'and' || op === 'or' || op === 'not') {
        if (vals.some((v) => v.t !== 'bool' && v.t !== 'unknown')) fail('X-010');
        const unk = vals.filter((v) => v.t === 'unknown');
        if (op === 'not') return unk.length ? vals[0] : bool(!vals[0].v);
        const decisive = op === 'and' ? false : true;
        if (vals.some((v) => v.t === 'bool' && v.v === decisive)) return bool(decisive);
        return unk.length ? mergeBecause(unk) : bool(!decisive);
      }
      const unk = vals.filter((v) => v.t === 'unknown');
      if (op === 'count') {
        if (vals.some((v) => v.t !== 'bool' && v.t !== 'unknown')) fail('X-010');
        return unk.length ? mergeBecause(unk) : { t: 'number', v: vals.filter((v) => v.v === true).length, unit: '1' };
      }
      if (op === 'select') {
        const a0 = e.args[0];
        if (a0.ref === 'parameter' && paramKinds.get(a0.id) === 'set') {
          if (unk.length) return mergeBecause(unk);
          return bool(vals[0].members.includes(vals[1].v));
        }
        if (vals.some((v) => v.t !== 'text' && v.t !== 'unknown')) fail('X-010');
        return unk.length ? mergeBecause(unk) : { t: 'row', cells: vals.map((v) => v.v) };
      }
      if (unk.length) return mergeBecause(unk);
      if (op === 'time-diff') {
        if (vals[0].t !== 'instant' || vals[1].t !== 'instant') fail('X-010');
        return { t: 'number', v: (vals[1].ms - vals[0].ms) / 60000, unit: 'min' };
      }
      if (op === 'add' || op === 'sub') {
        if (vals.some((v) => v.t !== 'number' || v.unit !== vals[0].unit)) fail('X-010');
        const v = op === 'add' ? vals.reduce((n, x) => n + x.v, 0) : vals[0].v - vals[1].v;
        if (!Number.isFinite(v)) fail('X-013');
        return { t: 'number', v, unit: vals[0].unit };
      }
      return bool(compareKnown(op, vals[0], vals[1]));
    };

    const value = deepFreeze(ev(tree.expr));
    const c = canonicalize(value);
    if (!c.ok) fail('X-013');
    if (new TextEncoder().encode(c.text).length > maxOutputBytes) fail('X-011');
    return { ok: true, value, steps };
  } catch (e) {
    if (e instanceof Refusal) return { ok: false, refusal: refusalOf(e.refusalId) };
    throw e;
  }
}

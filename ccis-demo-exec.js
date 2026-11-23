// DEMO RUNNER: replaced by rows 2.x and 3.x.
// Prototype. Synthetic data only. Not for clinical use.
//
// Demo executor (row DS2a, interval half). Pure: no clock read, randomness, network, file access, eval or
// dynamic import. A whitelist interpreter over the declarative expression trees of a package.
//
//   evaluateAnalytic(analytic, envelope, parameters, evaluationTime)
//     -> { ok: true, results: [run results] } | { ok: false, refusal: 'fixed sentence' }
//
// - Whitelist: and, or, not, is-present, state-of, eq, lt, le, time-diff, convert, if. Anything else, or any
//   tree using a name the package does not declare, refuses the WHOLE analytic before anything is evaluated.
//   Row DS2a-2 adds select and count (the completeness analytic) and tables.
// - Three-valued: an unreadable or non-present input gives "unknown" (null) in a comparison, never false. An
//   unknown condition does not pick a branch. An unknown result is `indeterminate` if the output declares it,
//   else the analytic is refused. Unknown never becomes a value.
// - Inputs have six states: present, absent, unknown, not-collected, not-applicable, explicitly-negative.
//   More than one record for a field is `conflicting` (demo rule D-047). Entered-in-error records are ignored.
// - Disabled parameters give state `parameter-not-enabled` with `dependsOnParameters`.
// - Every result validates against run-result.schema.json (a defect throws). Refusals never echo input content.
// - Warning and missing-data wording comes from a table in this file, because the package format has no place
//   for it (D-047). The demo runs the two snake analytics only.

import { analytics as vAnalytics, contextEnvelope as vEnvelope, runResult as vResult } from './ccis/validators/ccis-validators.js';

const SUPPORTED = { and: [1, Infinity], or: [1, Infinity], not: [1, 1], 'is-present': [1, 1], 'state-of': [1, 1], eq: [2, 2], lt: [2, 2], le: [2, 2], 'time-diff': [2, 2], convert: [2, 2], if: [3, 3] };
const BASE_UNIT = 'min';
const MAX_DEPTH = 64;
const INTERVAL_ID = 'snake.bite-to-antivenom-interval';
const ESTIMATED = 'biteTimeCertainty=estimated';
const LABEL = { biteTime: 'Bite time', biteTimeCertainty: 'Certainty of the bite time', antivenomStatus: 'Anti-snake-venom administration status', antivenomStartTime: 'Anti-snake-venom start time' };

class Refusal extends Error {}
const refuse = (sentence) => { throw new Refusal(sentence); };
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

// ---- time: explicit offset only; an unstated zone or an impossible date is unknown (null), never guessed ----
const TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/;
const daysIn = (y, m) => [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
function instant(t) {
  if (!isObj(t) || t.zone !== 'stated' || typeof t.value !== 'string') return null;
  const m = TIME.exec(t.value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1, 6).map(Number);
  const s = m[6] ? Number(m[6]) : 0;
  if (y < 1000 || mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo) || h > 23 || mi > 59 || s > 59) return null;
  let off = 0;
  if (m[8] !== 'Z') {
    const oh = Number(m[8].slice(1, 3)); const om = Number(m[8].slice(4, 6));
    if (oh > 23 || om > 59) return null;
    off = (m[8][0] === '-' ? -1 : 1) * (oh * 60 + om);
  }
  const ms = m[7] ? Math.round(Number('0.' + m[7]) * 1000) : 0;
  return Date.UTC(y, mo - 1, d, h, mi, s, ms) - off * 60000;
}

// ---- static checks: the whole analytic is refused before anything runs ----
function prescan(analytic) {
  const inputs = new Set(analytic.inputs.map((i) => i.key));
  const params = new Set(analytic.parameters.map((p) => p.id));
  const convs = new Set((analytic.conversions ?? []).map((c) => c.id));
  const walk = (e, depth) => {
    if (depth > MAX_DEPTH) refuse('analytic refused: expression too deep');
    if ('literal' in e) return;
    if ('ref' in e) {
      const known = { input: inputs, parameter: params, conversion: convs }[e.ref];
      if (!known.has(e.id)) refuse('analytic refused: the expression names something the package does not declare');
      return;
    }
    const arity = Object.hasOwn(SUPPORTED, e.op) ? SUPPORTED[e.op] : null;
    if (!arity) refuse('analytic refused: operator not supported by the demo executor');
    if (e.args.length < arity[0] || e.args.length > arity[1]) refuse('analytic refused: wrong number of arguments');
    const [first, second] = e.args;
    if ((e.op === 'is-present' && !('ref' in first && first.ref !== 'conversion')) || (e.op === 'state-of' && !('ref' in first && first.ref === 'input'))) refuse('analytic refused: is-present and state-of need a reference');
    if (e.op === 'convert' && !('ref' in second && second.ref === 'conversion')) refuse('analytic refused: convert needs a declared conversion');
    e.args.forEach((a, i) => { if (!(e.op === 'convert' && i === 1) && 'ref' in a && a.ref === 'conversion') refuse('analytic refused: a conversion is used outside convert'); });
    e.args.forEach((a) => walk(a, depth + 1));
  };
  const byOutput = new Map();
  for (const c of analytic.computation) { if (byOutput.has(c.output)) refuse('analytic refused: an output has two computations'); byOutput.set(c.output, c.expr); }
  const outs = new Set(analytic.outputs.map((o) => o.id));
  if (byOutput.size !== outs.size || [...byOutput.keys()].some((k) => !outs.has(k))) refuse('analytic refused: outputs and computations do not match');
  for (const e of byOutput.values()) walk(e, 0);
  return byOutput;
}

// ---- inputs and parameters ----
function readInputs(analytic, envelope) {
  const map = new Map();
  for (const inp of analytic.inputs) {
    const concept = `${inp.element}.${kebab(inp.field)}`;
    const obs = envelope.observations.filter((o) => o.status !== 'entered-in-error' && o.concept.id === concept);
    if (obs.length === 0) map.set(inp.key, { state: 'absent' });
    else if (obs.length > 1) map.set(inp.key, { state: 'conflicting' });
    else if (obs[0].state) map.set(inp.key, { state: obs[0].state });
    else if (inp.type === 'datetime' && obs[0].kind === 'datetime') map.set(inp.key, { state: 'present', t: instant(obs[0].value) });
    else if (inp.type === 'code' && obs[0].kind === 'code' && isObj(obs[0].value)) map.set(inp.key, { state: 'present', code: obs[0].value.code });
    else refuse('input refused: a record does not match the kind the package expects');
  }
  return map;
}

const toBase = (analytic, v) => {
  if (v.unit === BASE_UNIT) return v.amount;
  const c = (analytic.conversions ?? []).find((x) => x.from === v.unit && x.to === BASE_UNIT && x.kind === 'linear');
  return c ? v.amount * c.factor : null;
};

function readParams(analytic, supplied) {
  const given = supplied === undefined || supplied === null || supplied === 'none' ? {} : supplied;
  if (!isObj(given)) refuse('parameters refused: not an object');
  const map = new Map();
  for (const p of analytic.parameters) {
    if (!Object.hasOwn(given, p.id)) continue;
    const v = isObj(given[p.id]) ? given[p.id].value : undefined;
    if (p.kind === 'choice') {
      if (typeof v !== 'string' || !p.allowedChoices.includes(v)) refuse('parameters refused: a choice is not one the package allows');
      map.set(p.id, { value: v });
    } else if (p.kind === 'duration') {
      if (!isObj(v) || typeof v.amount !== 'number' || !Number.isFinite(v.amount) || typeof v.unit !== 'string' || !p.units.includes(v.unit)) refuse('parameters refused: a duration is malformed or in a unit the package does not allow');
      const mins = toBase(analytic, v);
      if (mins === null || mins < p.allowedRange.min || mins > p.allowedRange.max) refuse('parameters refused: a duration is outside the technical bound');
      map.set(p.id, { value: { amount: v.amount, unit: v.unit } });
    } else refuse('parameters refused: this kind of parameter is not supported by the demo executor');
  }
  return map;
}

// ---- the interpreter ----
const bool = (x) => (x === true || x === false || x === null ? x : refuse('analytic refused: a condition is not true, false or unknown'));

function evaluate(e, ctx) {
  if ('literal' in e) return e.literal;
  if ('ref' in e) {
    if (e.ref === 'input') {
      const i = ctx.inputs.get(e.id);
      if (i.state !== 'present') return null;
      return i.code !== undefined ? i.code : i.t === null ? null : { t: i.t };
    }
    const p = ctx.params.get(e.id);
    if (!p) return null;
    return typeof p.value === 'string' ? p.value : { q: p.value.amount, unit: p.value.unit };
  }
  const a = e.args;
  switch (e.op) {
    case 'is-present':
      if (a[0].ref === 'input') return ctx.inputs.get(a[0].id).state === 'present';
      if (ctx.params.has(a[0].id)) return true;
      ctx.trace.disabled.add(a[0].id);
      return false;
    case 'state-of': return ctx.inputs.get(a[0].id).state;
    case 'not': { const x = bool(evaluate(a[0], ctx)); return x === null ? null : !x; }
    case 'and': { const xs = a.map((x) => bool(evaluate(x, ctx))); return xs.includes(false) ? false : xs.includes(null) ? null : true; }
    case 'or': { const xs = a.map((x) => bool(evaluate(x, ctx))); return xs.includes(true) ? true : xs.includes(null) ? null : false; }
    case 'if': { const c = bool(evaluate(a[0], ctx)); return c === null ? null : evaluate(c ? a[1] : a[2], ctx); }
    case 'eq': {
      const [x, y] = a.map((v) => evaluate(v, ctx));
      if (x === null || y === null) return null;
      if (typeof x !== 'string' || typeof y !== 'string') refuse('analytic refused: eq compares only codes, states and choices here');
      const r = x === y;
      if (r && 'ref' in a[0] && a[0].ref === 'input' && 'literal' in a[1]) ctx.trace.eqTrue.add(`${a[0].id}=${y}`);
      return r;
    }
    case 'lt': case 'le': {
      const [x, y] = a.map((v) => evaluate(v, ctx));
      if (x === null || y === null) return null;
      const [l, r] = x.t !== undefined && y.t !== undefined ? [x.t, y.t] : x.q !== undefined && y.q !== undefined && x.unit === y.unit ? [x.q, y.q] : refuse('analytic refused: values of different kinds or units cannot be ordered');
      return e.op === 'lt' ? l < r : l <= r;
    }
    case 'time-diff': {
      const [x, y] = a.map((v) => evaluate(v, ctx));
      if (x === null || y === null) return null;
      if (x.t === undefined || y.t === undefined) refuse('analytic refused: time-diff needs two times');
      return { q: (y.t - x.t) / 60000, unit: BASE_UNIT };
    }
    case 'convert': { // D-042: express in the conversion's target unit; identity when already there
      const x = evaluate(a[0], ctx);
      if (x === null) return null;
      const c = ctx.conversions.get(a[1].id);
      if (x.q === undefined) refuse('analytic refused: convert needs a quantity');
      if (x.unit === c.to) return x;
      if (x.unit === c.from && c.kind === 'linear') return { q: x.q * c.factor, unit: c.to };
      return refuse('analytic refused: a quantity is in a unit the conversion does not cover');
    }
    default: return refuse('analytic refused: operator not supported by the demo executor');
  }
}

// ---- wording (D-047): from this table, not from the package ----
const inputNote = (key, state) => {
  if (key === 'antivenomStatus' && state === 'unknown') return 'Whether anti-snake-venom was given is recorded as unknown.';
  return state === 'absent' ? `${LABEL[key]} is not documented.` : `${LABEL[key]} is recorded as ${state}.`;
};

function describe(state, value, ctx) {
  const estimated = ctx.trace.eqTrue.has(ESTIMATED);
  const choice = ctx.params.get('acceptedCertainty')?.value;
  const warnings = [];
  const missing = [];
  if (estimated) warnings.push('Bite time is estimated.');
  if (state === 'conflict') warnings.push('Anti-snake-venom start time is earlier than the bite time.');
  if (value && estimated && choice === 'flag-only') warnings.push('Flag only: the result rests on an estimated bite time.');
  if (state === 'needs-data') {
    for (const k of ['biteTime', 'antivenomStartTime', 'biteTimeCertainty']) if (ctx.inputs.get(k).state !== 'present') missing.push(inputNote(k, ctx.inputs.get(k).state));
    if (estimated && choice === 'needs-data') missing.push('Bite time is only an estimate and the local choice does not accept an estimate.');
  }
  if (state === 'indeterminate') {
    const s = ctx.inputs.get('antivenomStatus').state;
    missing.push(s !== 'present' ? inputNote('antivenomStatus', s) : 'A time in the record has no stated zone or cannot be read, so no times were compared.');
  }
  return { warnings, missing };
}

function result(analytic, out, expr, ctx) {
  ctx.trace = { disabled: new Set(), eqTrue: new Set() };
  const r = evaluate(expr, ctx);
  let state;
  let value;
  if (r === null) state = 'indeterminate';
  else if (typeof r === 'string' && out.states.includes(r)) state = r;
  else if (typeof r === 'string' && out.kind === 'classification' && out.labels.includes(r)) value = { label: r };
  else if (isObj(r) && r.q !== undefined && out.kind === 'value' && r.unit === out.unit) value = { amount: r.q, unit: r.unit };
  else refuse('analytic refused: a result is not one the output declares');
  if (state && !out.states.includes(state)) refuse('analytic refused: a result is a state the output does not declare');
  const { warnings, missing } = describe(state, value, ctx);
  const res = { outputId: out.id, kind: out.kind, warnings, limitations: [analytic.limitations.statement], missingDataNotes: missing, 'x-analytic': analytic.manifest.id };
  if (state) res.state = state; else res.value = value;
  if (state === 'parameter-not-enabled') {
    res.dependsOnParameters = analytic.parameters.map((p) => p.id).filter((id) => ctx.trace.disabled.has(id));
    if (res.dependsOnParameters.length === 0) refuse('analytic refused: a not-enabled result names no parameter');
  }
  if (vResult(res) !== true) throw new Error('defect: the executor built a result that fails its schema');
  return res;
}

export function evaluateAnalytic(analytic, envelope, parameters, evaluationTime) {
  try {
    if (!isObj(analytic) || vAnalytics(analytic) !== true) refuse('analytic refused: the package does not conform to its schema');
    if (!isObj(envelope) || vEnvelope(envelope) !== true) refuse('envelope refused: does not conform to the context envelope schema');
    if (typeof evaluationTime !== 'string' || instant({ value: evaluationTime, zone: 'stated' }) === null) refuse('evaluation time refused: needs an explicit offset');
    const trees = prescan(analytic);
    if (analytic.manifest.id !== INTERVAL_ID) refuse('analytic refused: the demo executor has wording for the snake interval analytic only so far');
    const ctx = {
      inputs: readInputs(analytic, envelope),
      params: readParams(analytic, parameters),
      conversions: new Map((analytic.conversions ?? []).map((c) => [c.id, c])),
    };
    return { ok: true, results: analytic.outputs.map((o) => result(analytic, o, trees.get(o.id), ctx)) };
  } catch (err) {
    if (err instanceof Refusal) return { ok: false, refusal: err.message };
    if (err instanceof RangeError) return { ok: false, refusal: 'analytic refused: expression too deep' };
    throw err;
  }
}

// CCIS binder and result mapper (row 3.4a). Prototype. Synthetic data only. Not for clinical use.
//
// Pure: takes parsed JSON, never reads files, the clock, randomness or the network. No eval, no dynamic import.
//
//   bindContext({ prepared, context })                      -> { ok, inputs, readings } | { ok: false, refusal }
//   bindParameters({ prepared, supplied })                  -> { ok, parameters, view }  | { ok: false, refusal }
//   runAnalytic({ prepared, context, supplied, evaluationTime })
//                                                           -> { ok, results, omitted, evaluationTime } | { ok: false, refusal }
//
// - Joins three finished pieces: a 3.1 context, a 3.3/3.4 prepared analytic, and the output contract of the
//   package. It does not walk decision nodes (3.4b), plan batches or write run records (3.5).
// - A field's records are found by concept, never by position (3.1 sorts by id). Entered-in-error records are
//   ignored again here (defence in depth). No record is `absent`; more than one is `conflicting`, even if the
//   records agree (D-048). A time with no stated zone or an impossible date is an unreadable input: never a
//   number, never zero. Valid times become integer UTC milliseconds here and nowhere else.
// - Parameters are disabled unless `supplied` enables them. A supplied id the package does not declare, or a
//   malformed value, is refused: it is never read as disabled. Enabled values arrive as a plain argument (D-112).
// - Every result is checked against the output the package declares (REQ-070) and against run-result.schema.json.
//   An unknown result becomes `indeterminate` only if the output declares it; otherwise the whole analytic is
//   refused. No partial results.
// - Warning and missing-data wording cannot be carried by the package format (D-047). It comes from the labelled,
//   versioned WORDING table below, keyed by analytic id; any other analytic gets generic wording only.
// - Refusals use fixed sentences and never echo context content (IMP-091).
// - Same input, versions and parameters give byte-identical results.

import { evaluateOutput } from './ccis-exec.js';
import { canonicalize } from './ccis-compile.js';
import { runResult as vResult } from './ccis/validators/ccis-validators.js';

export const BINDER_VERSION = '0.1.0';
export const WORDING_VERSION = '0.1.0';
const CONTEXT_FORM = 'ccis-context/1';
const BASE_UNIT = 'min';

export const BIND_REFUSALS = Object.freeze([
  ['B-001', 'The analytic is not a prepared analytic.'],
  ['B-002', 'The context is not a ccis-context/1 object.'],
  ['B-003', 'The evaluation time is not a time with an explicit offset.'],
  ['B-004', 'A record does not match the kind or state the package expects for its input.'],
  ['B-005', 'An input has a type this binder version does not read.'],
  ['B-006', 'The supplied parameters are not an object, or name a parameter the package does not declare.'],
  ['B-007', 'A parameter of kind criteria cannot be applied and cannot be enabled.'],
  ['B-008', 'A supplied parameter value is malformed, not allowed, or outside the technical bound.'],
  ['B-009', 'The executor refused an output of the analytic.'],
  ['B-010', 'A result is not one the output declares.'],
  ['B-011', 'A not-enabled result names no parameter.'],
].map(([id, meaning]) => Object.freeze({ id, meaning })));
const MEANING = new Map(BIND_REFUSALS.map((r) => [r.id, r.meaning]));

class Refusal extends Error {
  constructor(id, cause) { super(id); this.refusalId = id; this.cause = cause; }
}
const fail = (id, cause) => { throw new Refusal(id, cause); };
const refusalOf = (e) => ({ id: e.refusalId, meaning: MEANING.get(e.refusalId), ...(e.cause ? { cause: e.cause } : {}) });

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const EXPLICIT_STATES = new Set(['absent', 'unknown', 'not-collected', 'not-applicable', 'explicitly-negative']);

// ---------------------------------------------------------------------------------------------
// Time: an explicit offset only. Exact or unreadable; never a guess. (No clock is involved.)
// ---------------------------------------------------------------------------------------------

const TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/;
const daysIn = (y, m) => [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
// Days since 1970-01-01 for a proleptic Gregorian date (integer arithmetic only).
function daysFromCivil(y0, m, d) {
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
export function instantOf(t) {
  if (!isObj(t) || t.zone !== 'stated' || typeof t.value !== 'string') return null;
  const m = TIME.exec(t.value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1, 6).map(Number);
  const s = m[6] ? Number(m[6]) : 0;
  if (y < 1000 || mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo) || h > 23 || mi > 59 || s > 59) return null;
  let off = 0;
  if (m[8] !== 'Z') {
    const oh = Number(m[8].slice(1, 3));
    const om = Number(m[8].slice(4, 6));
    if (oh > 23 || om > 59) return null;
    off = (m[8][0] === '-' ? -1 : 1) * (oh * 60 + om);
  }
  const ms = m[7] ? Math.round(Number('0.' + m[7]) * 1000) : 0;
  return ((daysFromCivil(y, mo, d) * 24 + h) * 60 + mi) * 60000 + s * 1000 + ms - off * 60000;
}

// ---------------------------------------------------------------------------------------------
// Context to inputs
// ---------------------------------------------------------------------------------------------

function readContext(analytic, context) {
  if (!isObj(context) || context.contextForm !== CONTEXT_FORM || !Array.isArray(context.observations)) fail('B-002');
  const inputs = {};
  const readings = {};
  for (const inp of analytic.inputs) {
    const concept = `${inp.element}.${kebab(inp.field)}`;
    const found = context.observations.filter((o) => isObj(o) && isObj(o.concept) && o.concept.id === concept && o.status !== 'entered-in-error');
    let bound;
    if (found.length === 0) bound = { state: 'absent' };
    else if (found.length > 1) bound = { state: 'conflicting' };
    else {
      const o = found[0];
      if (o.state !== undefined) {
        if (!EXPLICIT_STATES.has(o.state)) fail('B-004');
        bound = { state: o.state };
      } else if (inp.type === 'datetime') {
        if (o.kind !== 'datetime') fail('B-004');
        const ms = instantOf(o.value);
        bound = ms === null ? { state: 'present' } : { state: 'present', value: { t: 'instant', ms } };
      } else if (inp.type === 'code') {
        if (o.kind !== 'code' || !isObj(o.value) || typeof o.value.code !== 'string') fail('B-004');
        bound = { state: 'present', value: { t: 'text', v: o.value.code } };
      } else fail('B-005');
    }
    inputs[inp.key] = bound;
    readings[inp.key] = { state: bound.state, unreadable: bound.state === 'present' && bound.value === undefined };
  }
  return { inputs, readings };
}

// ---------------------------------------------------------------------------------------------
// Supplied parameters to parameters
// ---------------------------------------------------------------------------------------------

function toBase(analytic, unit, amount) {
  if (unit === BASE_UNIT) return amount;
  const c = (analytic.conversions ?? []).find((x) => x.from === unit && x.to === BASE_UNIT && x.kind === 'linear');
  return c ? amount * c.factor : null;
}

function readSupplied(analytic, supplied) {
  const given = supplied === undefined || supplied === null ? {} : supplied;
  if (!isObj(given)) fail('B-006');
  const declared = new Set(analytic.parameters.map((p) => p.id));
  for (const id of Object.keys(given)) if (!declared.has(id)) fail('B-006');
  const parameters = {};
  const view = {};
  for (const p of analytic.parameters) {
    if (!Object.hasOwn(given, p.id)) { parameters[p.id] = { enabled: false }; view[p.id] = { enabled: false }; continue; }
    const entry = given[p.id];
    if (!isObj(entry) || entry.value === undefined) fail('B-008');
    const v = entry.value;
    if (p.kind === 'criteria') fail('B-007');
    if (p.kind === 'choice') {
      if (typeof v !== 'string' || !Array.isArray(p.allowedChoices) || !p.allowedChoices.includes(v)) fail('B-008');
      parameters[p.id] = { enabled: true, value: { t: 'text', v } };
    } else if (p.kind === 'duration') {
      if (!isObj(v) || typeof v.amount !== 'number' || !Number.isFinite(v.amount) || typeof v.unit !== 'string' || !Array.isArray(p.units) || !p.units.includes(v.unit)) fail('B-008');
      const mins = toBase(analytic, v.unit, v.amount);
      if (mins === null || !Number.isFinite(mins) || mins < p.allowedRange.min || mins > p.allowedRange.max) fail('B-008');
      parameters[p.id] = { enabled: true, value: { t: 'number', v: v.amount, unit: v.unit } };
    } else if (p.kind === 'set') {
      if (!Array.isArray(v) || v.length === 0 || new Set(v).size !== v.length || v.some((m) => typeof m !== 'string' || !Array.isArray(p.allowedMembers) || !p.allowedMembers.includes(m))) fail('B-008');
      parameters[p.id] = { enabled: true, value: { t: 'set', members: [...v] } };
    } else fail('B-008');
    view[p.id] = { enabled: true, value: v };
  }
  return { parameters, view };
}

// ---------------------------------------------------------------------------------------------
// Wording (D-047): labelled, versioned tables. Chosen by what the evaluation did, never by the package.
// ---------------------------------------------------------------------------------------------

const INTERVAL_ID = 'snake.bite-to-antivenom-interval';
const COMPLETENESS_ID = 'snake.clotting-documentation-completeness';
const readable = (r) => r.state === 'present' && !r.unreadable;

const LABEL1 = { biteTime: 'Bite time', biteTimeCertainty: 'Certainty of the bite time', antivenomStatus: 'Anti-snake-venom administration status', antivenomStartTime: 'Anti-snake-venom start time' };
const LABEL2 = { clottingTestStatus: 'Clotting test status', clottingTestStartTime: 'Test start time', clottingResultReadTime: 'Result read time', clottingResult: 'Clotting result' };
const NOUN2 = { clottingTestStatus: 'clotting test status', clottingTestStartTime: 'test start time', clottingResultReadTime: 'result read time', clottingResult: 'clotting result' };

function inputNote(labels, key, reading) {
  if (reading.unreadable) return `${labels[key]} is recorded but cannot be read as a time.`;
  if (key === 'antivenomStatus' && reading.state === 'unknown') return 'Whether anti-snake-venom was given is recorded as unknown.';
  return reading.state === 'absent' ? `${labels[key]} is not documented.` : `${labels[key]} is recorded as ${reading.state}.`;
}

// True when the evaluation reached the certainty check and the bite time is an estimate.
function estimateReached(outputId, ctx) {
  const { readings: R, inputs: I, view: P } = ctx;
  if (!['biteTime', 'antivenomStartTime', 'biteTimeCertainty', 'antivenomStatus'].every((k) => readable(R[k]))) return false;
  if (outputId === 'comparison' && !(P.targetIntervalDuration?.enabled && P.edgeRule?.enabled)) return false;
  if (I.antivenomStartTime.value.ms < I.biteTime.value.ms) return false;
  return I.biteTimeCertainty.value.v === 'estimated';
}

function describeInterval(out, state, hasValue, ctx) {
  const estimated = estimateReached(out.id, ctx);
  const choice = ctx.view.acceptedCertainty?.enabled ? ctx.view.acceptedCertainty.value : undefined;
  const warnings = [];
  const missing = [];
  if (estimated) warnings.push('Bite time is estimated.');
  if (state === 'conflict') warnings.push('Anti-snake-venom start time is earlier than the bite time.');
  if (hasValue && estimated && choice === 'flag-only') warnings.push('Flag only: the result rests on an estimated bite time.');
  if (state === 'needs-data') {
    for (const k of ['biteTime', 'antivenomStartTime', 'biteTimeCertainty']) {
      const r = ctx.readings[k];
      if (r.state !== 'present' || r.unreadable) missing.push(inputNote(LABEL1, k, r));
    }
    if (estimated && choice === 'needs-data') missing.push('Bite time is only an estimate and the local choice does not accept an estimate.');
  }
  if (state === 'indeterminate') {
    const r = ctx.readings.antivenomStatus;
    missing.push(!readable(r) ? inputNote(LABEL1, 'antivenomStatus', r) : 'A time in the record has no stated zone or cannot be read, so no times were compared.');
  }
  return { warnings, missing };
}

function listNotes(keys, ctx) {
  const notes = [];
  const absent = keys.filter((k) => ctx.readings[k].state === 'absent');
  if (absent.length === 1) notes.push(`${LABEL2[absent[0]]} is not documented.`);
  else if (absent.length > 1) notes.push(`${[LABEL2[absent[0]], ...absent.slice(1).map((k) => NOUN2[k])].join(' and ')} are not documented.`);
  for (const k of keys) {
    const r = ctx.readings[k];
    if (r.unreadable) notes.push(inputNote(LABEL2, k, r));
    else if (r.state !== 'present' && r.state !== 'absent') notes.push(`${LABEL2[k]} is recorded as ${r.state}.`);
  }
  return notes;
}

// True when the output's computation tests whether the input is present (so the evaluation looked at it).
function testsPresence(prepared, outputId, key) {
  const walk = (e) => Array.isArray(e.args) && ((e.op === 'is-present' && e.args[0]?.ref === 'input' && e.args[0].id === key) || e.args.some(walk));
  return walk(prepared.trees.find((t) => t.output === outputId).expr);
}

function describeCompleteness(prepared, out, state, ctx) {
  const warnings = [];
  let missing = [];
  if (out.id === 'itemStates' && state === 'conflict') {
    for (const k of Object.keys(ctx.readings)) if (ctx.readings[k].state === 'conflicting') warnings.push(`Two records disagree about the ${NOUN2[k]}.`);
  }
  if (out.id === 'readTimeInWindow' && state === 'conflict') warnings.push('Result read time is earlier than the test start time.');
  if (out.id === 'readTimeInWindow' && state === 'needs-data') {
    const st = ctx.readings.clottingTestStatus;
    if (!readable(st) && testsPresence(prepared, out.id, 'clottingTestStatus')) missing = [`Clotting test status is ${st.state === 'absent' ? 'not documented' : `recorded as ${st.state}`}, so the test start time cannot be read as the start of a performed test.`];
    else missing = listNotes(['clottingTestStartTime', 'clottingResultReadTime'], ctx);
  }
  return { warnings, missing };
}

// Which parameters made a `parameter-not-enabled` result: the first group that holds a disabled parameter.
const GATES = {
  [INTERVAL_ID]: { interval: [['acceptedCertainty']], comparison: [['targetIntervalDuration', 'edgeRule'], ['acceptedCertainty']] },
  [COMPLETENESS_ID]: { expectedDocumentedCount: [['expectedItems']], overallStatus: [['expectedItems']], readTimeInWindow: [['readTimeWindow', 'edgeRule']] },
};

// Outputs with no defined result when an input conflicts (D-050), a labelled table.
const OMIT_ON_CONFLICT = { [COMPLETENESS_ID]: ['expectedDocumentedCount', 'overallStatus', 'readTimeInWindow'] };

export const WORDING = Object.freeze({
  version: WORDING_VERSION,
  note: 'Fixed wording for warnings and missing-data notes. Chosen by what the evaluation did. Carries no clinical value.',
  analytics: Object.freeze([INTERVAL_ID, COMPLETENESS_ID]),
});

function referenced(tree) {
  const params = [];
  const inputs = [];
  const walk = (e) => {
    if (Object.hasOwn(e, 'ref')) { (e.ref === 'parameter' ? params : e.ref === 'input' ? inputs : []).push(e.id); return; }
    if (Array.isArray(e.args)) e.args.forEach(walk);
  };
  walk(tree);
  return { params, inputs };
}

function genericWording(prepared, out, state, ctx) {
  const missing = [];
  if (state === 'needs-data' || state === 'indeterminate') {
    const { inputs } = referenced(prepared.trees.find((t) => t.output === out.id).expr);
    for (const k of new Set(inputs)) {
      const r = ctx.readings[k];
      if (!readable(r)) missing.push(r.unreadable ? `${k} is recorded but cannot be read as a time.` : r.state === 'absent' ? `${k} is not documented.` : `${k} is recorded as ${r.state}.`);
    }
  }
  return { warnings: [], missing };
}

function dependsOn(prepared, analytic, out, because, ctx) {
  const order = analytic.parameters.map((p) => p.id);
  const disabled = (id) => ctx.view[id] && !ctx.view[id].enabled;
  if (because) return order.filter((id) => because.has(id));
  const gates = GATES[analytic.manifest.id]?.[out.id];
  if (gates) {
    for (const group of gates) {
      const hit = order.filter((id) => group.includes(id) && disabled(id));
      if (hit.length > 0) return hit;
    }
    return [];
  }
  const { params } = referenced(prepared.trees.find((t) => t.output === out.id).expr);
  return order.filter((id) => params.includes(id) && disabled(id));
}

// ---------------------------------------------------------------------------------------------
// Value to result, checked against the declared output (REQ-070)
// ---------------------------------------------------------------------------------------------

function mapValue(out, v) {
  if (v.t === 'unknown') {
    const reasons = Array.isArray(v.because) ? v.because : [];
    const ids = reasons.filter((r) => r.kind === 'parameter' && r.state === 'parameter-not-enabled').map((r) => r.id);
    if (reasons.length > 0 && ids.length === reasons.length && out.states.includes('parameter-not-enabled')) return { state: 'parameter-not-enabled', because: new Set(ids) };
    if (!out.states.includes('indeterminate')) fail('B-010');
    return { state: 'indeterminate' };
  }
  if (v.t === 'text') {
    if (out.states.includes(v.v)) return { state: v.v };
    if (out.kind === 'classification' && Array.isArray(out.labels) && out.labels.includes(v.v)) return { value: { label: v.v } };
    return fail('B-010');
  }
  if (v.t === 'number' && out.kind === 'value' && v.unit === out.unit && (out.valueType !== 'integer' || Number.isInteger(v.v))) return { value: { amount: v.v, unit: v.unit } };
  if (v.t === 'row' && out.kind === 'table' && Array.isArray(out.columns) && v.cells.length === out.columns.length) return { value: { columns: out.columns.map((c) => c.key), rows: [[...v.cells]] } };
  return fail('B-010');
}

function buildResult(prepared, out, v, ctx) {
  const analytic = prepared.analytic;
  const mapped = mapValue(out, v);
  const state = mapped.state;
  const id = analytic.manifest.id;
  let words;
  if (id === INTERVAL_ID) words = describeInterval(out, state, mapped.value !== undefined, ctx);
  else if (id === COMPLETENESS_ID) words = describeCompleteness(prepared, out, state, ctx);
  else words = genericWording(prepared, out, state, ctx);
  const res = { outputId: out.id, kind: out.kind, warnings: words.warnings, limitations: [analytic.limitations.statement], missingDataNotes: words.missing, 'x-analytic': id };
  if (state) res.state = state; else res.value = mapped.value;
  if (state === 'parameter-not-enabled') {
    res.dependsOnParameters = dependsOn(prepared, analytic, out, mapped.because, ctx);
    if (res.dependsOnParameters.length === 0) fail('B-011');
  }
  if (vResult(res) !== true) throw new Error('defect: the binder built a result that fails its schema');
  if (!canonicalize(res).ok) throw new Error('defect: the binder built a result that cannot be put in canonical form');
  return res;
}

// ---------------------------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------------------------

const checkPrepared = (prepared) => {
  if (!isObj(prepared) || !isObj(prepared.analytic) || !Array.isArray(prepared.trees) || !Array.isArray(prepared.analytic.inputs)) fail('B-001');
};
const wrap = (fn) => {
  try { return fn(); } catch (e) {
    if (e instanceof Refusal) return { ok: false, refusal: refusalOf(e) };
    throw e;
  }
};

export function bindContext({ prepared, context } = {}) {
  return wrap(() => { checkPrepared(prepared); return { ok: true, ...readContext(prepared.analytic, context) }; });
}

export function bindParameters({ prepared, supplied } = {}) {
  return wrap(() => { checkPrepared(prepared); return { ok: true, ...readSupplied(prepared.analytic, supplied) }; });
}

export function runAnalytic({ prepared, context, supplied, evaluationTime } = {}) {
  return wrap(() => {
    checkPrepared(prepared);
    if (typeof evaluationTime !== 'string' || instantOf({ value: evaluationTime, zone: 'stated' }) === null) fail('B-003');
    const analytic = prepared.analytic;
    const { inputs, readings } = readContext(analytic, context);
    const { parameters, view } = readSupplied(analytic, supplied);
    const ctx = { inputs, readings, view };
    const conflicting = Object.values(readings).some((r) => r.state === 'conflicting');
    const gone = new Set(conflicting ? OMIT_ON_CONFLICT[analytic.manifest.id] ?? [] : []);
    if (gone.size > 0 && !analytic.outputs.find((o) => o.id === 'itemStates')?.states.includes('conflict')) gone.add('itemStates');
    const results = [];
    for (const out of analytic.outputs) {
      if (gone.has(out.id)) continue;
      const ev = evaluateOutput({ prepared, outputId: out.id, inputs, parameters });
      if (!ev.ok) fail('B-009', ev.refusal.id);
      results.push(buildResult(prepared, out, ev.value, ctx));
    }
    return { ok: true, results, omitted: analytic.outputs.filter((o) => gone.has(o.id)).map((o) => o.id), evaluationTime };
  });
}

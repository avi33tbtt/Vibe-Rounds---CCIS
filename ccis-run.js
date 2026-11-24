// CCIS run planner and run records (row 3.5). Prototype. Synthetic data only. Not for clinical use.
//
// Pure: takes parsed JSON, never reads files, the clock, randomness or the network. No eval, no dynamic import.
//
//   planRun({ pathway, analytics, held, importResult, runtime, request })  -> { ok: true, plan } | { ok: false, refusal }
//   executeRun({ plan, supplied, evaluationTime, corrects })               -> { ok: true, record } | { ok: false, refusal }
//   runIdOf(record)         -> the content address of a record's inputs ("run-" + SHA-256 hex)
//   verifyRecord(record)    -> { ok, problems }   (detects an altered record; it cannot prevent one: storage is 3.7)
//   rerunFromRecord({ record, pathway, analytics, held, runtime }) -> { ok: true, record } | { ok: false, refusal }
//   compareRerun(a, b)      -> { ok: true } | { ok: false, path }
//
// - One record per request (D-132): `package` is the pathway, the analytics go in `x-analytics` with their checksums.
//   Results: node results in route order, then analytic results by analytic id, then output order.
// - The id is the address of the run's inputs: package and analytics versions with checksums, standard, engine,
//   operator set, output contract, snapshot, parameters, evaluation time, `corrects`. Same inputs, same id.
// - Items 3.2 does not allow to run (Needs data, Incompatible) are skipped and listed in `x-plan`; nothing runnable
//   is a refusal and no record. `request.runNeedsData: true` (opt-in, D-133) also runs Needs data items; it is part of the id. A refusal by the walker or binder, or a refused import, is a `failed` record with
//   no results and a fixed message (D-044). Never partial results.
// - Enabled parameter values go to the binder only; compatibility is unchanged (D-112 stays open).
// - The record is checked against its schema, deep-frozen, and nothing passed in is changed.
// - Refusals use fixed sentences and never echo input.

import { runRecord as vRecord } from './ccis/validators/ccis-validators.js';
import { canonicalize, checksumOf } from './ccis-compile.js';
import { prepareAnalytic, ENGINE, OPERATOR_SET } from './ccis-exec.js';
import { runAnalytic } from './ccis-bind.js';
import { walkPathway } from './ccis-walk.js';
import { resolveCompatibility, executionPolicy, versionSatisfies } from './ccis-compat.js';
import { STANDARD_VERSION, CONTEXT_FORM } from './ccis-import.js';

export const RUNNER_VERSION = '0.1.0';
export const RUN_OUTPUT_CONTRACT_VERSION = '0.1.0';
export const TEST_ONLY_NOTE = 'test-only placeholder values, not clinical values';
export const PROTOTYPE_LIMITATION = 'Prototype. Synthetic data only. Not for clinical use.';
const ID_FORM = 'ccis-run-id/1';
const UNREADABLE_CASE = 'unreadable-case-ref';

export const RUN_REFUSALS = Object.freeze([
  ['R-001', 'The request is not shaped as the planner expects.'],
  ['R-002', 'An analytics package has no checksum, or its checksum does not match its content.'],
  ['R-003', 'An analytics package is not one the pathway names, or the compatibility check does not know it.'],
  ['R-004', 'Two analytics packages declare the same parameter id differently.'],
  ['R-005', 'A supplied parameter is not declared by any package in the request, or its value cannot be held in a record.'],
  ['R-006', 'Nothing in the request may run.'],
  ['R-007', 'An analytics package cannot be prepared for execution.'],
  ['R-008', 'The evaluation time is missing or is not an instant with a stated zone.'],
  ['R-009', 'An artefact given for the rerun is not the one the record names.'],
  ['R-010', 'The record fails verification.'],
  ['R-011', 'The record has no snapshot to run again from.'],
].map(([id, meaning]) => Object.freeze({ id, meaning })));
const MEANING = new Map(RUN_REFUSALS.map((r) => [r.id, r.meaning]));

class Refusal extends Error {
  constructor(id) { super(id); this.refusalId = id; }
}
const fail = (id) => { throw new Refusal(id); };
const wrap = (fn) => {
  try { return fn(); } catch (e) {
    if (e instanceof Refusal) return { ok: false, refusal: { id: e.refusalId, meaning: MEANING.get(e.refusalId) } };
    throw e;
  }
};

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const clone = (x) => structuredClone(x);
const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };
const canon = (x) => { const c = canonicalize(x); if (!c.ok) throw new Error('defect: a value cannot be put in canonical form'); return c.text; };
const sum = (x) => checksumOf(canon(x));
const ref = (m) => ({ id: m.id, version: m.version });

// An instant with a stated zone and a real calendar date (no Date object: no clock, no locale).
function validInstant(t) {
  const m = typeof t === 'string' ? /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?(Z|[+-](\d\d):(\d\d))$/.exec(t) : null;
  if (!m) return false;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= dim && h < 24 && mi < 60 && s < 60 && (m[7] === 'Z' || (Number(m[8]) < 24 && Number(m[9]) < 60));
}

// ---------------------------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------------------------

const reasonsOf = (entry) => [...new Set((entry.checks ?? []).flatMap((c) => (c.findings ?? []).map((f) => f.reason)))].sort();
// `runNeedsData` is the caller's opt-in (D-133): a package whose only problem is missing data runs, so a package that
// exists to report missing data can do so. The status rules still apply: it is judged as if it were runnable.
const mayRunEntry = (entry, mode, runNeedsData) => entry.policy.mayRun || (runNeedsData && entry.outcome === 'needs-data' && executionPolicy({ ...entry, outcome: 'compatible-with-limitations' }, { mode }).mayRun);
const planItem = (kind, r, entry, mode, runNeedsData) => ({ kind, id: r.id, version: r.version, action: entry && mayRunEntry(entry, mode, runNeedsData) ? 'run' : 'skip', outcome: entry ? entry.outcome : null, reasons: entry ? reasonsOf(entry) : [] });

export function planRun({ pathway, analytics, held, importResult, runtime, request } = {}) {
  return wrap(() => {
    if (!isObj(pathway) || !isObj(pathway.manifest) || !Array.isArray(analytics) || analytics.length === 0 || !Array.isArray(held) || !isObj(importResult) || typeof importResult.ok !== 'boolean') fail('R-001');
    if (!canonicalize(pathway).ok) fail('R-001');
    const mode = isObj(request) && request.mode !== undefined ? request.mode : 'preview';
    const runNeedsData = isObj(request) && request.runNeedsData === true;
    const list = [];
    for (const a of analytics) {
      if (!isObj(a) || !isObj(a.analytic) || !isObj(a.analytic.manifest) || !Array.isArray(a.analytic.parameters)) fail('R-001');
      const c = canonicalize(a.analytic);
      if (!c.ok || typeof a.checksum !== 'string' || checksumOf(c.text) !== a.checksum) fail('R-002');
      const m = a.analytic.manifest;
      const named = (Array.isArray(pathway.analytics) ? pathway.analytics : []).some((p) => isObj(p) && isObj(p.ref) && p.ref.id === m.id && versionSatisfies(p.ref.range, m.version));
      if (!named) fail('R-003');
      if (list.some((x) => x.analytic.manifest.id === m.id)) fail('R-001');
      list.push({ analytic: a.analytic, checksum: a.checksum });
    }
    list.sort((a, b) => byId(a.analytic.manifest, b.analytic.manifest));
    const decls = new Map();
    for (const a of list) for (const p of a.analytic.parameters) {
      if (decls.has(p.id) && canon(decls.get(p.id)) !== canon(p)) fail('R-004');
      decls.set(p.id, p);
    }
    const pathwayRef = ref(pathway.manifest);
    const plan = { form: 'ccis-run-plan/1', mode, runNeedsData, pathway, pathwayChecksum: sum(pathway), importResult, analytics: [], items: [] };
    if (importResult.ok !== true) {
      plan.items = [planItem('pathway', pathwayRef, null, mode, false), ...list.map((a) => planItem('analytic', ref(a.analytic.manifest), null, mode, false))];
      plan.items.forEach((i) => { i.action = 'not-run'; });
      plan.analytics = list.map((a) => ({ ...a, run: false, prepared: null }));
      return { ok: true, plan };
    }
    const compat = resolveCompatibility({ pathway, held, context: importResult.context, runtime, request: { mode } });
    plan.items.push(planItem('pathway', pathwayRef, compat.pathway, mode, runNeedsData));
    for (const a of list) {
      const m = a.analytic.manifest;
      const entry = (compat.packages ?? []).find((p) => p.ref.id === m.id && p.ref.version === m.version);
      if (!entry) fail('R-003');
      const item = planItem('analytic', ref(m), entry, mode, runNeedsData);
      plan.items.push(item);
      let prepared = null;
      if (item.action === 'run') {
        const p = prepareAnalytic({ analytic: a.analytic, checksum: a.checksum, runtime });
        if (!p.ok) fail('R-007');
        prepared = p.prepared;
      }
      plan.analytics.push({ ...a, run: item.action === 'run', prepared });
    }
    plan.banners = compat.pathway.policy.banners.map((b) => b.text);
    if (!plan.items.some((i) => i.action === 'run')) fail('R-006');
    return { ok: true, plan };
  });
}

// ---------------------------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------------------------

function parameterEntries(plan, supplied) {
  const given = supplied === undefined || supplied === null ? {} : supplied;
  if (!isObj(given)) fail('R-005');
  const decls = new Map();
  for (const a of plan.analytics) for (const p of a.analytic.parameters) if (!decls.has(p.id)) decls.set(p.id, p);
  for (const id of Object.keys(given)) if (!decls.has(id)) fail('R-005');
  const entries = [];
  let testOnly = false;
  for (const [id, d] of decls) {
    if (!Object.hasOwn(given, id)) { entries.push({ id, enabled: false }); continue; }
    const g = given[id];
    const v = isObj(g) ? g.value : undefined;
    const e = { id, enabled: true };
    if (d.kind === 'duration' && isObj(v) && typeof v.amount === 'number' && typeof v.unit === 'string') { e.value = v.amount; e.units = v.unit; }
    else if (d.kind === 'choice' && typeof v === 'string') e.value = v;
    else if (d.kind === 'set' && Array.isArray(v) && v.every((m) => typeof m === 'string')) e.value = [...v];
    else fail('R-005');
    if (typeof d.suppliedBy !== 'string') fail('R-005');
    e.suppliedBy = d.suppliedBy;
    if (g.testOnly === true) { e['x-testOnly'] = true; testOnly = true; }
    entries.push(e);
  }
  return { entries, testOnly, decls };
}

// ---------------------------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------------------------

// What the id is the address of. Built from the record's own members, so verifyRecord can rebuild it.
function idInput(r) {
  return {
    form: ID_FORM,
    package: r.package,
    pathwayChecksum: r['x-pathwayChecksum'],
    analytics: r['x-analytics'],
    standard: r.standard,
    engine: r.engine,
    operatorSet: r.operatorSet,
    outputContract: r.outputContractVersion,
    snapshot: r.snapshot,
    parameters: r.parameters.map(({ id, enabled, value, units }) => ({ id, enabled, ...(value !== undefined ? { value } : {}), ...(units !== undefined ? { units } : {}) })),
    evaluationTime: r.evaluationTime,
    plan: { mode: r['x-plan'].mode, runNeedsData: r['x-plan'].runNeedsData },
    corrects: r.corrects ?? null,
    status: r.status,
    failure: r.status === 'failed' ? r.failure : null,
    envelopeChecksum: r['x-checksums'].envelope ?? null,
  };
}
export const runIdOf = (record) => `run-${sum(idInput(record)).slice('sha256:'.length)}`;

const failedMessage = (id, meaning) => `${id}: ${meaning}`;

function finish(plan, entries, testOnly, evaluationTime, corrects, body) {
  const ok = plan.importResult.ok === true;
  const ctx = ok ? plan.importResult.context : null;
  const failed = body.failure !== undefined;
  const rec = {
    id: 'pending',
    ...(corrects !== undefined ? { corrects } : {}),
    status: failed ? 'failed' : 'completed',
    ...(failed ? { failure: body.failure } : {}),
    package: ref(plan.pathway.manifest),
    standard: { version: STANDARD_VERSION },
    engine: { version: ENGINE.version },
    operatorSet: { name: OPERATOR_SET.name, version: OPERATOR_SET.version },
    context: ok ? { elements: ctx.applied.elements, pathways: ctx.applied.pathways } : { elements: [], pathways: [] },
    snapshot: ok ? { case: ctx.case, observations: ctx.observations, events: ctx.events } : { case: { ref: UNREADABLE_CASE }, observations: [], events: [] },
    parameters: ok ? entries : [],
    evaluationTime: { value: evaluationTime, zone: 'stated' },
    outputContractVersion: RUN_OUTPUT_CONTRACT_VERSION,
    validationMessages: [],
    importReport: plan.importResult.report,
    results: failed ? [] : body.results,
    warnings: failed ? [] : [...new Set([...(plan.banners ?? []), ...(testOnly ? [TEST_ONLY_NOTE] : [])])],
    limitations: [PROTOTYPE_LIMITATION],
    'x-pathwayChecksum': plan.pathwayChecksum,
    'x-analytics': plan.analytics.map((a) => ({ ...ref(a.analytic.manifest), checksum: a.checksum })),
    'x-plan': { mode: plan.mode, runNeedsData: plan.runNeedsData, items: plan.items },
    'x-checksums': { envelope: plan.importResult.envelopeChecksum ?? null, context: ok ? plan.importResult.contextChecksum : null, results: sum(failed ? [] : body.results) },
    ...(failed || !body.trace ? {} : { 'x-trace': body.trace }),
    ...(!failed && body.omitted && Object.keys(body.omitted).length > 0 ? { 'x-omitted': body.omitted } : {}),
    ...(testOnly ? { 'x-testOnly': true } : {}),
  };
  const out = clone(rec);
  out.id = runIdOf(out);
  if (vRecord(out) !== true) throw new Error(`defect: the run record fails its schema: ${JSON.stringify(vRecord.errors)}`);
  return deepFreeze(out);
}

export function executeRun({ plan, supplied, evaluationTime, corrects } = {}) {
  return wrap(() => {
    if (!isObj(plan) || plan.form !== 'ccis-run-plan/1' || !Array.isArray(plan.analytics) || !isObj(plan.importResult)) fail('R-001');
    if (!validInstant(evaluationTime)) fail('R-008');
    if (corrects !== undefined && (typeof corrects !== 'string' || !/^\S+$/.test(corrects))) fail('R-001');
    const { entries, testOnly } = parameterEntries(plan, supplied);
    if (plan.importResult.ok !== true) {
      const reason = plan.importResult.report.refusalReason;
      return { ok: true, record: finish(plan, [], false, evaluationTime, corrects, { failure: { rule: 'validation', message: typeof reason === 'string' ? reason : 'the import was refused' } }) };
    }
    const context = plan.importResult.context;
    const results = [];
    const omitted = {};
    let trace;
    const stop = (r) => ({ ok: true, record: finish(plan, entries, testOnly, evaluationTime, corrects, { failure: { rule: 'other', message: failedMessage(r.refusal.id, r.refusal.meaning) } }) });
    if (plan.items[0].action === 'run') {
      const w = walkPathway({ pathway: plan.pathway, context });
      if (!w.ok) return stop(w);
      results.push(...w.results);
      trace = w.trace;
    }
    for (const a of plan.analytics) {
      if (!a.run) continue;
      const declared = new Set(a.analytic.parameters.map((p) => p.id));
      const mine = Object.fromEntries(Object.entries(supplied ?? {}).filter(([k]) => declared.has(k)).map(([k, v]) => [k, { value: v.value }]));
      const r = runAnalytic({ prepared: a.prepared, context, supplied: mine, evaluationTime });
      if (!r.ok) return stop(r);
      results.push(...r.results);
      if (r.omitted.length > 0) omitted[a.analytic.manifest.id] = r.omitted;
    }
    return { ok: true, record: finish(plan, entries, testOnly, evaluationTime, corrects, { results, trace, omitted }) };
  });
}

// ---------------------------------------------------------------------------------------------
// Verify, rerun, compare
// ---------------------------------------------------------------------------------------------

export function verifyRecord(record) {
  const problems = [];
  try {
    if (!isObj(record) || vRecord(record) !== true) return { ok: false, problems: ['schema'] };
    if (runIdOf(record) !== record.id) problems.push('id');
    if (sum(record.results) !== record['x-checksums'].results) problems.push('results');
  } catch {
    return { ok: false, problems: ['unreadable'] };
  }
  return { ok: problems.length === 0, problems };
}

const suppliedOf = (record) => {
  const out = {};
  for (const p of record.parameters) {
    if (!p.enabled) continue;
    out[p.id] = { value: p.units !== undefined ? { amount: p.value, unit: p.units } : p.value, ...(p['x-testOnly'] ? { testOnly: true } : {}) };
  }
  return out;
};

export function rerunFromRecord({ record, pathway, analytics, held, runtime } = {}) {
  return wrap(() => {
    if (!verifyRecord(record).ok) fail('R-010');
    if (!isObj(record['x-checksums']) || record['x-checksums'].context === null) fail('R-011');
    if (!isObj(pathway) || !Array.isArray(analytics) || sum(pathway) !== record['x-pathwayChecksum']) fail('R-009');
    const want = record['x-analytics'];
    if (analytics.length !== want.length || !want.every((w) => analytics.some((a) => isObj(a) && isObj(a.analytic) && isObj(a.analytic.manifest) && a.analytic.manifest.id === w.id && a.analytic.manifest.version === w.version && a.checksum === w.checksum))) fail('R-009');
    const context = {
      contextForm: CONTEXT_FORM,
      envelope: clone(record.importReport.envelope),
      case: clone(record.snapshot.case),
      applied: clone({ elements: record.context.elements, pathways: record.context.pathways }),
      inclusions: clone(record.importReport.inclusions),
      observations: clone(record.snapshot.observations),
      events: clone(record.snapshot.events),
    };
    const importResult = { ok: true, outcome: 'read', context, contextChecksum: record['x-checksums'].context, envelopeChecksum: record['x-checksums'].envelope, report: clone(record.importReport) };
    const planned = planRun({ pathway, analytics, held, importResult, runtime, request: { mode: record['x-plan'].mode, runNeedsData: record['x-plan'].runNeedsData } });
    if (!planned.ok) return planned;
    return executeRun({ plan: planned.plan, supplied: suppliedOf(record), evaluationTime: record.evaluationTime.value, corrects: record.corrects });
  });
}

function firstDiff(a, b, path) {
  const here = path === '' ? '/' : path;
  if (a === undefined || b === undefined) return a === b ? null : here;
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) { const d = firstDiff(a[i], b[i], `${path}/${i}`); if (d !== null) return d; }
    return null;
  }
  if (isObj(a) && isObj(b)) {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) { const d = firstDiff(a[k], b[k], `${path}/${k}`); if (d !== null) return d; }
    return null;
  }
  return a === b ? null : here;
}

export function compareRerun(a, b) {
  if (canon(a) === canon(b)) return { ok: true };
  return { ok: false, path: firstDiff(a, b, '') };
}

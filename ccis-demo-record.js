// DEMO RUNNER: replaced by rows 2.x and 3.x.
// Prototype. Synthetic data only. Not for clinical use.
//
// Demo run record builder (row DS3). Pure: no clock, no randomness, no file access, no network, no hashing.
//
//   buildRunRecord({ id, package, envelope, importReport, parameters, evaluationTime, results,
//                    failure?, validationMessages?, corrects?, demoPlaceholders? }) -> run record
//   runIdInput({ package, envelope, parameters, evaluationTime }) -> canonical string the CALLER hashes
//   canonicalJson(value) -> string with sorted keys (the byte form of a record)
//
// - `id` is an input (D-031). The caller content-addresses it: SHA-256 of `runIdInput(...)`, so changing one
//   observation, one parameter, the evaluation time or one artefact version changes the id (D-009).
// - `package` is `{ pathway, analytics }`: the artefacts the run used. Only manifest ids and versions are
//   recorded, never the artefact bodies. Pass null or nothing when the artefacts could not be read.
// - `envelope` is the ORIGINAL envelope (before the loader dropped records), so the snapshot holds what was
//   received. Identity and narrative cannot be in it (the schema has no place for them).
// - `parameters` is the map given to the executor: `{ id: { value, ... } }`. The record lists every declared
//   parameter. An enabled one carries value, units and its declared role (`suppliedBy`); a disabled one
//   carries neither, so a test-only value can never appear against a parameter nobody enabled (D-013).
// - `failed` records (a `failure`, or a refused import report) carry no results (D-031). Nothing from a
//   refused envelope is echoed (D-044): the snapshot is an empty placeholder. A failure after a successful
//   import (for example an executor refusal) keeps the snapshot.
// - The result is deep-copied and frozen. The record is checked against its schema; a defect throws.

import { runRecord as vRecord } from './ccis/validators/ccis-validators.js';
import { DEMO_STANDARD_VERSION } from './ccis-demo-loader.js';

export const DEMO_ENGINE_VERSION = '0.1.0';
export const DEMO_OUTPUT_CONTRACT_VERSION = '0.1.0';
export const DEMO_PLACEHOLDER_NOTE = 'demo placeholders, not clinical values';
const PROTOTYPE_LIMITATION = 'Prototype. Synthetic data only. Not for clinical use.';
const UNREADABLE_ID = 'unreadable';
const UNREADABLE_VERSION = '0.0.0';
const UNREADABLE_CASE = 'unreadable-case-ref';
const DEFAULT_OPERATOR_SET = { name: 'ccis-core-ops', version: '0.1.0' };

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const copy = (x) => JSON.parse(JSON.stringify(x));
const deepFreeze = (x) => { if (x !== null && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isObj(value)) {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

class Defect extends Error {}
const defect = (msg) => { throw new Defect(`run record refused: ${msg}`); };

const analyticsOf = (pkg) => (isObj(pkg) && Array.isArray(pkg.analytics) ? pkg.analytics.filter((a) => isObj(a) && isObj(a.manifest)) : []);
const refOf = (m) => (isObj(m) && typeof m.id === 'string' && typeof m.version === 'string' ? { id: m.id, version: m.version } : null);

function packageRef(pkg) {
  return (isObj(pkg) && isObj(pkg.pathway) && refOf(pkg.pathway.manifest)) || { id: UNREADABLE_ID, version: UNREADABLE_VERSION };
}

function analyticsRefs(pkg) {
  return analyticsOf(pkg).map((a) => refOf(a.manifest)).filter(Boolean).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function operatorSetOf(pkg) {
  const sets = analyticsOf(pkg).map((a) => a.operatorSet).filter(isObj);
  if (sets.length === 0) return { ...DEFAULT_OPERATOR_SET };
  const [first] = sets;
  if (sets.some((s) => s.name !== first.name || s.version !== first.version)) defect('the analytics packages use different operator sets');
  return { name: first.name, version: first.version };
}

// Every declared parameter once, in declared order (first package wins), with the role it is supplied by.
function declaredParameters(pkg) {
  const out = new Map();
  for (const a of analyticsOf(pkg)) {
    for (const p of Array.isArray(a.parameters) ? a.parameters : []) {
      if (isObj(p) && typeof p.id === 'string' && !out.has(p.id)) out.set(p.id, { kind: p.kind, suppliedBy: p.suppliedBy });
    }
  }
  return out;
}

function suppliedMap(parameters) {
  if (parameters === undefined || parameters === null || parameters === 'none') return {};
  if (!isObj(parameters)) defect('parameters are not an object');
  return parameters;
}

function parameterEntries(pkg, parameters, lenient = false) {
  const declared = declaredParameters(pkg);
  if (lenient && declared.size === 0) return { entries: [], testOnly: false };
  const given = suppliedMap(parameters);
  for (const id of Object.keys(given)) if (!declared.has(id)) defect('a supplied parameter is not declared by any analytics package');
  const entries = [];
  let testOnly = false;
  for (const [id, decl] of declared) {
    if (!Object.hasOwn(given, id)) { entries.push({ id, enabled: false }); continue; }
    const g = given[id];
    const v = isObj(g) ? g.value : undefined;
    const e = { id, enabled: true };
    if (decl.kind === 'duration' && isObj(v) && typeof v.amount === 'number' && typeof v.unit === 'string') { e.value = v.amount; e.units = v.unit; }
    else if (decl.kind === 'choice' && typeof v === 'string') e.value = v;
    else if (decl.kind === 'set' && Array.isArray(v) && v.every((m) => typeof m === 'string')) e.value = [...v];
    else defect('an enabled parameter has no value the record can hold');
    if (typeof decl.suppliedBy !== 'string') defect('an enabled parameter has no declared role');
    e.suppliedBy = decl.suppliedBy;
    if (isObj(g) && g.testOnly === true) { e['x-testOnly'] = true; testOnly = true; }
    entries.push(e);
  }
  return { entries, testOnly };
}

function timeOf(evaluationTime) {
  const t = typeof evaluationTime === 'string' ? { value: evaluationTime, zone: 'stated' } : evaluationTime;
  if (!isObj(t) || t.zone !== 'stated' || typeof t.value !== 'string') defect('evaluation time must state its zone');
  return { value: t.value, zone: 'stated' };
}

// What the id is the address of. Same inputs give the same string.
export function runIdInput({ package: pkg, envelope, parameters, evaluationTime } = {}) {
  const { entries } = parameterEntries(pkg, parameters);
  return canonicalJson({
    package: packageRef(pkg),
    analytics: analyticsRefs(pkg),
    standard: DEMO_STANDARD_VERSION,
    engine: DEMO_ENGINE_VERSION,
    outputContract: DEMO_OUTPUT_CONTRACT_VERSION,
    snapshot: isObj(envelope) ? { case: envelope.case, observations: envelope.observations, events: envelope.events } : null,
    parameters: entries.map(({ id, enabled, value, units }) => ({ id, enabled, value, units })),
    evaluationTime: timeOf(evaluationTime),
  });
}

export function buildRunRecord(input) {
  if (!isObj(input)) defect('no input');
  const { id, package: pkg, envelope, importReport, parameters, evaluationTime, results, failure, validationMessages, corrects, demoPlaceholders } = input;
  if (typeof id !== 'string') defect('the id is an input and was not given');
  const refused = isObj(importReport) && importReport.outcome === 'refused';
  const failed = failure !== undefined && failure !== null ? true : refused;
  if (!isObj(importReport)) defect('the import report is missing');

  // A refused import has no readable package or envelope, so its parameters cannot be listed (D-044).
  const { entries, testOnly } = parameterEntries(pkg, parameters, refused);
  const placeholders = demoPlaceholders === true || testOnly;
  const readable = !refused && isObj(envelope);
  if (!failed && !readable) defect('the envelope is missing');

  const rec = {
    id,
    ...(corrects !== undefined ? { corrects } : {}),
    status: failed ? 'failed' : 'completed',
    ...(failed ? { failure: failureOf(failure, importReport) } : {}),
    package: packageRef(pkg),
    standard: { version: DEMO_STANDARD_VERSION },
    engine: { version: DEMO_ENGINE_VERSION },
    operatorSet: operatorSetOf(pkg),
    context: readable
      ? { elements: envelope.applied.elements, pathways: envelope.applied.pathways }
      : { elements: [], pathways: [] },
    snapshot: readable
      ? { case: envelope.case, observations: envelope.observations, events: envelope.events }
      : { case: { ref: UNREADABLE_CASE }, observations: [], events: [] },
    parameters: entries,
    evaluationTime: timeOf(evaluationTime),
    outputContractVersion: DEMO_OUTPUT_CONTRACT_VERSION,
    validationMessages: Array.isArray(validationMessages) ? validationMessages : [],
    importReport,
    results: failed ? [] : Array.isArray(results) ? results : defect('results are missing'),
    warnings: placeholders ? [DEMO_PLACEHOLDER_NOTE] : [],
    limitations: [PROTOTYPE_LIMITATION],
    'x-analytics': analyticsRefs(pkg),
    ...(placeholders ? { 'x-demo': { placeholders: true } } : {}),
  };
  if (failed && Array.isArray(results) && results.length > 0) defect('a failed run carries no results');

  const out = copy(rec);
  if (vRecord(out) !== true) throw new Error(`defect: the record builder built a run record that fails its schema: ${JSON.stringify(vRecord.errors)}`);
  return deepFreeze(out);
}

// Category sentences only: the message never carries envelope content (D-044).
function failureOf(failure, importReport) {
  if (isObj(failure)) {
    if (typeof failure.rule !== 'string' || typeof failure.message !== 'string') defect('a failure needs a rule and a message');
    return { rule: failure.rule, message: failure.message };
  }
  const reason = typeof importReport.refusalReason === 'string' ? importReport.refusalReason : 'the import was refused';
  return { rule: 'validation', message: reason };
}

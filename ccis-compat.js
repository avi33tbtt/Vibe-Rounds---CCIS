// CCIS compatibility resolver and execution policy v0 (row 3.2). Prototype. Synthetic data only. Not for clinical use.
//
// Pure: takes parsed JSON objects, never reads files, the clock, randomness or the network. Same input, same bytes out.
//
//   resolveCompatibility({ pathway, held, context, runtime, request }) -> result (one entry for the pathway, one per listed analytics package)
//   executionPolicy(entry, request)                                   -> { mayRun, banners }
//
// - Six checks (REQ-055): artefact, semantic, schema, data readiness, runtime, assurance suitability. Every entry lists all six.
// - Exactly one outcome (REQ-056). Matching is by declared ids, exact versions and declared ranges only; never by
//   similarity, case folding or a guessed mapping (REQ-060). A check that cannot be evaluated is reported as such and
//   never gives Compatible: the outcome is Incompatible and the reason says it could not be evaluated (REQ-061).
// - Findings name ids, keys, versions and ranges. They never quote a patient value, a code text or a date.
// - Data readiness reads the 3.1 canonical context only. Absent, unknown and not-collected never count as present data.

import { analytics as vAnalytics, element as vElement, pathway as vPathway } from './ccis/validators/ccis-validators.js';
import { CONTEXT_FORM } from './ccis-import.js';

export const COMPAT_VERSION = '0.1.0';
export const RESULT_FORM = 'ccis-compatibility/1';

export const OUTCOMES = Object.freeze({
  compatible: 'Compatible',
  'compatible-with-limitations': 'Compatible with limitations',
  'needs-data': 'Needs data',
  incompatible: 'Incompatible',
  'not-eligible': 'Not eligible',
});

export const CHECK_NAMES = Object.freeze(['artefact', 'semantic', 'schema', 'data-readiness', 'runtime', 'assurance']);

export const PREVIEW_BANNER = 'Preview. Prototype, synthetic data only, not validated, not for clinical use.';

// The frozen reason catalogue. `state` is the check state a finding of this kind causes.
export const COMPAT_REASONS = Object.freeze([
  { id: 'CMP-0-01', check: 'any', state: 'not-evaluable', meaning: 'A check was not evaluated because the artefact or an earlier check it depends on was not available.' },
  { id: 'CMP-1-01', check: 'artefact', state: 'not-met', meaning: 'A referenced artefact is not held under that id.' },
  { id: 'CMP-1-02', check: 'artefact', state: 'not-met', meaning: 'The artefact is held, but no held version satisfies the reference.' },
  { id: 'CMP-1-03', check: 'artefact', state: 'not-met', meaning: 'The id is held, but as a different artefact type.' },
  { id: 'CMP-1-04', check: 'artefact', state: 'not-evaluable', meaning: 'Two held documents share one id, type and version, so the one to use cannot be decided.' },
  { id: 'CMP-1-05', check: 'artefact', state: 'not-met', meaning: 'A transition names a decision node that the pathway does not define.' },
  { id: 'CMP-1-06', check: 'artefact', state: 'not-met', meaning: 'A mandatory extension is not understood by this runtime (REQ-016).' },
  { id: 'CMP-1-07', check: 'artefact', state: 'limited', meaning: 'An optional analytics package is not available, so the pathway runs without it.' },
  { id: 'CMP-1-08', check: 'artefact', state: 'not-evaluable', meaning: 'The pathway is not an object with a manifest, so nothing about it can be decided.' },
  { id: 'CMP-2-01', check: 'semantic', state: 'not-met', meaning: 'A package, node or stage names an element field that the held element does not have (exact key match only).' },
  { id: 'CMP-2-02', check: 'semantic', state: 'not-met', meaning: 'An input names an element that the package or pathway does not declare it reads.' },
  { id: 'CMP-2-03', check: 'semantic', state: 'not-met', meaning: 'An input declares a type that differs from the type of the element field.' },
  { id: 'CMP-2-04', check: 'semantic', state: 'not-met', meaning: 'An input unit is not permitted by the element field and no declared conversion covers the difference (REQ-042).' },
  { id: 'CMP-2-05', check: 'semantic', state: 'not-met', meaning: 'The context applies a different version of an artefact than the one held (REQ-025).' },
  { id: 'CMP-2-06', check: 'semantic', state: 'not-met', meaning: 'The context does not list an artefact the package or pathway reads as applied.' },
  { id: 'CMP-2-07', check: 'semantic', state: 'not-evaluable', meaning: 'A held element has no readable list of fields.' },
  { id: 'CMP-3-01', check: 'schema', state: 'not-met', meaning: 'A held document does not pass its committed schema.' },
  { id: 'CMP-3-02', check: 'schema', state: 'not-evaluable', meaning: 'This artefact type has no committed schema validator yet.' },
  { id: 'CMP-3-03', check: 'schema', state: 'not-met', meaning: 'The context is not in the form this runtime reads (ccis-context/1).' },
  { id: 'CMP-3-04', check: 'schema', state: 'not-evaluable', meaning: 'The context is not a readable object.' },
  { id: 'CMP-3-05', check: 'schema', state: 'not-met', meaning: 'An artefact is written for a standard major version this runtime does not support.' },
  { id: 'CMP-3-06', check: 'schema', state: 'not-evaluable', meaning: 'The runtime does not say which standard major versions it supports.' },
  { id: 'CMP-4-01', check: 'data-readiness', state: 'needs-data', meaning: 'No context has been imported, so nothing is available to run on.' },
  { id: 'CMP-4-02', check: 'data-readiness', state: 'needs-data', meaning: 'An input the package needs is missing: no observation, or only absent, unknown or not-collected.' },
  { id: 'CMP-4-03', check: 'data-readiness', state: 'limited', meaning: 'An input is missing, but the package declares a result for that case.' },
  { id: 'CMP-4-04', check: 'data-readiness', state: 'limited', meaning: 'A parameter is not enabled, so the results that need it will say so.' },
  { id: 'CMP-5-01', check: 'runtime', state: 'not-met', meaning: 'The engine version does not satisfy the version range the artefact requires.' },
  { id: 'CMP-5-02', check: 'runtime', state: 'not-evaluable', meaning: 'The runtime description is missing or unreadable.' },
  { id: 'CMP-5-03', check: 'runtime', state: 'not-met', meaning: 'The operator set is not one this runtime supports.' },
  { id: 'CMP-5-04', check: 'runtime', state: 'not-met', meaning: 'The package asks for execution limits above the runtime ceilings.' },
  { id: 'CMP-5-05', check: 'runtime', state: 'not-met', meaning: 'The artefact requires FHIR support that this runtime does not have.' },
  { id: 'CMP-6-01', check: 'assurance', state: 'not-met', meaning: 'The status (rejected or withdrawn) does not permit any use.' },
  { id: 'CMP-6-02', check: 'assurance', state: 'limited', meaning: 'The artefact is deprecated; it may still run in preview, as a limitation.' },
  { id: 'CMP-6-03', check: 'assurance', state: 'not-met', meaning: 'Governed use needs a validated or conditionally validated status.' },
  { id: 'CMP-6-04', check: 'assurance', state: 'not-met', meaning: 'Governed use needs a validation scope that names this exact version (REQ-052).' },
  { id: 'CMP-6-05', check: 'assurance', state: 'not-evaluable', meaning: 'The status or the requested mode is not one this runtime knows.' },
  { id: 'CMP-6-06', check: 'assurance', state: 'limited', meaning: 'A validated status carries a scope for another version, so the status is not credited.' },
]);
const REASON = new Map(COMPAT_REASONS.map((r) => [r.id, r]));

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);
const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const STATE_RANK = { met: 0, limited: 1, 'needs-data': 2, 'not-evaluable': 3, 'not-met': 4 };
const worst = (a, b) => (STATE_RANK[b] > STATE_RANK[a] ? b : a);

// ---------------------------------------------------------------------------------------------
// Versions and ranges: the same behaviour as satisfiesRange in ccis-validator.js (a test compares them).
// A pre-release never satisfies a range. Anything not understood does not satisfy: it is never guessed.
// ---------------------------------------------------------------------------------------------
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const COMPARATOR = /^([~^]|[<>]=?)?((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;
function parseVer(t) {
  const m = typeof t === 'string' ? SEMVER.exec(t) : null;
  return m ? { major: BigInt(m[1]), minor: BigInt(m[2]), patch: BigInt(m[3]), pre: m[4] ? m[4].split('.') : [] } : null;
}
const sgn = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function cmpPre(a, b) {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] === b[i]) continue;
    const na = /^\d+$/.test(a[i]);
    const nb = /^\d+$/.test(b[i]);
    if (na && nb) return sgn(BigInt(a[i]), BigInt(b[i]));
    if (na) return -1;
    if (nb) return 1;
    return sgn(a[i], b[i]);
  }
  return sgn(a.length, b.length);
}
function cmpVer(a, b) {
  const x = parseVer(a);
  const y = parseVer(b);
  if (!x || !y) return null;
  return sgn(x.major, y.major) || sgn(x.minor, y.minor) || sgn(x.patch, y.patch) || cmpPre(x.pre, y.pre);
}
export function versionSatisfies(range, version) {
  const v = parseVer(version);
  if (!v || v.pre.length > 0 || typeof range !== 'string') return false;
  for (const part of range.split(' ')) {
    const m = COMPARATOR.exec(part);
    if (!m) return false;
    const base = parseVer(m[2]);
    const c = cmpVer(version, m[2]);
    let ok;
    switch (m[1]) {
      case undefined: ok = c === 0; break;
      case '>=': ok = c >= 0; break;
      case '>': ok = c > 0; break;
      case '<=': ok = c <= 0; break;
      case '<': ok = c < 0; break;
      case '~': ok = c >= 0 && cmpVer(version, `${base.major}.${base.minor + 1n}.0`) < 0; break;
      default: {
        const upper = base.major > 0n ? `${base.major + 1n}.0.0` : base.minor > 0n ? `0.${base.minor + 1n}.0` : `0.0.${base.patch + 1n}`;
        ok = c >= 0 && cmpVer(version, upper) < 0;
      }
    }
    if (!ok) return false;
  }
  return true;
}
const refMatches = (ref, version) => (typeof ref.version === 'string' ? cmpVer(ref.version, version) === 0 : versionSatisfies(ref.range, version));
const refText = (ref) => (typeof ref.version === 'string' ? `version "${ref.version}"` : `range "${ref.range}"`);

// ---------------------------------------------------------------------------------------------
// Findings and checks
// ---------------------------------------------------------------------------------------------
function finding(reason, detail, needs) {
  return { reason, state: REASON.get(reason).state, detail, needs };
}
function mk(n, satisfied = [], findings = []) {
  let state = 'met';
  for (const f of findings) state = worst(state, f.state);
  return { check: n, name: CHECK_NAMES[n - 1], state, satisfied, findings };
}
const skipped = (n, why) => mk(n, [], [finding('CMP-0-01', `The ${CHECK_NAMES[n - 1]} check was not evaluated: ${why}.`, 'Resolve the findings of the earlier checks, then evaluate again.')]);

// The five outcomes, first rule that applies (REQ-056). A check that is not evaluable never gives Compatible.
function outcomeOf(checks) {
  const s = (n) => checks[n - 1].state;
  if (s(6) === 'not-met') return 'not-eligible';
  if ([1, 2, 3, 5].some((n) => s(n) === 'not-met') || checks.some((c) => c.state === 'not-evaluable')) return 'incompatible';
  if (s(4) === 'needs-data') return 'needs-data';
  if (checks.some((c) => c.state === 'limited')) return 'compatible-with-limitations';
  if (checks.every((c) => c.state === 'met')) return 'compatible';
  return 'incompatible';
}

// ---------------------------------------------------------------------------------------------
// Execution policy v0
// ---------------------------------------------------------------------------------------------
const STATUSES = ['draft', 'submitted', 'in-review', 'reviewed', 'validated', 'conditionally-validated', 'deprecated', 'withdrawn', 'rejected'];
const VALIDATED = ['validated', 'conditionally-validated'];
const RUNNABLE = ['compatible', 'compatible-with-limitations'];
const scopeOk = (a) => isObj(a) && VALIDATED.includes(a.status) && isObj(a.validation) && a.validation.version === a.version;

function statusPermits(mode, a) {
  if (!isObj(a) || !STATUSES.includes(a.status)) return false;
  if (mode === 'preview') return a.status !== 'rejected' && a.status !== 'withdrawn';
  if (mode === 'governed') return scopeOk(a);
  return false;
}

export function executionPolicy(entry, request) {
  const mode = !isObj(request) || request.mode === undefined ? 'preview' : request.mode;
  const a = isObj(entry) ? entry.assurance : null;
  const banners = [];
  if (statusPermits(mode, a)) {
    if (scopeOk(a)) {
      const v = a.validation;
      const scope = `version ${a.version}. Population: ${v.population}. Setting: ${v.setting}. Intended use: ${v.intendedUse}.`;
      if (a.status === 'validated') banners.push({ id: 'validated-scope', text: `Validated for ${scope}` });
      else {
        banners.push({ id: 'conditionally-validated-scope', text: `Conditionally validated for ${scope}` });
        banners.push({ id: 'conditions-must-be-shown', text: 'Conditionally validated: the conditions attached to this status must be shown wherever it appears.' });
      }
    } else banners.push({ id: 'preview-not-validated', text: PREVIEW_BANNER });
  }
  const mayRun = isObj(entry) && RUNNABLE.includes(entry.outcome) && statusPermits(mode, a);
  return { mayRun, banners };
}

function assuranceFindings(manifest, mode) {
  const f = [];
  const st = manifest.status;
  if (mode !== 'preview' && mode !== 'governed') {
    f.push(finding('CMP-6-05', 'The requested mode is not "preview" or "governed".', 'Ask for the mode "preview" or "governed".'));
  } else if (!STATUSES.includes(st)) {
    f.push(finding('CMP-6-05', 'The status is not one this runtime knows.', 'Use a status from the lifecycle list.'));
  } else if (mode === 'preview') {
    if (st === 'rejected' || st === 'withdrawn') f.push(finding('CMP-6-01', `The status "${st}" does not permit any use.`, 'Use a version with another status.'));
    if (st === 'deprecated') f.push(finding('CMP-6-02', 'The status is "deprecated".', 'Move to a newer version.'));
    if (VALIDATED.includes(st) && !(isObj(manifest.validation) && manifest.validation.version === manifest.version)) {
      f.push(finding('CMP-6-06', `The status "${st}" has no validation scope for version ${manifest.version}, so it is not credited.`, 'Record a validation scope that names this exact version.'));
    }
  } else if (!VALIDATED.includes(st)) {
    f.push(finding('CMP-6-03', `Governed use needs "validated" or "conditionally-validated"; the status is "${st}".`, 'Use a version whose status is validated, with its scope.'));
  } else if (!(isObj(manifest.validation) && manifest.validation.version === manifest.version)) {
    f.push(finding('CMP-6-04', `Governed use needs a validation scope that names version ${manifest.version}.`, 'Record a validation scope that names this exact version.'));
  }
  return f;
}
const assuranceOf = (m) => ({ status: m.status, version: m.version, validation: isObj(m.validation) ? { ...m.validation } : null });

// ---------------------------------------------------------------------------------------------
// The resolver
// ---------------------------------------------------------------------------------------------
const VALIDATORS = { 'contextual-element': vElement, 'analytics-package': vAnalytics, pathway: vPathway };
const MISSING_STATES = ['absent', 'unknown', 'not-collected'];
const ANSWERED = ['value', 'not-applicable', 'explicitly-negative'];
const LIMIT_KEYS = ['maxSteps', 'maxDepth', 'maxOutputBytes'];
const isInt = (x) => Number.isInteger(x) && x >= 0;

function runtimeProblem(rt) {
  if (!isObj(rt)) return 'the runtime description is missing';
  if (!isObj(rt.engine) || parseVer(rt.engine.version) === null) return 'the engine version is missing or not a version';
  if (!isObj(rt.operatorSet) || typeof rt.operatorSet.name !== 'string' || !Array.isArray(rt.operatorSet.majors) || !rt.operatorSet.majors.every(isInt)) return 'the operator set is missing or unreadable';
  if (!isObj(rt.limits) || !LIMIT_KEYS.every((k) => isInt(rt.limits[k]))) return 'the execution limits are missing or unreadable';
  if (rt.fhir !== undefined && !(isObj(rt.fhir) && parseVer(rt.fhir.version) !== null)) return 'the FHIR description is unreadable';
  return null;
}

export function resolveCompatibility(input) {
  const { pathway, held, context, runtime, request } = isObj(input) ? input : {};
  const mode = !isObj(request) || request.mode === undefined ? 'preview' : request.mode;
  const rtProblem = runtimeProblem(runtime);
  const rt = rtProblem ? null : runtime;
  const stdMajors = isObj(runtime) && Array.isArray(runtime.standardMajors) && runtime.standardMajors.every(isInt) ? runtime.standardMajors : null;
  const understood = isObj(runtime) && Array.isArray(runtime.understoodExtensions) ? runtime.understoodExtensions : [];

  const docs = arr(held).filter((d) => isObj(d) && isObj(d.manifest) && typeof d.manifest.id === 'string' && typeof d.manifest.type === 'string' && typeof d.manifest.version === 'string');

  // The context: absent (catalogue view), unreadable, or readable.
  const ctxPresent = context !== null && context !== undefined;
  const ctxOk = ctxPresent && isObj(context) && isObj(context.applied) && Array.isArray(context.applied.elements) && Array.isArray(context.applied.pathways) && Array.isArray(context.observations) && Array.isArray(context.events);
  const applied = (kind, id) => {
    const hit = ctxOk ? context.applied[kind].find((a) => isObj(a) && a.id === id) : undefined;
    return hit ? hit.version : undefined;
  };

  // A reference resolves to the held document of that id and type whose version satisfies it. When the context applies
  // one of those versions, that one is preferred; otherwise the highest version in range.
  function resolve(ref, preferred) {
    const same = docs.filter((d) => d.manifest.id === ref.id);
    if (same.length === 0) return { ok: false, finding: finding('CMP-1-01', `"${ref.id}" is not held.`, `Hold ${ref.type} "${ref.id}" with ${refText(ref)}.`) };
    const typed = same.filter((d) => d.manifest.type === ref.type);
    if (typed.length === 0) return { ok: false, finding: finding('CMP-1-03', `"${ref.id}" is held as "${same[0].manifest.type}", not as "${ref.type}".`, `Hold "${ref.id}" as a ${ref.type}.`) };
    const inRange = typed.filter((d) => refMatches(ref, d.manifest.version));
    if (inRange.length === 0) {
      const have = [...new Set(typed.map((d) => d.manifest.version))].sort((a, b) => (cmpVer(a, b) ?? 0)).join(', ');
      return { ok: false, finding: finding('CMP-1-02', `"${ref.id}" is held at ${have}, and none satisfies ${refText(ref)}.`, `Hold a version of "${ref.id}" that satisfies ${refText(ref)}.`) };
    }
    const pick = (inRange.find((d) => d.manifest.version === preferred)) ?? [...inRange].sort((a, b) => cmpVer(b.manifest.version, a.manifest.version))[0];
    if (inRange.filter((d) => d.manifest.version === pick.manifest.version).length > 1) {
      return { ok: false, finding: finding('CMP-1-04', `"${ref.id}" ${pick.manifest.version} is held more than once.`, `Hold one document for "${ref.id}" ${pick.manifest.version}.`) };
    }
    return { ok: true, doc: pick };
  }

  const extFindings = (label, m) => arr(m.mandatoryExtensions).filter((x) => !understood.includes(x)).map((x) => finding('CMP-1-06', `${label} requires the extension "${x}", which this runtime does not understand.`, `Run on a runtime that understands "${x}", or use a version that does not depend on it.`));

  // Check 3 pieces common to every document and to the context.
  function schemaPart(doc, label, type = doc.manifest.type) {
    const f = [];
    const sat = [];
    const v = VALIDATORS[type];
    if (!v) f.push(finding('CMP-3-02', `${label} is a "${type}", which has no committed schema validator.`, 'Wait for a validator for this type.'));
    else if (v(doc) !== true) f.push(finding('CMP-3-01', `${label} does not pass its schema.`, 'Fix the document so that it passes its schema.'));
    else sat.push(`${label} passes its schema`);
    if (stdMajors === null) f.push(finding('CMP-3-06', 'The runtime does not say which standard major versions it supports.', 'Pass the supported standard majors in the runtime description.'));
    else {
      const sv = isObj(doc.manifest.standard) ? parseVer(doc.manifest.standard.version) : null;
      if (sv !== null) {
        if (stdMajors.includes(Number(sv.major))) sat.push(`${label} is written for a supported standard major (${sv.major})`);
        else f.push(finding('CMP-3-05', `${label} is written for standard version ${doc.manifest.standard.version}; the supported majors are ${stdMajors.join(', ')}.`, 'Use an artefact written for a supported standard major.'));
      }
    }
    return { f, sat };
  }
  function contextPart() {
    if (!ctxPresent) return { f: [], sat: [] };
    if (!ctxOk) return { f: [finding('CMP-3-04', 'The context is not a readable object.', 'Import the envelope again and pass the context the importer returned.')], sat: [] };
    if (context.contextForm !== CONTEXT_FORM) return { f: [finding('CMP-3-03', `The context form is not "${CONTEXT_FORM}".`, `Pass a context in the form "${CONTEXT_FORM}".`)], sat: [] };
    return { f: [], sat: [`the context is in the form "${CONTEXT_FORM}"`] };
  }

  // Check 5: the runtime.
  function runtimePart(m, a) {
    const f = [];
    const sat = [];
    if (rtProblem) {
      f.push(finding('CMP-5-02', `The runtime cannot be read: ${rtProblem}.`, 'Pass a complete runtime description.'));
      return { f, sat };
    }
    const req = isObj(m.requires) ? m.requires : {};
    if (req.engine !== undefined) {
      if (versionSatisfies(req.engine, rt.engine.version)) sat.push(`the engine satisfies "${req.engine}"`);
      else f.push(finding('CMP-5-01', `The engine ${rt.engine.version} does not satisfy "${req.engine}".`, `Run on an engine that satisfies "${req.engine}".`));
    }
    if (req.fhir !== undefined) {
      if (rt.fhir !== undefined && versionSatisfies(req.fhir, rt.fhir.version)) sat.push(`FHIR support satisfies "${req.fhir}"`);
      else f.push(finding('CMP-5-05', `The artefact requires FHIR "${req.fhir}"; this runtime has ${rt.fhir === undefined ? 'no FHIR support' : `FHIR ${rt.fhir.version}`}.`, 'Run on a runtime with the required FHIR support.'));
    }
    if (a) {
      const os = a.operatorSet;
      if (isObj(os) && os.name === rt.operatorSet.name && parseVer(os.version) !== null && rt.operatorSet.majors.includes(Number(parseVer(os.version).major))) {
        sat.push(`the operator set "${os.name}" ${os.version} is supported`);
      } else {
        f.push(finding('CMP-5-03', `The operator set ${isObj(os) ? `"${os.name}" ${os.version}` : '(none declared)'} is not supported; the runtime has "${rt.operatorSet.name}" with majors ${rt.operatorSet.majors.join(', ')}.`, `Use the operator set "${rt.operatorSet.name}" at a supported major.`));
      }
      const ep = isObj(a.executionProfile) ? a.executionProfile : {};
      const over = LIMIT_KEYS.filter((k) => ep[k] !== undefined && !(typeof ep[k] === 'number' && ep[k] <= rt.limits[k]));
      if (over.length === 0) sat.push('the execution limits are within the runtime ceilings');
      else for (const k of over) f.push(finding('CMP-5-04', `The package asks for ${k} above the runtime ceiling ${rt.limits[k]}.`, `Lower ${k} in the package or raise the runtime ceiling.`));
    }
    return { f, sat };
  }

  const unresolvedChecks = (first) => [first, skipped(2, 'the artefact is not available'), skipped(3, 'the artefact is not available'), skipped(4, 'the artefact is not available'), skipped(5, 'the artefact is not available'), skipped(6, 'the artefact has no manifest to read')];

  function finish(ref, requirement, checks, assurance, missingData) {
    const outcome = outcomeOf(checks);
    const entry = {
      ref,
      ...(requirement ? { requirement } : {}),
      outcome,
      outcomeLabel: OUTCOMES[outcome],
      checks,
      satisfied: checks.flatMap((c) => c.satisfied.map((s) => `${c.name}: ${s}`)),
      missingData,
      needed: [...new Set(checks.flatMap((c) => c.findings.map((f) => f.needs)))],
      assurance,
    };
    entry.policy = executionPolicy(entry, { mode });
    return entry;
  }

  // ----- one analytics package ------------------------------------------------------------------
  function evalPackage(pref, requirement) {
    const rr = resolve(pref);
    const refOut = { id: pref.id, type: pref.type, version: null };
    if (!rr.ok) return finish(refOut, requirement, unresolvedChecks(mk(1, [], [rr.finding])), null, []);
    const doc = rr.doc;
    const m = doc.manifest;
    const ref = { id: m.id, type: m.type, version: m.version };

    // check 1: the package, its elements, extensions
    const c1f = [];
    const c1s = [`"${m.id}" ${m.version} is held and satisfies ${refText(pref)}`];
    const elems = new Map();
    for (const c of arr(doc.context).filter(isObj)) {
      if (!isObj(c.ref) || typeof c.ref.id !== 'string' || elems.has(c.ref.id)) continue;
      const e = resolve({ ...c.ref, type: 'contextual-element' }, applied('elements', c.ref.id));
      elems.set(c.ref.id, e);
      if (e.ok) c1s.push(`element "${c.ref.id}" ${e.doc.manifest.version} is held and satisfies ${refText(c.ref)}`);
      else c1f.push(e.finding);
    }
    c1f.push(...extFindings(`The package "${m.id}"`, m));
    for (const e of elems.values()) if (e.ok) c1f.push(...extFindings(`The element "${e.doc.manifest.id}"`, e.doc.manifest));
    const c1 = mk(1, c1s, c1f);

    // check 2: inputs against the held elements
    const c2f = [];
    const c2s = [];
    const unavailable = new Set();
    const hasFields = (e) => Array.isArray(e.doc.fields);
    const fieldOf = (e, key) => arr(e.doc.fields).find((f) => isObj(f) && f.key === key);
    const flagged = new Set();
    for (const [id, e] of elems) {
      if (e.ok && !hasFields(e) && !flagged.has(id)) { flagged.add(id); c2f.push(finding('CMP-2-07', `The element "${id}" has no readable list of fields.`, 'Hold a well-formed element.')); }
    }
    for (const c of arr(doc.context).filter(isObj)) {
      const e = isObj(c.ref) ? elems.get(c.ref.id) : undefined;
      if (!e) continue;
      if (!e.ok) { unavailable.add(c.ref.id); continue; }
      if (!hasFields(e)) continue;
      for (const key of arr(c.fields)) {
        if (fieldOf(e, key)) c2s.push(`context field "${c.ref.id}.${key}" exists`);
        else c2f.push(finding('CMP-2-01', `The package names the field "${key}" of "${c.ref.id}", which the held element does not have.`, `Use a field key that "${c.ref.id}" has, exactly as written.`));
      }
    }
    for (const i of arr(doc.inputs).filter(isObj)) {
      const e = elems.get(i.element);
      if (!e) { c2f.push(finding('CMP-2-02', `The input "${i.key}" reads "${i.element}", which the package does not list in its context.`, `Add "${i.element}" to the package context, or read a listed element.`)); continue; }
      if (!e.ok) { unavailable.add(i.element); continue; }
      if (!hasFields(e)) continue;
      const fld = fieldOf(e, i.field);
      if (!fld) { c2f.push(finding('CMP-2-01', `The input "${i.key}" reads the field "${i.field}" of "${i.element}", which the held element does not have.`, `Use a field key that "${i.element}" has, exactly as written.`)); continue; }
      if (fld.type !== i.type) { c2f.push(finding('CMP-2-03', `The input "${i.key}" is declared as "${i.type}", but the field "${i.element}.${i.field}" is "${fld.type}".`, 'Declare the input with the type of the field.')); continue; }
      let unitsOk = true;
      if (Array.isArray(i.units)) {
        const permitted = arr(fld.units);
        for (const u of i.units) {
          if (permitted.includes(u)) continue;
          const covered = arr(doc.conversions).some((cv) => isObj(cv) && ((cv.from === u && permitted.includes(cv.to)) || (cv.to === u && permitted.includes(cv.from))));
          if (!covered) { unitsOk = false; c2f.push(finding('CMP-2-04', `The input "${i.key}" uses the unit "${u}", which the field "${i.element}.${i.field}" does not permit, and no declared conversion covers it.`, 'Use a permitted unit, or declare a conversion between the units.')); }
        }
      }
      if (unitsOk) c2s.push(`input "${i.key}" matches "${i.element}.${i.field}" (type ${i.type})`);
    }
    if (unavailable.size > 0) c2f.push(finding('CMP-0-01', `Inputs reading ${[...unavailable].map((x) => `"${x}"`).join(', ')} were not evaluated: that element is not available.`, 'Resolve the artefact finding for that element.'));
    if (ctxOk) {
      for (const [id, e] of elems) {
        if (!e.ok) continue;
        const a = applied('elements', id);
        if (a === undefined) c2f.push(finding('CMP-2-06', `The context does not list the element "${id}" as applied.`, `Import a context that applies "${id}".`));
        else if (a !== e.doc.manifest.version) c2f.push(finding('CMP-2-05', `The context applies "${id}" ${a}, but the held version is ${e.doc.manifest.version}.`, `Import a context that applies "${id}" ${e.doc.manifest.version}, or hold ${a}.`));
        else c2s.push(`the context applies "${id}" ${a}, as held`);
      }
    }
    const c2 = mk(2, c2s, c2f);

    // check 3: schema, standard, context form
    const c3f = [];
    const c3s = [];
    const part = [schemaPart(doc, `The package "${m.id}"`), ...[...elems.values()].filter((e) => e.ok).map((e) => schemaPart(e.doc, `The element "${e.doc.manifest.id}"`)), contextPart()];
    for (const p of part) { c3f.push(...p.f); c3s.push(...p.sat); }
    const c3 = mk(3, c3s, c3f);

    // check 4: data readiness
    let c4;
    let missingData = [];
    if (![c1, c2, c3].every((c) => c.state === 'met')) {
      c4 = skipped(4, 'checks 1 to 3 are not all met');
    } else {
      const f4 = [];
      const s4 = [];
      const inputs = arr(doc.inputs).filter(isObj);
      if (!ctxOk) {
        f4.push(finding('CMP-4-01', 'No context has been imported.', 'Import a context, then evaluate again.'));
        missingData = inputs.map((i) => ({ key: i.key, concept: `${i.element}.${kebab(i.field)}`, onMissing: i.onMissing, observed: [] }));
      } else {
        for (const i of inputs) {
          const concept = `${i.element}.${kebab(i.field)}`;
          const states = context.observations.filter((o) => isObj(o) && isObj(o.concept) && o.concept.id === concept).map((o) => (o.state === undefined ? 'value' : o.state));
          if (states.some((s) => ANSWERED.includes(s))) { s4.push(`input "${i.key}" is answered`); continue; }
          const observed = [...new Set(states)].sort();
          missingData.push({ key: i.key, concept, onMissing: i.onMissing, observed });
          const seen = observed.length === 0 ? 'no observation' : `only ${observed.join(', ')}`;
          if (i.onMissing === 'needs-data') f4.push(finding('CMP-4-02', `The input "${i.key}" (${concept}) is missing: ${seen}.`, `Collect and import a value or a documented answer for "${concept}".`));
          else f4.push(finding('CMP-4-03', `The input "${i.key}" (${concept}) is missing: ${seen}. The package declares "${i.onMissing}" for it.`, `Collect "${concept}" to replace the "${i.onMissing}" result.`));
        }
      }
      for (const p of arr(doc.parameters).filter(isObj)) {
        if (p.enabledByDefault === true) s4.push(`parameter "${p.id}" is enabled`);
        else f4.push(finding('CMP-4-04', `The parameter "${p.id}" is not enabled.`, `A local clinician enables "${p.id}" with a value; until then results that need it say so.`));
      }
      c4 = mk(4, s4, f4);
    }

    // checks 5 and 6
    const r5 = runtimePart(m, doc);
    const c5 = mk(5, r5.sat, r5.f);
    const a6 = assuranceFindings(m, mode);
    const c6 = mk(6, a6.length === 0 ? [`status "${m.status}" permits ${mode} use`] : [], a6);
    return finish(ref, requirement, [c1, c2, c3, c4, c5, c6], assuranceOf(m), missingData);
  }

  // ----- the pathway ----------------------------------------------------------------------------
  if (!isObj(pathway) || !isObj(pathway.manifest)) {
    const f = finding('CMP-1-08', 'The pathway is not an object with a manifest.', 'Pass a pathway document.');
    return { resultForm: RESULT_FORM, compatVersion: COMPAT_VERSION, mode: mode === 'preview' || mode === 'governed' ? mode : null, pathway: finish({ id: null, type: 'pathway', version: null }, undefined, unresolvedChecks(mk(1, [], [f])), null, []), packages: [] };
  }
  const pm = pathway.manifest;
  const pathwayElems = new Map();
  const c1f = [];
  const c1s = [];
  if (pm.type === 'pathway') c1s.push(`"${pm.id}" ${pm.version} is a pathway`);
  else c1f.push(finding('CMP-1-03', `The pathway document is typed "${pm.type}".`, 'Pass a document of type pathway.'));
  for (const ref of arr(pathway.elements).filter(isObj)) {
    if (typeof ref.id !== 'string' || pathwayElems.has(ref.id)) continue;
    const e = resolve({ ...ref, type: 'contextual-element' }, applied('elements', ref.id));
    pathwayElems.set(ref.id, e);
    if (e.ok) c1s.push(`element "${ref.id}" ${e.doc.manifest.version} is held and satisfies ${refText(ref)}`);
    else c1f.push(e.finding);
  }
  const nodeIds = new Set(arr(pathway.nodes).filter(isObj).map((n) => n.id));
  for (const t of arr(pathway.transitions).filter(isObj)) {
    if (t.via === undefined) continue;
    if (nodeIds.has(t.via)) c1s.push(`decision node "${t.via}" is defined`);
    else c1f.push(finding('CMP-1-05', `A transition names the decision node "${t.via}", which the pathway does not define.`, `Define the node "${t.via}" in the pathway, or correct the transition.`));
  }
  c1f.push(...extFindings(`The pathway "${pm.id}"`, pm));
  for (const e of pathwayElems.values()) if (e.ok) c1f.push(...extFindings(`The element "${e.doc.manifest.id}"`, e.doc.manifest));

  const pkgRefs = arr(pathway.analytics).filter((a) => isObj(a) && isObj(a.ref) && typeof a.ref.id === 'string');
  const packages = pkgRefs.map((a) => evalPackage({ ...a.ref, type: a.ref.type ?? 'analytics-package' }, a.requirement === 'required' ? 'required' : 'optional'));
  // Optional analytics that is not available is a limitation of the pathway; required analytics is a failure of it.
  for (const p of packages) {
    if (p.ref.version !== null) continue;
    const why = p.checks[0].findings[0];
    if (p.requirement === 'required') c1f.push(why);
    else c1f.push(finding('CMP-1-07', `The optional package "${p.ref.id}" is not available (${why.reason}).`, why.needs));
  }

  // check 2: node inputs and stage needs against the pathway's elements, and the applied pathway
  const c2f = [];
  const c2s = [];
  const unavail = new Set();
  const field = (e, key) => arr(e.doc.fields).find((f) => isObj(f) && f.key === key);
  for (const n of arr(pathway.nodes).filter(isObj)) {
    for (const i of arr(n.inputs).filter(isObj)) {
      const e = pathwayElems.get(i.element);
      if (!e) { c2f.push(finding('CMP-2-02', `The node "${n.id}" reads "${i.element}", which the pathway does not list as an element.`, `Add "${i.element}" to the pathway elements, or read a listed element.`)); continue; }
      if (!e.ok) { unavail.add(i.element); continue; }
      if (!Array.isArray(e.doc.fields)) { c2f.push(finding('CMP-2-07', `The element "${i.element}" has no readable list of fields.`, 'Hold a well-formed element.')); continue; }
      if (field(e, i.field)) c2s.push(`node "${n.id}" input "${i.key}" reads an existing field`);
      else c2f.push(finding('CMP-2-01', `The node "${n.id}" reads the field "${i.field}" of "${i.element}", which the held element does not have.`, `Use a field key that "${i.element}" has, exactly as written.`));
    }
  }
  const readable = [...pathwayElems.values()].filter((e) => e.ok && Array.isArray(e.doc.fields));
  const allResolved = [...pathwayElems.values()].every((e) => e.ok && Array.isArray(e.doc.fields));
  for (const s of arr(pathway.stages).filter(isObj)) {
    for (const key of arr(s.needs)) {
      if (readable.some((e) => field(e, key))) c2s.push(`stage "${s.id}" need "${key}" exists`);
      else if (allResolved) c2f.push(finding('CMP-2-01', `The stage "${s.id}" needs "${key}", which none of the pathway elements has.`, `Use a field key that a listed element has, exactly as written.`));
      else unavail.add(`(stage "${s.id}" need "${key}")`);
    }
  }
  if (unavail.size > 0) c2f.push(finding('CMP-0-01', `Some node inputs and stage needs were not evaluated: an element is not available (${[...unavail].join(', ')}).`, 'Resolve the artefact finding for that element.'));
  if (ctxOk) {
    const a = applied('pathways', pm.id);
    if (a === undefined) c2f.push(finding('CMP-2-06', `The context does not list the pathway "${pm.id}" as applied.`, `Import a context that applies "${pm.id}".`));
    else if (a !== pm.version) c2f.push(finding('CMP-2-05', `The context applies "${pm.id}" ${a}, but the pathway given is ${pm.version}.`, `Import a context that applies "${pm.id}" ${pm.version}.`));
    else c2s.push(`the context applies "${pm.id}" ${a}, as given`);
    for (const [id, e] of pathwayElems) {
      if (!e.ok) continue;
      const av = applied('elements', id);
      if (av === undefined) c2f.push(finding('CMP-2-06', `The context does not list the element "${id}" as applied.`, `Import a context that applies "${id}".`));
      else if (av !== e.doc.manifest.version) c2f.push(finding('CMP-2-05', `The context applies "${id}" ${av}, but the held version is ${e.doc.manifest.version}.`, `Import a context that applies "${id}" ${e.doc.manifest.version}, or hold ${av}.`));
    }
  }
  // check 3
  const c3f = [];
  const c3s = [];
  for (const p of [schemaPart(pathway, `The pathway "${pm.id}"`, 'pathway'), ...[...pathwayElems.values()].filter((e) => e.ok).map((e) => schemaPart(e.doc, `The element "${e.doc.manifest.id}"`)), contextPart()]) { c3f.push(...p.f); c3s.push(...p.sat); }
  // check 5 and 6
  const r5 = runtimePart(pm, null);
  const a6 = assuranceFindings(pm, mode);

  const own = [mk(1, c1s, c1f), mk(2, c2s, c2f), mk(3, c3s, c3f), mk(4, [], []), mk(5, r5.sat, r5.f), mk(6, a6.length === 0 ? [`status "${pm.status}" permits ${mode} use`] : [], a6)];
  // Fold in the packages: a required package counts in full; an optional package can only lower a check to "limited".
  const checks = own.map((c) => {
    let state = c.state;
    const from = [];
    for (const p of packages) {
      const s = p.checks[c.check - 1].state;
      if (s === 'met') continue;
      from.push({ id: p.ref.id, requirement: p.requirement, state: s });
      state = worst(state, p.requirement === 'required' ? s : 'limited');
    }
    return { ...c, state, ...(from.length ? { fromPackages: from } : {}) };
  });
  const missingData = packages.flatMap((p) => p.missingData.map((x) => ({ package: p.ref.id, ...x })));
  const pathwayEntry = finish({ id: pm.id, type: pm.type, version: pm.version }, undefined, checks, assuranceOf(pm), missingData);
  return { resultForm: RESULT_FORM, compatVersion: COMPAT_VERSION, mode: mode === 'preview' || mode === 'governed' ? mode : null, pathway: pathwayEntry, packages };
}

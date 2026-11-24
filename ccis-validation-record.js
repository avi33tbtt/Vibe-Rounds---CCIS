// CCIS VALIDATION RECORD WRITER (row 2.3a): a validator result in, the record the 1.4a schema describes out.
// Prototype. Synthetic data only. Not for clinical use.
//
// Pure library: no file access, no network, no clock, no randomness, no imports. The same artefact and result give
// byte-identical record text (CCIS-REQ-090). A `passed` outcome means "no layer found an error". It is never "safe",
// and software conformance is recorded apart from clinical review, execution validation and security review (REQ-048, 053).
//
//   buildValidationRecord(doc, result) -> { ok: true, record } | { ok: false, reason }
//   recordText(record)                 -> canonical JSON (sorted keys) plus a newline
//   toRecordRuleId('CCIS-V4-009')      -> 'ccis.v4-009'      fromRecordRuleId('ccis.v4-009') -> 'CCIS-V4-009' (or null)
//   recordPath(path)                   -> { path, position? }  a layer 1 { line, column } becomes '' plus an x-position member

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);

export const STANDARD_VERSION = '0.1.0';
export const VALIDATOR = { name: 'ccis-validator', version: '0.1.0' };

const LAYERS = ['syntax', 'structural', 'reference-integrity', 'semantic', 'graph-and-compatibility', 'executable-safety', 'test-verification', 'governance'];
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ID_IN = /^CCIS-V(\d)-(\d{3})$/;
const ID_OUT = /^ccis\.v(\d)-(\d{3})$/;

export const toRecordRuleId = (id) => { const m = ID_IN.exec(id); return m ? `ccis.v${m[1]}-${m[2]}` : null; };
export const fromRecordRuleId = (id) => { const m = ID_OUT.exec(id); return m ? `CCIS-V${m[1]}-${m[2]}` : null; };

export function recordPath(path) {
  if (isObj(path) && Number.isInteger(path.line) && Number.isInteger(path.column)) return { path: '', position: { line: path.line, column: path.column } };
  return { path: typeof path === 'string' ? path : '' };
}

function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export const recordText = (record) => `${canonical(record)}\n`;

function diagnostic(d) {
  const ruleId = toRecordRuleId(d.ruleId);
  const { path, position } = recordPath(d.path);
  const out = { severity: d.severity, ruleId: ruleId ?? 'ccis.unknown-rule', path, message: d.message, hint: d.hint };
  if (position) out['x-position'] = position;
  return out;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// One software assurance member over a set of layers.
function softwareMember(names, result, label, scope) {
  const layers = names.map((n) => result.layers[n]);
  const failed = layers.some((l) => l.outcome === 'failed');
  const passed = layers.every((l) => l.outcome === 'passed');
  const warnings = layers.flatMap((l) => arr(l.diagnostics).filter((d) => d.severity === 'warning'));
  const errors = layers.flatMap((l) => arr(l.diagnostics).filter((d) => d.severity === 'error'));
  const conditions = warnings.map((d) => `Warning ${toRecordRuleId(d.ruleId) ?? d.ruleId} at ${recordPath(d.path).path || 'the top level'}: ${d.message}`);
  if (!failed && !passed) {
    return { result: 'not-assessed', conditions: [`${label}: at least one layer did not run, so nothing is claimed.`] };
  }
  const member = {
    result: failed ? 'not-met' : 'met',
    assessedBy: `${VALIDATOR.name} ${VALIDATOR.version} (software)`,
    evidence: [`${label}: ${names.map((n, i) => `${n} ${layers[i].outcome}`).join('; ')}. ${plural(errors.length, 'error')}, ${plural(warnings.length, 'warning')}.`],
    scope,
  };
  if (conditions.length > 0) member.conditions = conditions;
  return member;
}

export function buildValidationRecord(doc, result) {
  if (!isObj(doc)) return { ok: false, reason: 'No validation record was written: the document is not a JSON object, so it names no artefact version.' };
  if (!isObj(result) || !isObj(result.layers) || !LAYERS.every((n) => isObj(result.layers[n]))) {
    return { ok: false, reason: 'No validation record was written: the validator result does not list all eight layers.' };
  }
  if (result.layers.syntax.outcome !== 'passed' || result.layers.structural.outcome !== 'passed') {
    return { ok: false, reason: 'No validation record was written: layer 1 or layer 2 did not pass, so the artefact cannot be tied to one exact version.' };
  }
  const m = isObj(doc.manifest) ? doc.manifest : null;
  if (m === null || typeof m.id !== 'string' || typeof m.type !== 'string' || typeof m.version !== 'string' || !SEMVER.test(m.version)) {
    return { ok: false, reason: 'No validation record was written: the artefact has no manifest with an id, a type and a version, so a record cannot attach to it.' };
  }

  const scope = { version: m.version, population: 'Not applicable: software conformance check', setting: 'Not applicable: software conformance check', intendedUse: 'Conformance to the standard. Not for clinical use.' };
  const layers = {};
  for (const n of LAYERS) {
    const l = result.layers[n];
    layers[n] = { outcome: l.outcome, diagnostics: arr(l.diagnostics).map(diagnostic) };
    if (l.outcome === 'not-run') layers[n].reason = typeof l.reason === 'string' && l.reason !== '' ? l.reason : 'This layer did not run.';
  }
  const allPassed = LAYERS.every((n) => result.layers[n].outcome === 'passed');
  const record = {
    subject: { id: m.id, type: m.type, version: m.version },
    standard: { version: STANDARD_VERSION },
    validator: { name: VALIDATOR.name, version: VALIDATOR.version },
    outcome: result.outcome === 'no-errors-so-far' && allPassed ? 'passed' : 'failed',
    layers,
    assurance: {
      structural: softwareMember(LAYERS.slice(0, 3), result, 'Layers 1 to 3 (syntax, structure, reference integrity)', scope),
      semantic: softwareMember(LAYERS.slice(3, 5), result, 'Layers 4 and 5 (semantic; graph and compatibility)', scope),
      clinical: { result: 'not-assessed', conditions: ['No clinical review or clinical validation is recorded here. Software checks say nothing about clinical safety.'] },
      execution: { result: 'not-assessed', conditions: ['No engine has run this package. Executable safety and test verification (layers 6 and 7) are static checks and are not execution validation.'] },
      'security-privacy': { result: 'not-assessed', conditions: ['No security or privacy review is recorded here.'] },
    },
  };
  return { ok: true, record };
}

// CCIS rule-pack evaluator, row ECO-B14 (ED-48, ED-49). Prototype. Synthetic data only. Not for clinical use.
//
//   evaluateRulePack({ pack, bound, parameters, asOf, expectedChecksum? })
//     -> { ok: true, packChecksum, asOf, prompts, notEvaluated } | { ok: false, refusal }
//
// Pure: no clock, network, file access or randomness; `asOf` is the only time source. It does not interpret
// expressions itself: it builds a synthetic analytic from the pack and runs it through ccis-exec.js.
// `bound` maps each pack input id to { state, value?, refs: [recordId] }; binding a context is row B14a.
// Unknown or a disabled parameter never fires and is never read as false. A prompt holds record ids, never values.
import { canonicalize, checksumOf } from './ccis-compile.js';
import { prepareAnalytic, evaluateOutput } from './ccis-exec.js';

export const RULES_ENGINE = Object.freeze({ name: 'ccis-rules', version: '0.1.0' });
const LIMITS = Object.freeze({ maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 });
const REFUSALS = Object.freeze({
  pack: 'The rule pack could not be read.',
  time: 'The time of evaluation is missing or not a valid instant.',
  inputs: 'The bound inputs or parameters are not in the expected form.',
  answer: 'A rule did not give a true, false or unknown answer.',
});
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);
const refuse = (k) => ({ ok: false, refusal: REFUSALS[k] });
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function leaves(e, into = []) {
  if (!isObj(e)) return into;
  if (e.ref === 'input' || e.ref === 'parameter') into.push(e);
  arr(e.args).forEach((a) => leaves(a, into));
  return into;
}
const uniq = (xs) => [...new Set(xs)];

export function evaluateRulePack({ pack, bound, parameters, asOf, expectedChecksum } = {}) {
  const m = isObj(pack) ? pack.manifest : null;
  if (!isObj(m) || typeof m.id !== 'string' || typeof m.version !== 'string' || !['inputs', 'parameters', 'rules'].every((k) => Array.isArray(pack[k])) || !pack.rules.every(isObj) || !pack.inputs.every((i) => isObj(i) && typeof i.id === 'string') || !pack.parameters.every((p) => isObj(p) && typeof p.id === 'string')) return refuse('pack');
  const canon = canonicalize(pack);
  if (!canon.ok) return refuse('pack');
  const packChecksum = checksumOf(canon.text);
  if (expectedChecksum !== undefined && expectedChecksum !== packChecksum) return refuse('pack');
  if (typeof asOf !== 'string' || !ISO.test(asOf) || !Number.isFinite(Date.parse(asOf))) return refuse('time');
  if (!isObj(bound) || (parameters !== undefined && !isObj(parameters))) return refuse('inputs');

  const readOf = new Map(pack.inputs.map((i) => [i.id, i]));
  const inputs = {};
  for (const i of pack.inputs) {
    if (Object.hasOwn(bound, i.id)) inputs[i.id] = bound[i.id];
    else if (i.read === 'all') inputs[i.id] = { state: 'unknown' };
    else return refuse('inputs');
  }
  const params = {};
  for (const p of pack.parameters) params[p.id] = isObj(parameters) && Object.hasOwn(parameters, p.id) ? parameters[p.id] : { enabled: false };

  const rules = [...pack.rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const notEvaluated = [];
  const live = [];
  for (const r of rules) {
    if (typeof r.id !== 'string' || !isObj(r.when)) return refuse('pack');
    if (leaves(r.when).some((l) => l.ref === 'input' && readOf.get(l.id)?.read === 'all')) notEvaluated.push(r.id);
    else live.push(r);
  }
  const prompts = [];
  if (live.length > 0) {
    const analytic = {
      inputs: pack.inputs.map((i) => ({ key: i.id, type: 'code' })),
      parameters: pack.parameters.map((p) => ({ id: p.id, kind: p.kind })),
      conversions: [], operatorSet: { name: 'ccis-core-ops', version: '0.2.0' },
      computation: live.map((r) => ({ output: r.id, expr: r.when })), outputs: live.map((r) => ({ id: r.id })),
      executionProfile: { ...LIMITS },
    };
    const prep = prepareAnalytic({ analytic, checksum: checksumOf(canonicalize(analytic).text), runtime: { limits: { ...LIMITS } } });
    if (!prep.ok) return refuse('pack');
    for (const r of live) {
      const res = evaluateOutput({ prepared: prep.prepared, outputId: r.id, inputs, parameters: params });
      if (!res.ok) return refuse('inputs');
      const v = res.value;
      if (v.t === 'unknown') { notEvaluated.push(r.id); continue; }
      if (v.t !== 'bool') return refuse('answer');
      if (!v.v) continue;
      const read = leaves(r.when);
      const ins = uniq(read.filter((l) => l.ref === 'input').map((l) => l.id));
      const pars = uniq(read.filter((l) => l.ref === 'parameter').map((l) => l.id));
      const refs = uniq(ins.flatMap((id) => arr(inputs[id].refs).filter((x) => typeof x === 'string'))).sort();
      const concept = ins.length ? readOf.get(ins[0]).concept : '';
      const label = pars.length ? (pack.parameters.find((p) => p.id === pars[0]).label ?? pars[0]) : '';
      const template = isObj(r.message) && typeof r.message.template === 'string' ? r.message.template : '';
      prompts.push({
        ruleId: `${m.id}.${r.id}`, packVersion: m.version, packChecksum, kind: r.kind, severity: r.severity,
        message: template.replaceAll('{concept}', concept).replaceAll('{parameter}', label).replaceAll('{count}', String(refs.length)),
        recordRefs: refs, asOf,
      });
    }
  }
  return { ok: true, packChecksum, asOf, prompts, notEvaluated: notEvaluated.sort() };
}

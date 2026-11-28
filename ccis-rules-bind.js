// CCIS rule-pack input binder, row ECO-B14a (ED-50). Prototype. Synthetic data only. Not for clinical use.
//
//   bindRuleInputs({ pack, context }) -> { ok: true, bound } | { ok: false, refusal }
//
// Pure. Joins a ccis-context/1 object to the inputs of a rule pack for ccis-rules.js. Records are found by a
// `local` code equal to the input's concept key, never by label or concept id. Entered-in-error is ignored.
// `refs` are record ids only, never values. `read: all` gets no entry (B14 fills unknown; it waits for B9a).
import { instantOf } from './ccis-bind.js';

const REFUSALS = Object.freeze({
  context: 'The context is not a ccis-context/1 object.',
  pack: 'The rule pack inputs could not be read.',
  record: 'A record has a state this binder does not read.',
});
const STATES = new Set(['absent', 'unknown', 'not-collected', 'not-applicable', 'explicitly-negative']);
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const refuse = (k) => ({ ok: false, refusal: REFUSALS[k] });
const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function valueOf(o) {
  if (o.kind === 'datetime') { const ms = instantOf(o.value); return ms === null ? undefined : { t: 'instant', ms }; }
  if (o.kind === 'code' && isObj(o.value) && typeof o.value.code === 'string') return { t: 'text', v: o.value.code };
  return undefined; // any other kind: present, unreadable to the rule, never zero or false
}

export function bindRuleInputs({ pack, context } = {}) {
  if (!isObj(context) || context.contextForm !== 'ccis-context/1' || !Array.isArray(context.observations)) return refuse('context');
  if (!isObj(pack) || !Array.isArray(pack.inputs) || !pack.inputs.every((i) => isObj(i) && typeof i.id === 'string' && typeof i.concept === 'string')) return refuse('pack');
  const bound = {};
  for (const inp of pack.inputs) {
    if (inp.read === 'all') continue;
    const recs = context.observations.filter((o) => isObj(o) && typeof o.id === 'string' && o.status !== 'entered-in-error' && isObj(o.concept) && Array.isArray(o.concept.codes)
      && o.concept.codes.some((c) => isObj(c) && c.system === 'local' && c.code === inp.concept));
    const ids = recs.map((o) => o.id).sort(byId);
    if (recs.length === 0) { bound[inp.id] = { state: 'absent', refs: [] }; continue; }
    if (inp.read === 'count') { bound[inp.id] = { state: 'present', value: { t: 'number', v: recs.length, unit: '1' }, refs: ids }; continue; }
    let pick = recs[0];
    if (recs.length > 1) {
      const t = recs.map((o) => instantOf(o.effective));
      const max = t.every((x) => x !== null) ? Math.max(...t) : null;
      if (max === null || t.filter((x) => x === max).length !== 1) { bound[inp.id] = { state: 'conflicting', refs: ids }; continue; }
      pick = recs[t.indexOf(max)];
    }
    if (pick.state !== undefined) {
      if (!STATES.has(pick.state)) return refuse('record');
      bound[inp.id] = { state: pick.state, refs: [pick.id] };
    } else {
      const value = valueOf(pick);
      bound[inp.id] = { state: 'present', ...(value ? { value } : {}), refs: [pick.id] };
    }
  }
  return { ok: true, bound };
}

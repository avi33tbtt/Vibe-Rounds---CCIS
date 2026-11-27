// BROWSER APP, row 4.4: the pure form model for a contextual element. Prototype. Synthetic data only. Not for clinical use.
//
// Form state is what text boxes give: every value is a string, list members are one item per line. `formToSpec` maps the strings to the
// element spec and never judges them (a value that is not a whole number stays the string it was, so the SDK builder refuses it with its
// own code and path). `draftFromForm` runs the same builder, compiler and validator as every other route, so a form gives the same bytes
// as the JSON file (REQ-086). The manifest status is always draft: a form cannot claim validation. No DOM, network, storage or clock.

import { element, FIELD_TYPES } from './ccis-sdk-element.js';
import { SdkError, SDK_REFUSALS } from './ccis-sdk.js';
import { canonicalize, checksumOf } from './ccis-compile.js';
import { validateArtefact, LAYER_NAMES } from './ccis-validator.js';

export const FORM_TYPES = Object.freeze(FIELD_TYPES.filter((t) => t !== 'code'));
export const FORM_STATUS = 'draft';

const lines = (t) => (typeof t === 'string' ? t.split('\n').map((x) => x.trim()).filter((x) => x !== '') : undefined);
const whole = (t) => (typeof t === 'string' && /^\d+$/.test(t) ? Number(t) : t);
const put = (o, k, v) => { if (v !== undefined) o[k] = v; return o; };
const some = (v) => (Array.isArray(v) ? (v.length > 0 ? v : undefined) : (typeof v === 'string' && v !== '' ? v : undefined));

const fieldSpec = (f) => {
  const g = f && typeof f === 'object' ? f : {};
  const o = {};
  put(o, 'key', g.key); put(o, 'label', g.label); put(o, 'type', g.type);
  o.cardinality = put(put({}, 'min', whole(g.min)), 'max', whole(g.max));
  put(o, 'epistemic', lines(g.epistemic)); put(o, 'sourceClasses', lines(g.sourceClasses));
  put(o, 'units', some(lines(g.units))); put(o, 'timeSemantics', some(g.timeSemantics)); put(o, 'constraints', some(lines(g.constraints)));
  return o;
};

export function formToSpec(form) {
  const f = form && typeof form === 'object' ? form : {};
  const spec = {
    manifest: { id: f.id, name: f.name, type: 'contextual-element', version: f.version, publisher: { name: f.publisher }, standard: { version: '0.1.0' }, status: FORM_STATUS },
    intent: { purpose: f.purpose, setting: f.setting, population: f.population, exclusions: lines(f.exclusions), rationale: f.rationale },
    provenance: { origin: f.origin, basis: f.basis },
  };
  if (Array.isArray(f.fields)) spec.fields = f.fields.map(fieldSpec);
  return JSON.parse(JSON.stringify(spec)); // drops members that are still undefined
}

const where = (p) => (p && typeof p === 'object' ? `line ${p.line}, column ${p.column}` : p === '' ? 'the top level' : String(p));
const refused = (sdk) => Object.freeze({ ok: false, spec: null, canonical: null, checksum: null, sdk: Object.freeze(sdk), diagnostics: Object.freeze([]) });

export function draftFromForm(form, options = {}) {
  const at = form && Array.isArray(form.fields) ? form.fields.findIndex((x) => x && x.type === 'code') : -1;
  if (at >= 0) return refused({ code: 'S-003', path: `fields.${at}.type`, sentence: SDK_REFUSALS.find((r) => r.code === 'S-003').sentence });
  let spec;
  try { spec = element(formToSpec(form)); } catch (e) {
    if (!(e instanceof SdkError)) throw e;
    return refused({ code: e.code, path: e.path, sentence: e.message });
  }
  const c = canonicalize(spec);
  if (!c.ok) return refused({ code: c.code, path: String(c.path ?? ''), sentence: c.reason });
  const result = validateArtefact(spec, options);
  const diagnostics = LAYER_NAMES.flatMap((layer) => result.layers[layer].diagnostics.map((d) => Object.freeze({
    layer, severity: d.severity, ruleId: d.ruleId, path: where(d.path), message: d.message, hint: d.hint,
  })));
  return Object.freeze({ ok: true, spec, canonical: c.text, checksum: checksumOf(c.text), sdk: null, diagnostics: Object.freeze(diagnostics) });
}

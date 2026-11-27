// CCIS CODE-AUTHORING SDK, row 4.2b.1: the element field builder. Prototype. Synthetic data only. Not for clinical use.
//
// Returns a plain, frozen field exactly as the file holds it. Pure; nothing is invented (no default epistemic states, source
// classes, cardinality or label). `min` greater than `max` stays with the validator: the SDK adds no rule the file route lacks.
import { shape, need, list, keyText, textOf, binding, SdkError } from './ccis-sdk.js';

export const FIELD_TYPES = Object.freeze(['quantity', 'integer', 'boolean', 'code', 'string', 'date', 'datetime']);
export const EPISTEMIC_STATES = Object.freeze(['absent', 'unknown', 'not-collected', 'not-applicable', 'explicitly-negative', 'entered-in-error']);
export const SOURCE_CLASSES = Object.freeze(['patient-reported', 'informant-reported', 'clinician-entered', 'clinician-verified', 'imported', 'device', 'derived', 'ai-proposed']);
export const TIME_SEMANTICS = Object.freeze(['event-time', 'recorded-time', 'collection-time']);

const oneOf = (set) => (x, p) => { need(set.includes(x), p); return x; };
const int = (x, p, min) => { need(Number.isInteger(x) && x >= min, p); return x; };
const cardinality = (v, p) => shape(v, {
  closed: true,
  allowed: { min: (x, q) => int(x, q, 0), max: (x, q) => (x === 'unbounded' ? x : int(x, q, 1)) },
  required: ['min', 'max'],
}, p);
const precision = (v, p) => shape(v, { closed: true, allowed: { decimals: (x, q) => int(x, q, 0) }, required: ['decimals'] }, p);
const unit = (x, p) => { need(typeof x === 'string' && /^\S+$/.test(x), p); return x; };
const enums = (set) => (v, p) => list(v, p, 1, oneOf(set));

// The binding builder reports paths from its own root; a field prefixes its own.
const withPath = (v, p) => { try { return binding(v); } catch (e) { if (e instanceof SdkError) throw new SdkError(e.code, e.path ? `${p}.${e.path}` : p); throw e; } };

// One field of a contextual element.
export function field(spec) {
  const f = shape(spec, {
    allowed: {
      key: keyText, label: textOf, type: oneOf(FIELD_TYPES), cardinality, epistemic: enums(EPISTEMIC_STATES), sourceClasses: enums(SOURCE_CLASSES),
      units: (v, p) => list(v, p, 1, unit), precision, timeSemantics: oneOf(TIME_SEMANTICS), binding: withPath,
      constraints: (v, p) => list(v, p, 0, textOf),
    },
    required: ['key', 'label', 'type', 'cardinality', 'epistemic', 'sourceClasses'],
  }, '');
  const has = (k) => k in f;
  if (['quantity', 'integer'].includes(f.type) && !has('units')) throw new SdkError('S-004', '');
  if (['date', 'datetime'].includes(f.type) && !has('timeSemantics')) throw new SdkError('S-004', '');
  if (f.type === 'code' && !has('binding')) throw new SdkError('S-004', '');
  if (['string', 'boolean', 'code', 'date', 'datetime'].includes(f.type) && has('units')) throw new SdkError('S-004', '');
  return f;
}

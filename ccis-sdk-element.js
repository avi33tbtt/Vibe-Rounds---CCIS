// CCIS CODE-AUTHORING SDK, row 4.2b.1: the element field builder. Prototype. Synthetic data only. Not for clinical use.
//
// Returns a plain, frozen field exactly as the file holds it. Pure; nothing is invented (no default epistemic states, source
// classes, cardinality or label). `min` greater than `max` stays with the validator: the SDK adds no rule the file route lacks.
import { shape, need, list, keyText, idText, artefactId, textOf, binding, manifest, referenceAt, withPath, SdkError } from './ccis-sdk.js';

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
// A concept is a binding narrowed as the element schema narrows it: local system, status mapped, no value set (key format is the validator's, B2).
const concept = withPath((spec) => {
  const b = binding(spec);
  if ('valueSet' in b) throw new SdkError('S-001', 'valueSet');
  need(b.mapping.status === 'mapped', 'mapping.status');
  need(b.codeSystem.id === 'local', 'codeSystem.id');
  return b;
});
// Context tags: at least one, no repeats. Which tags are known is the validator's (B2).
const contexts = (v, p) => {
  const c = list(v, p, 1, idText);
  if (new Set(c).size !== c.length) throw new SdkError('S-004', p);
  return c;
};
// Owner of a concept (ED-12): element id and field key. Whether the owner exists and agrees is the validator's (B1e).
const ownedBy = (v, p) => shape(v, { allowed: { element: artefactId, key: keyText }, required: ['element', 'key'] }, p);
const enums = (set) => (v, p) => list(v, p, 1, oneOf(set));

// One field of a contextual element.
export function field(spec) {
  const f = shape(spec, {
    allowed: {
      key: keyText, label: textOf, type: oneOf(FIELD_TYPES), cardinality, epistemic: enums(EPISTEMIC_STATES), sourceClasses: enums(SOURCE_CLASSES),
      units: (v, p) => list(v, p, 1, unit), precision, timeSemantics: oneOf(TIME_SEMANTICS), binding: withPath(binding), concept, ownedBy, contexts,
      constraints: (v, p) => list(v, p, 0, textOf),
    },
    required: ['key', 'label', 'type', 'cardinality', 'epistemic', 'sourceClasses'],
  }, '');
  const has = (k) => k in f;
  if (has('ownedBy') && !has('concept')) throw new SdkError('S-002', 'concept');
  if (['quantity', 'integer'].includes(f.type) && !has('units')) throw new SdkError('S-004', '');
  if (['date', 'datetime'].includes(f.type) && !has('timeSemantics')) throw new SdkError('S-004', '');
  if (f.type === 'code' && !has('binding')) throw new SdkError('S-004', '');
  if (['string', 'boolean', 'code', 'date', 'datetime'].includes(f.type) && has('units')) throw new SdkError('S-004', '');
  return f;
}

export const RELATIONSHIP_KINDS = Object.freeze(['derived-from', 'part-of', 'refines', 'requires']);
const texts = (...keys) => Object.fromEntries(keys.map((k) => [k, textOf]));
const intent = (v, p) => shape(v, { allowed: { ...texts('purpose', 'setting', 'population', 'rationale'), exclusions: (x, q) => list(x, q, 0, textOf) }, required: ['purpose', 'setting', 'population', 'exclusions', 'rationale'] }, p);
const provenance = (v, p) => shape(v, { allowed: texts('origin', 'basis'), required: ['origin', 'basis'] }, p);
const fieldList = (v, p) => list(v, p, 1, withPath(field));
const module = (v, p) => shape(v, { allowed: { id: keyText, appliesWhen: textOf, fields: fieldList }, required: ['id', 'appliesWhen', 'fields'] }, p);
const relationship = (v, p) => shape(v, { allowed: { kind: oneOf(RELATIONSHIP_KINDS), from: keyText, to: keyText }, required: ['kind', 'from', 'to'] }, p);

// A whole contextual element. Duplicate field keys and relationships naming unknown keys stay with the validator (layer 3).
export function element(spec) {
  return shape(spec, {
    allowed: {
      manifest: withPath((x) => manifest(x, { type: 'contextual-element' })), intent, fields: fieldList, provenance,
      modules: (v, p) => list(v, p, 0, module), relationships: (v, p) => list(v, p, 0, relationship), tests: (v, p) => list(v, p, 0, referenceAt),
    },
    required: ['manifest', 'intent', 'fields', 'provenance'],
  }, '');
}

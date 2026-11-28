// CCIS CODE-AUTHORING SDK, row ECO-B16: the element-group builder. Prototype. Synthetic data only. Not for clinical use.
//
// Returns a plain, frozen element group exactly as the file holds it. Pure; nothing is invented. Duplicate members, unknown
// elements, shared fields that do not exist and meaning checks stay with the validator. No member can hold a number.
import { shape, need, list, keyText, artefactId, textOf, manifest, referenceAt, withPath } from './ccis-sdk.js';

export const RESOLUTIONS = Object.freeze(['same-concept', 'related-not-merged']);
export const CONFLICT_POLICIES = Object.freeze(['refuse', 'prefer-listed-order']);

const oneOf = (set) => (x, p) => { need(set.includes(x), p); return x; };
const matches = (re) => (x, p) => { need(typeof x === 'string' && re.test(x), p); return x; };
const bool = (x, p) => { need(typeof x === 'boolean', p); return x; };
const element = (v, p) => { const r = referenceAt(v, p); need(r.type === 'contextual-element', `${p}.type`); return r; };

const intent = (v, p) => shape(v, {
  allowed: { purpose: textOf, setting: textOf, population: textOf, rationale: textOf, exclusions: (x, q) => list(x, q, 0, textOf) },
  required: ['purpose', 'setting', 'population', 'rationale', 'exclusions'],
}, p);
const member = (v, p) => shape(v, { allowed: { element, required: bool }, required: ['element', 'required'] }, p);
const sharedField = (v, p) => shape(v, { allowed: { element: matches(/^\S+$/), field: keyText }, required: ['element', 'field'] }, p);
const owner = (v, p) => shape(v, { allowed: { element: artefactId, field: keyText }, required: ['element', 'field'] }, p);
const shared = (v, p) => shape(v, {
  allowed: { concept: matches(/^[a-z0-9][A-Za-z0-9._-]*$/), meaning: textOf, fields: (x, q) => list(x, q, 2, sharedField), resolution: oneOf(RESOLUTIONS), owner },
  required: ['concept', 'meaning', 'fields', 'resolution'],
}, p);
const policy = (v, p) => shape(v, { allowed: { conflict: oneOf(CONFLICT_POLICIES) }, required: ['conflict'] }, p);
const provenance = (v, p) => shape(v, { allowed: { origin: textOf, basis: textOf }, required: ['origin', 'basis'] }, p);

// A whole element group: the elements it composes, the concepts they share, and the conflict policy.
export function elementGroup(spec) {
  return shape(spec, {
    allowed: {
      manifest: withPath((x) => manifest(x, { type: 'element-group' })), intent,
      members: (v, p) => list(v, p, 1, member), sharedConcepts: (v, p) => list(v, p, 0, shared),
      versionPolicy: policy, provenance,
    },
    required: ['manifest', 'intent', 'members', 'sharedConcepts', 'versionPolicy', 'provenance'],
  }, '');
}

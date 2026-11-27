// CCIS CODE-AUTHORING SDK, row 4.2c: the pathway builder. Prototype. Synthetic data only. Not for clinical use.
//
// Returns a plain, frozen pathway exactly as the file holds it. Pure; nothing is invented. Timing carries a parameter id only:
// no member can hold a number. Unknown stage ids, missing `needs` keys and duplicate ids stay with the validator (layer 3).
import { shape, need, list, keyText, idText, textOf, manifest, referenceAt, decisionNode, withPath, SdkError } from './ccis-sdk.js';

export const STAGE_KINDS = Object.freeze(['information', 'report']);
export const REQUIREMENTS = Object.freeze(['required', 'optional']);

const oneOf = (set) => (x, p) => { need(set.includes(x), p); return x; };
const texts = (min) => (v, p) => list(v, p, min, textOf);
const pinned = (type) => (v, p) => { const r = referenceAt(v, p); need(r.type === type, `${p}.type`); return r; };
const element = (v, p) => {
  const r = pinned('contextual-element')(v, p);
  if (!('range' in r)) throw new SdkError('S-004', p); // a pathway names elements by range
  return r;
};
const stage = (v, p) => shape(v, {
  allowed: { id: idText, label: textOf, kind: oneOf(STAGE_KINDS), entry: texts(1), exit: texts(1), needs: (x, q) => list(x, q, 0, keyText) },
  required: ['id', 'label', 'kind', 'entry', 'exit'],
}, p);
const transition = (v, p) => shape(v, { allowed: { from: idText, to: idText, via: idText }, required: ['from', 'to'] }, p);
const between = (v, p) => shape(v, { closed: true, allowed: { from: idText, to: idText }, required: ['from', 'to'] }, p);
const timing = (v, p) => shape(v, { allowed: { id: idText, description: textOf, between, parameter: keyText }, required: ['id', 'between', 'parameter'] }, p);
const analytic = (v, p) => shape(v, { allowed: { ref: pinned('analytics-package'), requirement: oneOf(REQUIREMENTS) }, required: ['ref', 'requirement'] }, p);

// A whole pathway: stages, the elements they need, and optional nodes, transitions, timing and analytics.
export function pathway(spec) {
  return shape(spec, {
    allowed: {
      manifest: withPath((x) => manifest(x, { type: 'pathway' })), scope: textOf, intendedUse: textOf, exclusions: texts(0),
      elements: (v, p) => list(v, p, 1, element), stages: (v, p) => list(v, p, 1, stage),
      nodes: (v, p) => list(v, p, 0, withPath(decisionNode)), transitions: (v, p) => list(v, p, 0, transition),
      timing: (v, p) => list(v, p, 0, timing), analytics: (v, p) => list(v, p, 0, analytic),
    },
    required: ['manifest', 'scope', 'intendedUse', 'exclusions', 'elements', 'stages'],
  }, '');
}

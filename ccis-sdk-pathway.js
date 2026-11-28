// CCIS CODE-AUTHORING SDK, row 4.2c: the pathway builder. Prototype. Synthetic data only. Not for clinical use.
//
// Returns a plain, frozen pathway exactly as the file holds it. Pure; nothing is invented. Timing carries a parameter id only:
// no member can hold a number. Unknown stage ids, missing `needs` keys and duplicate ids stay with the validator (layer 3).
import { shape, need, list, keyText, idText, artefactId, textOf, manifest, referenceAt, decisionNode, withPath, SdkError } from './ccis-sdk.js';

export const STAGE_KINDS = Object.freeze(['information', 'report']);
export const REQUIREMENTS = Object.freeze(['required', 'optional']);

const oneOf = (set) => (x, p) => { need(set.includes(x), p); return x; };
const texts = (min) => (v, p) => list(v, p, min, textOf);
const pinned = (type) => (v, p) => { const r = referenceAt(v, p); need(r.type === type, `${p}.type`); return r; };
export const elementRange = (v, p) => {
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

// Layout only (B5): sections of element and section items, and which elements belong to a condition. Known section names,
// element membership and field existence stay with the validator (B6, B6a).
const flag = (x, p) => { need(typeof x === 'boolean', p); return x; };
const keys = (v, p) => list(v, p, 1, keyText);
const elementItem = (v, p) => shape(v, { allowed: { kind: oneOf(['element']), element: artefactId, fields: keys, rowGroups: (x, q) => list(x, q, 1, keys), visibleByDefault: flag }, required: ['kind', 'element'] }, p);
const sectionItem = (v, p) => shape(v, { allowed: { kind: oneOf(['section']), section: (x, q) => { need(typeof x === 'string' && /^[a-z][a-z0-9.-]*$/.test(x), q); return x; }, visibleByDefault: flag }, required: ['kind', 'section'] }, p);
const formItem = (v, p) => {
  need(v !== null && typeof v === 'object' && !Array.isArray(v), p);
  if (!('kind' in v)) throw new SdkError('S-002', `${p}.kind`);
  return v.kind === 'section' ? sectionItem(v, p) : elementItem(v, p); // an unknown kind fails the element item's `kind` check
};
const formSection = (v, p) => shape(v, { allowed: { id: idText, label: textOf, items: (x, q) => list(x, q, 1, formItem) }, required: ['id', 'label', 'items'] }, p);
const entryForm = (v, p) => shape(v, { allowed: { sections: (x, q) => list(x, q, 1, formSection) }, required: ['sections'] }, p);
const context = (v, p) => shape(v, { allowed: { id: idText, label: textOf, elements: (x, q) => list(x, q, 1, artefactId) }, required: ['id', 'label', 'elements'] }, p);

// A whole pathway: stages, the elements they need, and optional nodes, transitions, timing and analytics.
export function pathway(spec) {
  return shape(spec, {
    allowed: {
      manifest: withPath((x) => manifest(x, { type: 'pathway' })), scope: textOf, intendedUse: textOf, exclusions: texts(0),
      elements: (v, p) => list(v, p, 1, elementRange), stages: (v, p) => list(v, p, 1, stage),
      nodes: (v, p) => list(v, p, 0, withPath(decisionNode)), transitions: (v, p) => list(v, p, 0, transition),
      timing: (v, p) => list(v, p, 0, timing), analytics: (v, p) => list(v, p, 0, analytic),
      entryForm, contexts: (v, p) => list(v, p, 1, context),
    },
    required: ['manifest', 'scope', 'intendedUse', 'exclusions', 'elements', 'stages'],
  }, '');
}

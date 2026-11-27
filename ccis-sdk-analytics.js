// CCIS CODE-AUTHORING SDK, row 4.2d: analytics member builders (inputs, parameters, conversions, context entries). Prototype.
// Synthetic data only. Not for clinical use.
//
// Plain, frozen members exactly as the file holds them. Pure; nothing is invented. A parameter has no value, default or suggested
// member (CCIS-REQ-029): one is refused. A key clash, an input whose element is not in `context` and an unused parameter stay with the validator.
import { shape, need, list, keyText, textOf, artefactId, semver, SdkError } from './ccis-sdk.js';
import { FIELD_TYPES } from './ccis-sdk-element.js';
import { elementRange } from './ccis-sdk-pathway.js';

export const PARAMETER_KINDS = Object.freeze(['duration', 'choice', 'set', 'criteria']);
export const NON_VALUE_STATES = Object.freeze(['needs-data', 'indeterminate', 'not-applicable', 'conflict', 'parameter-not-enabled']);
export const CONVERSION_KINDS = Object.freeze(['linear', 'time-zone']);

const oneOf = (set) => (x, p) => { need(set.includes(x), p); return x; };
const token = (x, p) => { need(typeof x === 'string' && /^\S+$/.test(x), p); return x; };
const num = (x, p) => { need(typeof x === 'number' && Number.isFinite(x), p); return x; };
const units = (v, p) => list(v, p, 1, token);
const keys = (min) => (v, p) => list(v, p, min, keyText);
const rule = (ok) => { if (!ok) throw new SdkError('S-004', ''); };

// One declared input: which field of which element, its type and what happens when it is missing.
export function analyticsInput(spec) {
  const i = shape(spec, {
    allowed: { key: keyText, element: artefactId, field: keyText, type: oneOf(FIELD_TYPES), units, onMissing: oneOf(NON_VALUE_STATES) },
    required: ['key', 'element', 'field', 'type', 'onMissing'],
  }, '');
  rule(!['quantity', 'integer'].includes(i.type) || 'units' in i);
  return i;
}

// A declared parameter. It carries no value: the local clinician supplies one at run time.
export function parameter(spec) {
  const q = shape(spec, {
    allowed: {
      id: keyText, label: textOf, kind: oneOf(PARAMETER_KINDS), units, suppliedBy: textOf, note: textOf,
      enabledByDefault: (x, p) => { need(x === false, p); return x; },
      allowedRange: (v, p) => shape(v, { closed: true, allowed: { min: num, max: num }, required: ['min', 'max'] }, p),
      allowedChoices: (v, p) => list(v, p, 2, textOf), allowedMembers: keys(1),
    },
    required: ['id', 'label', 'kind', 'enabledByDefault', 'suppliedBy'],
  }, '');
  rule(q.kind !== 'duration' || ('units' in q && 'allowedRange' in q));
  rule(q.kind !== 'choice' || 'allowedChoices' in q);
  rule(q.kind !== 'set' || 'allowedMembers' in q);
  return q;
}

// A named, versioned conversion: the only place a conversion factor may appear.
export function conversion(spec) {
  const c = shape(spec, {
    allowed: { id: keyText, version: semver, from: token, to: token, kind: oneOf(CONVERSION_KINDS), factor: num, offset: num },
    required: ['id', 'version', 'from', 'to', 'kind'],
  }, '');
  rule(c.kind !== 'linear' || 'factor' in c);
  return c;
}

// An element the analytics needs, by version range, and the field keys it needs from it.
export const contextEntry = (spec) => shape(spec, { allowed: { ref: elementRange, fields: keys(1) }, required: ['ref', 'fields'] }, '');

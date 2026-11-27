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

export const OPERATORS = Object.freeze(['and', 'or', 'not', 'is-present', 'state-of', 'eq', 'ne', 'lt', 'le', 'gt', 'ge', 'add', 'sub', 'time-diff', 'convert', 'if', 'count', 'select']);
export const REF_KINDS = Object.freeze(['input', 'parameter', 'conversion']);
const MAX_DEPTH = 100; // stack safety only; the run-time limit is executionProfile.maxDepth

// A closed expression tree: operator, reference or literal nodes. No number can be built. Arity, type fit and unknown ids stay with the validator.
const exprAt = (v, p, depth) => {
  need(v !== null && typeof v === 'object' && !Array.isArray(v) && depth <= MAX_DEPTH, p);
  const kind = ['op', 'ref', 'literal'].find((k) => k in v);
  need(kind !== undefined, p);
  const child = (y, r) => exprAt(y, r, depth + 1);
  const allowed = {
    op: { op: oneOf(OPERATORS), args: (x, q) => list(x, q, 1, child) },
    ref: { ref: oneOf(REF_KINDS), id: keyText },
    literal: { literal: (x, q) => { need(typeof x === 'boolean' || typeof x === 'string', q); return x; } },
  }[kind];
  return shape(v, { closed: true, allowed, required: Object.keys(allowed) }, p);
};
export const expr = (spec) => exprAt(spec, '', 1);
export const input = (id) => expr({ ref: 'input', id });
export const param = (id) => expr({ ref: 'parameter', id });
export const conv = (id) => expr({ ref: 'conversion', id });
export const lit = (literal) => expr({ literal });
export const op = (name, ...args) => expr({ op: name, args });

// One closed expression tree per output.
export const computation = (v, p = '') => list(v, p, 1, (x, q) => shape(x, {
  closed: true, allowed: { output: keyText, expr: (e, r) => exprAt(e, r, 1) }, required: ['output', 'expr'],
}, q));

// Row 4.2d.2: outputs and the closing members. No default is ever added (no carries, limits or unit).
export const OUTPUT_KINDS = Object.freeze(['value', 'classification', 'table']);
export const VALUE_TYPES = Object.freeze(['quantity', 'time', 'integer']);
export const CARRIES = Object.freeze(['warnings', 'limitations', 'missingDataNotes', 'certainty']);
export const SOURCE_KINDS = Object.freeze(['guideline', 'publication', 'local-protocol', 'expert-opinion']);
const ruleAt = (ok, p) => { if (!ok) throw new SdkError('S-004', p); };
const closed = (allowed, required) => (v, p) => shape(v, { closed: true, allowed, required: required || Object.keys(allowed) }, p);
const whole = (x, p) => { need(Number.isInteger(x) && x >= 1, p); return x; };
const flag = (x, p) => { need(x === true, p); return x; };

export const outputs = (v, p = '') => list(v, p, 1, (x, q) => {
  const o = shape(x, {
    allowed: {
      id: keyText, kind: oneOf(OUTPUT_KINDS), valueType: oneOf(VALUE_TYPES), unit: token, labels: (a, r) => list(a, r, 2, textOf),
      columns: (a, r) => list(a, r, 1, closed({ key: keyText, label: textOf })), states: (a, r) => list(a, r, 1, oneOf(NON_VALUE_STATES)),
      carries: (a, r) => list(a, r, 0, oneOf(CARRIES)),
    },
    required: ['id', 'kind', 'states', 'carries'],
  }, q);
  ruleAt(['warnings', 'limitations', 'missingDataNotes'].every((c) => o.carries.includes(c)), `${q}.carries`);
  const needs = { value: ['valueType', 'unit'], classification: ['labels'], table: ['columns'] };
  for (const k of needs[o.kind]) if (!(k in o)) throw new SdkError('S-002', `${q}.${k}`);
  for (const k of ['valueType', 'unit', 'labels', 'columns']) ruleAt(!(k in o) || needs[o.kind].includes(k), `${q}.${k}`);
  return o;
});
export const interpretation = (v, p = '') => closed({ meaning: textOf, prohibited: (a, r) => list(a, r, 1, textOf) })(v, p);
export const executionProfile = (v, p = '') => closed({ maxSteps: whole, maxDepth: whole, maxOutputBytes: whole })(v, p);
export const evidence = (v, p = '') => closed({ statement: textOf, sources: (a, r) => list(a, r, 0, closed({ kind: oneOf(SOURCE_KINDS), citation: textOf })) })(v, p);
export const provenance = (v, p = '') => closed({ origin: textOf, basis: textOf })(v, p);
export const tests = (v, p = '') => list(v, p, 1, (x, q) => shape(x, {
  allowed: {
    id: keyText, fixture: (f, r) => { need(typeof f === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(f), r); return f; },
    enables: (a, r) => list(a, r, 0, closed({ parameter: keyText, testOnly: flag })),
    expect: (a, r) => list(a, r, 1, (e, s) => {
      const m = shape(e, { allowed: { output: keyText, state: oneOf(NON_VALUE_STATES), label: textOf, matchesFixture: flag }, required: ['output'], closed: true }, s);
      ruleAt(['state', 'label', 'matchesFixture'].filter((k) => k in m).length === 1, s);
      return m;
    }),
  },
  required: ['id', 'fixture', 'enables', 'expect'],
}, q));

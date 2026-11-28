// CCIS CODE-AUTHORING SDK, row ECO-B17: the rule-pack builder. Prototype. Synthetic data only. Not for clinical use.
//
// Returns a plain, frozen rule pack exactly as the file holds it. Pure; nothing is invented. A parameter is declared, never valued,
// and arrives disabled; no member can hold a number. Duplicate ids, unknown input or parameter ids, unknown rule names in tests,
// operator arity and the data-quality scope (ED-6) stay with the validator.
import { shape, need, list, keyText, textOf, semver, manifest, referenceAt, withPath } from './ccis-sdk.js';
import { exprWith } from './ccis-sdk-analytics.js';

export const PACK_CLASSES = Object.freeze(['data-quality', 'clinical-prompt']);
export const READ_MODES = Object.freeze(['latest', 'all', 'count']);
export const PARAMETER_KINDS_RULES = Object.freeze(['interval', 'count']);
export const RULE_KINDS = Object.freeze(['missing', 'stale', 'conflicting', 'inconsistent', 'interval-documentation']);
export const RULE_SEVERITIES = Object.freeze(['info', 'attention']);
export const TEST_EXPECTS = Object.freeze(['fires', 'does-not-fire', 'not-evaluated']);
export const RULE_OPERATORS = Object.freeze(['and', 'or', 'not', 'is-present', 'state-of', 'eq', 'ne', 'lt', 'le', 'gt', 'ge', 'add', 'sub', 'time-diff', 'convert', 'if', 'count', 'select', 'min', 'max', 'coalesce']);

const oneOf = (set) => (x, p) => { need(set.includes(x), p); return x; };
const matches = (re) => (x, p) => { need(typeof x === 'string' && re.test(x), p); return x; };
const exactly = (value) => (x, p) => { need(x === value, p); return x; };
const closed = (allowed, required) => (v, p) => shape(v, { closed: true, allowed, required: required || Object.keys(allowed) }, p);
const between = (min, max, item) => (v, p) => { need(Array.isArray(v) && v.length <= max, p); return list(v, p, min, item); };
const ruleExpr = exprWith(RULE_OPERATORS, ['input', 'parameter']);
const person = matches(/^\S.{0,119}$/);

const scope = (v, p) => shape(v, { allowed: { pathways: (x, q) => list(x, q, 1, (r, s) => { const ref = referenceAt(r, s); need(ref.type === 'pathway', `${s}.type`); return ref; }) }, required: ['pathways'] }, p);
const input = (v, p) => shape(v, { allowed: { id: keyText, concept: matches(/^[a-z0-9][A-Za-z0-9._-]*$/), element: matches(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/), read: oneOf(READ_MODES) }, required: ['id', 'concept', 'read'] }, p);
const parameter = (v, p) => shape(v, {
  allowed: { id: keyText, label: textOf, kind: oneOf(PARAMETER_KINDS_RULES), units: (x, q) => list(x, q, 1, matches(/^\S+$/)), enabledByDefault: exactly(false), suppliedBy: textOf },
  required: ['id', 'label', 'kind', 'enabledByDefault', 'suppliedBy'],
}, p);
const rule = (v, p) => shape(v, {
  allowed: { id: keyText, kind: oneOf(RULE_KINDS), severity: oneOf(RULE_SEVERITIES), when: ruleExpr, message: closed({ template: matches(/^\S.{0,199}$/) }) },
  required: ['id', 'kind', 'severity', 'when', 'message'],
}, p);
const enable = closed({ parameter: keyText, testOnly: exactly(true) });
const test = (v, p) => shape(v, {
  allowed: { id: keyText, rule: keyText, fixture: matches(/^[a-z0-9][a-z0-9-]*$/), synthetic: exactly(true), enables: (x, q) => list(x, q, 0, enable), expect: oneOf(TEST_EXPECTS) },
  required: ['id', 'rule', 'fixture', 'synthetic', 'enables', 'expect'],
}, p);
const reviewer = (v, p) => shape(v, { allowed: { name: person, version: semver, date: matches(/^\d{4}-\d{2}-\d{2}$/) }, required: ['name', 'version', 'date'] }, p);
const governance = (v, p) => shape(v, { allowed: { author: person, owner: person, reviewers: between(0, 20, reviewer) }, required: [] }, p);
const provenance = (v, p) => shape(v, { allowed: { origin: textOf, basis: textOf }, required: ['origin', 'basis'] }, p);

// A whole rule pack: scope, inputs read by concept, declared parameters, rules, synthetic tests and provenance.
export function rulePack(spec) {
  return shape(spec, {
    allowed: {
      manifest: withPath((x) => manifest(x, { type: 'rule-pack' })), class: oneOf(PACK_CLASSES), scope,
      inputs: (v, p) => list(v, p, 1, input), parameters: (v, p) => list(v, p, 0, parameter), rules: between(1, 20, rule),
      tests: (v, p) => list(v, p, 1, test), provenance, sourceNote: textOf, governance,
    },
    required: ['manifest', 'class', 'scope', 'inputs', 'parameters', 'rules', 'tests', 'provenance', 'sourceNote'],
  }, '');
}

// Row ECO-B17: the rule-pack builder, proved equivalent to the file route. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rulePack, PACK_CLASSES, READ_MODES, PARAMETER_KINDS_RULES, RULE_KINDS, RULE_SEVERITIES, TEST_EXPECTS, RULE_OPERATORS } from '../ccis-sdk-rules.js';
import { expr as analyticsExpr } from '../ccis-sdk-analytics.js';
import { SdkError } from '../ccis-sdk.js';
import { compareRoutes } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const schema = JSON.parse(readFileSync(new URL('../ccis/schemas/rule-pack.schema.json', import.meta.url), 'utf8'));
const I = (id) => ({ ref: 'input', id });
const base = () => ({
  manifest: { id: 'demo.data-quality', name: 'Demo data quality', type: 'rule-pack', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft' },
  class: 'data-quality',
  scope: { pathways: [{ id: 'demo.pathway', type: 'pathway', range: '>=0.1.0' }] },
  inputs: [{ id: 'crea', concept: 'creatinine', element: 'demo.element', read: 'count' }],
  parameters: [{ id: 'window', label: 'Window', kind: 'interval', units: ['day'], enabledByDefault: false, suppliedBy: 'Local clinician' }],
  rules: [{ id: 'dqMissing', kind: 'missing', severity: 'info', when: { op: 'eq', args: [I('crea'), { literal: 'needs-data' }] }, message: { template: 'No record found.' } }],
  tests: [{ id: 't1', rule: 'dqMissing', fixture: 'synthetic-case-1', synthetic: true, enables: [{ parameter: 'window', testOnly: true }], expect: 'fires' }],
  provenance: { origin: 'Synthetic test', basis: 'Synthetic test' },
  sourceNote: 'Synthetic note about an information gap.',
  governance: { author: 'Synthetic author', owner: 'Synthetic owner', reviewers: [{ name: 'Synthetic reviewer', version: '0.1.0', date: '2026-11-28' }] },
});
const refused = (fn, code, path) => {
  try { fn(); } catch (e) { assert.ok(e instanceof SdkError); if (code) assert.equal(e.code, code); if (path !== undefined) assert.equal(e.path, path); return e; }
  assert.fail('not refused');
};
const verdict = (doc) => Object.entries(validateArtefact(doc).layers).map(([k, v]) => [k, v.outcome, v.diagnostics.map((d) => d.ruleId)]);
const mut = (fn) => { const d = base(); fn(d); return d; };

test('B17: a full pack equals the hand-written object, frozen, input unchanged; constants equal the schema', () => {
  const spec = base(); const before = JSON.stringify(spec);
  const p = rulePack(spec);
  assert.deepEqual(p, base());
  assert.equal(JSON.stringify(spec), before);
  assert.ok(Object.isFrozen(p) && Object.isFrozen(p.rules[0].when.args) && Object.isFrozen(p.tests[0].enables[0]) && Object.isFrozen(p.governance.reviewers[0]));
  const pr = schema.properties, rp = pr.rules.items.properties, tp = pr.tests.items.properties;
  assert.deepEqual(PACK_CLASSES, pr.class.enum); assert.deepEqual(READ_MODES, pr.inputs.items.properties.read.enum);
  assert.deepEqual(PARAMETER_KINDS_RULES, pr.parameters.items.properties.kind.enum); assert.deepEqual(RULE_KINDS, rp.kind.enum);
  assert.deepEqual(RULE_SEVERITIES, rp.severity.enum); assert.deepEqual(TEST_EXPECTS, tp.expect.enum);
  assert.deepEqual(RULE_OPERATORS, schema.$defs.expr.oneOf[0].properties.op.enum);
});

test('B17: identical on both routes and the same verdict per layer', () => {
  const r = compareRoutes([{ name: 'json', input: JSON.stringify(base()) }, { name: 'code', input: rulePack(base()) }]);
  assert.equal(r.identical, true);
  assert.equal(r.routes[0].checksum, r.routes[1].checksum);
  assert.deepEqual(verdict(rulePack(base())), verdict(base()));
});

test('B17: each required member missing is S-002; unknown is S-001; x- passes through except inside message', () => {
  for (const k of ['manifest', 'class', 'scope', 'inputs', 'parameters', 'rules', 'tests', 'provenance', 'sourceNote']) refused(() => rulePack(mut((d) => { delete d[k]; })), 'S-002', k);
  assert.equal('governance' in rulePack(mut((d) => { delete d.governance; })), false);
  refused(() => rulePack({ ...base(), extra: 1 }), 'S-001', 'extra');
  const p = rulePack(mut((d) => { d['x-n'] = 1; d.rules[0]['x-r'] = true; d.scope['x-s'] = 'a'; }));
  assert.equal(p['x-n'], 1); assert.equal(p.rules[0]['x-r'], true); assert.equal(p.scope['x-s'], 'a');
  refused(() => rulePack(mut((d) => { d.rules[0].message['x-m'] = 1; })), 'S-001', 'rules.0.message.x-m');
});

test('B17: parameters are never valued or enabled; tests are synthetic and test-only', () => {
  refused(() => rulePack(mut((d) => { d.parameters[0].enabledByDefault = true; })), 'S-003', 'parameters.0.enabledByDefault');
  for (const k of ['value', 'default', 'min']) refused(() => rulePack(mut((d) => { d.parameters[0][k] = 1; })), 'S-001', `parameters.0.${k}`);
  refused(() => rulePack(mut((d) => { d.tests[0].synthetic = false; })), 'S-003', 'tests.0.synthetic');
  refused(() => rulePack(mut((d) => { d.tests[0].enables[0].testOnly = false; })), 'S-003', 'tests.0.enables.0.testOnly');
  refused(() => rulePack(mut((d) => { d.tests[0].enables[0]['x-a'] = 1; })), 'S-001', 'tests.0.enables.0.x-a');
});

test('B17: rule count and message length are bounded', () => {
  const one = base().rules[0];
  refused(() => rulePack(mut((d) => { d.rules = []; })), 'S-003', 'rules');
  refused(() => rulePack(mut((d) => { d.rules = Array.from({ length: 21 }, (_, i) => ({ ...one, id: `r${i}` })); })), 'S-003', 'rules');
  assert.equal(rulePack(mut((d) => { d.rules = Array.from({ length: 20 }, (_, i) => ({ ...one, id: `r${i}` })); })).rules.length, 20);
  refused(() => rulePack(mut((d) => { d.rules[0].message.template = 'x'.repeat(201); })), 'S-003', 'rules.0.message.template');
  refused(() => rulePack(mut((d) => { d.rules[0].message.template = ''; })), 'S-003', 'rules.0.message.template');
  refused(() => rulePack(mut((d) => { d.rules[0].message.note = 'a'; })), 'S-001', 'rules.0.message.note');
});

test('B17: rule expressions allow min max coalesce, only input and parameter refs, no number', () => {
  for (const name of ['min', 'max', 'coalesce']) assert.equal(rulePack(mut((d) => { d.rules[0].when = { op: name, args: [I('crea')] }; })).rules[0].when.op, name);
  refused(() => rulePack(mut((d) => { d.rules[0].when = { ref: 'conversion', id: 'c' }; })), 'S-003', 'rules.0.when.ref');
  refused(() => rulePack(mut((d) => { d.rules[0].when = { literal: 5 }; })), 'S-003', 'rules.0.when.literal');
  refused(() => rulePack(mut((d) => { d.rules[0].when = { op: 'exec', args: [I('crea')] }; })), 'S-003', 'rules.0.when.op');
});

test('B17: keys, enumerations and shapes are checked with the path', () => {
  refused(() => rulePack(mut((d) => { d.inputs[0].concept = 'bad concept'; })), 'S-003', 'inputs.0.concept');
  refused(() => rulePack(mut((d) => { d.inputs[0].read = 'first'; })), 'S-003', 'inputs.0.read');
  refused(() => rulePack(mut((d) => { d.rules[0].id = 'Bad'; })), 'S-003', 'rules.0.id');
  refused(() => rulePack(mut((d) => { d.rules[0].severity = 'high'; })), 'S-003', 'rules.0.severity');
  refused(() => rulePack(mut((d) => { d.class = 'advice'; })), 'S-003', 'class');
  refused(() => rulePack(mut((d) => { d.tests[0].expect = 'passes'; })), 'S-003', 'tests.0.expect');
  refused(() => rulePack(mut((d) => { d.scope.pathways[0].type = 'contextual-element'; })), 'S-003', 'scope.pathways.0.type');
  refused(() => rulePack(mut((d) => { d.governance.reviewers[0].date = '28/11/2026'; })), 'S-003', 'governance.reviewers.0.date');
});

test('B17: analytics expressions are unchanged; validator-level checks are not made here', () => {
  refused(() => analyticsExpr({ op: 'min', args: [{ ref: 'input', id: 'a' }] }), 'S-003', 'op');
  assert.equal(analyticsExpr({ ref: 'conversion', id: 'c' }).ref, 'conversion');
  const odd = mut((d) => { d.rules.push({ ...d.rules[0] }); d.rules[0].when = I('nope'); d.tests[0].rule = 'noRule'; });
  assert.equal(rulePack(odd).rules.length, 2);
});

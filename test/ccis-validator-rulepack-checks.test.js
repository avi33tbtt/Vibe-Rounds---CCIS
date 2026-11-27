// Row ECO-B12a: rule-pack layer 5 checks (CCIS-V5-048 to 053). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact, RULES } from '../ccis-validator.js';
import { rulePackChecks } from '../ccis-validator-rulepack-checks.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const pw = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-documentation.pathway.json', import.meta.url), 'utf8'));
pw.manifest.id = 'demo.pathway';
const snake = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8'));
const concept = (code) => ({ codeSystem: { id: 'local', version: '0.1.0' }, code, display: 'Demo', mapping: { status: 'mapped' } });
const element = (id, code) => {
  const e = clone(snake);
  e.manifest.id = id; delete e.relationships; delete e.modules; delete e.tests; delete e.manifest.references;
  e.fields = [{ key: 'a', label: 'Demo amount', type: 'quantity', units: ['mmol/L'], cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'], concept: concept(code) }];
  return e;
};
const elOne = element('demo.el', 'creatinine');
const mk = () => ({ op: 'is-present', args: [{ ref: 'input', id: 'crea' }] });
const base = () => ({
  manifest: { id: 'demo.data-quality', name: 'Demo data quality', type: 'rule-pack', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft', references: [{ id: 'demo.el', type: 'contextual-element', range: '>=0.0.0' }] },
  class: 'data-quality',
  scope: { pathways: [{ id: 'demo.pathway', type: 'pathway', range: '>=0.1.0' }] },
  inputs: [{ id: 'crea', concept: 'creatinine', element: 'demo.el', read: 'count' }],
  parameters: [{ id: 'window', label: 'Window', kind: 'interval', units: ['day'], enabledByDefault: false, suppliedBy: 'Local clinician' }],
  rules: [{ id: 'dqOne', kind: 'stale', severity: 'info', when: { op: 'and', args: [mk(), { op: 'gt', args: [{ ref: 'parameter', id: 'window' }, { ref: 'input', id: 'crea' }] }] }, message: { template: 'No {concept} record for {count} days.' } }],
  tests: [{ id: 't1', rule: 'dqOne', fixture: 'synthetic-1', synthetic: true, enables: [{ parameter: 'window', testOnly: true }], expect: 'not-evaluated' }],
  provenance: { origin: 'Synthetic', basis: 'Synthetic' },
  sourceNote: 'Synthetic note.',
});
const mutate = (fn) => { const d = base(); fn(d); return d; };
const ctxOf = (known) => ({ resolve: (r) => { const d = known.find((k) => k.manifest.id === r.id); return d ? { state: 'ok', doc: d } : { state: 'missing' }; } });
const rows = (d, known = [elOne]) => rulePackChecks(d, ctxOf(known)).map((x) => [x.ruleId, x.severity, x.path]);
const nest = (n) => { let e = mk(); for (let i = 0; i < n; i += 1) e = { op: 'not', args: [e] }; return e; };
const msg = (t) => mutate((d) => { d.rules[0].message.template = t; });

test('1 a valid pack with a resolving element, placeholders and depth 3 gives no layer 5 row', () => {
  assert.deepEqual(rows(base()), []);
  const r = validateArtefact(JSON.stringify(base()), { known: [pw, elOne] });
  assert.equal(r.diagnostics.filter((x) => /^CCIS-V5-0(4[89]|5[0-3])$/.test(x.ruleId)).length, 0, JSON.stringify(r.diagnostics));
});

test('2 V5-048 refuses depth 9 and 41 nodes, accepts depth 8', () => {
  assert.deepEqual(rows(mutate((d) => { d.rules[0].when = nest(7); })), []);
  assert.deepEqual(rows(mutate((d) => { d.rules[0].when = nest(8); })), [['CCIS-V5-048', 'error', '/rules/0/when']]);
  assert.deepEqual(rows(mutate((d) => { d.rules[0].when = { op: 'and', args: Array.from({ length: 20 }, mk) }; })), [['CCIS-V5-048', 'error', '/rules/0/when']]);
});

test('3 V5-049 for a concept the named element lacks; a present concept passes; an unresolved element is skipped', () => {
  assert.deepEqual(rows(mutate((d) => { d.inputs[0].concept = 'glucose'; })), [['CCIS-V5-049', 'error', '/inputs/0/concept']]);
  assert.deepEqual(rows(base(), []), []);
});

test('4 V5-049 without element: absent from every resolved referenced element', () => {
  assert.deepEqual(rows(mutate((d) => { delete d.inputs[0].element; d.inputs[0].concept = 'glucose'; })), [['CCIS-V5-049', 'error', '/inputs/0/concept']]);
  assert.deepEqual(rows(mutate((d) => { delete d.inputs[0].element; })), []);
});

test('5 V5-050 refuses an unknown placeholder and an unclosed brace; the three allowed ones pass', () => {
  assert.deepEqual(rows(msg('Gap in {creatinine}.')), [['CCIS-V5-050', 'error', '/rules/0/message/template']]);
  assert.deepEqual(rows(msg('Gap in {concept')), [['CCIS-V5-050', 'error', '/rules/0/message/template']]);
  assert.deepEqual(rows(msg('{concept} {parameter} {count}')), []);
});

test('6 V5-051 refuses markup, a URL, www and a control character', () => {
  for (const t of ['A <b>gap</b>.', 'See https://x', 'See www.x', 'A\tgap.']) assert.deepEqual(rows(msg(t)), [['CCIS-V5-051', 'error', '/rules/0/message/template']], t);
});

test('7 V5-052 refuses whole-word instruction words, accepts reordered and plain text', () => {
  assert.deepEqual(rows(msg('Order a repeat.')), [['CCIS-V5-052', 'error', '/rules/0/message/template']]);
  assert.deepEqual(rows(msg('STOP')), [['CCIS-V5-052', 'error', '/rules/0/message/template']]);
  assert.deepEqual(rows(msg('No record found.')), []);
  assert.deepEqual(rows(msg('The list was reordered.')), []);
});

test('8 V5-053 is a warning for an element outside references, and all six ids are in RULES', () => {
  assert.deepEqual(rows(mutate((d) => { d.inputs[0].element = 'demo.other'; })), [['CCIS-V5-053', 'warning', '/inputs/0/element']]);
  const ids = RULES.map((r) => r.ruleId);
  for (const n of [48, 49, 50, 51, 52, 53]) assert.ok(ids.includes(`CCIS-V5-0${n}`), String(n));
});

// Row ECO-B18a: contract fixtures part 2 (pathway, rule pack, contexts). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { canonicalize, checksumOf, compareRoutes } from '../ccis-compile.js';
import { pathway } from '../ccis-sdk-pathway.js';
import { rulePack } from '../ccis-sdk-rules.js';
import { bindRuleInputs } from '../ccis-rules-bind.js';
import { evaluateRulePack } from '../ccis-rules.js';

const dir = new URL('../ccis/fixtures/contract/', import.meta.url);
const text = (f) => readFileSync(new URL(f, dir), 'utf8');
const doc = (f) => JSON.parse(text(f));
const core = doc('core-vitals.element.json');
const htn = doc('htn-core.element.json');
const path = doc('contract.pathway.json');
const pack = doc('contract.rule-pack.json');
const ctxs = doc('contract.contexts.json');
const exp = doc('expected-rules.json');
const rows = (r) => Object.values(r.layers).flatMap((l) => l.diagnostics);
const errors = (r) => rows(r).filter((x) => x.severity === 'error');
const sorted = (v) => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v;
const run = (name) => {
  const b = bindRuleInputs({ pack, context: ctxs[name] });
  return { b, r: evaluateRulePack({ pack, bound: b.bound, asOf: exp.asOf }) };
};

test('B18a: the pathway passes every layer with no error row', () => {
  const r = validateArtefact(path, { known: [core, htn] });
  assert.equal(r.outcome, 'no-errors-so-far');
  assert.equal(errors(r).length, 0);
});

test('B18a: pathway and rule pack equal the builder output on both routes', () => {
  for (const [f, d, build] of [['contract.pathway.json', path, pathway], ['contract.rule-pack.json', pack, rulePack]]) {
    const r = compareRoutes([{ name: 'json', input: text(f) }, { name: 'code', input: build(d) }]);
    assert.equal(r.identical, true, f);
    assert.equal(r.routes[0].checksum, r.routes[1].checksum, f);
  }
});

test('B18a: the entry form places the shared sbp field nowhere', () => {
  const secs = path.entryForm.sections.map((s) => ({ id: s.id, items: s.items.map((i) => (i.kind === 'section' ? { section: i.section } : { element: i.element, fields: i.fields ?? null })) }));
  assert.deepEqual(secs, exp.formSections);
  assert.equal(JSON.stringify(path.entryForm).includes('sbp'), false);
  assert.deepEqual(path.contexts.map((c) => [c.id, c.elements]), [['hypertension', ['core.vitals', 'htn.core']]]);
});

test('B18a: the pack passes with the pathway as known and holds no number or parameter', () => {
  const r = validateArtefact(pack, { known: [path, htn, core] });
  assert.equal(r.outcome, 'no-errors-so-far');
  assert.equal(errors(r).length, 0);
  assert.deepEqual(pack.parameters, []);
  assert.equal(/[0-9]/.test(JSON.stringify(pack.rules)), false);
});

test('B18a: bound inputs for the three contexts equal the hand-calculated ones', () => {
  for (const name of ['absent', 'present', 'enteredInError']) {
    const { b } = run(name);
    assert.equal(b.ok, true, name);
    assert.deepEqual(sorted(b.bound), exp.bound[name], name);
  }
});

test('B18a: prompts equal the hand-calculated ones; the checksum is of the canonical pack', () => {
  for (const name of ['absent', 'present', 'enteredInError']) {
    const { r } = run(name);
    assert.equal(r.ok, true, name);
    const want = exp.prompts[name].map((p) => ({ ...p, packVersion: '0.1.0', packChecksum: checksumOf(canonicalize(pack).text), asOf: exp.asOf }));
    assert.deepEqual(sorted(r.prompts), sorted(want), name);
    assert.deepEqual(r.notEvaluated, [], name);
  }
});

test('B18a: pack tests cover fires and does-not-fire and name an existing rule', () => {
  const ids = new Set(pack.rules.map((r) => r.id));
  const kinds = pack.tests.map((t) => t.expect);
  assert.ok(kinds.includes('fires') && kinds.includes('does-not-fire'));
  for (const t of pack.tests) { assert.ok(ids.has(t.rule), t.id); assert.equal(t.synthetic, true); }
});

test('B18a: files are LF-only, sorted-key and carry no identity member', () => {
  for (const f of ['contract.pathway.json', 'contract.rule-pack.json', 'contract.contexts.json']) {
    const t = text(f);
    assert.equal(t.includes('\r'), false, f);
    assert.equal(t, JSON.stringify(sorted(JSON.parse(t)), null, 2) + '\n', f);
    assert.equal(/"(name|patientName|mrn|dob|nhsNumber)"\s*:\s*"[^"]*"/i.test(JSON.stringify(JSON.parse(t).absent ?? {})), false, f);
  }
  assert.match(text('contract.contexts.json'), /"obs-sbp-1"/);
});

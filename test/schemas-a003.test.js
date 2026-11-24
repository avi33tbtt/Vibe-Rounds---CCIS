// Row 1.6b: schema members for approved amendment A-003 (package tests, validation scope). Prototype. Synthetic data only.
// Fixture files are also covered by the index-driven tests in schemas.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { manifest, analytics, element, pathway, decisionNode, terminologyBinding } from '../ccis/validators/ccis-validators.js';

const fx = new URL('../ccis/fixtures/schemas/', import.meta.url);
const ex = new URL('../ccis/examples/snake/', import.meta.url);
const load = (u, f) => JSON.parse(readFileSync(new URL(f, u), 'utf8'));
const clone = (o) => structuredClone(o);

test('a validated or conditionally validated manifest must carry a validation scope; a draft need not', () => {
  const m = load(fx, 'manifest-good-validated.json');
  assert.equal(manifest(m), true);
  const bare = clone(m); delete bare.validation;
  assert.equal(manifest(bare), false);
  bare.status = 'conditionally-validated'; assert.equal(manifest(bare), false);
  bare.status = 'draft'; assert.equal(manifest(bare), true);
  const withScope = clone(m); withScope.status = 'draft'; assert.equal(manifest(withScope), true);
});

test('the validation scope needs a semver version, population, setting and intended use, and is closed', () => {
  const m = load(fx, 'manifest-good-validated.json');
  for (const k of ['version', 'population', 'setting', 'intendedUse']) { const x = clone(m); delete x.validation[k]; assert.equal(manifest(x), false, k); }
  const bad = clone(m); bad.validation.version = '1.0'; assert.equal(manifest(bad), false);
  const extra = clone(m); extra.validation.threshold = 'x'; assert.equal(manifest(extra), false);
  const ext = clone(m); ext.validation['x-note'] = 'ok'; assert.equal(manifest(ext), true);
});

test('package tests: needs id, fixture, enables, expect; a test-only marker on every enabled parameter; no value member', () => {
  const a = load(fx, 'analytics-good-with-tests.json');
  assert.equal(analytics(a), true, JSON.stringify(analytics.errors));
  for (const k of ['id', 'fixture', 'enables', 'expect']) { const x = clone(a); delete x.tests[0][k]; assert.equal(analytics(x), false, k); }
  const notOnly = clone(a); notOnly.tests[0].enables[0].testOnly = false; assert.equal(analytics(notOnly), false);
  const val = clone(a); val.tests[0].enables[0].value = 1; assert.equal(analytics(val), false);
  const top = clone(a); top.tests[0].values = {}; assert.equal(analytics(top), false);
  const two = clone(a); two.tests[0].expect[0].state = 'needs-data'; assert.equal(analytics(two), false, 'one kind of expectation only');
  const badState = clone(a); badState.tests[0].expect = [{ output: 'elapsed', state: 'normal' }]; assert.equal(analytics(badState), false);
  const none = clone(a); none.tests = []; assert.equal(analytics(none), false);
});

test('parameters stay valueless in a package that declares tests (D-022)', () => {
  const a = load(fx, 'analytics-good-with-tests.json');
  for (const p of a.parameters) assert.deepEqual(Object.keys(p).filter((k) => /^(value|default|suggested)/i.test(k)), []);
});

test('every committed snake artefact still passes its schema unchanged', () => {
  const v = { element, pathway, node: decisionNode, binding: terminologyBinding, analytics };
  for (const f of readdirSync(ex).filter((n) => n.endsWith('.json'))) {
    const kind = f.includes('.analytics') ? 'analytics' : f.includes('.node.') ? 'node' : f.includes('.pathway') ? 'pathway' : f.includes('.binding') ? 'binding' : 'element';
    assert.equal(v[kind](load(ex, f)), true, `${f}: ${JSON.stringify(v[kind].errors)}`);
  }
});

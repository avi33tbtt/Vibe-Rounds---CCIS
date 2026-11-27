// Row 4.2b.1a: the whole-element builder, proved equivalent to the file route. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { element, RELATIONSHIP_KINDS } from '../ccis-sdk-element.js';
import { SdkError } from '../ccis-sdk.js';
import { compareRoutes } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const fileText = readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8');
const schema = JSON.parse(readFileSync(new URL('../ccis/schemas/element.schema.json', import.meta.url), 'utf8'));
const FIELD = { key: 'demoKey', label: 'Demo label', type: 'string', cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'] };
const MIN = {
  manifest: { id: 'demo.element', name: 'Demo element', type: 'contextual-element', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.1.0' }, status: 'draft' },
  intent: { purpose: 'Demonstration.', setting: 'Any.', population: 'Synthetic.', exclusions: [], rationale: 'Demonstration only.' },
  fields: [FIELD],
  provenance: { origin: 'Demonstration', basis: 'None' },
};
const refused = (fn, code, path) => {
  try { fn(); } catch (e) { assert.ok(e instanceof SdkError); if (code) assert.equal(e.code, code); if (path !== undefined) assert.equal(e.path, path); return e; }
  assert.fail('not refused');
};
const verdict = (doc) => Object.entries(validateArtefact(doc).layers).map(([k, v]) => [k, v.outcome, v.diagnostics.map((d) => d.ruleId)]);

test('4.2b.1a: the snake element is identical on the code route and validates the same', () => {
  const r = compareRoutes([{ name: 'json', input: fileText }, { name: 'code', input: element(JSON.parse(fileText)) }]);
  assert.equal(r.identical, true);
  assert.equal(r.routes[0].checksum, r.routes[1].checksum);
  assert.deepEqual(verdict(element(JSON.parse(fileText))), verdict(JSON.parse(fileText)));
});

test('4.2b.1a: a minimal element holds only what was given, frozen; a missing member is refused', () => {
  const e = element(MIN);
  assert.deepEqual(e, MIN);
  for (const k of ['modules', 'relationships', 'tests']) assert.equal(k in e, false);
  assert.ok(Object.isFrozen(e) && Object.isFrozen(e.fields) && Object.isFrozen(e.intent) && Object.isFrozen(e.manifest));
  const { provenance, ...rest } = MIN;
  refused(() => element(rest), 'S-002', 'provenance');
  refused(() => element({ ...MIN, intent: { ...MIN.intent, exclusions: undefined } }), 'S-003', 'intent.exclusions');
  refused(() => element({ ...MIN, extra: 1 }), 'S-001', 'extra');
});

test('4.2b.1a: the manifest is pinned to contextual-element and keeps its own codes under a prefix', () => {
  refused(() => element({ ...MIN, manifest: { ...MIN.manifest, type: 'pathway' } }), 'S-003', 'manifest.type');
  refused(() => element({ ...MIN, manifest: { ...MIN.manifest, version: '1.0' } }), 'S-003', 'manifest.version');
  refused(() => element({ ...MIN, manifest: { ...MIN.manifest, status: 'validated' } }), 'S-004', 'manifest');
});

test('4.2b.1a: a refused field carries its index; fields cannot be empty', () => {
  refused(() => element({ ...MIN, fields: [FIELD, { ...FIELD, cardinality: { min: 0, max: 0 } }] }), 'S-003', 'fields.1.cardinality.max');
  refused(() => element({ ...MIN, fields: [FIELD, { ...FIELD, type: 'code' }] }), 'S-004', 'fields.1');
  refused(() => element({ ...MIN, fields: [] }), 'S-003', 'fields');
});

test('4.2b.1a: modules are built in order and each needs its members', () => {
  const m = (id) => ({ id, appliesWhen: 'When it applies.', fields: [FIELD] });
  assert.deepEqual(element({ ...MIN, modules: [m('zeta'), m('alpha')] }).modules.map((x) => x.id), ['zeta', 'alpha']);
  refused(() => element({ ...MIN, modules: [{ ...m('a'), fields: [] }] }), 'S-003', 'modules.0.fields');
  const { appliesWhen, ...bad } = m('a');
  refused(() => element({ ...MIN, modules: [m('b'), bad] }), 'S-002', 'modules.1.appliesWhen');
  refused(() => element({ ...MIN, modules: [{ ...m('a'), fields: [{ ...FIELD, key: 'Bad' }] }] }), 'S-003', 'modules.0.fields.0.key');
});

test('4.2b.1a: relationships keep their order and are not checked against the fields', () => {
  assert.deepEqual(RELATIONSHIP_KINDS, schema.properties.relationships.items.properties.kind.enum);
  const rel = [{ kind: 'requires', from: 'zKey', to: 'noSuchField' }, { kind: 'part-of', from: 'aKey', to: 'demoKey' }];
  assert.deepEqual(element({ ...MIN, relationships: rel }).relationships, rel);
  refused(() => element({ ...MIN, relationships: [{ kind: 'causes', from: 'a', to: 'b' }] }), 'S-003', 'relationships.0.kind');
  refused(() => element({ ...MIN, relationships: [{ kind: 'refines', from: 'a' }] }), 'S-002', 'relationships.0.to');
});

test('4.2b.1a: tests are references, and x- members pass where the schema allows', () => {
  const t = { id: 'demo.tests', type: 'test-validation-package', version: '0.1.0' };
  assert.deepEqual(element({ ...MIN, tests: [t] }).tests, [t]);
  refused(() => element({ ...MIN, tests: [{ ...t, range: '^0.1.0' }] }), 'S-004', 'tests.0');
  const x = element({
    ...MIN, 'x-e': 1, intent: { ...MIN.intent, 'x-i': 2 }, provenance: { ...MIN.provenance, 'x-p': 3 },
    modules: [{ id: 'm', appliesWhen: 'Always.', fields: [FIELD], 'x-m': 4 }], relationships: [{ kind: 'requires', from: 'a', to: 'b', 'x-r': 5 }],
  });
  assert.deepEqual([x['x-e'], x.intent['x-i'], x.provenance['x-p'], x.modules[0]['x-m'], x.relationships[0]['x-r']], [1, 2, 3, 4, 5]);
});

test('4.2b.1a: a hostile string is never in a message, and the module stays pure', () => {
  const H = '<script>alert(1)</script>';
  assert.equal(refused(() => element({ ...MIN, intent: { ...MIN.intent, purpose: 5, setting: H } }), 'S-003').message.includes(H), false);
  assert.equal(refused(() => element({ ...MIN, [H]: 1 }), 'S-001').message.includes(H), false);
  const src = readFileSync(new URL('../ccis-sdk-element.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['node:', 'Date', 'Math.random', 'fetch', 'eval', 'Function(', 'import(', 'process', 'require(']) assert.equal(src.includes(bad), false, bad);
});

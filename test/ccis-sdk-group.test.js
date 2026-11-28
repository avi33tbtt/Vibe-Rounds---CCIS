// Row ECO-B16: the element-group builder, proved equivalent to the file route. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { elementGroup, RESOLUTIONS, CONFLICT_POLICIES } from '../ccis-sdk-group.js';
import { SdkError } from '../ccis-sdk.js';
import { compareRoutes } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const fileText = readFileSync(new URL('../ccis/examples/diabetes-ckd/diabetes-ckd.group.json', import.meta.url), 'utf8');
const schema = JSON.parse(readFileSync(new URL('../ccis/schemas/element-group.schema.json', import.meta.url), 'utf8'));
const EL = { id: 'demo.element', type: 'contextual-element', version: '0.1.0' };
const SHARED = { concept: 'demoConcept', meaning: 'Two related facts.', fields: [{ element: 'demo.element', field: 'a' }, { element: 'demo.other', field: 'b' }], resolution: 'related-not-merged' };
const MIN = {
  manifest: { id: 'demo.group', name: 'Demo group', type: 'element-group', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.1.0' }, status: 'draft' },
  intent: { purpose: 'Demonstration.', setting: 'Any.', population: 'None.', rationale: 'Test.', exclusions: [] },
  members: [{ element: EL, required: true }], sharedConcepts: [SHARED], versionPolicy: { conflict: 'refuse' },
  provenance: { origin: 'Synthetic.', basis: 'None.' },
};
const refused = (fn, code, path) => {
  try { fn(); } catch (e) { assert.ok(e instanceof SdkError); if (code) assert.equal(e.code, code); if (path !== undefined) assert.equal(e.path, path); return e; }
  assert.fail('not refused');
};
const verdict = (doc) => Object.entries(validateArtefact(doc).layers).map(([k, v]) => [k, v.outcome, v.diagnostics.map((d) => d.ruleId)]);

test('B16: the diabetes-ckd group is identical on the code route and validates the same', () => {
  const r = compareRoutes([{ name: 'json', input: fileText }, { name: 'code', input: elementGroup(JSON.parse(fileText)) }]);
  assert.equal(r.identical, true);
  assert.equal(r.routes[0].checksum, r.routes[1].checksum);
  assert.deepEqual(verdict(elementGroup(JSON.parse(fileText))), verdict(JSON.parse(fileText)));
});

test('B16: a minimal group equals the hand-written object, frozen, input unchanged; enums match the schema', () => {
  const before = JSON.stringify(MIN);
  const g = elementGroup(MIN);
  assert.deepEqual(g, MIN);
  assert.equal(JSON.stringify(MIN), before);
  assert.ok(Object.isFrozen(g) && Object.isFrozen(g.members[0]) && Object.isFrozen(g.sharedConcepts[0].fields) && Object.isFrozen(g.intent));
  assert.deepEqual(RESOLUTIONS, schema.properties.sharedConcepts.items.properties.resolution.enum);
  assert.deepEqual(CONFLICT_POLICIES, schema.properties.versionPolicy.properties.conflict.enum);
  const withOwner = { ...SHARED, owner: { element: 'demo.element', field: 'a' } };
  assert.deepEqual(elementGroup({ ...MIN, sharedConcepts: [withOwner] }).sharedConcepts[0].owner, withOwner.owner);
});

test('B16: each missing top-level member is S-002 with its path', () => {
  for (const k of Object.keys(MIN)) {
    const { [k]: _gone, ...rest } = MIN;
    refused(() => elementGroup(rest), 'S-002', k);
  }
});

test('B16: unknown members are S-001; x- members pass through', () => {
  refused(() => elementGroup({ ...MIN, extra: 1 }), 'S-001', 'extra');
  refused(() => elementGroup({ ...MIN, members: [{ ...MIN.members[0], note: 'x' }] }), 'S-001', 'members.0.note');
  const g = elementGroup({ ...MIN, 'x-note': { a: 1 }, versionPolicy: { conflict: 'refuse', 'x-n': 2 } });
  assert.deepEqual(g['x-note'], { a: 1 });
  assert.equal(g.versionPolicy['x-n'], 2);
});

test('B16: wrong types are refused with the path', () => {
  refused(() => elementGroup({ ...MIN, members: [{ element: EL, required: 'yes' }] }), 'S-003', 'members.0.required');
  refused(() => elementGroup({ ...MIN, members: [{ element: { ...EL, type: 'pathway' }, required: true }] }), 'S-003', 'members.0.element.type');
  refused(() => elementGroup({ ...MIN, members: [{ element: { id: 'demo.element', type: 'contextual-element' }, required: true }] }), 'S-004', 'members.0.element');
  refused(() => elementGroup({ ...MIN, manifest: { ...MIN.manifest, type: 'pathway' } }), 'S-003', 'manifest.type');
  refused(() => elementGroup({ ...MIN, intent: { ...MIN.intent, exclusions: undefined } }), 'S-003', 'intent.exclusions');
});

test('B16: short lists and values outside their lists are refused', () => {
  refused(() => elementGroup({ ...MIN, members: [] }), 'S-003', 'members');
  refused(() => elementGroup({ ...MIN, sharedConcepts: [{ ...SHARED, fields: [SHARED.fields[0]] }] }), 'S-003', 'sharedConcepts.0.fields');
  refused(() => elementGroup({ ...MIN, sharedConcepts: [{ ...SHARED, resolution: 'merged' }] }), 'S-003', 'sharedConcepts.0.resolution');
  refused(() => elementGroup({ ...MIN, versionPolicy: { conflict: 'newest' } }), 'S-003', 'versionPolicy.conflict');
});

test('B16: a shared concept key with a space or a capital first letter is refused', () => {
  refused(() => elementGroup({ ...MIN, sharedConcepts: [{ ...SHARED, concept: 'demo concept' }] }), 'S-003', 'sharedConcepts.0.concept');
  refused(() => elementGroup({ ...MIN, sharedConcepts: [{ ...SHARED, concept: 'Demo' }] }), 'S-003', 'sharedConcepts.0.concept');
  assert.equal(elementGroup({ ...MIN, sharedConcepts: [{ ...SHARED, concept: 'local.demo-1' }] }).sharedConcepts[0].concept, 'local.demo-1');
});

test('B16: validator-level checks stay with the validator, not the builder', () => {
  const dup = { ...MIN, members: [{ element: EL, required: true }, { element: EL, required: false }] };
  assert.equal(elementGroup(dup).members.length, 2);
});

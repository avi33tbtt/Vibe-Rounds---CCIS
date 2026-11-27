// Row 4.2c: the pathway builder, proved equivalent to the file route. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathway, STAGE_KINDS, REQUIREMENTS } from '../ccis-sdk-pathway.js';
import { SdkError } from '../ccis-sdk.js';
import { compareRoutes } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const fileText = readFileSync(new URL('../ccis/examples/snake/snake-documentation.pathway.json', import.meta.url), 'utf8');
const schema = JSON.parse(readFileSync(new URL('../ccis/schemas/pathway.schema.json', import.meta.url), 'utf8'));
const EL = { id: 'demo.element', type: 'contextual-element', range: '^0.1.0' };
const STAGE = { id: 'first', label: 'First', kind: 'information', entry: ['It starts.'], exit: ['It ends.'] };
const MIN = {
  manifest: { id: 'demo.path', name: 'Demo path', type: 'pathway', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.1.0' }, status: 'draft' },
  scope: 'Demonstration.', intendedUse: 'Descriptive only.', exclusions: [], elements: [EL], stages: [STAGE],
};
const refused = (fn, code, path) => {
  try { fn(); } catch (e) { assert.ok(e instanceof SdkError); if (code) assert.equal(e.code, code); if (path !== undefined) assert.equal(e.path, path); return e; }
  assert.fail('not refused');
};
const verdict = (doc) => Object.entries(validateArtefact(doc).layers).map(([k, v]) => [k, v.outcome, v.diagnostics.map((d) => d.ruleId)]);

test('4.2c: the snake pathway is identical on the code route and validates the same', () => {
  const r = compareRoutes([{ name: 'json', input: fileText }, { name: 'code', input: pathway(JSON.parse(fileText)) }]);
  assert.equal(r.identical, true);
  assert.equal(r.routes[0].checksum, r.routes[1].checksum);
  assert.deepEqual(verdict(pathway(JSON.parse(fileText))), verdict(JSON.parse(fileText)));
});

test('4.2c: a minimal pathway holds only what was given, frozen; a missing member is refused', () => {
  const p = pathway(MIN);
  assert.deepEqual(p, MIN);
  for (const k of ['nodes', 'transitions', 'timing', 'analytics']) assert.equal(k in p, false);
  assert.ok(Object.isFrozen(p) && Object.isFrozen(p.stages[0]) && Object.isFrozen(p.elements[0]) && Object.isFrozen(p.manifest));
  const { stages, ...rest } = MIN;
  refused(() => pathway(rest), 'S-002', 'stages');
  refused(() => pathway({ ...MIN, exclusions: undefined }), 'S-003', 'exclusions');
  refused(() => pathway({ ...MIN, elements: [] }), 'S-003', 'elements');
});

test('4.2c: the manifest is pinned and elements are given by range of the element type', () => {
  refused(() => pathway({ ...MIN, manifest: { ...MIN.manifest, type: 'contextual-element' } }), 'S-003', 'manifest.type');
  refused(() => pathway({ ...MIN, elements: [{ id: 'demo.element', type: 'contextual-element', version: '0.1.0' }] }), 'S-004', 'elements.0');
  refused(() => pathway({ ...MIN, elements: [EL, { ...EL, type: 'pathway' }] }), 'S-003', 'elements.1.type');
});

test('4.2c: stages keep their order and their members are checked', () => {
  assert.deepEqual(STAGE_KINDS, schema.properties.stages.items.properties.kind.enum);
  const s2 = { ...STAGE, id: 'a-report', kind: 'report', needs: ['demoKey'] };
  assert.deepEqual(pathway({ ...MIN, stages: [STAGE, s2] }).stages.map((s) => s.id), ['first', 'a-report']);
  refused(() => pathway({ ...MIN, stages: [{ ...STAGE, entry: [] }] }), 'S-003', 'stages.0.entry');
  refused(() => pathway({ ...MIN, stages: [STAGE, { ...s2, needs: ['Bad Key'] }] }), 'S-003', 'stages.1.needs.0');
  refused(() => pathway({ ...MIN, stages: [{ ...STAGE, kind: 'action' }] }), 'S-003', 'stages.0.kind');
});

test('4.2c: nodes are built by the node builder; transitions keep order and are not checked against the stages', () => {
  const bad = { id: 'n', question: 'Is it so?', inputs: [{ key: 'k', element: 'demo.element', field: 'f' }], outcomes: [{ id: 'o', kind: 'answer', when: [{ input: 'k', is: 'present' }], next: { end: true } }, { id: 'p', kind: 'answer', when: [{ input: 'k', is: 'absent' }], next: { end: true } }] };
  refused(() => pathway({ ...MIN, nodes: [bad] }), 'S-004', 'nodes.0.outcomes');
  const tr = [{ from: 'zzz', to: 'nowhere', via: 'node-one' }, { from: 'first', to: 'first' }];
  assert.deepEqual(pathway({ ...MIN, transitions: tr }).transitions, tr);
  refused(() => pathway({ ...MIN, transitions: [{ from: 'a', to: 'B' }] }), 'S-003', 'transitions.0.to');
});

test('4.2c: timing names a parameter and holds no number', () => {
  const t = { id: 'gap', description: 'The number is supplied locally.', between: { from: 'first', to: 'first' }, parameter: 'targetInterval' };
  assert.deepEqual(pathway({ ...MIN, timing: [t] }).timing, [t]);
  refused(() => pathway({ ...MIN, timing: [{ ...t, between: { ...t.between, 'x-a': 1 } }] }), 'S-001', 'timing.0.between.x-a');
  refused(() => pathway({ ...MIN, timing: [{ ...t, minutes: 30 }] }), 'S-001', 'timing.0.minutes');
  refused(() => pathway({ ...MIN, timing: [{ ...t, parameter: 30 }] }), 'S-003', 'timing.0.parameter');
});

test('4.2c: analytics references are pinned and x- members pass where allowed', () => {
  assert.deepEqual(REQUIREMENTS, schema.properties.analytics.items.properties.requirement.enum);
  const a = { ref: { id: 'demo.analytics', type: 'analytics-package', range: '^0.1.0' }, requirement: 'optional' };
  assert.deepEqual(pathway({ ...MIN, analytics: [a] }).analytics, [a]);
  refused(() => pathway({ ...MIN, analytics: [{ ...a, ref: { ...a.ref, type: 'pathway' } }] }), 'S-003', 'analytics.0.ref.type');
  refused(() => pathway({ ...MIN, analytics: [{ ...a, requirement: 'maybe' }] }), 'S-003', 'analytics.0.requirement');
  const x = pathway({ ...MIN, 'x-p': 1, stages: [{ ...STAGE, 'x-s': 2 }], analytics: [{ ...a, 'x-a': 3 }] });
  assert.deepEqual([x['x-p'], x.stages[0]['x-s'], x.analytics[0]['x-a']], [1, 2, 3]);
});

test('4.2c: a hostile string is never in a message, and the module stays pure', () => {
  const H = '<script>alert(1)</script>';
  assert.equal(refused(() => pathway({ ...MIN, scope: 5, intendedUse: H }), 'S-003').message.includes(H), false);
  assert.equal(refused(() => pathway({ ...MIN, [H]: 1 }), 'S-001').message.includes(H), false);
  const src = readFileSync(new URL('../ccis-sdk-pathway.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['node:', 'Date', 'Math.random', 'fetch', 'eval', 'Function(', 'import(', 'process', 'require(']) assert.equal(src.includes(bad), false, bad);
});

// Row 4.2b: the manifest and reference builders, proved equivalent to the file route. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { manifest, reference, SdkError, ARTEFACT_TYPES, MANIFEST_STATUSES } from '../ccis-sdk.js';
import { compareRoutes } from '../ccis-compile.js';

const dir = new URL('../ccis/examples/snake/', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('../ccis/schemas/manifest.schema.json', import.meta.url), 'utf8'));
const MIN = { id: 'demo.thing', name: 'Demo thing', type: 'pathway', version: '1.0.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.1.0' }, status: 'draft' };
const SCOPE = { version: '1.0.0', population: 'Synthetic adults', setting: 'Demonstration', intendedUse: 'Demonstration only' };
const REF = { id: 'demo.other', type: 'contextual-element', version: '0.1.0' };
const refused = (fn, code, path) => {
  try { fn(); } catch (e) { assert.ok(e instanceof SdkError); if (code) assert.equal(e.code, code); if (path !== undefined) assert.equal(e.path, path); return e; }
  assert.fail('not refused');
};

test('4.2b: every example manifest is identical on the code route', () => {
  let seen = 0;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const doc = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    if (!doc.manifest) continue;
    seen += 1;
    const r = compareRoutes([{ name: 'json', input: JSON.stringify(doc.manifest) }, { name: 'code', input: manifest(doc.manifest) }]);
    assert.equal(r.identical, true, f);
    assert.equal(r.routes[0].checksum, r.routes[1].checksum);
  }
  assert.ok(seen >= 5);
});

test('4.2b: a minimal draft holds only what was given, frozen', () => {
  const m = manifest(MIN);
  assert.deepEqual(m, MIN);
  for (const k of ['requires', 'references', 'validation', 'mandatoryExtensions']) assert.equal(k in m, false);
  assert.ok(Object.isFrozen(m) && Object.isFrozen(m.publisher) && Object.isFrozen(m.standard));
  refused(() => manifest({ ...MIN, name: undefined }), 'S-003', 'name');
  const { standard, ...rest } = MIN;
  refused(() => manifest(rest), 'S-002', 'standard');
});

test('4.2b: a reference has a version or a range, not both or neither', () => {
  assert.deepEqual(reference(REF), REF);
  assert.deepEqual(reference({ id: 'demo.other', type: 'pathway', range: '>=1.0.0 <2.0.0' }).range, '>=1.0.0 <2.0.0');
  refused(() => reference({ ...REF, range: '^0.1.0' }), 'S-004', '');
  refused(() => reference({ id: 'demo.other', type: 'pathway' }), 'S-004', '');
  refused(() => reference({ ...REF, id: 'Bad Id' }), 'S-003', 'id');
  refused(() => reference({ ...REF, type: 'unknown-type' }), 'S-003', 'type');
  refused(() => manifest({ ...MIN, references: [REF, { ...REF, range: '^0.1.0' }] }), 'S-004', 'references.1');
});

test('4.2b: a validated claim needs its scope, and the scope is complete', () => {
  assert.deepEqual(MANIFEST_STATUSES, schema.properties.status.enum);
  for (const status of ['validated', 'conditionally-validated']) {
    refused(() => manifest({ ...MIN, status }), 'S-004', '');
    assert.equal(manifest({ ...MIN, status, validation: SCOPE }).validation.version, '1.0.0');
  }
  const { setting, ...partial } = SCOPE;
  refused(() => manifest({ ...MIN, status: 'validated', validation: partial }), 'S-002', 'validation.setting');
  assert.equal(manifest({ ...MIN, status: 'rejected' }).status, 'rejected');
});

test('4.2b: version and range patterns match the schema', () => {
  for (const v of ['0.1.0', '1.2.3-rc.1', '1.0.0+build.5']) assert.equal(manifest({ ...MIN, version: v }).version, v);
  for (const v of ['1.0', '^1', 'v1.0.0', '01.0.0']) refused(() => manifest({ ...MIN, version: v }), 'S-003', 'version');
  assert.equal(manifest({ ...MIN, requires: { engine: '^1.2.0', fhir: '>=4.0.1 <5.0.0' } }).requires.fhir, '>=4.0.1 <5.0.0');
  refused(() => manifest({ ...MIN, requires: { engine: '1.0' } }), 'S-003', 'requires.engine');
  assert.deepEqual(manifest({ ...MIN, mandatoryExtensions: ['x-demo-one'] }).mandatoryExtensions, ['x-demo-one']);
  refused(() => manifest({ ...MIN, mandatoryExtensions: ['demo'] }), 'S-003', 'mandatoryExtensions.0');
});

test('4.2b: the optional type pins the artefact type', () => {
  assert.deepEqual(ARTEFACT_TYPES, schema.$defs.artefactType.enum);
  assert.equal(manifest(MIN, { type: 'pathway' }).type, 'pathway');
  refused(() => manifest(MIN, { type: 'contextual-element' }), 'S-003', 'type');
  refused(() => manifest({ ...MIN, type: 'nonsense' }), 'S-003', 'type');
});

test('4.2b: unknown members are refused with a path, x- members pass', () => {
  refused(() => manifest({ ...MIN, extra: 1 }), 'S-001', 'extra');
  refused(() => manifest({ ...MIN, publisher: { name: 'P', extra: 1 } }), 'S-001', 'publisher.extra');
  const x = manifest({
    ...MIN, 'x-top': { a: 1 }, publisher: { name: 'P', 'x-p': 1 }, standard: { version: '0.1.0', 'x-s': 'y' },
    status: 'validated', validation: { ...SCOPE, 'x-v': true }, references: [{ ...REF, 'x-r': [1] }],
  });
  assert.equal(x['x-top'].a, 1);
  assert.equal(x.references[0]['x-r'][0], 1);
  assert.equal(x.validation['x-v'], true);
});

test('4.2b: a hostile string is never in a message, and the module stays pure', () => {
  const H = '<script>alert(1)</script>';
  const e = refused(() => manifest({ ...MIN, name: 5, id: H }));
  assert.equal(e.message.includes(H), false);
  assert.equal(refused(() => manifest({ ...MIN, version: H }), 'S-003').message.includes(H), false);
  assert.equal(refused(() => manifest({ ...MIN, [H]: 1 }), 'S-001').message.includes(H), false);
  const src = readFileSync(new URL('../ccis-sdk.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['node:', 'Date', 'Math.random', 'fetch', 'eval', 'Function(', 'import(', 'process', 'require(']) assert.equal(src.includes(bad), false, bad);
});

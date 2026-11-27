// Row 4.2b.1: the element field builder, proved equivalent to the file route. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { field, FIELD_TYPES, EPISTEMIC_STATES, SOURCE_CLASSES, TIME_SEMANTICS } from '../ccis-sdk-element.js';
import { SdkError } from '../ccis-sdk.js';
import { compareRoutes } from '../ccis-compile.js';

const element = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8'));
const schema = JSON.parse(readFileSync(new URL('../ccis/schemas/element.schema.json', import.meta.url), 'utf8'));
const F = schema.$defs.field.properties;
const BASE = { key: 'demoKey', label: 'Demo label', cardinality: { min: 0, max: 1 }, epistemic: ['absent', 'unknown'], sourceClasses: ['clinician-entered'] };
const STR = { ...BASE, type: 'string' };
const BIND = { mapping: { status: 'unmapped', note: 'No code yet.' } };
const refused = (fn, code, path) => {
  try { fn(); } catch (e) { assert.ok(e instanceof SdkError); if (code) assert.equal(e.code, code); if (path !== undefined) assert.equal(e.path, path); return e; }
  assert.fail('not refused');
};

test('4.2b.1: every snake element field is identical on the code route', () => {
  assert.equal(element.fields.length, 10);
  for (const f of element.fields) {
    const r = compareRoutes([{ name: 'json', input: JSON.stringify(f) }, { name: 'code', input: field(f) }]);
    assert.equal(r.identical, true, f.key);
    assert.equal(r.routes[0].checksum, r.routes[1].checksum);
  }
});

test('4.2b.1: a minimal field holds only what was given, frozen; missing and unknown members are refused', () => {
  const f = field(STR);
  assert.deepEqual(f, STR);
  for (const k of ['units', 'precision', 'timeSemantics', 'binding', 'constraints']) assert.equal(k in f, false);
  assert.ok(Object.isFrozen(f) && Object.isFrozen(f.cardinality) && Object.isFrozen(f.epistemic));
  const { label, ...rest } = STR;
  refused(() => field(rest), 'S-002', 'label');
  refused(() => field({ ...STR, extra: 1 }), 'S-001', 'extra');
});

test('4.2b.1: the four type rules', () => {
  refused(() => field({ ...BASE, type: 'quantity' }), 'S-004', '');
  refused(() => field({ ...BASE, type: 'integer' }), 'S-004', '');
  assert.deepEqual(field({ ...BASE, type: 'quantity', units: ['mg'], precision: { decimals: 1 } }).units, ['mg']);
  refused(() => field({ ...BASE, type: 'datetime' }), 'S-004', '');
  assert.equal(field({ ...BASE, type: 'date', timeSemantics: 'recorded-time' }).timeSemantics, 'recorded-time');
  refused(() => field({ ...BASE, type: 'code' }), 'S-004', '');
  assert.equal(field({ ...BASE, type: 'code', binding: BIND }).type, 'code');
  for (const [type, extra] of [['string', {}], ['boolean', {}], ['code', { binding: BIND }], ['date', { timeSemantics: 'event-time' }], ['datetime', { timeSemantics: 'event-time' }]]) {
    refused(() => field({ ...BASE, type, ...extra, units: ['1'] }), 'S-004', '');
  }
});

test('4.2b.1: cardinality', () => {
  assert.deepEqual(field({ ...STR, cardinality: { min: 0, max: 'unbounded' } }).cardinality, { min: 0, max: 'unbounded' });
  refused(() => field({ ...STR, cardinality: { min: 0, max: 0 } }), 'S-003', 'cardinality.max');
  refused(() => field({ ...STR, cardinality: { min: -1, max: 1 } }), 'S-003', 'cardinality.min');
  refused(() => field({ ...STR, cardinality: { min: 0, max: 'many' } }), 'S-003', 'cardinality.max');
  refused(() => field({ ...STR, cardinality: { min: 0, max: 1, 'x-a': 1 } }), 'S-001', 'cardinality.x-a');
  refused(() => field({ ...STR, cardinality: { min: 0 } }), 'S-002', 'cardinality.max');
});

test('4.2b.1: the four enums equal the schema, and a value outside each is refused', () => {
  assert.deepEqual(FIELD_TYPES, F.type.enum);
  assert.deepEqual(EPISTEMIC_STATES, F.epistemic.items.enum);
  assert.deepEqual(SOURCE_CLASSES, F.sourceClasses.items.enum);
  assert.deepEqual(TIME_SEMANTICS, F.timeSemantics.enum);
  refused(() => field({ ...STR, type: 'text' }), 'S-003', 'type');
  refused(() => field({ ...STR, epistemic: ['absent', 'negative'] }), 'S-003', 'epistemic.1');
  refused(() => field({ ...STR, sourceClasses: ['guess'] }), 'S-003', 'sourceClasses.0');
  refused(() => field({ ...BASE, type: 'date', timeSemantics: 'whenever' }), 'S-003', 'timeSemantics');
});

test('4.2b.1: a binding is built by the existing builder; x- members pass', () => {
  refused(() => field({ ...BASE, type: 'code', binding: { mapping: { status: 'unmapped', note: 'n' }, code: 'c' } }), 'S-004', 'binding');
  refused(() => field({ ...BASE, type: 'code', binding: { mapping: { status: 'mapped' } } }), 'S-002', 'binding.codeSystem');
  const f = field({ ...STR, 'x-note': { a: [1] } });
  assert.equal(f['x-note'].a[0], 1);
});

test('4.2b.1: list order is kept and a required list cannot be empty', () => {
  const f = field({ ...STR, epistemic: ['unknown', 'absent'], sourceClasses: ['device', 'derived'], constraints: ['b', 'a'] });
  assert.deepEqual(f.epistemic, ['unknown', 'absent']);
  assert.deepEqual(f.sourceClasses, ['device', 'derived']);
  assert.deepEqual(f.constraints, ['b', 'a']);
  assert.deepEqual(field({ ...BASE, type: 'quantity', units: ['mg', '1'] }).units, ['mg', '1']);
  refused(() => field({ ...STR, epistemic: [] }), 'S-003', 'epistemic');
  refused(() => field({ ...STR, sourceClasses: [] }), 'S-003', 'sourceClasses');
  refused(() => field({ ...BASE, type: 'quantity', units: [] }), 'S-003', 'units');
  assert.deepEqual(field({ ...STR, constraints: [] }).constraints, []);
});

test('4.2b.1: a hostile string is never in a message, and the module stays pure', () => {
  const H = '<script>alert(1)</script>';
  assert.equal(refused(() => field({ ...STR, key: H }), 'S-003').message.includes(H), false);
  assert.equal(refused(() => field({ ...STR, [H]: 1 }), 'S-001').message.includes(H), false);
  const src = readFileSync(new URL('../ccis-sdk-element.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['node:', 'Date', 'Math.random', 'fetch', 'eval', 'Function(', 'import(', 'process', 'require(']) assert.equal(src.includes(bad), false, bad);
});

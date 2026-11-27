// Row 4.2d: analytics member builders (inputs, parameters, conversions, context), proved on the snake examples. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { analyticsInput, parameter, conversion, contextEntry, PARAMETER_KINDS, NON_VALUE_STATES, CONVERSION_KINDS } from '../ccis-sdk-analytics.js';
import { SdkError } from '../ccis-sdk.js';
import { compareRoutes } from '../ccis-compile.js';

const dir = new URL('../ccis/examples/snake/', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('../ccis/schemas/analytics.schema.json', import.meta.url), 'utf8'));
const P = schema.properties;
const IN = { key: 'biteTime', element: 'demo.element', field: 'biteTime', type: 'datetime', onMissing: 'needs-data' };
const PAR = { id: 'someChoice', label: 'A choice', kind: 'criteria', enabledByDefault: false, suppliedBy: 'Local clinician' };
const refused = (fn, code, path) => {
  try { fn(); } catch (e) { assert.ok(e instanceof SdkError); if (code) assert.equal(e.code, code); if (path !== undefined) assert.equal(e.path, path); return e; }
  assert.fail('not refused');
};

test('4.2d: every input, parameter, conversion and context member of the snake examples is identical on the code route', () => {
  const seen = { inputs: 0, parameters: 0, conversions: 0, context: 0 };
  const build = { inputs: analyticsInput, parameters: parameter, conversions: conversion, context: contextEntry };
  for (const f of readdirSync(dir).filter((n) => n.includes('analytics'))) {
    const doc = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    for (const [member, fn] of Object.entries(build)) {
      for (const m of doc[member] ?? []) {
        const r = compareRoutes([{ name: 'json', input: JSON.stringify(m) }, { name: 'code', input: fn(m) }]);
        assert.equal(r.identical, true, `${f} ${member}`);
        seen[member] += 1;
      }
    }
  }
  for (const n of Object.values(seen)) assert.ok(n >= 1);
});

test('4.2d: an input holds only what was given, frozen; units are needed for quantities', () => {
  const i = analyticsInput(IN);
  assert.deepEqual(i, IN);
  assert.ok(Object.isFrozen(i));
  const { onMissing, ...rest } = IN;
  refused(() => analyticsInput(rest), 'S-002', 'onMissing');
  refused(() => analyticsInput({ ...IN, type: 'quantity' }), 'S-004', '');
  assert.deepEqual(analyticsInput({ ...IN, type: 'integer', units: ['1'] }).units, ['1']);
  assert.deepEqual(NON_VALUE_STATES, schema.$defs.nonValueState.enum);
  refused(() => analyticsInput({ ...IN, onMissing: 'normal' }), 'S-003', 'onMissing');
});

test('4.2d: a parameter carries no value and is never enabled by default', () => {
  assert.equal(parameter(PAR).enabledByDefault, false);
  refused(() => parameter({ ...PAR, enabledByDefault: true }), 'S-003', 'enabledByDefault');
  const { enabledByDefault, ...rest } = PAR;
  refused(() => parameter(rest), 'S-002', 'enabledByDefault');
  for (const k of ['value', 'default', 'suggested']) refused(() => parameter({ ...PAR, [k]: 30 }), 'S-001', k);
});

test('4.2d: parameter kinds carry what the schema requires', () => {
  assert.deepEqual(PARAMETER_KINDS, P.parameters.items.properties.kind.enum);
  const dur = { ...PAR, kind: 'duration', units: ['min'], allowedRange: { min: 0, max: 10 } };
  assert.deepEqual(parameter(dur).allowedRange, { min: 0, max: 10 });
  refused(() => parameter({ ...dur, allowedRange: undefined }), 'S-003', 'allowedRange');
  const { allowedRange, ...noRange } = dur;
  refused(() => parameter(noRange), 'S-004', '');
  refused(() => parameter({ ...dur, allowedRange: { min: 0, max: 1, 'x-a': 1 } }), 'S-001', 'allowedRange.x-a');
  refused(() => parameter({ ...PAR, kind: 'choice' }), 'S-004', '');
  refused(() => parameter({ ...PAR, kind: 'choice', allowedChoices: ['only'] }), 'S-003', 'allowedChoices');
  assert.deepEqual(parameter({ ...PAR, kind: 'choice', allowedChoices: ['b', 'a'] }).allowedChoices, ['b', 'a']);
  refused(() => parameter({ ...PAR, kind: 'set' }), 'S-004', '');
  assert.deepEqual(parameter({ ...PAR, kind: 'set', allowedMembers: ['zKey', 'aKey'] }).allowedMembers, ['zKey', 'aKey']);
});

test('4.2d: a conversion needs a factor when linear', () => {
  assert.deepEqual(CONVERSION_KINDS, P.conversions.items.properties.kind.enum);
  const c = { id: 'minToH', version: '1.0.0', from: 'min', to: 'h', kind: 'linear' };
  refused(() => conversion(c), 'S-004', '');
  assert.equal(conversion({ ...c, factor: 0.5 }).factor, 0.5);
  assert.equal(conversion({ ...c, kind: 'time-zone' }).kind, 'time-zone');
  refused(() => conversion({ ...c, kind: 'time-zone', from: 'a b' }), 'S-003', 'from');
  refused(() => conversion({ ...c, kind: 'time-zone', version: '1.0' }), 'S-003', 'version');
});

test('4.2d: a context entry names elements by range', () => {
  const e = { ref: { id: 'demo.element', type: 'contextual-element', range: '^0.1.0' }, fields: ['zKey', 'aKey'] };
  assert.deepEqual(contextEntry(e), e);
  refused(() => contextEntry({ ...e, ref: { id: 'demo.element', type: 'contextual-element', version: '0.1.0' } }), 'S-004', 'ref');
  refused(() => contextEntry({ ...e, ref: { ...e.ref, type: 'pathway' } }), 'S-003', 'ref.type');
  refused(() => contextEntry({ ...e, fields: [] }), 'S-003', 'fields');
});

test('4.2d: x- members pass where the schema allows', () => {
  assert.equal(analyticsInput({ ...IN, 'x-a': 1 })['x-a'], 1);
  assert.equal(parameter({ ...PAR, 'x-p': [1] })['x-p'][0], 1);
  assert.equal(conversion({ id: 'k', version: '1.0.0', from: 'a', to: 'b', kind: 'time-zone', 'x-c': true })['x-c'], true);
  assert.equal(contextEntry({ ref: { id: 'demo.element', type: 'contextual-element', range: '^0.1.0' }, fields: ['k'], 'x-e': 'y' })['x-e'], 'y');
});

test('4.2d: a hostile string is never in a message, and the module stays pure', () => {
  const H = '<script>alert(1)</script>';
  assert.equal(refused(() => analyticsInput({ ...IN, key: H }), 'S-003').message.includes(H), false);
  assert.equal(refused(() => parameter({ ...PAR, [H]: 1 }), 'S-001').message.includes(H), false);
  const src = readFileSync(new URL('../ccis-sdk-analytics.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['node:', 'Date', 'Math.random', 'fetch', 'eval', 'Function(', 'import(', 'process', 'require(']) assert.equal(src.includes(bad), false, bad);
});

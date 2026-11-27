// Row ECO-B1d: the SDK field builder accepts `ownedBy`, same rules as the file route. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { field } from '../ccis-sdk-element.js';
import { SdkError } from '../ccis-sdk.js';
import { compareRoutes } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const elementDoc = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const BASE = { key: 'demoKey', label: 'Demo label', type: 'string', cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'] };
const concept = () => ({ codeSystem: { id: 'local', version: '0.1.0' }, code: 'demo-concept', display: 'Demo concept', mapping: { status: 'mapped' } });
const OWNER = { element: 'demo.owner', key: 'ownerKey' };
const refused = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof SdkError); return e; } assert.fail('not refused'); };
const sdkRefuses = (extra) => refused(() => field({ ...BASE, ...extra }));
const fileRefuses = (extra) => {
  const e = clone(elementDoc); e.fields[0] = { ...clone(e.fields[0]), ...extra };
  return validateArtefact(e).outcome === 'failed';
};
const same = (f) => { const r = compareRoutes([{ name: 'json', input: JSON.stringify(f) }, { name: 'code', input: field(f) }]); return r.identical && r.routes[0].checksum === r.routes[1].checksum; };

test('1 a field with concept and ownedBy is identical on both routes', () => {
  assert.ok(same({ ...BASE, concept: concept(), ownedBy: OWNER }));
});

test('2 the builder is shared: a module field object is identical too', () => {
  assert.ok(same({ ...BASE, key: 'moduleKey', type: 'boolean', concept: concept(), ownedBy: { element: 'demo.owner-two', key: 'flag' } }));
});

test('3 ownedBy without concept is refused (S-002, path concept), on both routes', () => {
  const e = sdkRefuses({ ownedBy: OWNER });
  assert.equal(e.code, 'S-002');
  assert.equal(e.path, 'concept');
  assert.ok(fileRefuses({ ownedBy: OWNER }));
});

test('4 ownedBy missing element or key is refused, on both routes', () => {
  for (const miss of ['element', 'key']) {
    const o = { ...OWNER }; delete o[miss];
    const e = sdkRefuses({ concept: concept(), ownedBy: o });
    assert.equal(e.code, 'S-002');
    assert.equal(e.path, `ownedBy.${miss}`);
    assert.ok(fileRefuses({ concept: concept(), ownedBy: o }));
  }
});

test('5 an unknown ownedBy member is refused; an x- member is accepted and identical on both routes', () => {
  const bad = { concept: concept(), ownedBy: { ...OWNER, extra: 1 } };
  assert.equal(sdkRefuses(bad).code, 'S-001');
  assert.ok(fileRefuses(bad));
  assert.ok(same({ ...BASE, concept: concept(), ownedBy: { ...OWNER, 'x-note': { a: 1 } } }));
});

test('6 element with uppercase or a space, and key with a leading digit, are refused (S-003), on both routes', () => {
  for (const o of [{ element: 'Demo.owner', key: 'k' }, { element: 'demo owner', key: 'k' }, { element: 'demo.owner', key: '1key' }]) {
    const x = { concept: concept(), ownedBy: o };
    assert.equal(sdkRefuses(x).code, 'S-003');
    assert.ok(fileRefuses(x));
  }
});

test('7 every field of the snake element still builds unchanged', () => {
  for (const f of elementDoc.fields) assert.deepEqual(clone(field(f)), f);
});

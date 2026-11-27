// Row ECO-B1c: the SDK field builder accepts `concept` and `contexts`, same rules as the file route. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { field } from '../ccis-sdk-element.js';
import { SdkError } from '../ccis-sdk.js';
import { compareRoutes } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const fileText = readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8');
const elementDoc = JSON.parse(fileText);
const clone = (x) => JSON.parse(JSON.stringify(x));
const BASE = { key: 'demoKey', label: 'Demo label', type: 'string', cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'] };
const concept = (over = {}) => ({ codeSystem: { id: 'local', version: '0.1.0' }, code: 'demo-concept', display: 'Demo concept', mapping: { status: 'mapped' }, ...over });
const refused = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof SdkError); return e; } assert.fail('not refused'); };
const sdkRefuses = (extra) => refused(() => field({ ...BASE, ...extra }));
const fileRefuses = (extra) => {
  const e = clone(elementDoc); e.fields[0] = { ...clone(e.fields[0]), ...extra };
  return validateArtefact(e).outcome === 'failed';
};
const same = (f) => { const r = compareRoutes([{ name: 'json', input: JSON.stringify(f) }, { name: 'code', input: field(f) }]); return r.identical && r.routes[0].checksum === r.routes[1].checksum; };

test('1 a field with concept and contexts is identical on both routes', () => {
  assert.ok(same({ ...BASE, concept: concept(), contexts: ['outpatient', 'dm-ckd'] }));
});

test('2 the builder is shared: a module field object is identical too', () => {
  assert.ok(same({ ...BASE, key: 'moduleKey', type: 'boolean', concept: concept({ code: 'module-flag' }) }));
});

test('3 concept in a system other than local is refused, on both routes', () => {
  const x = { concept: concept({ codeSystem: { id: 'other', version: '1' } }) };
  assert.equal(sdkRefuses(x).path, 'concept.codeSystem.id');
  assert.ok(fileRefuses(x));
});

test('4 concept with status unmapped, lossy or low-confidence is refused, on both routes', () => {
  const unmapped = { mapping: { status: 'unmapped', note: 'Test.' } };
  assert.equal(sdkRefuses({ concept: unmapped }).path, 'concept.mapping.status');
  for (const status of ['lossy', 'low-confidence']) {
    const x = { concept: concept({ mapping: { status, confidence: 0.5, note: 'Test.' } }) };
    assert.equal(sdkRefuses(x).path, 'concept.mapping.status');
    assert.ok(fileRefuses(x));
  }
  assert.ok(fileRefuses({ concept: unmapped }));
});

test('5 concept without code, or with a valueSet, is refused, on both routes', () => {
  const noCode = concept(); delete noCode.code;
  assert.equal(sdkRefuses({ concept: noCode }).code, 'S-002');
  assert.ok(fileRefuses({ concept: noCode }));
  const vs = { concept: concept({ valueSet: { id: 'local-vs', version: '1' } }) };
  assert.equal(sdkRefuses(vs).code, 'S-001');
  assert.ok(fileRefuses(vs));
});

test('6 contexts: a valid list passes; empty, duplicate, uppercase and spaced tags are refused, on both routes', () => {
  assert.ok(same({ ...BASE, contexts: ['a1', 'b-2'] }));
  for (const bad of [[], ['a', 'a'], ['Inpatient'], ['in patient']]) {
    assert.ok(sdkRefuses({ contexts: bad }).path.startsWith('contexts'), JSON.stringify(bad));
    assert.ok(fileRefuses({ contexts: bad }), JSON.stringify(bad));
  }
});

test('7 every snake element field still builds and matches the file route', () => {
  assert.equal(elementDoc.fields.length, 10);
  for (const f of elementDoc.fields) assert.ok(same(f), f.key);
});

test('8 the result is frozen and holds only what was given', () => {
  const f = field({ ...BASE, concept: concept(), contexts: ['x'] });
  assert.ok(Object.isFrozen(f.contexts));
  assert.deepEqual(Object.keys(f).sort(), ['cardinality', 'concept', 'contexts', 'epistemic', 'key', 'label', 'sourceClasses', 'type']);
});

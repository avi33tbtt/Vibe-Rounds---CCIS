// Row 4.2: the code-authoring SDK, binding builder, proved equivalent to the file route. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { binding, SdkError, MAPPING_STATUSES } from '../ccis-sdk.js';
import { compareRoutes, canonicalize, checksumOf } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const fileText = readFileSync(new URL('../ccis/examples/snake/snake-demo-terminology.binding.json', import.meta.url), 'utf8');
const schema = JSON.parse(readFileSync(new URL('../ccis/schemas/terminology-binding.schema.json', import.meta.url), 'utf8'));
const GOOD = {
  codeSystem: { id: 'ccis-demo', version: '0.1.0' },
  valueSet: { id: 'ccis-demo.clotting-test-status', version: '0.1.0' },
  code: 'clotting-test-status',
  display: 'Clotting test status (demonstration)',
  mapping: { status: 'mapped', note: 'Demonstration code in a local demonstration code system. Unverified. Not a real terminology code.' },
};
const refused = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof SdkError); return e; } assert.fail('not refused'); };
const verdict = (doc) => Object.entries(validateArtefact(doc).layers).map(([k, v]) => [k, v.outcome, v.diagnostics.map((d) => d.ruleId)]);

test('code route and file route give identical canonical bytes and checksum', () => {
  const r = compareRoutes([{ name: 'json', input: fileText }, { name: 'code', input: binding(GOOD) }]);
  assert.equal(r.identical, true);
  assert.equal(r.routes[0].checksum, r.routes[1].checksum);
  assert.equal(checksumOf(canonicalize(binding(GOOD)).text), r.routes[0].checksum);
});

test('both routes get the same verdict from the same validator, good and broken', () => {
  assert.deepEqual(verdict(binding(GOOD)), verdict(JSON.parse(fileText)));
  const bad = { ...GOOD, mapping: { status: 'nope' } };
  const fromFile = verdict(bad);
  assert.equal(fromFile.find(([k]) => k === 'structural')[1], 'failed');
  refused(() => binding(bad)); // the SDK refuses before the validator is needed
});

test('an unknown member is refused S-001; an x- extension passes and is canonical', () => {
  const e = refused(() => binding({ ...GOOD, colour: 'red' }));
  assert.deepEqual([e.code, e.path], ['S-001', 'colour']);
  const b = binding({ ...GOOD, 'x-note': { a: 1 } });
  assert.match(canonicalize(b).text, /"x-note":\{"a":1\}/);
});

test('a missing required member is refused S-002 with its path', () => {
  const { mapping: _m, ...noMapping } = GOOD;
  assert.deepEqual([refused(() => binding(noMapping)).code, refused(() => binding(noMapping)).path], ['S-002', 'mapping']);
  const { code: _c, ...noCode } = GOOD;
  assert.deepEqual([refused(() => binding(noCode)).code, refused(() => binding(noCode)).path], ['S-002', 'code']);
  assert.equal(refused(() => binding({ ...GOOD, codeSystem: { version: '1' } })).path, 'codeSystem.id');
});

test('mapping status: exactly the schema statuses are accepted; combination rules are S-004', () => {
  assert.deepEqual([...MAPPING_STATUSES], schema.properties.mapping.properties.status.enum);
  assert.equal(refused(() => binding({ ...GOOD, mapping: { status: 'maybe' } })).code, 'S-003');
  assert.equal(refused(() => binding({ ...GOOD, mapping: { status: 'lossy' } })).code, 'S-004');
  assert.equal(refused(() => binding({ mapping: { status: 'unmapped', note: 'n' }, code: 'x' })).code, 'S-004');
  assert.equal(refused(() => binding({ ...GOOD, codeSystem: { id: 'a', version: '1', noVersionPublished: true } })).code, 'S-004');
  for (const s of ['lossy', 'low-confidence']) binding({ ...GOOD, mapping: { status: s, confidence: 0.5, note: 'n' } });
  binding({ mapping: { status: 'unmapped', note: 'no code exists' } });
});

test('a changed display makes the routes differ, and the difference names display', () => {
  const r = compareRoutes([{ name: 'json', input: fileText }, { name: 'code', input: binding({ ...GOOD, display: 'Something else' }) }]);
  assert.equal(r.identical, false);
  assert.equal(r.firstDifference.route, 'code');
  assert.match(String(r.firstDifference.path), /display/);
});

test('no default is invented: the output holds only what was given', () => {
  const b = binding({ code: 'c', codeSystem: { id: 's', noVersionPublished: true }, mapping: { status: 'mapped' } });
  assert.deepEqual(Object.keys(b).sort(), ['code', 'codeSystem', 'mapping']);
  assert.equal(Object.isFrozen(b) && Object.isFrozen(b.mapping) && Object.isFrozen(b.codeSystem), true);
});

test('errors never quote the refused value; the module is pure', () => {
  const HOSTILE = '<img onerror=x>';
  const e = refused(() => binding({ ...GOOD, code: `${HOSTILE} x` }));
  assert.equal(e.message.includes(HOSTILE) || e.path.includes(HOSTILE) || String(e.stack).split('\n')[0].includes(HOSTILE), false);
  assert.equal(refused(() => binding({ ...GOOD, [HOSTILE]: 1 })).message.includes(HOSTILE), false);
  const src = readFileSync(new URL('../ccis-sdk.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['node:', 'Date', 'Math.random', 'fetch', 'eval', 'Function(', 'import(', 'process', 'require(']) assert.equal(src.includes(bad), false, bad);
});

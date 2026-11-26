// Row 4.2: the code-authoring SDK, binding builder, proved equivalent to the file route. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { binding, decisionNode, SdkError, MAPPING_STATUSES, OUTCOME_KINDS, INPUT_STATES } from '../ccis-sdk.js';
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

// ---- Row 4.2a: the decision-node builder ----
const nodeDir = new URL('../ccis/examples/snake/', import.meta.url);
const NODES = ['snake-node-antivenom.node.json', 'snake-node-clotting.node.json'].map((f) => readFileSync(new URL(f, nodeDir), 'utf8'));
const nodeSchema = JSON.parse(readFileSync(new URL('../ccis/schemas/decision-node.schema.json', import.meta.url), 'utf8'));
const N = () => JSON.parse(NODES[0]);

test('4.2a: both node examples are identical on the code route, with the same validator verdict', () => {
  for (const text of NODES) {
    const r = compareRoutes([{ name: 'json', input: text }, { name: 'code', input: decisionNode(JSON.parse(text)) }]);
    assert.equal(r.identical, true);
    assert.equal(r.routes[0].checksum, r.routes[1].checksum);
    assert.deepEqual(verdict(decisionNode(JSON.parse(text))), verdict(JSON.parse(text)));
  }
});

test('4.2a: unknown members at any depth are S-001; x- passes on node, input and outcome but not in when or next', () => {
  const at = (mut) => { const n = N(); mut(n); return refused(() => decisionNode(n)); };
  assert.deepEqual([at((n) => { n.outcomes[1].colour = 1; }).code, at((n) => { n.outcomes[1].colour = 1; }).path], ['S-001', 'outcomes.1.colour']);
  assert.equal(at((n) => { n.inputs[0].colour = 1; }).path, 'inputs.0.colour');
  const ok = N(); ok['x-a'] = 1; ok.inputs[0]['x-b'] = 2; ok.outcomes[0]['x-c'] = 3;
  assert.match(canonicalize(decisionNode(ok)).text, /"x-a":1/);
  assert.equal(at((n) => { n.outcomes[0].when[0]['x-d'] = 1; }).path, 'outcomes.0.when.0.x-d');
  assert.equal(at((n) => { n.outcomes[0].next['x-e'] = 1; }).code, 'S-001');
});

test('4.2a: S-002 missing outcomes; S-003 short lists and bad enums; S-004 combination rules; enums equal the schema', () => {
  assert.deepEqual([...OUTCOME_KINDS], nodeSchema.$defs.outcome.properties.kind.enum);
  assert.deepEqual([...INPUT_STATES], nodeSchema.$defs.outcome.properties.when.items.properties.is.enum);
  const run = (mut) => { const n = N(); mut(n); return refused(() => decisionNode(n)); };
  assert.deepEqual([run((n) => { delete n.outcomes; }).code, run((n) => { delete n.outcomes; }).path], ['S-002', 'outcomes']);
  assert.equal(run((n) => { n.outcomes = n.outcomes.slice(0, 1); }).code, 'S-003');
  assert.equal(run((n) => { n.inputs = []; }).code, 'S-003');
  assert.equal(run((n) => { n.outcomes[0].kind = 'maybe'; }).code, 'S-003');
  assert.equal(run((n) => { n.outcomes[0].when[0].is = 'maybe'; }).code, 'S-003');
  assert.deepEqual([run((n) => { n.outcomes = n.outcomes.filter((o) => o.kind !== 'indeterminate'); }).code, run((n) => { n.outcomes = n.outcomes.filter((o) => o.kind !== 'indeterminate'); }).path], ['S-004', 'outcomes']);
  assert.equal(run((n) => { n.outcomes[0].next = { stage: 'a', end: true }; }).code, 'S-004');
  assert.equal(run((n) => { n.outcomes[0].next = {}; }).code, 'S-004');
});

test('4.2a: order is kept, nothing is invented, purity still holds', () => {
  const n = N(); [n.outcomes[0], n.outcomes[1]] = [n.outcomes[1], n.outcomes[0]];
  const r = compareRoutes([{ name: 'json', input: NODES[0] }, { name: 'code', input: decisionNode(n) }]);
  assert.equal(r.identical, false);
  assert.match(String(r.firstDifference.path), /outcomes/);
  const small = { id: 'a', question: 'q', inputs: [{ key: 'k', element: 'e.f', field: 'f' }], outcomes: [{ id: 'x', kind: 'answer', when: [{ input: 'k', is: 'present' }], next: { end: true } }, { id: 'y', kind: 'indeterminate', when: [{ input: 'k', is: 'unknown' }], next: { stage: 'gap' } }] };
  const b = decisionNode(small);
  assert.equal('preconditions' in b || 'note' in b.outcomes[0], false);
  assert.equal(Object.isFrozen(b.outcomes[0].when[0]) && Object.isFrozen(b.inputs), true);
  const src = readFileSync(new URL('../ccis-sdk.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['node:', 'Date', 'Math.random', 'fetch', 'eval', 'Function(', 'import(', 'process', 'require(']) assert.equal(src.includes(bad), false, bad);
});

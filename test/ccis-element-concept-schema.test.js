// Row ECO-B1: optional `concept` and `contexts` on an element field (schema only). Prototype. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validateArtefact } from '../ccis-validator.js';

const snakeDir = new URL('../ccis/examples/snake/', import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, snakeDir), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const snakeFiles = readdirSync(snakeDir).filter((f) => f.endsWith('.json')).sort();
const known = snakeFiles.map((f) => read(f));
const run = (doc) => validateArtefact(doc, { known });
const l2 = (r) => r.diagnostics.filter((d) => d.layer === 2 || /^CCIS-V2-/.test(d.ruleId));
const ELEMENT = 'snake-envenomation.element.json';
const concept = (over = {}) => ({
  codeSystem: { id: 'local', version: '0.1.0' }, code: 'bite-time', display: 'Bite time', mapping: { status: 'mapped' }, ...over,
});
const withField = (mutate) => { const e = clone(read(ELEMENT)); mutate(e.fields[0]); return e; };

test('1 concept on a field validates', () => {
  const r = run(withField((f) => { f.concept = concept(); }));
  assert.deepEqual(l2(r), []);
});

test('2 concept on a module field validates', () => {
  const e = clone(read(ELEMENT));
  const f = { key: 'testFlag', label: 'A test flag', type: 'boolean', cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'], concept: concept({ code: 'test-flag' }) };
  e.modules = [{ id: 'extra', appliesWhen: 'Only for this test.', fields: [f] }];
  assert.deepEqual(l2(run(e)), []);
});

test('3 concept in a system other than local is refused', () => {
  const r = run(withField((f) => { f.concept = concept({ codeSystem: { id: 'other', version: '1' } }); }));
  assert.ok(l2(r).length > 0);
  assert.equal(r.outcome, 'failed');
});

test('4 concept with mapping status other than mapped is refused', () => {
  const lossy = run(withField((f) => { f.concept = concept({ mapping: { status: 'lossy', confidence: 0.5, note: 'Test.' } }); }));
  const unmapped = run(withField((f) => { f.concept = { mapping: { status: 'unmapped', note: 'Test.' } }; }));
  assert.ok(l2(lossy).length > 0);
  assert.ok(l2(unmapped).length > 0);
});

test('5 concept without code is refused; a valueSet in concept is refused', () => {
  const noCode = run(withField((f) => { const c = concept(); delete c.code; f.concept = c; }));
  const vs = run(withField((f) => { f.concept = concept({ valueSet: { id: 'local-vs', version: '1' } }); }));
  assert.ok(l2(noCode).length > 0);
  assert.ok(l2(vs).length > 0);
});

test('6 contexts: valid list passes; empty, duplicate, uppercase and spaced tags are refused', () => {
  assert.deepEqual(l2(run(withField((f) => { f.contexts = ['outpatient', 'dm-ckd']; }))), []);
  for (const bad of [[], ['a', 'a'], ['Inpatient'], ['in patient']]) {
    assert.ok(l2(run(withField((f) => { f.contexts = bad; }))).length > 0, JSON.stringify(bad));
  }
});

test('7 every existing snake artefact still validates with no diagnostics through layer 5', () => {
  for (const f of snakeFiles) {
    const r = run(readFileSync(new URL(f, snakeDir), 'utf8'));
    assert.equal(r.outcome, 'no-errors-so-far', f);
    assert.deepEqual(r.diagnostics, [], f);
  }
});

test('8 generated validators equal a fresh build', () => {
  const r = spawnSync(process.execPath, ['scripts/build-validators.js', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

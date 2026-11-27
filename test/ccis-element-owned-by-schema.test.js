// Row ECO-B1a: optional `ownedBy` on an element field (schema only). Prototype. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validateArtefact } from '../ccis-validator.js';

const snakeDir = new URL('../ccis/examples/snake/', import.meta.url);
const ckdDir = new URL('../ccis/examples/diabetes-ckd/', import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, snakeDir), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const snakeFiles = readdirSync(snakeDir).filter((f) => f.endsWith('.json')).sort();
const known = snakeFiles.map((f) => read(f));
const run = (doc) => validateArtefact(doc, { known });
const l2 = (r) => r.diagnostics.filter((d) => d.layer === 2 || /^CCIS-V2-/.test(d.ruleId));
const ELEMENT = 'snake-envenomation.element.json';
const concept = () => ({ codeSystem: { id: 'local', version: '0.1.0' }, code: 'bite-time', display: 'Bite time', mapping: { status: 'mapped' } });
const owned = (over = {}) => ({ element: 'core.vitals', key: 'bpSys', ...over });
const withField = (mutate) => { const e = clone(read(ELEMENT)); mutate(e.fields[0]); return e; };
const withOwned = (o) => withField((f) => { f.concept = concept(); f.ownedBy = o; });

test('1 a field with concept and ownedBy validates', () => {
  assert.deepEqual(l2(run(withOwned(owned()))), []);
});

test('2 ownedBy on a module field validates', () => {
  const e = clone(read(ELEMENT));
  const f = { key: 'testFlag', label: 'A test flag', type: 'boolean', cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'], concept: concept(), ownedBy: owned() };
  e.modules = [{ id: 'extra', appliesWhen: 'Only for this test.', fields: [f] }];
  assert.deepEqual(l2(run(e)), []);
});

test('3 ownedBy without concept is refused', () => {
  const r = run(withField((f) => { f.ownedBy = owned(); }));
  assert.ok(l2(r).length > 0);
  assert.equal(r.outcome, 'failed');
});

test('4 ownedBy missing element or key is refused', () => {
  const noEl = owned(); delete noEl.element;
  const noKey = owned(); delete noKey.key;
  assert.ok(l2(run(withOwned(noEl))).length > 0);
  assert.ok(l2(run(withOwned(noKey))).length > 0);
});

test('5 ownedBy with an unknown member is refused; an x- member is allowed', () => {
  assert.ok(l2(run(withOwned(owned({ version: '1.0.0' })))).length > 0);
  assert.deepEqual(l2(run(withOwned(owned({ 'x-note': 'test' })))), []);
});

test('6 malformed element id or key is refused', () => {
  for (const bad of [owned({ element: 'Core.Vitals' }), owned({ element: 'core vitals' }), owned({ key: '1sbp' })]) {
    assert.ok(l2(run(withOwned(bad))).length > 0, JSON.stringify(bad));
  }
});

test('7 every existing snake and diabetes-ckd artefact still validates as before', () => {
  for (const f of snakeFiles) {
    const r = run(readFileSync(new URL(f, snakeDir), 'utf8'));
    assert.equal(r.outcome, 'no-errors-so-far', f);
    assert.deepEqual(r.diagnostics, [], f);
  }
  for (const f of readdirSync(ckdDir).filter((n) => n.endsWith('.element.json'))) {
    const r = validateArtefact(readFileSync(new URL(f, ckdDir), 'utf8'), { known });
    assert.deepEqual(l2(r), [], f);
  }
});

test('8 generated validators equal a fresh build', () => {
  const r = spawnSync(process.execPath, ['scripts/build-validators.js', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

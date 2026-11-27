// Row ECO-B1b: the local terminology package schema and its wiring. Prototype. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validateArtefact } from '../ccis-validator.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const snakeDir = new URL('../ccis/examples/snake/', import.meta.url);
const snake = JSON.parse(readFileSync(new URL('snake-envenomation.element.json', snakeDir), 'utf8'));
const pkg = () => ({
  manifest: { ...clone(snake.manifest), id: 'demo.terms', name: 'Demo local terms', type: 'terminology-package' },
  codeSystem: { id: 'local', version: '0.1.0' },
  concepts: [
    { key: 'demo-concept', display: 'Demo concept', definition: 'A synthetic concept.', category: 'finding' },
    { key: 'old-concept', display: 'Old concept', deprecated: true, replacedBy: 'demo-concept' },
  ],
  valueSets: [{ id: 'demo.values', version: '0.1.0', display: 'Demo values', members: [{ key: 'demo-concept', display: 'Demo concept' }] }],
  provenance: { origin: 'Synthetic test.', basis: 'Synthetic test.' },
});
const mutate = (fn) => { const p = pkg(); fn(p); return p; };
const l2 = (doc) => validateArtefact(doc).diagnostics.filter((d) => /^CCIS-V2-/.test(d.ruleId) && d.severity === 'error');
const refused = (doc) => l2(doc).length > 0;

test('1 a valid package passes the whole validator with no error', () => {
  const r = validateArtefact(pkg());
  assert.deepEqual(r.diagnostics.filter((d) => d.severity === 'error'), []);
  assert.equal(r.layers.structural.outcome, 'passed');
  assert.ok(!r.diagnostics.some((d) => d.ruleId === 'CCIS-V2-006'), 'the type now has a schema');
});

test('2 a missing codeSystem, concepts or provenance is refused', () => {
  for (const k of ['codeSystem', 'concepts', 'provenance']) {
    const r = l2(mutate((p) => { delete p[k]; }));
    assert.deepEqual(r.map((d) => [d.ruleId, d.path]), [['CCIS-V2-003', `/${k}`]], k);
  }
});

test('3 a code system other than local is refused', () => {
  assert.ok(refused(mutate((p) => { p.codeSystem.id = 'snomed'; })));
});

test('4 bad concept keys are refused', () => {
  for (const key of ['Upper', 'has space', '-lead', 'x'.repeat(65), '']) assert.ok(refused(mutate((p) => { p.concepts[0].key = key; })), key);
  assert.ok(!refused(mutate((p) => { p.concepts[0].key = 'a.b_c-1'; })));
});

test('5 bad display, definition or category are refused', () => {
  assert.ok(refused(mutate((p) => { p.concepts[0].display = ''; })));
  assert.ok(refused(mutate((p) => { p.concepts[0].display = 'x'.repeat(201); })));
  assert.ok(refused(mutate((p) => { p.concepts[0].definition = 'x'.repeat(501); })));
  assert.ok(refused(mutate((p) => { p.concepts[0].category = 'numbers'; })));
});

test('6 replacedBy needs deprecated', () => {
  assert.ok(refused(mutate((p) => { delete p.concepts[1].deprecated; })));
  assert.ok(!refused(pkg()));
});

test('7 value sets: no members or a bad member key is refused; x- members pass, unknown members do not', () => {
  assert.ok(refused(mutate((p) => { p.valueSets[0].members = []; })));
  assert.ok(refused(mutate((p) => { p.valueSets[0].members[0].key = 'Bad Key'; })));
  assert.ok(!refused(mutate((p) => { p['x-note'] = 1; p.concepts[0]['x-note'] = 1; p.valueSets[0].members[0]['x-note'] = { a: 1 }; })));
  assert.ok(refused(mutate((p) => { p.concepts[0].threshold = 5; })));
});

test('8 generated validators equal a fresh build; existing examples validate unchanged', () => {
  const r = spawnSync(process.execPath, ['scripts/build-validators.js', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const files = readdirSync(snakeDir).filter((f) => f.endsWith('.json'));
  const known = files.map((f) => JSON.parse(readFileSync(new URL(f, snakeDir), 'utf8')));
  for (const d of known) assert.deepEqual(validateArtefact(d, { known }).diagnostics.filter((x) => x.severity === 'error'), [], d.manifest?.id);
});

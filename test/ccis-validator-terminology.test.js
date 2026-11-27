// Row ECO-B1f: layer 5 checks for a terminology package (CCIS-V5-017 to 021). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const snake = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8'));
const pkg = () => ({
  manifest: { ...clone(snake.manifest), id: 'demo.terms', name: 'Demo local terms', type: 'terminology-package' },
  codeSystem: { id: 'local', version: '0.1.0' },
  concepts: [
    { key: 'demo-concept', display: 'Demo concept', category: 'finding' },
    { key: 'old-concept', display: 'Old concept', deprecated: true, replacedBy: 'demo-concept' },
  ],
  valueSets: [{ id: 'demo.values', version: '0.1.0', display: 'Demo values', members: [{ key: 'demo-concept' }] }],
  provenance: { origin: 'Synthetic test.', basis: 'Synthetic test.' },
});
const mutate = (fn) => { const p = pkg(); fn(p); return p; };
const rows = (doc) => validateArtefact(doc).diagnostics.filter((d) => /^CCIS-V5-0(1[7-9]|2[01])$/.test(d.ruleId));
const ids = (doc) => rows(doc).map((d) => d.ruleId);

test('1 the valid package gives no error and no V5-017 to 021 row', () => {
  const r = validateArtefact(pkg());
  assert.deepEqual(rows(pkg()), []);
  assert.deepEqual(r.diagnostics.filter((d) => d.severity === 'error'), []);
});

test('2 a repeated concept key is V5-017 at the second concept', () => {
  const r = rows(mutate((p) => { p.concepts.push({ key: 'demo-concept', display: 'Again' }); }));
  assert.deepEqual(r.map((d) => [d.ruleId, d.path]), [['CCIS-V5-017', '/concepts/2/key']]);
});

test('3 replacedBy naming itself or a missing key is V5-018; an existing key passes', () => {
  assert.deepEqual(ids(mutate((p) => { p.concepts[1].replacedBy = 'old-concept'; })), ['CCIS-V5-018']);
  assert.deepEqual(ids(mutate((p) => { p.concepts[1].replacedBy = 'no-such-key'; })), ['CCIS-V5-018']);
  assert.deepEqual(ids(pkg()), []);
});

test('4 a member key absent from concepts is V5-019 with the member path', () => {
  const r = rows(mutate((p) => { p.valueSets[0].members.push({ key: 'missing-key' }); }));
  assert.deepEqual(r.map((d) => [d.ruleId, d.path]), [['CCIS-V5-019', '/valueSets/0/members/1/key']]);
});

test('5 a repeated value-set id, or a repeated member in one set, is V5-020', () => {
  assert.deepEqual(ids(mutate((p) => { p.valueSets.push({ ...clone(p.valueSets[0]), version: '0.2.0' }); })), ['CCIS-V5-020']);
  assert.deepEqual(ids(mutate((p) => { p.valueSets[0].members.push({ key: 'demo-concept' }); })), ['CCIS-V5-020']);
});

test('6 a member naming a deprecated concept is a V5-021 warning only', () => {
  const p = mutate((x) => { x.valueSets[0].members.push({ key: 'old-concept' }); });
  const r = validateArtefact(p);
  assert.deepEqual(ids(p), ['CCIS-V5-021']);
  assert.equal(rows(p)[0].severity, 'warning');
  assert.equal(r.outcome, 'no-errors-so-far');
});

test('7 a malformed concepts list fails at layer 2 and never reaches this module', () => {
  const r = validateArtefact(mutate((p) => { p.concepts = 'nope'; }));
  assert.equal(r.outcome, 'failed');
  assert.deepEqual(r.diagnostics.filter((d) => /^CCIS-V5-0(1[7-9]|2[01])$/.test(d.ruleId)), []);
  assert.ok(r.diagnostics.some((d) => /^CCIS-V2-/.test(d.ruleId)));
});

test('8 a contextual element still validates with no new row', () => {
  const r = validateArtefact(snake, { known: [] });
  assert.deepEqual(r.diagnostics.filter((d) => /^CCIS-V5-0(1[7-9]|2[01])$/.test(d.ruleId)), []);
  assert.deepEqual(r.diagnostics.filter((d) => d.severity === 'error'), []);
});

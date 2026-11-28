// Row ECO-C6: core.vitals, core.fluid-balance, core.event-times. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { compareRoutes } from '../ccis-compile.js';
import { conceptOwners } from '../ccis-concept-owners.js';
import { ELEMENTS, build } from '../scripts/build-ecosystem-core-measures.js';
import { ELEMENTS as TEXT_ELEMENTS } from '../scripts/build-ecosystem-core-text.js';
import { text } from '../scripts/build-ecosystem-terms.js';

const read = (n) => readFileSync(new URL(`../ccis/examples/ecosystem/${n}`, import.meta.url), 'utf8');
const file = (id) => read(`${id}.element.json`);
const docs = () => ELEMENTS.map((e) => JSON.parse(file(e.id)));
const byKey = () => Object.fromEntries(docs().flatMap((d) => d.fields).map((f) => [f.key, f]));
const E_M = ['absent', 'unknown', 'not-collected', 'entered-in-error'];
const E_A = ['absent', 'unknown', 'not-collected', 'not-applicable', 'entered-in-error'];

test('1 each element passes validateArtefact with no error row', () => {
  for (const d of docs()) assert.deepEqual(validateArtefact(d).diagnostics.filter((x) => x.severity === 'error'), [], d.manifest.id);
});

test('2 each file equals the script output and the SDK route equals the file route', () => {
  for (const e of ELEMENTS) {
    assert.equal(file(e.id), text(build(e)));
    assert.equal(compareRoutes([{ name: 'json', input: file(e.id) }, { name: 'code', input: build(e) }]).identical, true);
  }
});

test('3 keys, types, units, cardinality, epistemic sets and sources match the chunk', () => {
  const f = byKey();
  assert.deepEqual(Object.keys(f), ['hr', 'bpSys', 'bpDia', 'rr', 'temp', 'spo2', 'intake', 'output', 'balance', 'catheter', 'ioNotes', 'onsetTime', 'onsetTimeCertainty', 'arrivalTime']);
  const vit = { hr: ['integer', '/min'], bpSys: ['integer', 'mm[Hg]'], bpDia: ['integer', 'mm[Hg]'], rr: ['integer', '/min'], temp: ['quantity', 'Cel'], spo2: ['integer', '%'] };
  for (const [k, [t, u]] of Object.entries(vit)) {
    assert.deepEqual([f[k].type, f[k].units, f[k].cardinality, f[k].epistemic, f[k].sourceClasses], [t, [u], { min: 0, max: 'unbounded' }, E_M, ['clinician-entered', 'device', 'imported']], k);
  }
  assert.deepEqual([f.intake.units, f.output.units, f.balance.units], [['mL'], ['mL'], ['mL']]);
  assert.deepEqual([f.balance.sourceClasses, f.balance.epistemic], [['derived'], E_M]);
  assert.deepEqual([f.catheter.type, f.catheter.epistemic, f.ioNotes.type], ['boolean', E_A, 'string']);
  assert.deepEqual(f.arrivalTime.sourceClasses, ['clinician-entered', 'imported']);
});

test('4 the eight owner fields match the owner map; each concept once; no ownedBy', () => {
  const map = JSON.parse(read('concept-owners.json')).owners.filter((o) => ['core.vitals', 'core.fluid-balance'].includes(o.owner.element));
  assert.equal(map.length, 8);
  const found = docs().flatMap((d) => d.fields.filter((f) => f.concept).map((f) => ({ concept: f.concept.code, owner: { element: d.manifest.id, key: f.key } })));
  assert.deepEqual(found.sort((a, b) => (a.concept < b.concept ? -1 : 1)), map.map(({ concept, owner }) => ({ concept, owner })).sort((a, b) => (a.concept < b.concept ? -1 : 1)));
  assert.ok(docs().flatMap((d) => d.fields).every((f) => !('ownedBy' in f)));
});

test('5 conceptOwners over these and the C5 elements reports no second owner', () => {
  const all = [...docs(), ...TEXT_ELEMENTS.map(([id]) => JSON.parse(read(`${id}.element.json`)))];
  const r = conceptOwners(all);
  assert.equal(r.length, 8);
  assert.ok(r.every((e) => e.status === 'ok'));
});

test('6 balance has no concept, is derived and has two derived-from links; no formula member', () => {
  const d = JSON.parse(file('core.fluid-balance'));
  assert.ok(!('concept' in d.fields.find((f) => f.key === 'balance')));
  assert.deepEqual(d.relationships, [{ kind: 'derived-from', from: 'balance', to: 'intake' }, { kind: 'derived-from', from: 'balance', to: 'output' }]);
  assert.doesNotMatch(file('core.fluid-balance'), /formula|expression/i);
});

test('7 onsetTimeCertainty carries the local binding; datetime fields have event-time', () => {
  const f = byKey();
  assert.equal(f.onsetTimeCertainty.type, 'code');
  assert.deepEqual(f.onsetTimeCertainty.binding.valueSet, { id: 'ecosystem.onset-certainty', version: '0.1.0' });
  assert.deepEqual([f.onsetTimeCertainty.binding.codeSystem, f.onsetTimeCertainty.binding.code], [{ id: 'local', version: '0.1.0' }, 'onset-certainty']);
  assert.ok(['onsetTime', 'arrivalTime'].every((k) => f[k].type === 'datetime' && f[k].timeSemantics === 'event-time'));
});

test('8 files are LF-only, sorted keys, synthetic and hold no band or threshold word', () => {
  for (const e of ELEMENTS) {
    const t = file(e.id);
    assert.ok(!t.includes('\r') && t.endsWith('}\n'));
    assert.equal(t, text(JSON.parse(t)));
    assert.match(t, /[Ss]ynthetic/);
    assert.doesNotMatch(t, /threshold|target|normal range|band/i);
  }
});

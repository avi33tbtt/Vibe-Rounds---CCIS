// Row ECO-C7: dm.core, dm.glycaemic-monitoring. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { compareRoutes } from '../ccis-compile.js';
import { conceptOwners } from '../ccis-concept-owners.js';
import { ELEMENTS, build } from '../scripts/build-ecosystem-dm.js';
import { ELEMENTS as TEXT_ELEMENTS } from '../scripts/build-ecosystem-core-text.js';
import { ELEMENTS as MEASURE_ELEMENTS } from '../scripts/build-ecosystem-core-measures.js';
import { text } from '../scripts/build-ecosystem-terms.js';

const read = (n) => readFileSync(new URL(`../ccis/examples/ecosystem/${n}`, import.meta.url), 'utf8');
const file = (id) => read(`${id}.element.json`);
const docs = () => ELEMENTS.map((e) => JSON.parse(file(e.id)));
const byKey = () => Object.fromEntries(docs().flatMap((d) => d.fields).map((f) => [f.key, f]));
const E_M = ['absent', 'unknown', 'not-collected', 'entered-in-error'];
const E_A = ['absent', 'unknown', 'not-collected', 'not-applicable', 'entered-in-error'];
const one = { min: 0, max: 1 };

test('1 both elements pass validateArtefact with no error row', () => {
  for (const d of docs()) assert.deepEqual(validateArtefact(d).diagnostics.filter((x) => x.severity === 'error'), [], d.manifest.id);
});

test('2 each file equals the script output and the SDK route equals the file route', () => {
  for (const e of ELEMENTS) {
    assert.equal(file(e.id), text(build(e)));
    assert.equal(compareRoutes([{ name: 'json', input: file(e.id) }, { name: 'code', input: build(e) }]).identical, true);
  }
});

test('3 keys, types, units, cardinality, epistemic sets, sources and EMR ids match the chunk', () => {
  const f = byKey();
  assert.deepEqual(Object.keys(f), ['dmType', 'dmDuration', 'dmMeds', 'dmComp', 'dmHypo', 'glu', 'hba1c']);
  const rows = { dmType: ['code', E_A, 'dm_type'], dmDuration: ['quantity', E_M, 'dm_duration'], dmMeds: ['string', E_M, 'dm_meds'], dmComp: ['string', E_M, 'dm_comp'], dmHypo: ['boolean', E_A, 'dm_hypo'] };
  for (const [k, [t, ep, emr]] of Object.entries(rows)) assert.deepEqual([f[k].type, f[k].epistemic, f[k].cardinality, f[k].sourceClasses, f[k]['x-emrFieldId']], [t, ep, one, ['clinician-entered'], emr], k);
  for (const [k, u] of [['glu', 'mg/dL'], ['hba1c', '%']]) assert.deepEqual([f[k].type, f[k].units, f[k].cardinality, f[k].epistemic, f[k].sourceClasses, f[k]['x-emrFieldId']], ['quantity', [u], { min: 0, max: 'unbounded' }, E_M, ['clinician-entered', 'device', 'imported'], k], k);
});

test('4 glu and hba1c concepts match the owner map; no ownedBy; each concept once', () => {
  const map = JSON.parse(read('concept-owners.json')).owners.filter((o) => o.owner.element === 'dm.glycaemic-monitoring');
  assert.equal(map.length, 2);
  const found = docs().flatMap((d) => d.fields.filter((f) => f.concept).map((f) => ({ concept: f.concept.code, owner: { element: d.manifest.id, key: f.key } })));
  const sort = (a) => a.sort((x, y) => (x.concept < y.concept ? -1 : 1));
  assert.deepEqual(sort(found), sort(map.map(({ concept, owner }) => ({ concept, owner }))));
  assert.ok(docs().flatMap((d) => d.fields).every((f) => !('ownedBy' in f)));
  assert.ok(docs().find((d) => d.manifest.id === 'dm.core').fields.every((f) => !('concept' in f)));
});

test('5 conceptOwners over C5, C6 and C7 elements reports no second owner', () => {
  const all = [...docs(), ...TEXT_ELEMENTS.map(([id]) => JSON.parse(read(`${id}.element.json`))), ...MEASURE_ELEMENTS.map((e) => JSON.parse(read(`${e.id}.element.json`)))];
  const r = conceptOwners(all);
  assert.equal(r.length, 10);
  assert.ok(r.every((e) => e.status === 'ok'));
});

test('6 dmType binding is local, names the package value set, and the value set exists', () => {
  const b = byKey().dmType.binding;
  assert.deepEqual([b.codeSystem, b.valueSet, b.code], [{ id: 'local', version: '0.1.0' }, { id: 'ecosystem.dm-type', version: '0.1.0' }, 'dm-type']);
  const pkg = JSON.parse(read('ecosystem.local-terms.terminology-package.json'));
  assert.ok(JSON.stringify(pkg).includes('"id":"ecosystem.dm-type"'));
});

test('7 dmDuration is a quantity in years without a concept; dmHypo is boolean', () => {
  const f = byKey();
  assert.deepEqual([f.dmDuration.type, f.dmDuration.units, 'concept' in f.dmDuration], ['quantity', ['a'], false]);
  assert.equal(f.dmHypo.type, 'boolean');
  assert.equal('units' in f.dmHypo, false);
});

test('8 files are LF-only, sorted keys, synthetic and hold no band, target or threshold word', () => {
  for (const e of ELEMENTS) {
    const t = file(e.id);
    assert.ok(!t.includes('\r') && t.endsWith('}\n'));
    assert.equal(t, text(JSON.parse(t)));
    assert.match(t, /[Ss]ynthetic/);
    assert.doesNotMatch(t, /threshold|target|normal range|band|formula/i);
  }
});

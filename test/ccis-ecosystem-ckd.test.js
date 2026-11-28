// Row ECO-C8: ckd.core, ckd.kidney-function. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { compareRoutes } from '../ccis-compile.js';
import { conceptOwners } from '../ccis-concept-owners.js';
import { ELEMENTS, build } from '../scripts/build-ecosystem-ckd.js';
import { ELEMENTS as TEXT_ELEMENTS } from '../scripts/build-ecosystem-core-text.js';
import { ELEMENTS as MEASURE_ELEMENTS } from '../scripts/build-ecosystem-core-measures.js';
import { ELEMENTS as DM_ELEMENTS } from '../scripts/build-ecosystem-dm.js';
import { text } from '../scripts/build-ecosystem-terms.js';

const read = (n) => readFileSync(new URL(`../ccis/examples/ecosystem/${n}`, import.meta.url), 'utf8');
const file = (id) => read(`${id}.element.json`);
const docs = () => ELEMENTS.map((e) => JSON.parse(file(e.id)));
const byKey = () => Object.fromEntries(docs().flatMap((d) => d.fields).map((f) => [f.key, f]));
const E_M = ['absent', 'unknown', 'not-collected', 'entered-in-error'];
const E_A = ['absent', 'unknown', 'not-collected', 'not-applicable', 'entered-in-error'];
const one = { min: 0, max: 1 };

test('1 both elements pass validateArtefact with no error row (only the V4-011 unit warning is allowed)', () => {
  for (const d of docs()) {
    const rows = validateArtefact(d).diagnostics;
    assert.deepEqual(rows.filter((x) => x.severity === 'error'), [], d.manifest.id);
    assert.ok(rows.filter((x) => x.severity === 'warning').every((x) => x.ruleId === 'CCIS-V4-011'));
  }
});

test('2 each file equals the script output and the SDK route equals the file route', () => {
  for (const e of ELEMENTS) {
    assert.equal(file(e.id), text(build(e)));
    assert.equal(compareRoutes([{ name: 'json', input: file(e.id) }, { name: 'code', input: build(e) }]).identical, true);
  }
});

test('3 keys, types, units, cardinality, epistemic sets, sources and EMR ids match the chunk', () => {
  const f = byKey();
  assert.deepEqual(Object.keys(f), ['ckdStage', 'ckdCause', 'egfr', 'creat', 'uacr']);
  assert.deepEqual([f.ckdStage.type, f.ckdStage['x-emrFieldId'], f.ckdCause.type, f.ckdCause['x-emrFieldId']], ['code', 'ckd_stage', 'string', 'ckd_cause']);
  for (const k of ['ckdStage', 'ckdCause']) assert.deepEqual([f[k].cardinality, f[k].epistemic, f[k].sourceClasses], [one, E_A, ['clinician-entered']], k);
  for (const [k, u] of [['egfr', 'mL/min/{1.73_m2}'], ['creat', 'mg/dL'], ['uacr', 'mg/g']]) {
    assert.deepEqual([f[k].type, f[k].units, f[k].cardinality, f[k].epistemic, f[k].sourceClasses, f[k]['x-emrFieldId']], ['quantity', [u], { min: 0, max: 'unbounded' }, E_M, ['clinician-entered', 'device', 'imported'], k], k);
  }
});

test('4 the three concepts match the owner map; no ownedBy; ckd.core has no concept', () => {
  const map = JSON.parse(read('concept-owners.json')).owners.filter((o) => o.owner.element === 'ckd.kidney-function');
  assert.equal(map.length, 3);
  const found = docs().flatMap((d) => d.fields.filter((f) => f.concept).map((f) => ({ concept: f.concept.code, owner: { element: d.manifest.id, key: f.key } })));
  const sort = (a) => a.sort((x, y) => (x.concept < y.concept ? -1 : 1));
  assert.deepEqual(sort(found), sort(map.map(({ concept, owner }) => ({ concept, owner }))));
  assert.ok(docs().flatMap((d) => d.fields).every((f) => !('ownedBy' in f)));
  assert.ok(docs().find((d) => d.manifest.id === 'ckd.core').fields.every((f) => !('concept' in f)));
});

test('5 conceptOwners over C5 to C8 elements reports no second owner', () => {
  const all = [...docs(), ...TEXT_ELEMENTS.map(([id]) => JSON.parse(read(`${id}.element.json`))), ...[...MEASURE_ELEMENTS, ...DM_ELEMENTS].map((e) => JSON.parse(read(`${e.id}.element.json`)))];
  const r = conceptOwners(all);
  assert.equal(r.length, 13);
  assert.ok(r.every((e) => e.status === 'ok'));
});

test('6 ckdStage binding is local and its value set holds exactly the six stages', () => {
  const b = byKey().ckdStage.binding;
  assert.deepEqual([b.codeSystem, b.valueSet, b.code], [{ id: 'local', version: '0.1.0' }, { id: 'ecosystem.ckd-stage', version: '0.1.0' }, 'ckd-stage']);
  const pkg = JSON.parse(read('ecosystem.local-terms.terminology-package.json'));
  const set = pkg.valueSets.find((x) => x.id === 'ecosystem.ckd-stage');
  assert.deepEqual(set.members.map((m) => m.key), ['1', '2', '3a', '3b', '4', '5'].map((s) => `ckd-stage.${s}`));
});

test('7 ckd.kidney-function has no relationship member and no formula word anywhere', () => {
  assert.ok(!('relationships' in JSON.parse(file('ckd.kidney-function'))));
  for (const e of ELEMENTS) assert.doesNotMatch(file(e.id), /formula|expression|derived/i);
});

test('8 files are LF-only, sorted keys, synthetic and hold no band, target or threshold word', () => {
  for (const e of ELEMENTS) {
    const t = file(e.id);
    assert.ok(!t.includes('\r') && t.endsWith('}\n'));
    assert.equal(t, text(JSON.parse(t)));
    assert.match(t, /[Ss]ynthetic/);
    assert.doesNotMatch(t, /threshold|target|normal range|band/i);
  }
});

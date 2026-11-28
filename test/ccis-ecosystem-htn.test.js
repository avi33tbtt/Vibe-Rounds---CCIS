// Row ECO-C9: htn.core. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { compareRoutes } from '../ccis-compile.js';
import { conceptOwners } from '../ccis-concept-owners.js';
import { ELEMENTS, build } from '../scripts/build-ecosystem-htn.js';
import { ELEMENTS as TEXT_ELEMENTS } from '../scripts/build-ecosystem-core-text.js';
import { ELEMENTS as MEASURE_ELEMENTS } from '../scripts/build-ecosystem-core-measures.js';
import { ELEMENTS as DM_ELEMENTS } from '../scripts/build-ecosystem-dm.js';
import { ELEMENTS as CKD_ELEMENTS } from '../scripts/build-ecosystem-ckd.js';
import { text } from '../scripts/build-ecosystem-terms.js';

const read = (n) => readFileSync(new URL(`../ccis/examples/ecosystem/${n}`, import.meta.url), 'utf8');
const file = (id) => read(`${id}.element.json`);
const htn = () => JSON.parse(file('htn.core'));
const vitals = () => JSON.parse(file('core.vitals'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const byKey = (d) => Object.fromEntries(d.fields.map((f) => [f.key, f]));
const E_M = ['absent', 'unknown', 'not-collected', 'entered-in-error'];
const E_A = ['absent', 'unknown', 'not-collected', 'not-applicable', 'entered-in-error'];
const rules = (r) => r.diagnostics.map((x) => x.ruleId);

test('1 with core.vitals known: no error and no owner row V5-014, V5-015 or V5-016', () => {
  const r = validateArtefact(htn(), { known: [vitals()] });
  assert.deepEqual(r.diagnostics.filter((x) => x.severity === 'error'), []);
  assert.deepEqual(rules(r).filter((x) => /^CCIS-V5-01[456]$/.test(x)), []);
  assert.ok(r.diagnostics.every((x) => x.ruleId === 'CCIS-V4-011'));
});

test('2 the file equals the script output and the SDK route equals the file route', () => {
  assert.equal(file('htn.core'), text(build(ELEMENTS[0])));
  assert.equal(compareRoutes([{ name: 'json', input: file('htn.core') }, { name: 'code', input: build(ELEMENTS[0]) }]).identical, true);
});

test('3 keys, types, units, cardinality, epistemic sets, sources and EMR ids match the chunk', () => {
  const f = byKey(htn());
  assert.deepEqual(Object.keys(f), ['htnType', 'sbp', 'dbp']);
  assert.deepEqual([f.htnType.type, f.htnType.cardinality, f.htnType.epistemic, f.htnType.sourceClasses, f.htnType['x-emrFieldId'], 'concept' in f.htnType], ['code', { min: 0, max: 1 }, E_A, ['clinician-entered'], 'htn_type', false]);
  for (const k of ['sbp', 'dbp']) assert.deepEqual([f[k].type, f[k].units, f[k].cardinality, f[k].epistemic, f[k].sourceClasses, f[k]['x-emrFieldId']], ['integer', ['mm[Hg]'], { min: 0, max: 'unbounded' }, E_M, ['clinician-entered', 'device', 'imported'], k], k);
});

test('4 sbp and dbp repeat the owner fields of core.vitals and match the owner map users', () => {
  const f = byKey(htn());
  const v = byKey(vitals());
  for (const [k, o] of [['sbp', 'bpSys'], ['dbp', 'bpDia']]) {
    assert.deepEqual(f[k].ownedBy, { element: 'core.vitals', key: o });
    for (const m of ['concept', 'type', 'units', 'cardinality']) assert.deepEqual(f[k][m], v[o][m], `${k} ${m}`);
  }
  const users = JSON.parse(read('concept-owners.json')).owners.filter((o) => o.users.length);
  assert.deepEqual(users.map((o) => [o.concept, o.users]), [['systolic-pressure', [{ element: 'htn.core', key: 'sbp' }]], ['diastolic-pressure', [{ element: 'htn.core', key: 'dbp' }]]]);
});

test('5 conceptOwners over C5 to C9: 13 concepts ok; the two blood pressure concepts have exactly these users', () => {
  const all = [htn(), ...TEXT_ELEMENTS.map(([id]) => JSON.parse(read(`${id}.element.json`))), ...[...MEASURE_ELEMENTS, ...DM_ELEMENTS, ...CKD_ELEMENTS].map((e) => JSON.parse(read(`${e.id}.element.json`)))];
  const r = conceptOwners(all);
  assert.equal(r.length, 13);
  assert.ok(r.every((e) => e.status === 'ok' && e.owners.length === 1));
  assert.deepEqual(r.filter((e) => e.users.length).map((e) => [e.concept, e.users, e.owners[0].element]), [
    ['diastolic-pressure', [{ element: 'htn.core', key: 'dbp' }], 'core.vitals'], ['systolic-pressure', [{ element: 'htn.core', key: 'sbp' }], 'core.vitals']]);
});

test('6 htnType binding is local and its value set holds exactly the three members', () => {
  const b = byKey(htn()).htnType.binding;
  assert.deepEqual([b.codeSystem, b.valueSet, b.code], [{ id: 'local', version: '0.1.0' }, { id: 'ecosystem.htn-type', version: '0.1.0' }, 'htn-type']);
  const set = JSON.parse(read('ecosystem.local-terms.terminology-package.json')).valueSets.find((x) => x.id === 'ecosystem.htn-type');
  assert.deepEqual(set.members.map((m) => m.key), ['htn-type.essential', 'htn-type.secondary', 'htn-type.other']);
});

test('7 in memory: a wrong owner key gives V5-014, a changed unit gives V5-015, no known artefacts skips the owner', () => {
  const a = htn(); a.fields[1].ownedBy.key = 'nope';
  assert.ok(rules(validateArtefact(a, { known: [vitals()] })).includes('CCIS-V5-014'));
  const b = htn(); b.fields[1].units = ['kPa'];
  assert.ok(rules(validateArtefact(b, { known: [vitals()] })).includes('CCIS-V5-015'));
  const c = validateArtefact(htn());
  assert.deepEqual(c.diagnostics.filter((x) => x.severity === 'error'), []);
  assert.ok(!rules(c).some((x) => /^CCIS-V5-01[456]$/.test(x)));
});

test('8 the file is LF-only, sorted keys, synthetic and holds no band, target or threshold word', () => {
  const t = file('htn.core');
  assert.ok(!t.includes('\r') && t.endsWith('}\n'));
  assert.equal(t, text(JSON.parse(t)));
  assert.match(t, /[Ss]ynthetic/);
  assert.doesNotMatch(t, /threshold|target|normal range|band/i);
  assert.equal(clone(htn()).manifest.id, 'htn.core');
});

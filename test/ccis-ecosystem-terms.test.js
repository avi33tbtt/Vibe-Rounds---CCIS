// Row ECO-C4: the ecosystem local terminology package and owner map. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { buildPackage, buildOwners, text } from '../scripts/build-ecosystem-terms.js';

const read = (n) => readFileSync(new URL(`../ccis/examples/ecosystem/${n}`, import.meta.url), 'utf8');
const PKG = 'ecosystem.local-terms.terminology-package.json';
const pkg = () => JSON.parse(read(PKG));
const owners = () => JSON.parse(read('concept-owners.json'));
const KEY = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const errors = (d) => validateArtefact(d).diagnostics.filter((x) => x.severity === 'error').map((x) => x.ruleId);

test('1 the package passes validateArtefact with no error row', () => {
  assert.deepEqual(errors(pkg()), []);
});

test('2 both files equal the script output byte for byte', () => {
  assert.equal(read(PKG), text(buildPackage()));
  assert.equal(read('concept-owners.json'), text(buildOwners()));
});

test('3 keys are unique and valid; the 13 measurement keys equal the owner map', () => {
  const keys = pkg().concepts.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every((k) => KEY.test(k)));
  const measures = pkg().concepts.filter((c) => c.category !== 'finding').map((c) => c.key).sort();
  assert.equal(measures.length, 13);
  assert.deepEqual(owners().owners.map((o) => o.concept).sort(), measures);
});

test('4 every member names an existing concept; none is deprecated', () => {
  const p = pkg();
  const keys = new Set(p.concepts.map((c) => c.key));
  assert.ok(p.valueSets.flatMap((v) => v.members).every((m) => keys.has(m.key)));
  assert.ok(p.concepts.every((c) => !c.deprecated));
});

test('5 no digit in any display or definition except the allow-listed stage and type labels', () => {
  const allow = (c) => /-24h$|^hba1c$/.test(c.key) || /^ckd-stage\.\w+$/.test(c.key) || /^dm-type\.t[12]dm$/.test(c.key);
  for (const c of pkg().concepts) if (!allow(c)) assert.doesNotMatch(`${c.display} ${c.definition ?? ''}`, /\d/, c.key);
  assert.ok(pkg().concepts.some((c) => /\d/.test(c.display)));
});

test('6 each concept has one owner; htn.core is a user, never a second owner', () => {
  const o = owners().owners;
  assert.equal(new Set(o.map((x) => x.concept)).size, o.length);
  const byConcept = Object.fromEntries(o.map((x) => [x.concept, x]));
  assert.deepEqual(byConcept['systolic-pressure'].users, [{ element: 'htn.core', key: 'sbp' }]);
  assert.deepEqual(byConcept['diastolic-pressure'].users, [{ element: 'htn.core', key: 'dbp' }]);
  assert.ok(o.every((x) => x.owner.element !== 'htn.core'));
  assert.deepEqual(o.filter((x) => x.users.length).map((x) => x.concept).sort(), ['diastolic-pressure', 'systolic-pressure']);
});

test('7 files are LF-only with sorted keys and say synthetic', () => {
  for (const n of [PKG, 'concept-owners.json']) {
    const t = read(n);
    assert.ok(!t.includes('\r') && t.endsWith('}\n'));
    assert.equal(t, text(JSON.parse(t)));
    assert.match(t, /[Ss]ynthetic/);
  }
});

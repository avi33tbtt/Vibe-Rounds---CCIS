// Row ECO-C5: the three core text elements. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { compareRoutes } from '../ccis-compile.js';
import { ELEMENTS, build } from '../scripts/build-ecosystem-core-text.js';
import { text } from '../scripts/build-ecosystem-terms.js';

const file = (id) => readFileSync(new URL(`../ccis/examples/ecosystem/${id}.element.json`, import.meta.url), 'utf8');
const docs = () => ELEMENTS.map(([id]) => JSON.parse(file(id)));
const fields = () => docs().flatMap((d) => d.fields);
const E_A = ['absent', 'unknown', 'not-collected', 'not-applicable', 'entered-in-error'];
const E_N = [...E_A, 'explicitly-negative'];
const WANT = { cc: E_A, hpi: E_A, pmh: E_N, exam: E_N, assessment: E_A, plan: E_A };

test('1 each element passes validateArtefact with no error row', () => {
  for (const d of docs()) {
    const r = validateArtefact(d);
    assert.deepEqual(r.diagnostics.filter((x) => x.severity === 'error'), [], d.manifest.id);
  }
});

test('2 each file equals the script output and the SDK route equals the file route', () => {
  for (const e of ELEMENTS) {
    assert.equal(file(e[0]), text(build(e)));
    assert.equal(compareRoutes([{ name: 'json', input: file(e[0]) }, { name: 'code', input: build(e) }]).identical, true);
  }
});

test('3 field keys, types, epistemic sets and source classes match the table', () => {
  assert.deepEqual(fields().map((f) => f.key), Object.keys(WANT));
  for (const f of fields()) {
    assert.equal(f.type, 'string');
    assert.deepEqual(f.cardinality, { min: 0, max: 1 });
    assert.deepEqual(f.epistemic, WANT[f.key]);
    assert.deepEqual(f.sourceClasses, ['clinician-entered']);
  }
});

test('4 no field has concept, binding or units, and no label or intent holds a digit', () => {
  for (const f of fields()) for (const k of ['concept', 'binding', 'units', 'ownedBy', 'contexts']) assert.ok(!(k in f), `${f.key} ${k}`);
  for (const d of docs()) assert.doesNotMatch(JSON.stringify([d.fields.map((f) => f.label), d.intent]), /\d/);
});

test('5 every field has x-emrFieldId and the six ids are unique', () => {
  const ids = fields().map((f) => f['x-emrFieldId']);
  assert.deepEqual(ids, Object.keys(WANT));
  assert.equal(new Set(ids).size, 6);
});

test('6 no concept key from the owner map appears in these elements', () => {
  const owners = JSON.parse(readFileSync(new URL('../ccis/examples/ecosystem/concept-owners.json', import.meta.url), 'utf8')).owners.map((o) => o.concept);
  const all = ELEMENTS.map(([id]) => file(id)).join('');
  for (const c of owners) assert.ok(!all.includes(`"${c}"`), c);
});

test('7 files are LF-only, sorted keys and say synthetic', () => {
  for (const [id] of ELEMENTS) {
    const t = file(id);
    assert.ok(!t.includes('\r') && t.endsWith('}\n'));
    assert.equal(t, text(JSON.parse(t)));
    assert.match(t, /[Ss]ynthetic/);
  }
});

// Row ECO-B2a: concept ownership (CCIS-V5-028, 029). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { conceptOwners } from '../ccis-concept-owners.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const snake = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8'));
const concept = (code) => ({ codeSystem: { id: 'local', version: '0.1.0' }, code, display: 'Demo', mapping: { status: 'mapped' } });
const f = (key, code = 'demo-concept', over = {}) => ({ key, label: 'Demo amount', type: 'quantity', units: ['mmol/L'], cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'], concept: concept(code), ...over });
const el = (id, fields, version = '0.1.0', extra = {}) => {
  const e = clone(snake);
  e.manifest.id = id; e.manifest.version = version; e.fields = fields; delete e.relationships; delete e.modules; delete e.tests;
  return Object.assign(e, extra);
};
const own = (id, key = 'ownerKey', version) => el(id, [f(key)], version);
const use = (id, owner = 'demo.owner', key = 'userKey') => el(id, [f(key, 'demo-concept', { ownedBy: { element: owner, key: 'ownerKey' } })]);
const run = (doc, known, strictOwnership) => validateArtefact(doc, { known, strictOwnership });
const mine = (r) => r.diagnostics.filter((d) => /^CCIS-V5-02[89]$/.test(d.ruleId));

test('1 one owner and one user give ok, list both keys and raise no row', () => {
  const [e] = conceptOwners([own('demo.owner'), use('demo.user')]);
  assert.deepEqual([e.status, e.keys], ['ok', ['ownerKey', 'userKey']]);
  assert.deepEqual(mine(run(use('demo.user'), [own('demo.owner')])), []);
});

test('2 owner fields in two elements give second-owner and a V5-028 warning', () => {
  const a = own('demo.a'), b = own('demo.b');
  assert.equal(conceptOwners([a, b])[0].status, 'second-owner');
  const d = mine(run(a, [b]));
  assert.deepEqual(d.map((x) => [x.ruleId, x.severity, x.path]), [['CCIS-V5-028', 'warning', '/fields/0/concept/code']]);
});

test('3 two owner fields in one element are not a second owner', () => {
  const e = el('demo.a', [f('one'), f('two')]);
  assert.equal(conceptOwners([e])[0].status, 'ok');
  assert.deepEqual(mine(run(e, [])), []);
});

test('4 a concept carried only by user fields gives needs-owner and a V5-029 warning', () => {
  const u = use('demo.user', 'demo.elsewhere');
  assert.equal(conceptOwners([u])[0].status, 'needs-owner');
  assert.deepEqual(mine(run(u, [])).map((x) => [x.ruleId, x.severity]), [['CCIS-V5-029', 'warning']]);
});

test('5 strictOwnership makes both rows errors', () => {
  const a = own('demo.a'), b = own('demo.b');
  assert.deepEqual(mine(run(a, [b], true)).map((x) => x.severity), ['error']);
  assert.deepEqual(mine(run(use('demo.user', 'demo.elsewhere'), [], true)).map((x) => x.severity), ['error']);
});

test('6 an older version of an element is ignored when a higher one is present', () => {
  const oldA = own('demo.a', 'ownerKey', '0.1.0');
  const newA = el('demo.a', [f('now', 'other-concept')], '0.2.0');
  const entries = conceptOwners([oldA, newA, own('demo.b')]);
  assert.deepEqual(entries.map((e) => [e.concept, e.status]), [['demo-concept', 'ok'], ['other-concept', 'ok']]);
});

test('7 a module field is counted and gets its module path', () => {
  const a = el('demo.a', [f('base', 'x-base')], '0.1.0', { modules: [{ id: 'mod', appliesWhen: 'Demo condition', fields: [f('modf')] }] });
  const b = own('demo.b');
  const d = mine(run(a, [b]));
  assert.deepEqual(d.map((x) => [x.ruleId, x.path]), [['CCIS-V5-028', '/modules/0/fields/0/concept/code']]);
});

test('8 the examples raise no row and the output does not depend on input order', () => {
  for (const dir of ['snake', 'diabetes-ckd']) {
    for (const n of readdirSync(new URL(`../ccis/examples/${dir}/`, import.meta.url))) {
      if (!/element\.json$/.test(n)) continue;
      const doc = JSON.parse(readFileSync(new URL(`../ccis/examples/${dir}/${n}`, import.meta.url), 'utf8'));
      assert.deepEqual(mine(run(doc, [])), [], n);
    }
  }
  const x = [own('demo.b'), own('demo.a'), use('demo.u')];
  assert.deepEqual(conceptOwners(x), conceptOwners([...x].reverse()));
});

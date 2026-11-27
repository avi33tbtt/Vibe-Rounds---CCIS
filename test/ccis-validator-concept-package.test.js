// Row ECO-B2c: a field concept must exist in the referenced terminology package (CCIS-V5-026, 027). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const snake = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8'));
const pkg = (id = 'demo.terms', concepts) => ({
  manifest: { ...clone(snake.manifest), id, name: 'Demo local terms', type: 'terminology-package' },
  codeSystem: { id: 'local', version: '0.1.0' },
  concepts: concepts ?? [
    { key: 'demo-concept', display: 'Demo concept', category: 'finding' },
    { key: 'old-concept', display: 'Old concept', deprecated: true, replacedBy: 'demo-concept' },
  ],
  provenance: { origin: 'Synthetic test.', basis: 'Synthetic test.' },
});
const concept = (code) => ({ codeSystem: { id: 'local', version: '0.1.0' }, code, display: 'Demo', mapping: { status: 'mapped' } });
const f = (key, code) => ({ key, label: 'Demo amount', type: 'quantity', units: ['mmol/L'], cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'], concept: concept(code) });
const el = (fields, refs, extra = {}) => {
  const e = clone(snake);
  e.manifest.id = 'demo.el'; e.fields = fields; delete e.relationships; delete e.modules; delete e.tests;
  e.manifest.references = refs;
  return Object.assign(e, extra);
};
const ref = (id = 'demo.terms') => ({ id, type: 'terminology-package', range: '>=0.0.0' });
const run = (e, known = [pkg()]) => validateArtefact(e, { known });
const mine = (r) => r.diagnostics.filter((d) => /^CCIS-V5-02[67]$/.test(d.ruleId));

test('1 a concept in the referenced package gives no row', () => {
  assert.deepEqual(mine(run(el([f('a', 'demo-concept')], [ref()]))), []);
});

test('2 a concept absent from the package gives V5-026 at the field path', () => {
  const d = mine(run(el([f('a', 'demo-concept'), f('b', 'missing-one')], [ref()])));
  assert.deepEqual(d.map((x) => [x.ruleId, x.severity, x.path]), [['CCIS-V5-026', 'error', '/fields/1/concept/code']]);
});

test('3 a deprecated concept gives a V5-027 warning that names replacedBy', () => {
  const d = mine(run(el([f('a', 'old-concept')], [ref()])));
  assert.deepEqual(d.map((x) => [x.ruleId, x.severity]), [['CCIS-V5-027', 'warning']]);
  assert.match(d[0].hint, /demo-concept/);
});

test('4 no terminology-package reference gives no row', () => {
  assert.deepEqual(mine(run(el([f('a', 'missing-one')], []))), []);
});

test('5 a package that is not known gives no V5-026; layer 3 reports V3-004', () => {
  const r = run(el([f('a', 'missing-one')], [ref('absent.terms')]));
  assert.deepEqual(mine(r), []);
  assert.ok(r.diagnostics.some((d) => d.ruleId === 'CCIS-V3-004'));
});

test('6 with two referenced packages a code in either one passes', () => {
  const known = [pkg(), pkg('demo.more', [{ key: 'other-concept', display: 'Other' }])];
  assert.deepEqual(mine(run(el([f('a', 'demo-concept'), f('b', 'other-concept')], [ref(), ref('demo.more')]), known)), []);
});

test('7 a module field is checked with its module path', () => {
  const e = el([f('base', 'demo-concept')], [ref()], { modules: [{ id: 'mod', appliesWhen: 'Demo condition', fields: [f('modf', 'missing-one')] }] });
  assert.deepEqual(mine(run(e)).map((x) => [x.ruleId, x.path]), [['CCIS-V5-026', '/modules/0/fields/0/concept/code']]);
});

test('8 a package and the example elements get no row', () => {
  assert.deepEqual(mine(validateArtefact(pkg(), { known: [pkg()] })), []);
  for (const d of ['snake', 'diabetes-ckd']) {
    for (const n of readdirSync(new URL(`../ccis/examples/${d}/`, import.meta.url))) {
      if (!/element\.json$/.test(n)) continue;
      const doc = JSON.parse(readFileSync(new URL(`../ccis/examples/${d}/${n}`, import.meta.url), 'utf8'));
      assert.deepEqual(mine(run(doc)), [], n);
    }
  }
});

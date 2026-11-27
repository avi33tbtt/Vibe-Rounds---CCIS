// Row ECO-B2: layer 5 concept and context checks (CCIS-V5-022 to 025). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';

const snake = JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-envenomation.element.json', import.meta.url), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const concept = (code = 'demo-concept') => ({ codeSystem: { id: 'local', version: '0.1.0' }, code, display: 'Demo concept', mapping: { status: 'mapped' } });
const f = (over = {}) => ({ key: 'amount', label: 'Demo amount', type: 'quantity', units: ['mmol/L'], cardinality: { min: 0, max: 1 }, epistemic: ['absent'], sourceClasses: ['clinician-entered'], concept: concept(), ...over });
const el = (fields, version = '0.1.0', extra = {}) => {
  const e = clone(snake);
  e.manifest.id = 'demo.concept'; e.manifest.standard.version = version;
  e.fields = fields; delete e.relationships; delete e.modules; delete e.tests;
  return Object.assign(e, extra);
};
const run = (e) => validateArtefact(e, { known: [] });
const mine = (r) => r.diagnostics.filter((d) => /^CCIS-V5-02[2-5]$/.test(d.ruleId));

test('1 a good concept and a known tag give no V5-022 to 025 row', () => {
  assert.deepEqual(mine(run(el([f({ contexts: ['ckd'] })]))), []);
});

test('2 a bad concept code gives V5-022 with the field path', () => {
  for (const code of ['Creatinine', '_x', 'a'.repeat(65)]) {
    const d = mine(run(el([f({ concept: concept(code) })])));
    assert.deepEqual(d.map((x) => x.ruleId), ['CCIS-V5-022']);
    assert.equal(d[0].path, '/fields/0/concept/code');
  }
});

test('3 an unknown tag gives V5-023 at its path; each known tag passes', () => {
  const d = mine(run(el([f({ contexts: ['diabetes', 'asthma'] })])));
  assert.deepEqual(d.map((x) => [x.ruleId, x.path]), [['CCIS-V5-023', '/fields/0/contexts/1']]);
  for (const t of ['diabetes', 'ckd', 'hypertension']) assert.deepEqual(mine(run(el([f({ contexts: [t] })]))), []);
});

test('4 a repeating numeric field with no concept: warning at 0.1.0, error at 0.2.0; others give no row', () => {
  const rep = (over) => f({ concept: undefined, cardinality: { min: 0, max: 'unbounded' }, ...over });
  const w = mine(run(el([rep()], '0.1.0')));
  assert.deepEqual(w.map((x) => [x.ruleId, x.severity]), [['CCIS-V5-024', 'warning']]);
  const e = mine(run(el([rep({ type: 'integer', units: ['count'] })], '0.2.0')));
  assert.deepEqual(e.map((x) => [x.ruleId, x.severity]), [['CCIS-V5-024', 'error']]);
  assert.deepEqual(mine(run(el([f({ concept: undefined })], '0.2.0'))), []);
  assert.deepEqual(mine(run(el([rep({ type: 'text', units: undefined })], '0.2.0'))), []);
});

test('5 one concept with different units, then different type, gives V5-025; same units in another order pass', () => {
  const a = f({ key: 'a', units: ['mmol/L'] });
  assert.deepEqual(mine(run(el([a, f({ key: 'b', units: ['mg/dL'] })]))).map((x) => x.ruleId), ['CCIS-V5-025']);
  assert.deepEqual(mine(run(el([a, f({ key: 'b', type: 'integer' })]))).map((x) => x.ruleId), ['CCIS-V5-025']);
  const two = (u) => f({ key: u.join(''), units: u });
  assert.deepEqual(mine(run(el([two(['mmol/L', 'mg/dL']), f({ key: 'c', units: ['mg/dL', 'mmol/L'] })]))), []);
});

test('6 a module field is checked with its module path', () => {
  const e = el([f({ key: 'base' })], '0.1.0', { modules: [{ id: 'mod', appliesWhen: 'Demo condition', fields: [f({ key: 'modf', concept: concept('BAD') })] }] });
  const d = mine(run(e));
  assert.deepEqual(d.map((x) => [x.ruleId, x.path]), [['CCIS-V5-022', '/modules/0/fields/0/concept/code']]);
});

test('7 the example elements raise no new error', () => {
  const found = [];
  const walk = (dir) => { for (const n of readdirSync(dir, { withFileTypes: true })) { const p = new URL(n.name + (n.isDirectory() ? '/' : ''), dir); if (n.isDirectory()) walk(p); else if (/element\.json$/.test(n.name)) found.push(p); } };
  walk(new URL('../ccis/examples/', import.meta.url));
  assert.ok(found.length > 0);
  for (const p of found) {
    const d = mine(run(JSON.parse(readFileSync(p, 'utf8'))));
    assert.deepEqual(d.filter((x) => x.severity === 'error'), [], p.pathname);
  }
});

test('8 an element group and a terminology package get no V5-022 to 025 row', () => {
  const g = clone(el([f()]));
  g.manifest.type = 'element-group';
  assert.deepEqual(mine(run(g)), []);
  const t = clone(el([f({ concept: concept('BAD') })]));
  t.manifest.type = 'terminology-package';
  assert.deepEqual(mine(run(t)), []);
});

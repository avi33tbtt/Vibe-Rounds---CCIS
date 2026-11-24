// Row 2.2b: layer 4 element and binding checks (CCIS-V4-009 to V4-011). Prototype. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateArtefact, RULES } from '../ccis-validator.js';
import { semanticLayer, SEMANTIC_RULES } from '../ccis-validator-semantic.js';

const snakeDir = new URL('../ccis/examples/snake/', import.meta.url);
const text = (u) => readFileSync(u, 'utf8');
const read = (f) => JSON.parse(text(new URL(f, snakeDir)));
const clone = (x) => JSON.parse(JSON.stringify(x));
const snakeFiles = readdirSync(snakeDir).filter((f) => f.endsWith('.json')).sort();
const known = snakeFiles.map((f) => read(f));
const run = (doc) => validateArtefact(doc, { known });
const ELEMENT = 'snake-envenomation.element.json';
const INTERVAL = 'snake-interval.analytics.0.1.1.json';
const quantityField = (units) => ({
  key: 'testQuantity', label: 'A test quantity', type: 'quantity', cardinality: { min: 0, max: 1 }, units,
  epistemic: ['absent'], sourceClasses: ['clinician-entered'],
});

// (a) valid artefacts stay clean ------------------------------------------------------------------

test('every valid snake artefact still has no diagnostics through layer 5', () => {
  for (const f of snakeFiles) {
    const r = run(text(new URL(f, snakeDir)));
    assert.equal(r.outcome, 'no-errors-so-far', f);
    assert.deepEqual(r.diagnostics, [], f);
  }
});

// (b) one handmade defect per new id ---------------------------------------------------------------

test('CCIS-V4-009: a binding on a quantity field gives exactly its rule at the binding', () => {
  const e = clone(read(ELEMENT));
  const i = e.fields.findIndex((f) => f.type === 'code');
  const j = e.fields.findIndex((f) => f.type === 'datetime');
  e.fields[j].binding = clone(e.fields[i].binding);
  const r = run(e);
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path, d.severity]), [['CCIS-V4-009', `/fields/${j}/binding`, 'error']]);
  assert.equal(r.outcome, 'failed');
  assert.equal(r.layers.semantic.outcome, 'failed');
  assert.equal(r.layers['graph-and-compatibility'].outcome, 'not-run');
});

test('CCIS-V4-009 also applies to a module field', () => {
  const e = clone(read(ELEMENT));
  const binding = clone(e.fields.find((f) => f.binding).binding);
  e.modules = [{ id: 'extra', appliesWhen: 'Only for this test.', fields: [quantityField(['min'])] }];
  e.modules[0].fields[0].binding = binding;
  const r = run(e);
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V4-009', '/modules/0/fields/0/binding']]);
});

test('CCIS-V4-010: a unit that is not UCUM gives an error at the unit (full pipeline)', () => {
  const e = clone(read(ELEMENT));
  e.fields.push(quantityField(['m/']));
  const r = run(e);
  const k = e.fields.length - 1;
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path, d.severity]), [['CCIS-V4-010', `/fields/${k}/units/0`, 'error']]);
  assert.match(r.diagnostics[0].message, /m\//);
  assert.equal(r.outcome, 'failed');
});

test('CCIS-V4-010: a unit with a space is refused by layer 4 itself (layer 2 normally stops it first)', () => {
  const e = clone(read(ELEMENT));
  e.fields.push(quantityField(['m g']));
  const d = semanticLayer(e, 'contextual-element');
  assert.deepEqual(d.map((x) => [x.ruleId, x.path, x.severity]), [['CCIS-V4-010', `/fields/${e.fields.length - 1}/units/0`, 'error']]);
  const r = run(e);
  assert.equal(r.layers.structural.outcome, 'failed'); // the schema pattern fires first; layer 4 then does not run
  assert.equal(r.layers.semantic.outcome, 'not-run');
});

test('CCIS-V4-010 is also found in analytics units (input, parameter, output, conversion)', () => {
  const a = clone(read(INTERVAL));
  a.parameters[0].units = ['min', 'h/'];
  a.outputs[0].unit = '(min';
  a.conversions[0].to = 'kmin';
  const d = semanticLayer(a, 'analytics-package').filter((x) => x.ruleId === 'CCIS-V4-010');
  assert.deepEqual(d.map((x) => x.path).sort(), ['/conversions/0/to', '/outputs/0/unit', '/parameters/0/units/1']);
});

test('CCIS-V4-011: a brace-annotated unit gives a warning, not an error, and the outcome stays no-errors-so-far', () => {
  const e = clone(read(ELEMENT));
  e.fields.push(quantityField(['{beats}/min']));
  const r = run(e);
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path, d.severity]), [['CCIS-V4-011', `/fields/${e.fields.length - 1}/units/0`, 'warning']]);
  assert.match(r.diagnostics[0].message, /not checked/);
  assert.equal(r.outcome, 'no-errors-so-far');
  assert.equal(r.layers.semantic.outcome, 'passed');
  assert.equal(r.layers['graph-and-compatibility'].outcome, 'passed');
});

// (c) table of accepted and refused unit strings ----------------------------------------------------

const unitIds = (u) => semanticLayer({ fields: [quantityField([u])] }, 'contextual-element').map((d) => d.ruleId);

const ACCEPTED = ['1', 'min', 'h', 'd', 'wk', 'mo', 'a', 's', 'ms', 'm', 'cm', 'kg', 'g', 'mg', 'L', 'dL', 'mL', 'mol', 'mmol', 'mg/dL',
  'g/L', 'mg/kg/h', 'm2', 's-1', '/min', 'm.s', '10*3/uL', '%', '(mg/kg)/h'];
const REFUSED = ['', 'm g', ' min', 'min ', 'm//s', 'm..s', 'm/', '.m', '/', '(m', 'm)', '((m)', 'kmin', 'kh', 'dd', 'm,s', 'mg;', '{a', 'a}', '{{a}}', 'm/(s'];
const UNDECIDED = ['{beats}/min', '{x}', 'zzz', '[IU]', 'mg/[IU]', 'furlong'];

for (const u of ACCEPTED) test(`unit accepted with no diagnostic: "${u}"`, () => assert.deepEqual(unitIds(u), []));
for (const u of REFUSED) test(`unit refused with CCIS-V4-010: "${u}"`, () => assert.deepEqual(unitIds(u), ['CCIS-V4-010']));
for (const u of UNDECIDED) test(`unit not decidable gives CCIS-V4-011: "${u}"`, () => assert.deepEqual(unitIds(u), ['CCIS-V4-011']));

test('a refusal wins over an undecided part: an unknown unit with a broken structure is an error', () => {
  assert.deepEqual(unitIds('zzz/'), ['CCIS-V4-010']);
});

// (d) the pure library still holds -------------------------------------------------------------------

test('the module still has no dynamic code, file access, network, clock or randomness, and imports nothing', () => {
  const src = text(new URL('../ccis-validator-semantic.js', import.meta.url));
  const forbidden = [/\beval\b/, /\bFunction\b/, /\bimport\s*\(/, /\brequire\s*\(/, /node:/, /\bfs\b/, /\bDate\b/, /Math\.random/, /performance\.now/, /\bfetch\b/, /\bprocess\b/, /XMLHttpRequest/, /WebSocket/, /localStorage/];
  for (const re of forbidden) assert.equal(re.test(src), false, String(re));
  assert.deepEqual([...src.matchAll(/^import .* from '([^']+)';$|^\} from '([^']+)';$/gm)], []);
});

test('the new checks are deterministic and do not change their input', () => {
  const e = clone(read(ELEMENT));
  e.fields.push(quantityField(['{beats}/min']), { ...quantityField(['m/']), key: 'testTwo' });
  const frozen = JSON.parse(JSON.stringify(e), (k, v) => v);
  const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };
  deepFreeze(frozen);
  assert.equal(JSON.stringify(run(frozen)), JSON.stringify(run(frozen)));
});

// (e) the catalogue -----------------------------------------------------------------------------------

test('the catalogue lists the three new ids once; only V4-011 is a warning', () => {
  const idList = RULES.map((x) => x.ruleId);
  for (const id of ['CCIS-V4-009', 'CCIS-V4-010', 'CCIS-V4-011']) assert.equal(idList.filter((x) => x === id).length, 1, id);
  const sev = Object.fromEntries(SEMANTIC_RULES.map((x) => [x.ruleId, x.severity]));
  assert.equal(sev['CCIS-V4-009'], 'error');
  assert.equal(sev['CCIS-V4-010'], 'error');
  assert.equal(sev['CCIS-V4-011'], 'warning');
});

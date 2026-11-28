// Row ECO-C11: pathway package basic-emr. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { compareRoutes } from '../ccis-compile.js';
import { SPEC, ELEMENT_IDS, build } from '../scripts/build-ecosystem-basic-emr.js';
import { text } from '../scripts/build-ecosystem-terms.js';

const read = (n) => readFileSync(new URL(`../ccis/examples/ecosystem/${n}`, import.meta.url), 'utf8');
const file = () => read('basic-emr.pathway.json');
const path = () => JSON.parse(file());
const known = () => ELEMENT_IDS.map((id) => JSON.parse(read(`${id}.element.json`)));
const rules = (r) => r.diagnostics.map((x) => x.ruleId);
const items = (p) => p.entryForm.sections.flatMap((s) => s.items);

test('1 with the six elements known: no error and no entryForm, context or reference row', () => {
  const r = validateArtefact(path(), { known: known() });
  assert.deepEqual(r.diagnostics.filter((x) => x.severity === 'error'), []);
  assert.deepEqual(rules(r).filter((x) => /^CCIS-V5-0(3\d|4\d)$|^CCIS-V3-00[45]$/.test(x)), []);
});

test('2 the file equals the script output and the SDK route equals the file route', () => {
  assert.equal(file(), text(build()));
  assert.equal(compareRoutes([{ name: 'json', input: file() }, { name: 'code', input: build() }]).identical, true);
});

test('3 manifest, element references and ranges, and the one stage match the chunk', () => {
  const p = path();
  assert.deepEqual([p.manifest.id, p.manifest.type, p.manifest.version, p.manifest.standard.version, p.manifest.status], ['basic-emr', 'pathway', '0.1.0', '0.2.0', 'draft']);
  assert.deepEqual(p.elements, ELEMENT_IDS.map((id) => ({ id, type: 'contextual-element', range: '0.1.0' })));
  assert.deepEqual(p.manifest.references, ELEMENT_IDS.map((id) => ({ id, type: 'contextual-element', version: '0.1.0' })));
  assert.equal(p.stages.length, 1);
  assert.deepEqual([p.stages[0].id, p.stages[0].kind], ['documentation', 'report']); // ED-70
});

test('4 every element is placed once; section ids are unique; exactly four section items, no care-episode', () => {
  const p = path();
  const placed = items(p).filter((i) => i.kind === 'element').map((i) => i.element);
  assert.deepEqual([...placed].sort(), [...ELEMENT_IDS].sort());
  const ids = p.entryForm.sections.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(items(p).filter((i) => i.kind === 'section').map((i) => i.section), ['core.problems', 'core.allergies', 'core.medications', 'core.investigations']);
});

test('5 every rowGroups field exists in core.vitals and is placed once', () => {
  const vit = items(path()).find((i) => i.element === 'core.vitals');
  const keys = JSON.parse(read('core.vitals.element.json')).fields.map((f) => f.key);
  const flat = vit.rowGroups.flat();
  assert.deepEqual(flat.filter((k) => !keys.includes(k)), []);
  assert.equal(new Set(flat).size, flat.length);
});

test('6 in memory: a removed element gives V5-036, an unknown section V5-041, a duplicate section id V5-042', () => {
  const run = (mut) => { const p = path(); mut(p); return rules(validateArtefact(p, { known: known() })); };
  assert.ok(run((p) => { p.elements = p.elements.filter((e) => e.id !== 'core.vitals'); }).includes('CCIS-V5-036'));
  assert.ok(run((p) => { p.entryForm.sections[0].items[2].section = 'core.nonsense'; }).includes('CCIS-V5-041'));
  assert.ok(run((p) => { p.entryForm.sections[1].id = 'history'; }).includes('CCIS-V5-042'));
});

test('7 no contexts, analytics, rules, nodes, transitions or timing; the scope says it does not authorise treatment', () => {
  const p = path();
  for (const k of ['contexts', 'analytics', 'rules', 'nodes', 'transitions', 'timing']) assert.ok(!(k in p), k);
  assert.match(p.intendedUse, /does not authorise/);
  assert.deepEqual(Object.keys(SPEC).includes('rules'), false);
});

test('8 the file is LF-only, sorted keys, no band, target or threshold word, no numeric value in the form', () => {
  const t = file();
  assert.ok(!t.includes('\r') && t.endsWith('}\n'));
  assert.equal(t, text(JSON.parse(t)));
  assert.match(t, /[Ss]ynthetic/);
  assert.doesNotMatch(t, /threshold|target|normal range|band/i);
  assert.ok(!JSON.stringify(path().entryForm, (k, v) => v).match(/:\s*-?\d/));
});

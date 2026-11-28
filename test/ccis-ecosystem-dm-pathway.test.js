// Row ECO-C12: pathway package dm. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { compareRoutes } from '../ccis-compile.js';
import { SPEC, ELEMENT_IDS, DM_IDS, build } from '../scripts/build-ecosystem-dm-pathway.js';
import { text } from '../scripts/build-ecosystem-terms.js';

const read = (n) => readFileSync(new URL(`../ccis/examples/ecosystem/${n}`, import.meta.url), 'utf8');
const file = () => read('dm.pathway.json');
const path = () => JSON.parse(file());
const known = () => ELEMENT_IDS.map((id) => JSON.parse(read(`${id}.element.json`)));
const rules = (r) => r.diagnostics.map((x) => x.ruleId);
const items = (p) => p.entryForm.sections.flatMap((s) => s.items);

test('1 with the eight elements known: no error and no entryForm, context or reference row', () => {
  const r = validateArtefact(path(), { known: known() });
  assert.deepEqual(r.diagnostics.filter((x) => x.severity === 'error'), []);
  assert.deepEqual(rules(r).filter((x) => /^CCIS-V5-0(3\d|4[0-7])$|^CCIS-V3-00[45]$/.test(x)), []);
});

test('2 the file equals the script output and the SDK route equals the file route', () => {
  assert.equal(file(), text(build()));
  assert.equal(compareRoutes([{ name: 'json', input: file() }, { name: 'code', input: build() }]).identical, true);
});

test('3 manifest, the eight references and ranges, and the one stage match the chunk', () => {
  const p = path();
  assert.deepEqual([p.manifest.id, p.manifest.type, p.manifest.version, p.manifest.standard.version, p.manifest.status], ['dm', 'pathway', '0.1.0', '0.2.0', 'draft']);
  assert.equal(ELEMENT_IDS.length, 8);
  assert.deepEqual(p.elements, ELEMENT_IDS.map((id) => ({ id, type: 'contextual-element', range: '0.1.0' })));
  assert.deepEqual(p.manifest.references, ELEMENT_IDS.map((id) => ({ id, type: 'contextual-element', version: '0.1.0' })));
  assert.equal(p.stages.length, 1);
  assert.deepEqual([p.stages[0].id, p.stages[0].kind], ['documentation', 'report']); // ED-70
});

test('4 every element placed once; section ids unique; first three sections equal basic-emr; fourth is diabetes', () => {
  const p = path();
  const base = JSON.parse(read('basic-emr.pathway.json'));
  const placed = items(p).filter((i) => i.kind === 'element').map((i) => i.element);
  assert.deepEqual([...placed].sort(), [...ELEMENT_IDS].sort());
  const ids = p.entryForm.sections.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(p.entryForm.sections.slice(0, 3), base.entryForm.sections);
  assert.equal(p.entryForm.sections.length, 4);
  assert.deepEqual([p.entryForm.sections[3].id, p.entryForm.sections[3].label], ['diabetes', 'Diabetes']);
  assert.deepEqual(p.entryForm.sections[3].items.map((i) => i.element), DM_IDS);
});

test('5 contexts is exactly the one diabetes context and every dm element is in it', () => {
  const p = path();
  assert.equal(p.contexts.length, 1);
  assert.deepEqual([p.contexts[0].id, p.contexts[0].label], ['diabetes', 'Diabetes']);
  assert.deepEqual(p.contexts[0].elements, DM_IDS);
  assert.deepEqual(p.elements.filter((e) => e.id.startsWith('dm.')).map((e) => e.id).filter((id) => !p.contexts[0].elements.includes(id)), []);
});

test('6 in memory: a context naming an absent element gives V5-044, an unknown context id V5-046, a removed dm.core V5-036', () => {
  const run = (mut) => { const p = path(); mut(p); return rules(validateArtefact(p, { known: known() })); };
  assert.ok(run((p) => { p.contexts[0].elements.push('core.nonsense'); }).includes('CCIS-V5-044'));
  assert.ok(run((p) => { p.contexts[0].id = 'not-a-known-context'; }).includes('CCIS-V5-046'));
  assert.ok(run((p) => { p.elements = p.elements.filter((e) => e.id !== 'dm.core'); }).includes('CCIS-V5-036'));
});

test('7 no analytics, rules, nodes, transitions or timing; intendedUse says it does not authorise treatment', () => {
  const p = path();
  for (const k of ['analytics', 'rules', 'nodes', 'transitions', 'timing']) assert.ok(!(k in p), k);
  assert.match(p.intendedUse, /does not authorise/);
  assert.equal('rules' in SPEC, false);
});

test('8 the file is LF-only, sorted keys, synthetic, no band, target or threshold word', () => {
  const t = file();
  assert.ok(!t.includes('\r') && t.endsWith('}\n'));
  assert.equal(t, text(JSON.parse(t)));
  assert.match(t, /[Ss]ynthetic/);
  assert.doesNotMatch(t, /threshold|target|normal range|band/i);
});

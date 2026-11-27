// Row 4.5c.2: the diabetes and CKD element group. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalize, checksumOf } from '../ccis-compile.js';
import { validateArtefact } from '../ccis-validator.js';

const dir = new URL('../ccis/examples/diabetes-ckd/', import.meta.url);
const text = (f) => readFileSync(new URL(f, dir), 'utf8');
const fileText = text('diabetes-ckd.group.json');
const doc = JSON.parse(fileText);
const dia = JSON.parse(text('diabetes.element.json'));
const ckd = JSON.parse(text('ckd.element.json'));
const PINNED = 'sha256:8dba1987e9f3600e768697b06e5a072e36c99b0d199c9a7b6bd99e796e2efaff';
const run = (g) => validateArtefact(g, { known: [dia, ckd] });
const mutate = (fn) => { const g = JSON.parse(fileText); fn(g); return g; };

test('4.5c.2: the file validates through every layer with no diagnostic row', () => {
  const r = run(doc);
  assert.deepEqual(r.diagnostics, []);
  for (const [layer, v] of Object.entries(r.layers)) assert.notEqual(v.outcome, 'failed', layer);
});

test('4.5c.2: canonical bytes are stable and the checksum is pinned', () => {
  const a = canonicalize(doc);
  assert.equal(a.ok, true);
  assert.equal(canonicalize(JSON.parse(fileText)).text, a.text);
  assert.equal(checksumOf(a.text), PINNED);
});

test('4.5c.2: the file is its own sorted two-space form', () => {
  const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
  assert.equal(fileText, `${JSON.stringify(sorted(doc), null, 2)}\n`);
});

test('4.5c.2: two members in order, mandatory then optional, versions pinned', () => {
  assert.deepEqual(doc.members.map((m) => [m.element.id, m.required]), [[dia.manifest.id, true], [ckd.manifest.id, false]]);
  for (const m of doc.members) assert.deepEqual([m.element.version, 'range' in m.element], ['0.1.0', false]);
});

test('4.5c.2: two shared concepts, both related-not-merged, none by label', () => {
  assert.deepEqual(doc.sharedConcepts.map((c) => [c.concept, c.resolution]), [['diagnosisDates', 'related-not-merged'], ['plannedFollowUp', 'related-not-merged']]);
  assert.equal(/"label"/.test(fileText), false);
});

test('4.5c.2: concept fields exist and every key both elements define is listed', () => {
  const keys = (e) => e.fields.map((f) => f.key);
  const listed = new Set(doc.sharedConcepts.flatMap((c) => c.fields.map((f) => `${f.element}/${f.field}`)));
  for (const c of doc.sharedConcepts) for (const f of c.fields) assert.ok(keys(f.element === dia.manifest.id ? dia : ckd).includes(f.field), f.field);
  for (const k of keys(dia).filter((x) => keys(ckd).includes(x))) assert.ok(listed.has(`${dia.manifest.id}/${k}`) && listed.has(`${ckd.manifest.id}/${k}`), k);
});

test('4.5c.2: removing the diagnosisDates concept leaves an undeclared overlap', () => {
  const r = run(mutate((g) => { g.sharedConcepts.shift(); }));
  assert.deepEqual(r.diagnostics.map((d) => d.ruleId), ['CCIS-V5-012']);
});

test('4.5c.2: flipping a concept to same-concept passes the validator but changes the checksum', () => {
  const g = mutate((x) => { x.sharedConcepts[0].resolution = 'same-concept'; });
  assert.deepEqual(run(g).diagnostics.filter((d) => d.severity === 'error'), []);
  assert.notEqual(checksumOf(canonicalize(g).text), PINNED);
  assert.match(doc.sharedConcepts[0].meaning, /different|never one value/);
});

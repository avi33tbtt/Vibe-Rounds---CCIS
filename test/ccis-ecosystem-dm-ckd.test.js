// Row ECO-C14: composed pathway dm-ckd. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { canonicalize } from '../ccis-compile.js';
import { composePathway } from '../ccis-compose-pathway.js';
import { build, IDS } from '../scripts/build-ecosystem-dm-ckd.js';

const rd = (u) => readFileSync(new URL(u, import.meta.url), 'utf8');
const eco = (n) => rd(`../ccis/examples/ecosystem/${n}`);
const elements = () => IDS.map((id) => JSON.parse(eco(`${id}.element.json`)));
const group = () => JSON.parse(eco('dm-ckd.group.json'));
const path = () => JSON.parse(eco('dm-ckd.pathway.json'));
const dm = () => JSON.parse(eco('dm.pathway.json'));
const ckd = () => JSON.parse(eco('ckd.pathway.json'));
const rules = (r) => r.diagnostics.map((x) => x.ruleId);

test('1 the conflict report equals the hand-written fixture', () => {
  assert.deepEqual(build().report, JSON.parse(rd('../ccis/fixtures/ecosystem/dm-ckd.conflict-report.expected.json')));
});

test('2 group and pathway files equal the script output; the group validates with no error', () => {
  const r = build();
  assert.equal(eco('dm-ckd.group.json'), r.group.bytes + '\n');
  assert.equal(eco('dm-ckd.pathway.json'), r.pathway.bytes + '\n');
  assert.deepEqual(validateArtefact(group(), { known: elements() }).diagnostics.filter((x) => x.severity === 'error'), []);
});

test('3 the pathway validates with no error and no entryForm, context or reference row', () => {
  const r = validateArtefact(path(), { known: [group(), dm(), ckd(), ...elements()] });
  assert.deepEqual(r.diagnostics.filter((x) => x.severity === 'error'), []);
  assert.deepEqual(rules(r).filter((x) => /^CCIS-V5-0(3\d|4[0-7])$/.test(x)), []);
});

test('4 ten members, six required and four not; no shared concept', () => {
  const g = group();
  assert.deepEqual(g.members.map((m) => m.element.id), IDS);
  assert.deepEqual(g.members.map((m) => m.required), [true, true, true, true, true, true, false, false, false, false]);
  assert.deepEqual(g.sharedConcepts, []);
});

test('5 references, sections, contexts and placements', () => {
  const p = path();
  assert.deepEqual(p.manifest.references.map((r) => r.id), ['dm-ckd.group', 'dm', 'ckd']);
  assert.deepEqual(p.entryForm.sections.map((s) => s.id), ['history', 'examination', 'assessment', 'diabetes', 'ckd']);
  assert.deepEqual(p.contexts.map((c) => c.id), ['diabetes', 'ckd']);
  const placed = p.entryForm.sections.flatMap((s) => s.items).filter((i) => i.kind === 'element').map((i) => i.element);
  assert.deepEqual([...placed].sort(), [...IDS].sort());
  const base = JSON.parse(eco('basic-emr.pathway.json'));
  assert.deepEqual(p.entryForm.sections.slice(0, 3), base.entryForm.sections);
});

test('6 byte determinism: two builds and a reversed element list give equal bytes', () => {
  const a = build();
  assert.equal(a.pathway.bytes, build().pathway.bytes);
  const b = build([...elements()].reverse());
  assert.equal(a.group.bytes, b.group.bytes);
  assert.equal(a.pathway.bytes, b.pathway.bytes);
});

test('7 in memory: a missing ckd.core gives missing-element; an empty scope gives missing-text', () => {
  const r = build(elements().filter((e) => e.manifest.id !== 'ckd.core'));
  assert.equal(r.group.ok, false);
  assert.ok(r.group.blockers.some((b) => b.status === 'missing-element'));
  const bad = composePathway({ manifest: { id: 'dm-ckd', name: 'x', version: '0.1.0', publisher: { name: 'p' }, standardVersion: '0.2.0' }, scope: '', intendedUse: 'x', exclusions: ['x'], stages: dm().stages, group: group(), pathways: [dm(), ckd()], elements: elements() });
  assert.equal(bad.ok, false);
  assert.ok(bad.blockers.some((b) => b.status === 'missing-text'));
});

test('8 files are LF-only with sorted keys; synthetic; no band, target or threshold word', () => {
  for (const n of ['dm-ckd.group.json', 'dm-ckd.pathway.json']) {
    const t = eco(n);
    assert.ok(!t.includes('\r') && t.endsWith('}\n') && t.indexOf('\n') === t.length - 1, n);
    assert.equal(t, canonicalize(JSON.parse(t)).text + '\n');
    assert.doesNotMatch(t, /threshold|target|normal range|band/i);
  }
  assert.match(eco('dm-ckd.group.json') + eco('dm-ckd.pathway.json'), /[Ss]ynthetic/);
});

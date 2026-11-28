// Row ECO-C15: the ecosystem market folder (market-ecosystem/). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { checksumOf } from '../ccis-compile.js';
import { lintArtefact } from '../ccis-market.js';
import { buildMarket, main as buildMain, marketFiles, ECO_ORDER } from '../scripts/market-build.js';

const dir = new URL('../market-ecosystem/', import.meta.url);
const text = (u) => readFileSync(u, 'utf8');
const walk = (d, base = '') => readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const rel = base === '' ? e.name : `${base}/${e.name}`;
  return e.isDirectory() ? walk(new URL(`${e.name}/`, d), rel) : [rel];
});
const index = () => JSON.parse(text(new URL('index.json', dir)));
const quiet = (f) => { const e = console.error, l = console.log; console.error = console.log = () => {}; try { return f(); } finally { console.error = e; console.log = l; } };
const IDS = ['core.presentation', 'core.examination', 'core.assessment-plan', 'core.vitals', 'core.fluid-balance', 'core.event-times', 'dm.core', 'dm.glycaemic-monitoring', 'ckd.core', 'ckd.kidney-function', 'htn.core', 'basic-emr', 'dm', 'ckd', 'dm-ckd.group', 'dm-ckd'];

test('1 sixteen entries: the ids and versions as listed, all passed, all draft', () => {
  const got = buildMarket('ecosystem').index.entries.map((e) => `${e.id}@${e.version}`).sort();
  assert.deepEqual(got, IDS.map((i) => `${i}@0.1.0`).sort());
  for (const e of index().entries) { assert.equal(e.validation.outcome, 'passed', e.id); assert.equal(e.status, 'draft', e.id); }
});

test('2 --check passes on the committed folder', () => {
  assert.equal(quiet(() => buildMain(['--set', 'ecosystem', '--check'])), 0);
});

test('3 the folder equals a fresh build byte for byte, and two builds are equal', () => {
  const a = marketFiles(buildMarket('ecosystem'));
  assert.deepEqual(a, marketFiles(buildMarket('ecosystem')));
  assert.deepEqual(Object.keys(a).sort(), walk(dir).filter((r) => r !== '.gitattributes').sort());
  for (const [rel, t] of Object.entries(a)) assert.equal(text(new URL(rel, dir)), t, rel);
});

test('4 every entry checksum equals the checksum of its published file', () => {
  for (const e of index().entries) {
    const c = checksumOf(text(new URL(e.path, dir)));
    assert.equal(c.ok ? c.checksum : c, e.checksum, e.id);
  }
});

test('5 every reference in the index resolves to an entry with the same id, type and version', () => {
  const entries = index().entries;
  for (const e of entries) for (const r of e.references) assert.ok(entries.some((x) => x.id === r.id && x.type === r.type && x.version === r.version), `${e.id} -> ${r.id}`);
  assert.deepEqual(entries.find((e) => e.id === 'dm-ckd').references.map((r) => r.id), ['dm-ckd.group', 'dm', 'ckd']);
});

test('6 the terminology package is absent from the order, the index and the folder', () => {
  assert.ok(!ECO_ORDER.some((n) => /terminology/.test(n)));
  assert.ok(!index().entries.some((e) => e.type === 'terminology-package'));
  assert.ok(!walk(dir).some((r) => /terminolog|local-terms/.test(r)));
});

test('7 the other two sets still match a fresh build', () => {
  assert.equal(quiet(() => buildMain(['--check'])), 0);
  assert.equal(quiet(() => buildMain(['--set', 'diabetes-ckd', '--check'])), 0);
  assert.equal(quiet(() => buildMain(['--set', 'nope'])), 1);
});

test('8 LF-only, synthetic, no band, target or threshold word in pathways and the group, and the patient-data screen finds nothing', () => {
  for (const rel of walk(dir).filter((r) => r.endsWith('.json'))) {
    const t = text(new URL(rel, dir));
    assert.ok(!t.includes('\r'), rel);
    // Elements may say "no band or threshold" in their rationale (a denial), so the word check covers pathways and the group only.
    if (/^artefacts\/(basic-emr|dm|ckd|dm-ckd|dm-ckd\.group)\//.test(rel)) assert.doesNotMatch(t, /threshold|target|normal range|\bband\b/i, rel);
    if (rel.startsWith('artefacts/')) assert.deepEqual(lintArtefact(JSON.parse(t)).findings ?? [], [], rel);
  }
  assert.match(text(new URL('artefacts/dm-ckd/0.1.0.json', dir)), /[Ss]ynthetic/);
});

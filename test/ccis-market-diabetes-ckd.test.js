// Row 4.5g: the diabetes and CKD market folder (market-diabetes-ckd/). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadMarket, indexText, resolve, pin, verifyPin, publishArtefact, lintArtefact } from '../ccis-market.js';
import { buildMarket, main as buildMain, marketFiles } from '../scripts/market-build.js';

const SET = 'diabetes-ckd';
const dir = new URL('../market-diabetes-ckd/', import.meta.url);
const text = (u) => readFileSync(u, 'utf8');
function readFolder() {
  const files = {};
  const walk = (d, base) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const rel = base === '' ? e.name : `${base}/${e.name}`;
      if (e.isDirectory()) walk(new URL(`${e.name}/`, d), rel);
      else if (rel !== 'index.json' && e.name !== '.gitattributes') files[rel] = text(new URL(rel, dir));
    }
  };
  walk(dir, '');
  return { indexText: text(new URL('index.json', dir)), files };
}
const REAL = (() => { const r = loadMarket(readFolder()); assert.equal(r.ok, true, JSON.stringify(r)); return r.market; })();
const EL = ['ckd.kidney-function-documentation', 'diabetes.glycaemia-documentation'];
const AN = 'diabetes-ckd.sample-gap';

test('(1) six entries, ids and versions as listed, every layer passed, all draft', () => {
  const got = REAL.index.entries.map((e) => `${e.id}@${e.version}`).sort();
  assert.deepEqual(got, [...EL.map((i) => `${i}@0.1.0`), ...['0.1.0', '0.1.1', '0.1.2', '0.1.3'].map((v) => `${AN}@${v}`)].sort());
  for (const e of REAL.index.entries) {
    assert.equal(e.validation.outcome, 'passed', e.id);
    assert.equal(e.status, 'draft', e.id);
  }
});

test('(2) the committed folder equals a fresh build (--check passes; two builds are byte-identical)', () => {
  assert.equal(buildMain(['--set', SET, '--check']), 0);
  const a = buildMarket(SET);
  assert.equal(indexText(a), indexText(buildMarket(SET)));
  assert.equal(indexText(a), indexText(REAL));
  assert.deepEqual(a.files, REAL.files);
  assert.deepEqual(Object.keys(marketFiles(a)).length, 7);
});

test('(3) loadMarket accepts the folder and every pinned checksum verifies', () => {
  for (const e of REAL.index.entries) {
    const p = pin({ market: REAL, ref: { id: e.id, type: e.type, version: e.version } });
    assert.equal(p.ok, true, e.id);
    assert.equal(verifyPin({ market: REAL, pin: p.pin }).ok, true, e.id);
  }
});

test('(4) the default build is still the committed snake market (market/ untouched)', () => {
  assert.equal(buildMain(['--check']), 0);
  assert.equal(buildMain(['--set', 'snake', '--check']), 0);
  assert.ok(buildMarket().index.entries.every((e) => e.id.startsWith('snake.')));
});

test('(5) the group file now publishes into a copy of the market (row B15b); the committed folder is untouched', () => {
  const group = JSON.parse(text(new URL('../ccis/examples/diabetes-ckd/diabetes-ckd.group.json', import.meta.url)));
  const r = publishArtefact({ market: buildMarket(SET), artefact: group });
  assert.equal(r.ok, true, JSON.stringify(r.refusal));
  assert.equal(r.entry.type, 'element-group');
  assert.equal(REAL.index.entries.some((e) => e.type === 'element-group'), false);
});

test('(6) every analytics version references both elements; 0.1.3 declares the unit conversions', () => {
  for (const e of REAL.index.entries.filter((x) => x.id === AN)) {
    assert.deepEqual(e.references.map((r) => r.id).sort(), EL, e.version);
  }
  const r = resolve({ market: REAL, ref: { id: AN, type: 'analytics-package', version: '0.1.3' } });
  assert.equal(r.ok, true);
  const ids = r.artefact.conversions.map((c) => c.id);
  assert.deepEqual(ids, ['hoursToMinutes', 'mgdlToUmolL', 'mmolLToMgdL']);
  const old = resolve({ market: REAL, ref: { id: AN, type: 'analytics-package', version: '0.1.2' } });
  assert.deepEqual(old.artefact.conversions.map((c) => c.id), ['hoursToMinutes']);
});

test('(7) an unknown --set name refuses; every artefact passes the patient-data screen', () => {
  assert.equal(buildMain(['--set', 'nope']), 1);
  assert.equal(buildMain(['--set']), 1);
  for (const f of Object.values(REAL.files)) assert.deepEqual(lintArtefact(JSON.parse(f)), { ok: true, findings: [] });
});

test('(8) the script uses no clock, network or random source', () => {
  const src = text(new URL('../scripts/market-build.js', import.meta.url));
  for (const bad of ['Date.now', 'new Date', 'Math.random', 'fetch(', 'node:http', 'node:https', 'node:net', 'randomUUID']) {
    assert.equal(src.includes(bad), false, bad);
  }
});

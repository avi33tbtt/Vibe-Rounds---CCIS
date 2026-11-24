// Row 3.8b.1: envelope import view (module only, not wired). Prototype. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { importEnvelope } from '../ccis-import.js';
import { heldFromMarket, importReportView } from '../ccis-app-import-report.js';
import { mountImportView } from '../ccis-app-import-view.js';

const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
const files = {};
for (const e of idx.entries) files[e.path] = readFileSync(join('market', e.path), 'utf8');
const MARKET = { index: idx, files };
const ENV_PATH = 'ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json';
const ENV_TEXT = readFileSync(ENV_PATH, 'utf8');

function setup(market = MARKET) {
  const { document } = new JSDOM('<!doctype html><body><div id="r"></div>').window;
  const root = document.getElementById('r');
  const states = [];
  mountImportView({ document, root, getMarket: () => market, onState: (s) => states.push(s) });
  const input = root.querySelector('input');
  const pick = (file) => {
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new document.defaultView.Event('change'));
  };
  const last = () => states[states.length - 1];
  const settle = () => new Promise((r) => setTimeout(r, 10));
  return { root, input, pick, last, settle, document };
}
const fileOf = (text, name = 'secret-name.json') => ({ name, size: text.length, text: async () => text });

test('real market and a snake envelope: counts equal the pure view', async () => {
  const t = setup();
  t.pick(fileOf(ENV_TEXT));
  await t.settle();
  const v = importReportView(importEnvelope(JSON.parse(ENV_TEXT), { held: heldFromMarket(MARKET) }));
  assert.equal(t.last().imported, true);
  assert.equal(t.last().accepted, v.counts.accepted);
  assert.equal(t.last().rejected, v.counts.rejected);
  assert.match(t.root.textContent, new RegExp(`${v.counts.accepted} accepted, ${v.counts.rejected} rejected`));
});

test('no market: fixed sentence, nothing imported, nothing read', async () => {
  const t = setup(null);
  let read = false;
  t.pick({ name: 'a.json', size: 10, text: async () => { read = true; return '{}'; } });
  await t.settle();
  assert.equal(read, false);
  assert.equal(t.last().imported, false);
  assert.match(t.root.textContent, /Load a market first/);
});

test('invalid JSON: fixed sentence, parser message absent', async () => {
  const t = setup();
  t.pick(fileOf('{ not json'));
  await t.settle();
  assert.match(t.root.textContent, /The file is not valid JSON\./);
  assert.doesNotMatch(t.root.textContent, /position|Unexpected|token/i);
  assert.equal(t.last().refused, true);
});

test('file over 5 MB is refused and never read', async () => {
  const t = setup();
  t.pick({ name: 'big.json', size: 5 * 1024 * 1024 + 1, text: async () => { throw new Error('read'); } });
  await t.settle();
  assert.match(t.root.textContent, /larger than 5 MB/);
  assert.equal(t.last().refused, true);
});

test('sentinel value, unit and concept text never appear', async () => {
  const env = JSON.parse(ENV_TEXT);
  env.observations[0].concept.id = 'SENTINEL-CONCEPT';
  env.observations[0].concept.codes = [{ system: 'SENTINEL-SYSTEM', code: 'SENTINEL-CODE' }];
  env.observations[0].value = { value: 'SENTINEL-VALUE', unit: 'SENTINEL-UNIT' };
  const t = setup();
  t.pick(fileOf(JSON.stringify(env)));
  await t.settle();
  assert.doesNotMatch(t.root.textContent, /SENTINEL/);
});

test('a second pick before the first resolves: only the second is shown', async () => {
  const t = setup();
  let release;
  const slow = { name: 'slow.json', size: 5, text: () => new Promise((r) => { release = () => r('{ bad'); }) };
  t.pick(slow);
  t.pick(fileOf(ENV_TEXT));
  await t.settle();
  release();
  await t.settle();
  assert.equal(t.last().imported, true);
  assert.doesNotMatch(t.root.textContent, /not valid JSON/);
});

test('Clear empties the box and state; the file name is never shown', async () => {
  const t = setup();
  t.pick(fileOf(ENV_TEXT, 'patient-john.json'));
  await t.settle();
  assert.doesNotMatch(t.root.textContent, /patient-john/);
  t.root.querySelector('button').click();
  assert.equal(t.root.querySelector('div').textContent, '');
  assert.equal(t.last().imported, false);
  assert.equal(t.last().message, 'No envelope is loaded.');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importEnvelope } from '../ccis-import.js';
import { resolveCompatibility, OUTCOMES } from '../ccis-compat.js';
import { CLI_RUNTIME } from '../ccis-cli-flow.js';
import { heldFromMarket } from '../ccis-app-import-report.js';
import { APP_RUNTIME, compatibilityFor, catalogueModel } from '../ccis-app-catalogue.js';

const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
const files = Object.fromEntries(idx.entries.map((e) => [e.path, readFileSync(`market/${e.path}`, 'utf8')]));
const market = { index: idx, files };
const KEY = 'snake.documentation-path@0.1.0';
const held = heldFromMarket(market);
const context = importEnvelope(JSON.parse(readFileSync('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json', 'utf8')), { held }).context;
const pathway = JSON.parse(files[idx.entries.find((e) => `${e.id}@${e.version}` === KEY).path]);
const direct = (ctx) => resolveCompatibility({ pathway, held, context: ctx, runtime: CLI_RUNTIME, request: { mode: 'preview' } });
const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };

test('compatibilityFor gives the three fixed sentences', () => {
  assert.deepEqual(compatibilityFor({ market: null, pathwayKey: KEY }), { ok: false, sentence: 'Load a market first.' });
  assert.deepEqual(compatibilityFor({ market }), { ok: false, sentence: 'Choose a pathway first.' });
  assert.deepEqual(compatibilityFor({ market, pathwayKey: 'nope@1.0.0' }), { ok: false, sentence: 'The chosen pathway is not in the market.' });
});

test('with the market, the pathway and the imported context: three rows equal the direct result', () => {
  const r = compatibilityFor({ market, pathwayKey: KEY, context });
  assert.equal(r.ok, true);
  const m = catalogueModel(r.result);
  const d = direct(context);
  assert.equal(m.rows.length, 3);
  assert.deepEqual(m.rows.map((x) => x.outcome), [d.pathway, ...d.packages].map((e) => e.outcome));
  m.rows.forEach((x) => assert.equal(x.label, OUTCOMES[x.outcome]));
  assert.equal(Object.values(m.counts).reduce((a, b) => a + b, 0), 3);
  assert.ok(m.banners.length >= 1);
});

test('with no context the packages need data (the pathway row reads as the core result gives it, finding F-12)', () => {
  const m = catalogueModel(compatibilityFor({ market, pathwayKey: KEY, context: null }).result);
  assert.deepEqual(m.rows.map((x) => x.outcome), [direct(null).pathway.outcome, 'needs-data', 'needs-data']);
  assert.ok(m.rows.slice(1).every((x) => x.explanations.some((e) => e.reason === 'CMP-4-01')));
  assert.deepEqual(m.groups['needs-data'], [1, 2]);
});

test('an unknown reason and an unknown outcome are shown as unrecognised, never as compatible', () => {
  const entry = (outcome, reason) => ({ ref: { id: 'x', type: 'analytics-package', version: '1.0.0' }, outcome, checks: [{ name: 'artefact', findings: [{ reason, state: 'not-met', detail: 'd', needs: 'n' }] }], satisfied: [], needed: [], policy: { mayRun: true, banners: [] } });
  const m = catalogueModel({ pathway: entry('mystery', 'CMP-9-99'), packages: [] });
  assert.equal(m.rows[0].outcome, 'other');
  assert.equal(m.rows[0].label, 'Unrecognised outcome');
  assert.equal(m.rows[0].explanations[0].meaning, 'The reason is not recognised by this version of the page.');
  assert.deepEqual(m.groups.other, [0]);
  assert.deepEqual([m.groups.compatible, m.groups['compatible-with-limitations']], [[], []]);
});

test('the model leaves a frozen input alone and gives the same JSON twice', () => {
  const result = deepFreeze(JSON.parse(JSON.stringify(direct(context))));
  assert.equal(JSON.stringify(catalogueModel(result)), JSON.stringify(catalogueModel(result)));
});

test('a hostile string in detail stays a plain string', () => {
  const bad = '<img src=x onerror=1>';
  const m = catalogueModel({ pathway: { ref: { id: 'p', type: 'pathway', version: '1.0.0' }, outcome: 'incompatible', checks: [{ name: 'artefact', findings: [{ reason: 'CMP-1-01', state: 'not-met', detail: bad, needs: bad }] }], policy: { banners: [] } }, packages: [] });
  assert.equal(m.rows[0].explanations[0].detail, bad);
  assert.equal(typeof m.rows[0].explanations[0].needs, 'string');
});

test('APP_RUNTIME equals CLI_RUNTIME', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(APP_RUNTIME)), JSON.parse(JSON.stringify(CLI_RUNTIME)));
});

test('ccis-app-catalogue.js uses no node module, page, storage, network, clock or dynamic code', () => {
  const src = readFileSync('ccis-app-catalogue.js', 'utf8');
  for (const word of ['node:', 'document', 'window', 'localStorage', 'sessionStorage', 'fetch', 'eval', 'Date', 'Math.random', 'import(']) assert.equal(src.includes(word), false, word);
});

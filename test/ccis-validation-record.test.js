// Row 2.3a: the validation record writer. Prototype. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateArtefact, RULES, LAYER_NAMES } from '../ccis-validator.js';
import { SUPPORTED_STANDARD_MAJORS } from '../ccis-validator-semantic.js';
import { validationRecord as vRecord } from '../ccis/validators/ccis-validators.js';
import { buildValidationRecord, recordText, recordPath, toRecordRuleId, fromRecordRuleId, STANDARD_VERSION, VALIDATOR } from '../ccis-validation-record.js';
import { main } from '../ccis-cli.js';

const snakeDir = new URL('../ccis/examples/snake/', import.meta.url);
const invalidDir = new URL('../ccis/examples/invalid/', import.meta.url);
const fixtureDir = new URL('../ccis/fixtures/snake/', import.meta.url);
const text = (u) => readFileSync(u, 'utf8');
const read = (u) => JSON.parse(text(u));
const clone = (x) => JSON.parse(JSON.stringify(x));
const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };

const snakeFiles = readdirSync(snakeDir).filter((f) => f.endsWith('.json')).sort();
const known = deepFreeze(snakeFiles.map((f) => read(new URL(f, snakeDir))));
const fixtures = read(new URL('index.json', fixtureDir)).cases.map((c) => c.case);
const validate = (input) => validateArtefact(input, { known, fixtures });
const record = (doc) => { const r = buildValidationRecord(doc, validate(doc)); assert.equal(r.ok, true, r.reason); return r.record; };
const schemaOk = (rec, label) => assert.equal(vRecord(rec), true, `${label}: ${JSON.stringify(vRecord.errors?.slice(0, 2))}`);
const NOT_ASSESSED = ['clinical', 'execution', 'security-privacy'];

// (a) valid artefacts ------------------------------------------------------------------------------

const WITH_MANIFEST = snakeFiles.filter((f) => 'manifest' in read(new URL(f, snakeDir)));
const WITHOUT_MANIFEST = snakeFiles.filter((f) => !WITH_MANIFEST.includes(f));

test('every valid snake artefact with a manifest gives a schema-valid record: passed, software members met, the other three not assessed', () => {
  assert.ok(WITH_MANIFEST.length >= 6);
  for (const f of WITH_MANIFEST) {
    const doc = read(new URL(f, snakeDir));
    const rec = record(doc);
    schemaOk(rec, f);
    assert.equal(rec.outcome, 'passed', f);
    assert.deepEqual(rec.subject, { id: doc.manifest.id, type: doc.manifest.type, version: doc.manifest.version });
    assert.deepEqual(rec.standard, { version: STANDARD_VERSION });
    assert.deepEqual(rec.validator, VALIDATOR);
    assert.deepEqual(Object.keys(rec.assurance).sort(), ['clinical', 'execution', 'security-privacy', 'semantic', 'structural']);
    for (const n of ['structural', 'semantic']) {
      assert.equal(rec.assurance[n].result, 'met', `${f} ${n}`);
      assert.equal(rec.assurance[n].scope.version, doc.manifest.version);
      assert.match(rec.assurance[n].assessedBy, /software/);
    }
    for (const n of NOT_ASSESSED) {
      assert.equal(rec.assurance[n].result, 'not-assessed', `${f} ${n}`);
      assert.ok(rec.assurance[n].conditions.length === 1);
    }
    for (const n of LAYER_NAMES) assert.equal(rec.layers[n].outcome, 'passed', `${f} ${n}`);
  }
});

test('a decision node or terminology binding has no manifest, so no record is written, with a reason', () => {
  assert.ok(WITHOUT_MANIFEST.length >= 3);
  for (const f of WITHOUT_MANIFEST) {
    const doc = read(new URL(f, snakeDir));
    const r = buildValidationRecord(doc, validate(doc));
    assert.equal(r.ok, false, f);
    assert.match(r.reason, /no manifest/, f);
    assert.equal('record' in r, false);
  }
});

// (b) invalid examples ---------------------------------------------------------------------------------

const CASES = [['3-reference-integrity', 'reference-integrity'], ['4-semantic', 'semantic'], ['5-graph-and-compatibility', 'graph-and-compatibility'],
  ['6-executable-safety', 'executable-safety'], ['7-test-verification', 'test-verification'], ['8-governance', 'governance']];
for (const [dir, layer] of CASES) {
  for (const f of readdirSync(new URL(`${dir}/`, invalidDir)).filter((x) => !x.includes('expected'))) {
    test(`${dir}/${f}: a schema-valid record with ${layer} failed, later layers not run with a reason, outcome failed`, () => {
      const doc = read(new URL(`${dir}/${f}`, invalidDir));
      const rec = record(doc);
      schemaOk(rec, f);
      assert.equal(rec.outcome, 'failed');
      assert.equal(rec.layers[layer].outcome, 'failed');
      assert.ok(rec.layers[layer].diagnostics.some((d) => d.severity === 'error'));
      LAYER_NAMES.slice(LAYER_NAMES.indexOf(layer) + 1).forEach((n) => {
        assert.equal(rec.layers[n].outcome, 'not-run', n);
        assert.ok(rec.layers[n].reason.length > 0, n);
      });
      for (const n of NOT_ASSESSED) assert.equal(rec.assurance[n].result, 'not-assessed');
      if (['reference-integrity', 'semantic', 'graph-and-compatibility'].includes(layer)) {
        const member = layer === 'reference-integrity' ? 'structural' : 'semantic';
        assert.equal(rec.assurance[member].result, 'not-met');
        assert.ok(rec.assurance[member].evidence.length >= 1);
      }
    });
  }
}

// (c) refusals: a record must attach to one exact artefact version ---------------------------------------

test('a layer 1 failure, a layer 2 failure, a non-object and a missing manifest give no record, each with a reason', () => {
  const syntax = text(new URL('1-syntax/interval-truncated.json.txt', invalidDir));
  const structural = read(new URL('2-structural/parameter-carries-value.json', invalidDir));
  const cases = [[null, validate(syntax)], [structural, validate(structural)], [[1], validate('[1]')], [{ x: 1 }, validate({ x: 1 })]];
  for (const [doc, result] of cases) {
    const r = buildValidationRecord(doc, result);
    assert.equal(r.ok, false);
    assert.match(r.reason, /^No validation record was written/);
  }
});

test('a result that does not list all eight layers gives no record', () => {
  const doc = read(new URL('snake-interval.analytics.0.1.1.json', snakeDir));
  const r = validate(doc);
  const cut = { ...r, layers: Object.fromEntries(Object.entries(r.layers).slice(0, 6)) };
  assert.equal(buildValidationRecord(doc, cut).ok, false);
  assert.equal(buildValidationRecord(doc, null).ok, false);
});

// (d) rule ids and paths --------------------------------------------------------------------------------

test('every catalogue rule id maps to a record id and back; other text is not an id', () => {
  for (const x of RULES) {
    const out = toRecordRuleId(x.ruleId);
    assert.match(out, /^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$/, x.ruleId);
    assert.equal(fromRecordRuleId(out), x.ruleId);
  }
  assert.equal(toRecordRuleId('nonsense'), null);
  assert.equal(fromRecordRuleId('ccis.x'), null);
  assert.equal(toRecordRuleId('CCIS-V4-009'), 'ccis.v4-009');
});

test('a layer 1 { line, column } path becomes the top level plus a position; a pointer is kept', () => {
  assert.deepEqual(recordPath({ line: 3, column: 7 }), { path: '', position: { line: 3, column: 7 } });
  assert.deepEqual(recordPath('/a/b'), { path: '/a/b' });
  assert.deepEqual(recordPath(undefined), { path: '' });
});

// (e) determinism and purity ---------------------------------------------------------------------------

test('the record text is byte-identical on two runs and the inputs are not changed', () => {
  const doc = deepFreeze(clone(read(new URL('snake-interval.analytics.0.1.1.json', snakeDir))));
  const result = deepFreeze(clone(validate(doc)));
  const a = recordText(buildValidationRecord(doc, result).record);
  const b = recordText(buildValidationRecord(doc, result).record);
  assert.equal(a, b);
  assert.ok(a.endsWith('}\n'));
  assert.equal(a.indexOf('\n'), a.length - 1);
  const keys = Object.keys(JSON.parse(a));
  assert.deepEqual(keys, keys.slice().sort());
});

test('the constants stay inside what the validator supports', () => {
  assert.ok(SUPPORTED_STANDARD_MAJORS.includes(Number(STANDARD_VERSION.split('.')[0])));
  assert.match(VALIDATOR.version, /^\d+\.\d+\.\d+$/);
});

test('the module has no dynamic code, file access, network, clock or randomness, and imports nothing', () => {
  const src = text(new URL('../ccis-validation-record.js', import.meta.url));
  const forbidden = [/\beval\b/, /\bFunction\b/, /\bimport\s*\(/, /\brequire\s*\(/, /node:/, /\bfs\b/, /\bDate\b/, /Math\.random/, /performance\.now/, /\bfetch\b/, /\bprocess\b/, /XMLHttpRequest/, /WebSocket/, /localStorage/];
  for (const re of forbidden) assert.equal(re.test(src), false, String(re));
  assert.deepEqual([...src.matchAll(/^import .* from '([^']+)';$|^\} from '([^']+)';$/gm)], []);
});

// (f) warnings are shown where the member is -------------------------------------------------------------

test('a warning of layer 4 appears in the conditions of the semantic member, and the record is still schema-valid', () => {
  const e = clone(read(new URL('snake-envenomation.element.json', snakeDir)));
  e.fields.push({ key: 'testQuantity', label: 'A test quantity', type: 'quantity', cardinality: { min: 0, max: 1 }, units: ['{beats}/min'], epistemic: ['absent'], sourceClasses: ['clinician-entered'] });
  const rec = record(e);
  schemaOk(rec, 'warning case');
  assert.equal(rec.outcome, 'passed');
  assert.equal(rec.assurance.semantic.result, 'met');
  assert.equal(rec.assurance.semantic.conditions.length, 1);
  assert.match(rec.assurance.semantic.conditions[0], /ccis\.v4-011/);
  assert.equal('conditions' in rec.assurance.structural, false);
  assert.equal(rec.layers.semantic.diagnostics[0].ruleId, 'ccis.v4-011');
});

// (g) the CLI --record option ------------------------------------------------------------------------------

const cli = (args) => {
  const o = []; const e = [];
  const code = main(args, { out: (s) => o.push(s), err: (s) => e.push(s) });
  return { code, out: o.join('\n'), err: e.join('\n') };
};
const path = (u) => fileURLToPath(u);

test('CLI: --record writes a canonical record, accepts the same bytes again, refuses a different file, and says why a file has none', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccis-rec-'));
  try {
    const file = path(new URL('snake-interval.analytics.0.1.1.json', snakeDir));
    const node = path(new URL('snake-node-clotting.node.json', snakeDir));
    const first = cli(['validate', file, node, '--known', path(snakeDir), '--record', dir]);
    assert.equal(first.code, 0);
    assert.match(first.err, /snake-node-clotting\.node\.json: No validation record was written/);
    const target = join(dir, 'snake-interval.analytics.0.1.1.validation-record.json');
    const bytes = text(target);
    assert.equal(bytes, recordText(JSON.parse(bytes)));
    schemaOk(JSON.parse(bytes), 'cli');
    assert.equal(existsSync(join(dir, 'snake-node-clotting.node.validation-record.json')), false);
    assert.equal(cli(['validate', file, '--known', path(snakeDir), '--record', dir]).code, 0);
    writeFileSync(target, '{}\n');
    const clash = cli(['validate', file, '--known', path(snakeDir), '--record', dir]);
    assert.equal(clash.code, 2);
    assert.match(clash.err, /already holds a different record/);
    assert.equal(text(target), '{}\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: --record with no value is a usage error, and without --record nothing is written', () => {
  const file = path(new URL('snake-interval.analytics.0.1.1.json', snakeDir));
  assert.equal(cli(['validate', file, '--record']).code, 2);
  assert.equal(cli(['validate', file, '--known', path(snakeDir)]).code, 0);
});

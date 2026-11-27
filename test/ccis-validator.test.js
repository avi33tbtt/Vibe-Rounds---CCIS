// Row 2.1: validator layers 1 to 3 (syntax, structural, reference integrity). Prototype. Synthetic data only.
// The acceptance targets are the row 1.6 invalid examples and their expected diagnostics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as validators from '../ccis/validators/ccis-validators.js';
import {
  validateArtefact, renderText, compareSemver, satisfiesRange, satisfiesReference, parseSemver, RULES, LAYER_NAMES,
} from '../ccis-validator.js';
import { main } from '../ccis-cli.js';

const root = new URL('../', import.meta.url);
const snakeDir = new URL('../ccis/examples/snake/', import.meta.url);
const invalidDir = new URL('../ccis/examples/invalid/', import.meta.url);
const fixtureDir = new URL('../ccis/fixtures/schemas/', import.meta.url);
const text = (u) => readFileSync(u, 'utf8');
const read = (u) => JSON.parse(text(u));
const clone = (x) => JSON.parse(JSON.stringify(x));
const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };

const snakeFiles = readdirSync(snakeDir).filter((f) => f.endsWith('.json')).sort();
const known = deepFreeze(snakeFiles.map((f) => read(new URL(f, snakeDir))));
const snake = (f) => clone(read(new URL(f, snakeDir)));
const run = (input, options = {}) => validateArtefact(input, { known, ...options });
const ids = (r) => r.diagnostics.map((d) => d.ruleId);
const errors = (r) => r.diagnostics.filter((d) => d.severity === 'error');

const exampleFiles = (dir) => readdirSync(new URL(`${dir}/`, invalidDir)).filter((f) => !f.includes('expected')).sort();
const expectedFiles = (dir) => readdirSync(new URL(`${dir}/`, invalidDir)).filter((f) => f.endsWith('.expected-diagnostics.json')).sort();

// (a) layers 1 to 3 give exactly the expected diagnostics ------------------------------------

for (const dir of ['1-syntax', '2-structural', '3-reference-integrity']) {
  for (const f of expectedFiles(dir)) {
    test(`${dir}: ${f} is matched exactly`, () => {
      const exp = read(new URL(`${dir}/${f}`, invalidDir));
      const r = run(text(new URL(exp.example.replace('ccis/examples/invalid/', ''), invalidDir)));
      assert.deepEqual(r.diagnostics, exp.diagnostics);
      assert.equal(r.outcome, 'failed');
      assert.equal(r.layers[exp.layerName].outcome, 'failed');
    });
  }
}

// (b) valid artefacts and fixtures pass ------------------------------------------------------

test('every valid snake artefact has no diagnostics at layers 1 to 3 (the snake folder is the known set)', () => {
  assert.ok(snakeFiles.length >= 9);
  for (const f of snakeFiles) {
    const r = run(text(new URL(f, snakeDir)));
    assert.deepEqual(r.diagnostics, [], f);
    assert.equal(r.outcome, 'no-errors-so-far', f);
    for (const name of LAYER_NAMES.slice(0, 3)) assert.equal(r.layers[name].outcome, 'passed', `${f} ${name}`);
  }
});

const fixtureIndex = read(new URL('index.json', fixtureDir));

test('every valid schema fixture passes layers 1 and 2 (the fixture names its schema)', () => {
  const good = fixtureIndex.filter((e) => e.valid);
  assert.ok(good.length > 20);
  for (const e of good) {
    const r = validateArtefact(text(new URL(e.file, fixtureDir)), { schema: e.schema });
    assert.equal(r.layers.syntax.outcome, 'passed', e.file);
    assert.equal(r.layers.structural.outcome, 'passed', e.file);
    assert.deepEqual([...r.layers.syntax.diagnostics, ...r.layers.structural.diagnostics], [], e.file);
  }
});

test('no schema error is dropped: every invalid fixture gives one diagnostic per schema error, each with its own pointer', () => {
  const bad = fixtureIndex.filter((e) => !e.valid);
  assert.ok(bad.length > 20);
  for (const e of bad) {
    const doc = read(new URL(e.file, fixtureDir));
    assert.equal(validators[e.schema](doc), false, e.file);
    const n = validators[e.schema].errors.length;
    const r = validateArtefact(doc, { schema: e.schema });
    assert.equal(r.layers.structural.diagnostics.length, n, e.file);
    assert.equal(r.layers.structural.outcome, 'failed', e.file);
    for (const d of r.layers.structural.diagnostics) {
      assert.match(d.ruleId, /^CCIS-V2-00[1-4]$/);
      assert.equal(typeof d.path, 'string');
      assert.ok(d.message && d.hint, e.file);
    }
  }
});

// (c) the examples for layers 6 to 8 pass layers 1 to 5 (their own layers are matched in test/ccis-validator-governance.test.js) ---
// (Layers 4 and 5 were built in row 2.2; their examples are matched exactly in test/ccis-validator-semantic.test.js.)

test('the layer 6 to 8 examples pass layers 1 to 5', () => {
  for (const dir of ['6-executable-safety', '7-test-verification', '8-governance']) {
    const files = exampleFiles(dir);
    assert.ok(files.length >= 1, dir);
    for (const f of files) {
      const r = run(text(new URL(`${dir}/${f}`, invalidDir)));
      for (const name of LAYER_NAMES.slice(0, 5)) assert.equal(r.layers[name].outcome, 'passed', `${f} ${name}`);
    }
  }
});

// (d) fail closed --------------------------------------------------------------------------------

test('a layer 1 failure runs no later layer', () => {
  const r = run(text(new URL('1-syntax/interval-truncated.json.txt', invalidDir)));
  assert.equal(r.layers.syntax.outcome, 'failed');
  for (const name of LAYER_NAMES.slice(1)) {
    assert.equal(r.layers[name].outcome, 'not-run', name);
    assert.ok(r.layers[name].reason.length > 0, name);
  }
  assert.deepEqual(ids(r), ['CCIS-V1-001']);
  // A document that is broken twice reports only the layer 1 break: nothing after it was read.
  const twice = run('{"manifest": {"id": 1}, "x": ');
  assert.deepEqual(ids(twice), ['CCIS-V1-001']);
});

test('a layer 2 failure runs no layer 3 check, even when layer 3 would also find a defect', () => {
  const a = snake('snake-interval.analytics.0.1.1.json');
  a.parameters[0].value = 1;
  a.inputs[3].field = 'antivenomStartTim';
  const r = run(a);
  assert.equal(r.layers.structural.outcome, 'failed');
  assert.equal(r.layers['reference-integrity'].outcome, 'not-run');
  assert.ok(r.layers['reference-integrity'].reason.length > 0);
  assert.deepEqual(ids(r), ['CCIS-V2-001']);
});

test('layer 1 reads only a JSON object; a parsed document is accepted as it is', () => {
  const brokenTexts = ['{"a":}', '{"a":1,}', '[1,2', '', '   ', '{"a":"x', '{"a":tru', '{"a":1} x', '{"a":"\\q"}', '\ufeff{}', '{"a":1\n,"b"}'];
  for (const t of brokenTexts) {
    const r = run(t);
    assert.deepEqual(ids(r), ['CCIS-V1-001'], JSON.stringify(t));
    const p = r.diagnostics[0].path;
    assert.ok(Number.isInteger(p.line) && Number.isInteger(p.column) && p.line >= 1 && p.column >= 1, JSON.stringify(t));
  }
  assert.deepEqual(run('{"a":1\n,"b"}').diagnostics[0].path, { line: 2, column: 5 });
  assert.deepEqual(run('{"a":}').diagnostics[0].path, { line: 1, column: 6 });
  for (const t of ['[1]', '"x"', '42', 'null', '  [1]']) assert.deepEqual(ids(run(t)), ['CCIS-V1-002'], t);
  assert.deepEqual(run('  [1]').diagnostics[0].path, { line: 1, column: 3 });
  for (const v of [null, 7, [1]]) assert.deepEqual(ids(run(v)), ['CCIS-V1-002']);
  // A parsed object skips the text check and goes straight to layer 2.
  assert.equal(run(snake('snake-envenomation.element.json')).outcome, 'no-errors-so-far');
});

// Layer 2 rules ----------------------------------------------------------------------------------

test('layer 2: a parameter that carries a value, a default or a suggestion is CCIS-V2-001 (D-022)', () => {
  for (const member of ['value', 'default', 'suggestion', 'defaultValue', 'recommended']) {
    const a = snake('snake-interval.analytics.0.1.1.json');
    a.parameters[1][member] = 'x';
    const r = run(a);
    assert.deepEqual(ids(r), ['CCIS-V2-001'], member);
    assert.equal(r.diagnostics[0].path, `/parameters/1/${member}`);
    assert.ok(r.diagnostics[0].message.includes(`"${member}"`));
  }
  const a = snake('snake-interval.analytics.0.1.1.json');
  a.parameters[0].colour = 'red';
  assert.deepEqual(ids(run(a)), ['CCIS-V2-002']);
});

test('layer 2: unknown member, missing member, wrong value, unknown kind, and a type with no schema yet', () => {
  const e = snake('snake-envenomation.element.json');
  const unknown = clone(e);
  unknown.surprise = 1;
  unknown.manifest.extra = 2;
  unknown['x-local'] = 'allowed';
  let r = run(unknown);
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V2-002', '/manifest/extra'], ['CCIS-V2-002', '/surprise']]);

  const missing = clone(e);
  delete missing.intent;
  r = run(missing);
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V2-003', '/intent']]);

  const wrong = clone(e);
  wrong.manifest.version = 'one';
  r = run(wrong);
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V2-004', '/manifest/version']]);

  r = run({ hello: 1 });
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V2-005', '']]);
  assert.equal(r.layers['reference-integrity'].outcome, 'not-run');

  const pkgDoc = { manifest: { ...clone(e.manifest), id: 'snake.tvp', type: 'test-validation-package' } };
  r = run(pkgDoc);
  assert.deepEqual(r.diagnostics.map((d) => [d.severity, d.ruleId]), [['warning', 'CCIS-V2-006']]);
  assert.equal(r.outcome, 'no-errors-so-far');
  assert.equal(r.layers.structural.outcome, 'passed');
  assert.equal(r.layers['reference-integrity'].outcome, 'passed');

  assert.throws(() => run(e, { schema: 'nonsense' }), /unknown schema name/);
});

// Layer 3 rules ----------------------------------------------------------------------------------

test('layer 3: field keys, relationships, missing artefacts, versions that do not resolve, stage needs', () => {
  const e = snake('snake-envenomation.element.json');
  const dup = clone(e);
  dup.fields.push(clone(dup.fields[0]));
  const last = dup.fields.length - 1;
  assert.deepEqual(run(dup).diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V3-002', `/fields/${last}/key`]]);

  const rel = clone(e);
  rel.relationships[0].to = 'nope';
  assert.deepEqual(run(rel).diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V3-003', '/relationships/0/to']]);

  const a = snake('snake-interval.analytics.0.1.1.json');
  let r = run(a, { known: [] });
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V3-004', '/context/0/ref'], ['CCIS-V3-004', '/manifest/references/0']]);
  assert.equal(r.outcome, 'failed');

  const other = clone(a);
  other.manifest.references[0].version = '9.9.9';
  other.context[0].ref.range = '^9.0.0';
  r = run(other);
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V3-005', '/context/0/ref'], ['CCIS-V3-005', '/manifest/references/0']]);
  assert.ok(r.diagnostics[0].message.includes('^9.0.0') && r.diagnostics[0].message.includes('0.1.0'));

  const ctx = clone(a);
  ctx.context[0].fields.push('zzz');
  assert.deepEqual(run(ctx).diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V3-001', `/context/0/fields/${ctx.context[0].fields.length - 1}`]]);

  const p = snake('snake-documentation.pathway.json');
  p.stages[0].needs.push('zzz');
  p.nodes[0].inputs[0].field = 'zzz';
  assert.deepEqual(run(p).diagnostics.map((d) => [d.ruleId, d.path]), [
    ['CCIS-V3-001', '/nodes/0/inputs/0/field'], ['CCIS-V3-001', `/stages/0/needs/${p.stages[0].needs.length - 1}`],
  ]);

  // A decision node alone: its element is looked up among the known artefacts, and a missing one is reported once.
  const node = snake('snake-node-clotting.node.json');
  r = run(node, { known: [] });
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V3-004', '/inputs/0/element']]);
  assert.deepEqual(run(node).diagnostics, []);
});

test('layer 3 resolves only against the artefacts it is given, and a range takes the highest satisfying version', () => {
  const a = snake('snake-interval.analytics.0.1.1.json');
  const e = snake('snake-envenomation.element.json');
  const newer = clone(e);
  newer.manifest.version = '0.1.5';
  newer.fields = newer.fields.filter((f) => f.key !== 'antivenomStartTime');
  newer.relationships = newer.relationships.filter((r) => r.from !== 'antivenomStartTime' && r.to !== 'antivenomStartTime');
  // The context entry (^0.1.0) reaches 0.1.5, the highest, so its fields and the inputs are checked against it.
  // The manifest's exact pin still resolves to 0.1.0, so it raises nothing.
  const r = run(a, { known: [e, newer] });
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V3-001', '/context/0/fields/3'], ['CCIS-V3-001', '/inputs/3/field']]);
  assert.deepEqual(run(a, { known: [e] }).diagnostics, []);
});

// (e) the semver comparator ----------------------------------------------------------------------

test('semver: ranges as the manifest schema allows', () => {
  const yes = [['^0.1.0', '0.1.9'], ['^1.2.0', '1.9.0'], ['~1.2.0', '1.2.9'], ['>=1.0.0 <2.0.0', '1.5.0'], ['^0.0.3', '0.0.3'], ['1.0.0', '1.0.0'], ['>=1.0.0', '1.0.0'], ['<=1.0.0', '1.0.0'], ['<2.0.0', '1.9.9'], ['>1.0.0', '1.0.1'], ['^1.2.3', '1.2.3']];
  const no = [['^0.1.0', '0.2.0'], ['^0.1.0', '0.0.9'], ['^1.2.0', '2.0.0'], ['^1.2.0', '1.1.9'], ['~1.2.0', '1.3.0'], ['>=1.0.0 <2.0.0', '2.0.0'], ['^0.0.3', '0.0.4'], ['>1.0.0', '1.0.0'], ['<1.0.0', '1.0.0'], ['1.0.0', '1.0.1']];
  for (const [r, v] of yes) assert.equal(satisfiesRange(r, v), true, `${r} ${v}`);
  for (const [r, v] of no) assert.equal(satisfiesRange(r, v), false, `${r} ${v}`);
});

test('semver: nothing is guessed (malformed ranges and versions, pre-releases, wrong spacing)', () => {
  for (const [r, v] of [['', '1.0.0'], ['latest', '1.0.0'], ['*', '1.0.0'], ['^1.0', '1.0.0'], ['>=1.0.0  <2.0.0', '1.0.0'], [' ^1.0.0', '1.0.0'], ['^1.0.0', '1.0.1-beta'], ['^1.0.0', 'x'], ['^1.0.0', ''], [null, '1.0.0'], [7, '1.0.0']]) {
    assert.equal(satisfiesRange(r, v), false, `${r} ${v}`);
  }
  assert.equal(parseSemver('1.0'), null);
  assert.equal(parseSemver(7), null);
  assert.equal(compareSemver('1.0', '1.0.0'), null);
});

test('semver: ordering, including pre-releases and build metadata, and large numbers', () => {
  assert.equal(compareSemver('1.10.0', '1.9.0'), 1);
  assert.equal(compareSemver('1.0.0', '1.0.0'), 0);
  assert.equal(compareSemver('1.0.0+a', '1.0.0+b'), 0);
  assert.equal(compareSemver('1.0.0-alpha', '1.0.0'), -1);
  assert.equal(compareSemver('1.0.0-alpha', '1.0.0-alpha.1'), -1);
  assert.equal(compareSemver('1.0.0-alpha.1', '1.0.0-alpha.beta'), -1);
  assert.equal(compareSemver('1.0.0-2', '1.0.0-10'), -1);
  assert.equal(compareSemver('99999999999999999999.0.0', '99999999999999999998.0.0'), 1);
  assert.equal(satisfiesReference({ version: '1.0.0' }, '1.0.0+build'), true);
  assert.equal(satisfiesReference({ version: '1.0.0' }, '1.0.1'), false);
  assert.equal(satisfiesReference({ range: '^1.0.0' }, '1.4.0'), true);
  assert.equal(satisfiesReference({}, '1.0.0'), false);
  assert.equal(satisfiesReference(null, '1.0.0'), false);
});

// The result itself ------------------------------------------------------------------------------

test('the result shape, the rule catalogue and the plain-text rendering', () => {
  const r = run(text(new URL('3-reference-integrity/input-field-missing.json', invalidDir)));
  assert.deepEqual(Object.keys(r), ['outcome', 'layers', 'diagnostics']);
  assert.deepEqual(Object.keys(r.layers), LAYER_NAMES);
  assert.equal(LAYER_NAMES.length, 8);
  for (const d of r.diagnostics) assert.deepEqual(Object.keys(d), ['severity', 'ruleId', 'path', 'message', 'hint']);

  const idList = RULES.map((x) => x.ruleId);
  assert.equal(new Set(idList).size, idList.length);
  for (const x of RULES) assert.match(x.ruleId, new RegExp(`^CCIS-V${x.layer}-\\d{3}$`));
  for (const id of ['CCIS-V1-001', 'CCIS-V2-001', 'CCIS-V2-002', 'CCIS-V2-003', 'CCIS-V2-004', 'CCIS-V3-001', 'CCIS-V3-002', 'CCIS-V3-003', 'CCIS-V3-004', 'CCIS-V3-005']) {
    assert.ok(idList.includes(id), id);
  }

  const t = renderText(r, 'x.json');
  assert.match(t, /^x\.json: failed/);
  assert.match(t, /error CCIS-V3-001 at \/inputs\/3\/field: /);
  assert.match(t, /hint: /);
  assert.match(t, /layer 4 semantic: not-run \(Layer 3 \(reference-integrity\) found errors/);
  assert.match(t, /layer 8 governance: not-run/);
  assert.match(renderText(run('{"a":}'), 'b.json'), /at line 1, column 6/);
});

test('same input, same output; inputs are not changed', () => {
  for (const f of ['3-reference-integrity/input-field-missing.json', '2-structural/parameter-carries-value.json']) {
    const t = text(new URL(f, invalidDir));
    assert.equal(JSON.stringify(run(t)), JSON.stringify(run(t)));
  }
  const frozen = deepFreeze(snake('snake-interval.analytics.0.1.1.json'));
  assert.equal(JSON.stringify(run(frozen)), JSON.stringify(run(frozen)));
});

// (f) the CLI --------------------------------------------------------------------------------------

const cli = (...args) => spawnSync(process.execPath, ['ccis-cli.js', ...args], { cwd: root, encoding: 'utf8' });
const snakePath = (f) => `ccis/examples/snake/${f}`;
const invalidPath = (f) => `ccis/examples/invalid/${f}`;

test('the CLI exits 0 with no error diagnostics, 1 with errors, 2 for usage or unreadable input', () => {
  let r = cli('validate', snakePath('snake-interval.analytics.0.1.1.json'), '--known', 'ccis/examples/snake');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /no-errors-so-far/);

  r = cli('validate', invalidPath('3-reference-integrity/input-field-missing.json'), '--known', 'ccis/examples/snake');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /CCIS-V3-001/);

  r = cli('validate', invalidPath('1-syntax/interval-truncated.json.txt'));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /CCIS-V1-001 at line 764, column 4/);

  const dir = mkdtempSync(join(tmpdir(), 'ccis-validate-'));
  writeFileSync(join(dir, 'broken.json'), '{ nope');
  const bad = [
    [[], /at least one file/],
    [['validate'], /at least one file/],
    [['validate', 'no-such-file.json'], /cannot read no-such-file\.json/],
    [['validate', snakePath('snake-envenomation.element.json'), '--bogus'], /unknown argument/],
    [['validate', snakePath('snake-envenomation.element.json'), '--known'], /--known needs a value/],
    [['validate', snakePath('snake-envenomation.element.json'), '--known', join(dir, 'nope')], /cannot read the known folder/],
    [['validate', snakePath('snake-envenomation.element.json'), '--known', dir], /broken\.json in the known folder is not JSON/],
  ];
  for (const [args, re] of bad) {
    const out = cli(...(args[0] === 'validate' ? args : ['validate', ...args]));
    assert.equal(out.status, 2, args.join(' '));
    assert.match(out.stderr, re, args.join(' '));
    assert.match(out.stderr, /usage: node ccis-cli\.js validate/);
  }
});

test('the CLI treats the files given as known to each other, and can print the result as JSON', () => {
  const r = cli('validate', snakePath('snake-interval.analytics.0.1.1.json'), snakePath('snake-envenomation.element.json'), '--json');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const out = JSON.parse(r.stdout);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((x) => x.outcome), ['no-errors-so-far', 'no-errors-so-far']);
  assert.deepEqual(Object.keys(out[0].layers), LAYER_NAMES);
  const alone = cli('validate', snakePath('snake-interval.analytics.0.1.1.json'));
  assert.equal(alone.status, 1);
  assert.match(alone.stdout, /CCIS-V3-004/);
});

test('main() reports through io, and the run command still behaves', () => {
  const lines = [];
  const io = { out: (s) => lines.push(s), err: (s) => lines.push(s) };
  assert.equal(main(['validate', 'no-such-file.json'], io), 2);
  assert.match(lines.join('\n'), /cannot read/);
  lines.length = 0;
  assert.equal(main(['frobnicate'], io), 2);
  assert.match(lines.join('\n'), /only commands/);
  lines.length = 0;
  assert.equal(main(['run'], io), 2);
  assert.match(lines.join('\n'), /--envelope is required/);
  lines.length = 0;
  assert.equal(main(['validate', fileURLToPath(new URL(snakePath('snake-envenomation.element.json'), root))], io), 0);
  assert.match(lines.join('\n'), /no-errors-so-far/);
});

// (g) the library stays pure -------------------------------------------------------------------------

test('the library has no dynamic code, file access, network, clock or randomness', () => {
  const src = text(new URL('../ccis-validator.js', import.meta.url));
  const forbidden = [/\beval\b/, /\bFunction\b/, /\bimport\s*\(/, /\brequire\s*\(/, /node:/, /\bfs\b/, /\bDate\b/, /Math\.random/, /performance\.now/, /\bfetch\b/, /\bprocess\b/, /XMLHttpRequest/, /WebSocket/, /localStorage/];
  for (const re of forbidden) assert.equal(re.test(src), false, String(re));
  assert.deepEqual([...src.matchAll(/^import .* from '([^']+)';$|^\} from '([^']+)';$/gm)].map((m) => m[1] ?? m[2]), ['./ccis/validators/ccis-validators.js', './ccis-validator-semantic.js', './ccis-validator-group.js', './ccis-validator-entryform.js', './ccis-validator-rulepack.js', './ccis-validator-rulepack-checks.js', './ccis-validator-rulepack-shape.js', './ccis-validator-contexts.js', './ccis-validator-owner.js', './ccis-validator-terminology.js', './ccis-validator-concept.js', './ccis-validator-concept-package.js', './ccis-concept-owners.js', './ccis-validator-governance.js']);
});

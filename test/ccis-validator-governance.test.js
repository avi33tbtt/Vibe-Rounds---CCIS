// Row 2.3: validator layers 6 to 8 (executable safety, test verification, governance). Prototype. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateArtefact, RULES, LAYER_NAMES, renderText } from '../ccis-validator.js';
import { executableSafetyLayer, testVerificationLayer, governanceLayer, GOVERNANCE_RULES } from '../ccis-validator-governance.js';
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
const run = (input, withFixtures = true) => validateArtefact(input, { known, fixtures: withFixtures ? fixtures : undefined });
const ids = (r) => r.diagnostics.map((d) => d.ruleId);
const TEST_EXAMPLE = new URL('7-test-verification/test-expects-missing-output.json', invalidDir);
const INTERVAL = 'snake-interval.analytics.0.1.1.json';

// (a) the examples for layers 6 to 8 give exactly their expected diagnostics --------------------------

const LAYER_DIRS = ['6-executable-safety', '7-test-verification', '8-governance'];
for (const dir of LAYER_DIRS) {
  const files = readdirSync(new URL(`${dir}/`, invalidDir)).filter((f) => f.endsWith('.expected-diagnostics.json')).sort();
  for (const f of files) {
    test(`${dir}: ${f} is matched exactly`, () => {
      const exp = read(new URL(`${dir}/${f}`, invalidDir));
      const r = run(text(new URL(exp.example.replace('ccis/examples/invalid/', ''), invalidDir)));
      assert.deepEqual(r.diagnostics, exp.diagnostics);
      assert.equal(r.outcome, 'failed');
      assert.equal(r.layers[exp.layerName].outcome, 'failed');
      for (const name of LAYER_NAMES.slice(0, LAYER_NAMES.indexOf(exp.layerName))) assert.equal(r.layers[name].outcome, 'passed', name);
      for (const name of LAYER_NAMES.slice(LAYER_NAMES.indexOf(exp.layerName) + 1)) {
        assert.equal(r.layers[name].outcome, 'not-run', name); // fail closed
        assert.ok(r.layers[name].reason.length > 0, name);
      }
    });
  }
}

// (b) valid artefacts stay clean; unknown is not a pass ---------------------------------------------

test('every valid snake artefact passes all eight layers with no diagnostics, with or without a fixture list', () => {
  for (const f of snakeFiles) {
    for (const withFixtures of [true, false]) {
      const r = run(text(new URL(f, snakeDir)), withFixtures);
      assert.equal(r.outcome, 'no-errors-so-far', f);
      assert.deepEqual(r.diagnostics, [], f);
      for (const name of LAYER_NAMES) assert.equal(r.layers[name].outcome, 'passed', `${f} ${name}`);
    }
  }
});

test('a declared test with no fixture list gives the warning V7-004 and the outcome stays no-errors-so-far', () => {
  const a = clone(read(new URL(INTERVAL, snakeDir)));
  a.tests = [{ id: 'intervalNormal', fixture: 'normal-01-all-enabled', enables: [{ parameter: 'targetIntervalDuration', testOnly: true }], expect: [{ output: 'interval', matchesFixture: true }] }];
  const without = run(a, false);
  assert.deepEqual(without.diagnostics.map((d) => [d.ruleId, d.path, d.severity]), [['CCIS-V7-004', '/tests/0/fixture', 'warning']]);
  assert.equal(without.outcome, 'no-errors-so-far');
  assert.equal(without.layers['test-verification'].outcome, 'passed');
  assert.deepEqual(ids(run(a, true)), []);
});

test('a layer 6 failure leaves layers 7 and 8 not run; a layer 7 failure leaves layer 8 not run', () => {
  const six = run(text(new URL('6-executable-safety/extension-holds-code-text.json', invalidDir)));
  assert.deepEqual(['test-verification', 'governance'].map((n) => six.layers[n].outcome), ['not-run', 'not-run']);
  const seven = run(text(TEST_EXAMPLE));
  assert.equal(seven.layers.governance.outcome, 'not-run');
  assert.match(seven.layers.governance.reason, /test-verification/);
});

test('the plain-text rendering gives a line for every layer and no longer says layers 6 to 8 were not run', () => {
  const t = renderText(run(text(new URL(INTERVAL, snakeDir))), 'x');
  assert.equal(t.split('\n').filter((l) => /^ {2}layer \d /.test(l)).length, 8);
  assert.equal(/not run/.test(t), false);
});

// (c) one handmade case per new id --------------------------------------------------------------------

const withTests = (mutate) => { const a = clone(read(TEST_EXAMPLE)); mutate(a.tests[0]); return a; };

test('V7-001: an output id one letter off', () => {
  const r = run(withTests(() => {}));
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V7-001', '/tests/0/expect/0/output']]);
});
test('V7-002: an enabled parameter that is not declared', () => {
  const r = run(withTests((t) => { t.expect[0].output = 'interval'; t.enables[0].parameter = 'noSuchParameter'; }));
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V7-002', '/tests/0/enables/0/parameter']]);
});
test('V7-003: an expected state the output does not declare (library call: every declared output in the valid package declares all five states, so the schema-valid pipeline case does not exist)', () => {
  const doc = { outputs: [{ id: 'o', states: ['needs-data'] }], tests: [{ id: 't', fixture: 'f', enables: [], expect: [{ output: 'o', state: 'conflict' }, { output: 'o', state: 'needs-data' }] }] };
  const d = testVerificationLayer(doc, 'analytics-package', { fixtures: ['f'] });
  assert.deepEqual(d.map((x) => [x.ruleId, x.severity, x.path]), [['CCIS-V7-003', 'error', '/tests/0/expect/0/state']]);
});
test('V7-005: a fixture case that is not in the supplied list', () => {
  const r = run(withTests((t) => { t.expect[0].output = 'interval'; t.fixture = 'normal-99-not-a-case'; }));
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V7-005', '/tests/0/fixture']]);
});
test('V7: a package with no tests gets no layer 7 diagnostic (whether tests are required is not decided here)', () => {
  assert.deepEqual(testVerificationLayer(read(new URL(INTERVAL, snakeDir)), 'analytics-package', { fixtures }), []);
  assert.deepEqual(testVerificationLayer(read(new URL('snake-envenomation.element.json', snakeDir)), 'contextual-element', { fixtures }), []);
});

test('V6-002: markup that can run in a page, in a plain text member, is refused through the pipeline', () => {
  const a = clone(read(new URL(INTERVAL, snakeDir)));
  a.question = 'Is the interval within target? <script>placeholder</script>';
  const r = run(a);
  assert.deepEqual(r.diagnostics.map((d) => [d.ruleId, d.path]), [['CCIS-V6-002', '/question']]);
  assert.equal(r.layers['executable-safety'].outcome, 'failed');
});
test('V6-002: a network address in an x- member is refused; the same address in a standard member is not judged here', () => {
  assert.deepEqual(executableSafetyLayer({ 'x-source': 'see https://example.invalid/page' }).map((d) => d.ruleId), ['CCIS-V6-002']);
  assert.deepEqual(executableSafetyLayer({ question: 'see https://example.invalid/page' }), []);
});
test('V6-001 finds code-like text at any depth inside an x- member, with the path to the text', () => {
  const d = executableSafetyLayer({ a: { 'x-outer': { list: ['fine', { deep: 'a => b' }] } } });
  assert.deepEqual(d.map((x) => [x.ruleId, x.path]), [['CCIS-V6-001', '/a/x-outer/list/1/deep']]);
  assert.match(d[0].message, /x-outer/);
});

test('V8-003: a validated status with no evidence statement is a warning that says not checked', () => {
  const d = governanceLayer({ manifest: { version: '1.0.0', status: 'validated' } });
  assert.deepEqual(d.map((x) => [x.ruleId, x.severity, x.path]), [['CCIS-V8-003', 'warning', '/manifest/status']]);
  assert.match(d[0].message, /not checked/);
});
test('V8: a draft with no scope, or a validated claim with real evidence text and a matching scope, gives nothing', () => {
  assert.deepEqual(governanceLayer({ manifest: { version: '1.0.0', status: 'draft' }, evidence: { statement: 'x', sources: [] } }), []);
  const ok = { manifest: { version: '1.0.0', status: 'validated', validation: { version: '1.0.0' } }, evidence: { statement: 'A fictional validation is claimed for this synthetic example only.', sources: [] } };
  assert.deepEqual(governanceLayer(ok), []);
  const other = clone(ok); other.manifest.validation.version = '1.0.1';
  assert.deepEqual(governanceLayer(other).map((x) => x.ruleId), ['CCIS-V8-002']);
});

// (d) tables of accepted and refused extension text ---------------------------------------------------

const ext = (s) => executableSafetyLayer({ 'x-note': s }).map((d) => d.ruleId);
const ACCEPTED = ['', 'A note about the demonstration.', 'Time and documentation only.', 'Interval in minutes (see the dossier).', 'one = a count, two = another', 'The arrow in the figure points left.',
  'Fact F1 to F9.', 'a; b; c', 'Use dashes - not code.', 'Approx. 60 min', 'Entered by the clinician.', 'Plain text with a (bracket) in it.'];
const REFUSED = ['function () { }', 'function run(a) { return a; }', '(a) => a', 'x => x + 1', 'ev' + 'al(1)', 'new Fun' + 'ction("a")', 'imp' + 'ort("x")', 'requ' + 'ire("x")',
  'cat file | sh', 'echo `date`', '$(ls)', 'doIt();'];
for (const s of ACCEPTED) test(`extension text accepted: ${JSON.stringify(s)}`, () => assert.deepEqual(ext(s), []));
for (const s of REFUSED) test(`extension text refused with CCIS-V6-001: ${JSON.stringify(s)}`, () => assert.deepEqual(ext(s), ['CCIS-V6-001']));

// (e) the pure library holds -----------------------------------------------------------------------------

test('the module has no dynamic code, file access, network, clock or randomness, and imports nothing', () => {
  const src = text(new URL('../ccis-validator-governance.js', import.meta.url));
  const forbidden = [/\beval\b/, /\bFunction\b/, /\bimport\s*\(/, /\brequire\s*\(/, /node:/, /\bfs\b/, /\bDate\b/, /Math\.random/, /performance\.now/, /\bfetch\b/, /\bprocess\b/, /XMLHttpRequest/, /WebSocket/, /localStorage/];
  for (const re of forbidden) assert.equal(re.test(src), false, String(re));
  assert.deepEqual([...src.matchAll(/^import .* from '([^']+)';$|^\} from '([^']+)';$/gm)], []);
});

test('the layers are deterministic and do not change their input', () => {
  const a = deepFreeze(clone(read(TEST_EXAMPLE)));
  assert.equal(JSON.stringify(run(a)), JSON.stringify(run(a)));
  const b = deepFreeze(clone(read(new URL('6-executable-safety/extension-holds-code-text.json', invalidDir))));
  assert.equal(JSON.stringify(run(b)), JSON.stringify(run(b)));
});

// (f) the rule catalogue ----------------------------------------------------------------------------------

test('the catalogue lists every layer 6 to 8 id once, with the severity the rules give', () => {
  const idList = RULES.map((x) => x.ruleId);
  assert.equal(new Set(idList).size, idList.length);
  assert.equal(GOVERNANCE_RULES.length, 10);
  for (const x of GOVERNANCE_RULES) {
    assert.equal(idList.filter((i) => i === x.ruleId).length, 1, x.ruleId);
    assert.match(x.ruleId, new RegExp(`^CCIS-V${x.layer}-\\d{3}$`));
  }
  assert.deepEqual(GOVERNANCE_RULES.filter((x) => x.severity === 'warning').map((x) => x.ruleId), ['CCIS-V7-004', 'CCIS-V8-003']);
});

// (g) the CLI --fixtures option ---------------------------------------------------------------------------

const cli = (args) => {
  const o = []; const e = [];
  const code = main(args, { out: (s) => o.push(s), err: (s) => e.push(s) });
  return { code, out: o.join('\n'), err: e.join('\n') };
};
const path = (u) => fileURLToPath(u);

test('CLI: validate with --fixtures checks the case name; without it the case name gives a warning only', () => {
  const file = path(new URL('7-test-verification/test-expects-missing-output.json', invalidDir));
  const withFx = cli(['validate', file, '--known', path(snakeDir), '--fixtures', path(fixtureDir)]);
  assert.equal(withFx.code, 1);
  assert.match(withFx.out, /CCIS-V7-001/);
  assert.equal(/CCIS-V7-004/.test(withFx.out), false);
  const without = cli(['validate', file, '--known', path(snakeDir)]);
  assert.match(without.out, /CCIS-V7-004/);
});
test('CLI: a fixtures folder without index.json, or --fixtures with no value, is a usage error (exit 2)', () => {
  const file = path(new URL(INTERVAL, snakeDir));
  assert.equal(cli(['validate', file, '--fixtures', path(snakeDir)]).code, 2);
  assert.equal(cli(['validate', file, '--fixtures']).code, 2);
});

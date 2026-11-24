// Row 2.2: validator layers 4 and 5 (semantic; graph and compatibility). Prototype. Synthetic data only.
// The acceptance targets are the row 1.6 examples for layers 4 and 5 and their expected diagnostics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateArtefact, RULES, LAYER_NAMES } from '../ccis-validator.js';
import { SEMANTIC_RULES } from '../ccis-validator-semantic.js';

const snakeDir = new URL('../ccis/examples/snake/', import.meta.url);
const invalidDir = new URL('../ccis/examples/invalid/', import.meta.url);
const text = (u) => readFileSync(u, 'utf8');
const read = (u) => JSON.parse(text(u));
const clone = (x) => JSON.parse(JSON.stringify(x));
const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };

const snakeFiles = readdirSync(snakeDir).filter((f) => f.endsWith('.json')).sort();
const known = deepFreeze(snakeFiles.map((f) => read(new URL(f, snakeDir))));
const snake = (f) => clone(read(new URL(f, snakeDir)));
const run = (input) => validateArtefact(input, { known });
const errors = (r) => r.diagnostics.filter((d) => d.severity === 'error');
const expectedFiles = (dir) => readdirSync(new URL(`${dir}/`, invalidDir)).filter((f) => f.endsWith('.expected-diagnostics.json')).sort();

// (a) the examples for layers 4 and 5 give exactly their expected diagnostics ----------------------

for (const dir of ['4-semantic', '5-graph-and-compatibility']) {
  for (const f of expectedFiles(dir)) {
    test(`${dir}: ${f} is matched exactly`, () => {
      const exp = read(new URL(`${dir}/${f}`, invalidDir));
      const r = run(text(new URL(exp.example.replace('ccis/examples/invalid/', ''), invalidDir)));
      assert.deepEqual(r.diagnostics, exp.diagnostics);
      assert.equal(r.outcome, 'failed');
      assert.equal(r.layers[exp.layerName].outcome, 'failed');
      for (const name of LAYER_NAMES.slice(0, LAYER_NAMES.indexOf(exp.layerName))) assert.equal(r.layers[name].outcome, 'passed', name);
    });
  }
}

// (b) every valid snake artefact passes through layer 5 --------------------------------------------

test('every valid snake artefact has no error diagnostics through layer 5 (and layers 6 to 8 are not run)', () => {
  assert.ok(snakeFiles.length >= 9);
  for (const f of snakeFiles) {
    const r = run(text(new URL(f, snakeDir)));
    assert.deepEqual(errors(r), [], f);
    assert.equal(r.outcome, 'no-errors-so-far', f);
    for (const name of LAYER_NAMES.slice(0, 5)) assert.equal(r.layers[name].outcome, 'passed', `${f} ${name}`);
    for (const name of LAYER_NAMES.slice(5)) assert.equal(r.layers[name].outcome, 'not-run', `${f} ${name}`);
  }
});

// (c) the layer 6, 7 and 8 examples pass layers 1 to 5 ---------------------------------------------

test('the layer 6, 7 and 8 examples pass layers 1 to 5 and list layers 6 to 8 as not run', () => {
  for (const dir of ['6-executable-safety', '7-test-verification', '8-governance']) {
    const files = readdirSync(new URL(`${dir}/`, invalidDir)).filter((f) => !f.includes('expected'));
    assert.ok(files.length >= 1, dir);
    for (const f of files) {
      const r = run(text(new URL(`${dir}/${f}`, invalidDir)));
      assert.deepEqual(errors(r), [], `${dir}/${f}`);
      for (const name of LAYER_NAMES.slice(0, 5)) assert.equal(r.layers[name].outcome, 'passed', `${f} ${name}`);
      for (const name of LAYER_NAMES.slice(5)) assert.equal(r.layers[name].outcome, 'not-run', `${f} ${name}`);
    }
  }
});

// (d) fail closed ----------------------------------------------------------------------------------

test('a layer 4 error leaves layer 5 not run, with a reason', () => {
  const r = run(text(new URL('4-semantic/time-diff-on-code.json', invalidDir)));
  assert.equal(r.layers.semantic.outcome, 'failed');
  assert.equal(r.layers['graph-and-compatibility'].outcome, 'not-run');
  assert.ok(r.layers['graph-and-compatibility'].reason.length > 0);
  assert.deepEqual(r.layers['graph-and-compatibility'].diagnostics, []);
});

test('a layer 2 or layer 3 error leaves layers 4 and 5 not run', () => {
  for (const f of ['2-structural/parameter-carries-value.json', '3-reference-integrity/input-field-missing.json']) {
    const r = run(text(new URL(f, invalidDir)));
    assert.equal(r.outcome, 'failed', f);
    for (const name of ['semantic', 'graph-and-compatibility']) {
      assert.equal(r.layers[name].outcome, 'not-run', `${f} ${name}`);
      assert.ok(r.layers[name].reason.length > 0, `${f} ${name}`);
      assert.deepEqual(r.layers[name].diagnostics, [], `${f} ${name}`);
    }
  }
});

test('a layer 4 error stops layer 5 even when layer 5 would also find a defect', () => {
  const a = snake('snake-interval.analytics.0.1.1.json');
  a.computation[0].expr.args[0] = { ref: 'input', id: 'biteTimeCertainty' };
  a.operatorSet.name = 'other-ops';
  const r = run(a);
  assert.deepEqual(r.diagnostics.map((d) => d.ruleId), ['CCIS-V4-001']);
  assert.equal(r.layers['graph-and-compatibility'].outcome, 'not-run');
});

// (e) one handmade defect per rule id, from a copy of a valid artefact -----------------------------

// Pointers of every node (in document order) of a parsed artefact whose value satisfies `pred`.
function find(root, pred, base = '', out = []) {
  if (root && typeof root === 'object') {
    if (!Array.isArray(root) && pred(root)) out.push(base);
    for (const [k, v] of Object.entries(root)) find(v, pred, `${base}/${k}`, out);
  }
  return out;
}
const at = (root, pointer) => pointer.split('/').slice(1).reduce((x, k) => x[k], root);

const INTERVAL = 'snake-interval.analytics.0.1.1.json';
const PATHWAY = 'snake-documentation.pathway.json';

const cases = [
  ['V4-001 a code input as the condition of an if', INTERVAL, (d) => { d.computation[0].expr.args[0] = { ref: 'input', id: 'biteTimeCertainty' }; },
    ['CCIS-V4-001'], ['/computation/0/expr/args/0/id']],
  ['V4-002 a not with two arguments', INTERVAL, (d) => { d.computation[0].expr.args[2].args[0].args.push({ literal: true }); },
    ['CCIS-V4-002'], ['/computation/0/expr/args/2/args/0/args']],
  ['V4-003 an undeclared parameter is read', INTERVAL, (d) => { d.computation[1].expr.args[0].args[0].args[0].args[0].id = 'targetIntervalDuratio'; },
    ['CCIS-V4-003'], ['/computation/1/expr/args/0/args/0/args/0/args/0/id']],
  ['V4-003 an undeclared input is read', INTERVAL, (d) => { d.computation[0].expr.args[2].args[0].args[0].args[0].id = 'antivenomStatu'; },
    ['CCIS-V4-003'], ['/computation/0/expr/args/2/args/0/args/0/args/0/id']],
  ['V4-003 an undeclared conversion is named', INTERVAL, (d) => { d.conversions[0].id = 'hoursToMinute'; },
    ['CCIS-V4-003', 'CCIS-V4-003'], null],
  ['V4-003 an output has no computation', INTERVAL, (d) => { d.outputs.push({ id: 'extra', kind: 'classification', labels: ['a', 'b'], states: ['needs-data'], carries: ['warnings', 'limitations', 'missingDataNotes'] }); },
    ['CCIS-V4-003'], ['/outputs/2/id']],
  ['V4-003 a computation is for an undeclared output', INTERVAL, (d) => { d.computation.push({ output: 'ghost', expr: { literal: true } }); },
    ['CCIS-V4-003'], ['/computation/2/output']],
  ['V4-004 a parameter with two units is compared without a convert', INTERVAL, (d) => {
    const [le] = find(d, (n) => n.op === 'le');
    at(d, le).args[1] = { ref: 'parameter', id: 'targetIntervalDuration' };
    d.__le = le;
  }, ['CCIS-V4-004'], (d) => [`${d.__le}/args/1/id`]],
  ['V4-005 the computation gives a state the output does not declare', INTERVAL, (d) => { d.outputs[0].states = d.outputs[0].states.filter((s) => s !== 'conflict'); },
    ['CCIS-V4-005'], (d) => find(d, (n) => n.literal === 'conflict').filter((p) => p.startsWith('/computation/0'))],
  ['V4-006 a time-zone conversion names an unknown zone', INTERVAL, (d) => { d.conversions.push({ id: 'zoneShift', version: '0.1.0', from: 'UTC', to: 'Mars/Olympus', kind: 'time-zone' }); },
    ['CCIS-V4-006'], ['/conversions/1/to']],
  ['V4-007 a declared input is never used', INTERVAL, (d) => { d.inputs.push({ key: 'extraInput', element: 'snake.envenomation-timing', field: 'biteTime', type: 'datetime', onMissing: 'needs-data' }); },
    ['CCIS-V4-007'], ['/inputs/4/key']],
  ['V4-008 an output declares a state its computation cannot give', INTERVAL, (d) => {
    const hit = find(d, (n) => n.literal === 'conflict').filter((p) => p.startsWith('/computation/1'));
    for (const p of hit) at(d, p).literal = 'not-applicable';
  }, ['CCIS-V4-008'], ['/outputs/1/states/3']],

  ['V5-001 a node outcome leads to a stage that does not exist', PATHWAY, (d) => { d.nodes[0].outcomes[0].next.stage = 'antivenom-documentaton'; },
    ['CCIS-V5-001'], ['/nodes/0/outcomes/0/next/stage']],
  ['V5-001 a transition goes via a node that does not exist', PATHWAY, (d) => { d.transitions[1].via = 'ghost-node'; },
    ['CCIS-V5-001'], ['/transitions/1/via']],
  ['V5-002 a stage no transition reaches', PATHWAY, (d) => { d.stages.push({ id: 'orphan', label: 'Orphan', kind: 'report', entry: ['Never reached.'], exit: ['Nothing.'] }); },
    ['CCIS-V5-002'], ['/stages/4']],
  ['V5-003 an outcome tests an input the node does not have', PATHWAY, (d) => { d.nodes[0].outcomes[0].when[1].input = 'readTimee'; },
    ['CCIS-V5-003'], ['/nodes/0/outcomes/0/when/1/input']],
  ['V5-004 a timing parameter no named analytics declares', PATHWAY, (d) => { d.timing[0].parameter = 'targetIntervalDuratio'; },
    ['CCIS-V5-004'], ['/timing/0/parameter']],
  ['V5-005 no outcome handles a state of the first input', PATHWAY, (d) => { d.nodes[0].outcomes.pop(); },
    ['CCIS-V5-005'], ['/nodes/0/outcomes']],
  ['V5-006 a stage that is not final has no way out', PATHWAY, (d) => { d.transitions.pop(); },
    ['CCIS-V5-006'], ['/stages/2']],
  ['V5-007 a cycle is a warning, not an error', PATHWAY, (d) => { d.transitions.push({ from: 'gap-report', to: 'presentation' }); },
    ['CCIS-V5-007'], ['/transitions/4']],
  ['V5-008 an unsupported standard major version', PATHWAY, (d) => { d.manifest.standard.version = '1.0.0'; },
    ['CCIS-V5-008'], ['/manifest/standard/version']],
  ['V5-008 an operator set the validator does not know', INTERVAL, (d) => { d.operatorSet.name = 'other-ops'; },
    ['CCIS-V5-008'], ['/operatorSet']],
];

for (const [name, file, mutate, wantIds, wantPaths] of cases) {
  test(`handmade defect: ${name}`, () => {
    const d = snake(file);
    mutate(d);
    const probe = clone(d);
    delete d.__le; // helper members used to compute a pointer are not part of the artefact
    const r = run(d);
    assert.deepEqual(r.diagnostics.map((x) => x.ruleId), wantIds, JSON.stringify(r.diagnostics));
    const paths = typeof wantPaths === 'function' ? wantPaths(probe) : wantPaths;
    if (paths) assert.deepEqual(r.diagnostics.map((x) => x.path), paths);
    for (const x of r.diagnostics) {
      assert.ok(x.message.length > 0 && x.hint.length > 0);
      assert.equal(x.severity, RULES.find((q) => q.ruleId === x.ruleId).severity);
    }
    const layer = wantIds[0].startsWith('CCIS-V4') ? 'semantic' : 'graph-and-compatibility';
    assert.notEqual(r.layers[layer].outcome, 'not-run');
    assert.equal(r.outcome, wantIds[0] === 'CCIS-V5-007' || wantIds[0] === 'CCIS-V4-007' || wantIds[0] === 'CCIS-V4-008' ? 'no-errors-so-far' : 'failed');
  });
}

test('a standalone decision node is checked by layer 5 too (inputs tested, states covered)', () => {
  const n = snake('snake-node-clotting.node.json');
  n.outcomes = n.outcomes.filter((o) => o.id !== 'status-unknown');
  n.outcomes[0].when[1].input = 'readTimee';
  const r = run(n);
  assert.deepEqual(r.diagnostics.map((d) => d.ruleId), ['CCIS-V5-003', 'CCIS-V5-005']);
});

test('a rule that cannot decide stays quiet: no timing parameter is checked when the pathway names no analytics', () => {
  const p = snake(PATHWAY);
  p.analytics = [];
  p.timing[0].parameter = 'anythingAtAll';
  const r = run(p);
  assert.deepEqual(r.diagnostics, []);
  assert.equal(r.layers['graph-and-compatibility'].outcome, 'passed');
});

// (f) the pure-library scan holds for the new file --------------------------------------------------

test('the new module has no dynamic code, file access, network, clock or randomness, and imports nothing', () => {
  const src = text(new URL('../ccis-validator-semantic.js', import.meta.url));
  const forbidden = [/\beval\b/, /\bFunction\b/, /\bimport\s*\(/, /\brequire\s*\(/, /node:/, /\bfs\b/, /\bDate\b/, /Math\.random/, /performance\.now/, /\bfetch\b/, /\bprocess\b/, /XMLHttpRequest/, /WebSocket/, /localStorage/];
  for (const re of forbidden) assert.equal(re.test(src), false, String(re));
  assert.deepEqual([...src.matchAll(/^import .* from '([^']+)';$|^\} from '([^']+)';$/gm)], []);
});

test('the new code is deterministic and does not change its input', () => {
  const frozen = deepFreeze(snake(INTERVAL));
  assert.equal(JSON.stringify(run(frozen)), JSON.stringify(run(frozen)));
  const p = deepFreeze(snake(PATHWAY));
  assert.equal(JSON.stringify(run(p)), JSON.stringify(run(p)));
});

// (g) the rule catalogue ---------------------------------------------------------------------------

test('the catalogue lists every new rule id once, with the severity the rules give', () => {
  const idList = RULES.map((x) => x.ruleId);
  assert.equal(new Set(idList).size, idList.length);
  const added = SEMANTIC_RULES.map((x) => x.ruleId);
  assert.equal(added.length, 19); // 16 from row 2.2, 3 from row 2.2b
  for (const id of added) assert.equal(idList.filter((x) => x === id).length, 1, id);
  for (const x of SEMANTIC_RULES) assert.match(x.ruleId, new RegExp(`^CCIS-V${x.layer}-\\d{3}$`));
  assert.deepEqual(SEMANTIC_RULES.filter((x) => x.severity === 'warning').map((x) => x.ruleId), ['CCIS-V4-007', 'CCIS-V4-008', 'CCIS-V4-011', 'CCIS-V5-007']);
  // Every id in the catalogue has a handmade case above (or is covered by an example).
  const covered = new Set(cases.flatMap((c) => c[3]));
  // V4-009 to V4-011 have their handmade cases in test/ccis-validator-element.test.js (row 2.2b).
  for (const id of added.filter((x) => !['CCIS-V4-009', 'CCIS-V4-010', 'CCIS-V4-011'].includes(x))) assert.ok(covered.has(id), `no handmade case for ${id}`);
});

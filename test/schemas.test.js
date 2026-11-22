import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { manifest, element, terminologyBinding, decisionNode, pathway, analytics } from '../ccis/validators/ccis-validators.js';

const validators = { manifest, element, terminologyBinding, decisionNode, pathway, analytics };
const dir = new URL('../ccis/fixtures/schemas/', import.meta.url);
const load = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
const index = load('index.json');
const run = (name, data) => { const v = validators[name]; const ok = v(data); return { ok, errors: v.errors ?? [] }; };
const clone = (o) => structuredClone(o);

for (const e of index) {
  test(`fixture ${e.file} is ${e.valid ? 'valid' : 'rejected: ' + e.diagnostic}`, () => {
    const { ok, errors } = run(e.schema, load(e.file));
    assert.equal(ok, e.valid, JSON.stringify(errors));
    if (!e.valid) {
      const hit = errors.some((x) => x.keyword === e.expect.keyword &&
        (x.instancePath.includes(e.expect.where) || JSON.stringify(x.params).includes(e.expect.where)));
      assert.ok(hit, `expected ${e.expect.keyword} at ${e.expect.where}, got ${JSON.stringify(errors)}`);
    }
  });
}

test('every fixture file is listed in the index', () => {
  const files = readdirSync(dir).filter((f) => f !== 'index.json').sort();
  assert.deepEqual(files, index.map((e) => e.file).sort());
});

test('mutations: one defect each is rejected (REQ-014, 016, 032, 036, 039, 044)', () => {
  const m = load('manifest-good-full.json');
  const el = load('element-good-full.json');
  const b = load('binding-good.json');
  const cases = [
    ['manifest', { ...m, references: [{ ...m.references[0], content: { id: 'copy' } }] }, 'embedded copy of a referenced artefact'],
    ['manifest', { ...m, references: [{ ...m.references[0], version: '1.0.0' }] }, 'both version and range'],
    ['manifest', { ...m, mandatoryExtensions: ['notx'] }, 'mandatory extension outside x- namespace'],
    ['manifest', { ...m, status: 'validated-ish' }, 'status outside lifecycle list'],
    ['element', { ...el, manifest: { ...el.manifest, type: 'pathway' } }, 'element manifest of wrong type'],
    ['element', (() => { const x = clone(el); x.fields[1].threshold = 5; return x; })(), 'threshold key on a field'],
    ['element', (() => { const x = clone(el); x.fields[0].timeSemantics = undefined; delete x.fields[0].timeSemantics; return x; })(), 'datetime without time meaning'],
    ['element', (() => { const x = clone(el); x.fields[1].epistemic = ['unknown', 'normal']; return x; })(), 'epistemic state outside the six'],
    ['element', (() => { const x = clone(el); x.fields[1].sourceClasses = ['ai-verified']; return x; })(), 'source class outside the set'],
    ['element', (() => { const x = clone(el); delete x.fields[2].binding; return x; })(), 'code field without binding'],
    ['element', (() => { const x = clone(el); x.fields[1].units = []; return x; })(), 'empty unit list'],
    ['terminologyBinding', { ...b, mapping: { status: 'lossy' } }, 'lossy mapping without confidence and note'],
    ['terminologyBinding', { mapping: { status: 'unmapped', note: 'n' }, code: 'S1' }, 'unmapped binding carrying a guessed code'],
  ];
  for (const [name, data, what] of cases) assert.equal(run(name, data).ok, false, `should reject: ${what}`);
  // and the valid counterparts stay valid
  assert.equal(run('terminologyBinding', { mapping: { status: 'unmapped', note: 'no equivalent concept' } }).ok, true);
  assert.equal(run('manifest', { ...m, 'x-extra': { any: 1 } }).ok, true);
});

test('mutations: pathway and decision node defects are rejected (REQ-025, 026, 027)', () => {
  const pw = load('pathway-good-full.json');
  const node = pw.nodes[0];
  const cases = [
    ['pathway', (() => { const x = clone(pw); delete x.elements[0].range; x.elements[0].version = '0.1.0'; return x; })(), 'element reference by exact version is not a range'],
    ['pathway', (() => { const x = clone(pw); delete x.elements[0].range; return x; })(), 'element reference with neither version nor range'],
    ['pathway', (() => { const x = clone(pw); x.stages[0].kind = 'treatment'; return x; })(), 'stage kind other than information or report'],
    ['pathway', (() => { const x = clone(pw); x.manifest.type = 'contextual-element'; return x; })(), 'pathway manifest of wrong type'],
    ['pathway', (() => { const x = clone(pw); x.analytics[0].requirement = 'maybe'; return x; })(), 'analytics neither required nor optional'],
    ['decisionNode', (() => { const x = clone(node); x.outcomes[0].kind = 'no'; return x; })(), 'unknown outcome kind'],
    ['decisionNode', (() => { const x = clone(node); x.outcomes[0].when[0].is = 'normal'; return x; })(), 'unknown state in a test'],
    ['decisionNode', (() => { const x = clone(node); x.outcomes[0].when[0].equals = 5; return x; })(), 'value comparison in a state test'],
    ['decisionNode', (() => { const x = clone(node); x.outcomes = [x.outcomes[5]]; return x; })(), 'node with a single outcome'],
    ['decisionNode', (() => { const x = clone(node); x.outcomes[0].next = {}; return x; })(), 'empty next'],
    ['decisionNode', (() => { const x = clone(node); x.outcomes[0].next = { stage: 'a', end: true }; return x; })(), 'next with both stage and end'],
  ];
  for (const [name, data, what] of cases) assert.equal(run(name, data).ok, false, `should reject: ${what}`);
  assert.equal(run('decisionNode', node).ok, true);
  assert.equal(run('pathway', { ...pw, 'x-note': 1 }).ok, true);
});

test('mutations: analytics defects are rejected (REQ-005, 028, 029, 033, 042, 066, 070, 073)', () => {
  const an = load('analytics-good-full.json');
  const cases = [
    ['recommendation field on the package', (x) => { x.recommendation = 'Synthetic'; }],
    ['empty outputs', (x) => { x.outputs = []; }],
    ['carries without limitations', (x) => { x.outputs[0].carries = ['warnings', 'missingDataNotes']; }],
    ['manifest type not analytics-package', (x) => { x.manifest.type = 'pathway'; }],
    ['ref without id', (x) => { x.computation[0].expr.args[0] = { ref: 'input' }; }],
    ['node with both op and ref', (x) => { x.computation[0].expr.args[0] = { op: 'not', args: [{ literal: true }], ref: 'input' }; }],
    ['bare number as an argument', (x) => { x.computation[0].expr.args.push(5); }],
    ['unknown ref kind', (x) => { x.computation[0].expr.args[0] = { ref: 'file', id: 'startTime' }; }],
    ['value output without unit', (x) => { delete x.outputs[0].unit; }],
    ['classification with one label', (x) => { x.outputs[1].labels = ['only']; }],
    ['table output without columns', (x) => { x.outputs[1].kind = 'table'; delete x.outputs[1].labels; }],
    ['choice parameter without choices', (x) => { delete x.parameters[1].allowedChoices; }],
    ['parameter with a value', (x) => { x.parameters[1].value = 'accept'; }],
    ['linear conversion without factor', (x) => { delete x.conversions[0].factor; }],
    ['numeric input without units', (x) => { x.inputs[0].type = 'quantity'; }],
    ['non-value state outside the five', (x) => { x.inputs[0].onMissing = 'zero'; }],
    ['zero execution limit', (x) => { x.executionProfile.maxSteps = 0; }],
    ['analytics context reference without range', (x) => { delete x.context[0].ref.range; }],
  ];
  for (const [what, fn] of cases) { const x = clone(an); fn(x); assert.equal(run('analytics', x).ok, false, `should reject: ${what}`); }
  assert.equal(run('analytics', an).ok, true);
  const ext = clone(an); ext['x-note'] = 1; assert.equal(run('analytics', ext).ok, true);
});

test('the analytics fixtures carry no numeric literal and no parameter value anywhere', () => {
  const an = load('analytics-good-full.json');
  const walk = (n) => { if (n && typeof n === 'object') { if ('literal' in n) assert.notEqual(typeof n.literal, 'number'); Object.values(n).forEach(walk); } };
  walk(an.computation);
  for (const p of an.parameters) for (const k of ['default', 'value', 'suggested']) assert.equal(k in p, false);
});

test('generated validators contain no eval, Function, dynamic import or runtime imports (D-005, D-006)', () => {
  const src = readFileSync(new URL('../ccis/validators/ccis-validators.js', import.meta.url), 'utf8');
  for (const bad of [/\beval\s*\(/, /new\s+Function/, /\bFunction\s*\(/, /\bimport\s*\(/, /\brequire\s*\(/, /^\s*import\s/m, /from\s*["']ajv/])
    assert.equal(bad.test(src), false, `forbidden pattern ${bad}`);
});

test('generated validators are up to date with the schemas', () => {
  execFileSync(process.execPath, ['scripts/build-validators.js', '--check'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
});

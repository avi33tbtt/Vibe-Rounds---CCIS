// Row 1.6: one invalid example per validator layer (layer 7 waits for amendment A-003, row 1.6b). Prototype. Synthetic data only.
// No validator exists yet. These examples are the acceptance targets for rows 2.1 to 2.3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { analytics, pathway } from '../ccis/validators/ccis-validators.js';

const validators = { analytics, pathway };
const root = new URL('../', import.meta.url);
const inv = new URL('../ccis/examples/invalid/', import.meta.url);
const text = (u) => readFileSync(u, 'utf8');
const parse = (u) => JSON.parse(text(u));
const folders = readdirSync(inv, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const cases = folders.map((f) => {
  const file = readdirSync(new URL(`${f}/`, inv)).find((n) => n.endsWith('.expected-diagnostics.json'));
  const expected = parse(new URL(`${f}/${file}`, inv));
  return { folder: f, expected, exampleUrl: new URL(expected.example.replace(/^ccis\/examples\/invalid\//, ''), inv) };
});

const leaves = (x, p = '') => {
  if (x === null || typeof x !== 'object') return [[p, x]];
  const keys = Array.isArray(x) ? x.map((_, i) => String(i)) : Object.keys(x);
  return keys.flatMap((k) => leaves(x[k], `${p}/${k}`));
};
const changed = (a, b) => {
  const A = new Map(leaves(a)), B = new Map(leaves(b)), out = new Set();
  for (const [p, v] of B) if (!A.has(p) || A.get(p) !== v) out.add(p);
  for (const p of A.keys()) if (!B.has(p)) out.add(p);
  return [...out].sort();
};
const has = (doc, ptr) => ptr.split('/').slice(1).reduce((o, k) => (o !== undefined && o !== null && typeof o === 'object' && k in o ? o[k] : undefined), doc) !== undefined;

test('the eight layers: seven examples exist, layer 7 is not built and is listed as a gap', () => {
  assert.deepEqual(cases.map((c) => c.expected.layer), [1, 2, 3, 4, 5, 6, 8]);
  for (const c of cases) assert.ok(c.folder.startsWith(`${c.expected.layer}-`), c.folder);
  assert.match(text(new URL('README.md', inv)), /layer 7/i);
});

test('every base file still passes its schema', () => {
  for (const c of cases) {
    const v = validators[c.expected.schema];
    assert.equal(v(parse(new URL(c.expected.base, root))), true, c.folder + ' ' + JSON.stringify(v.errors));
  }
});

test('layer 1 is not parseable as JSON; the others parse', () => {
  for (const c of cases) {
    if (c.expected.layer === 1) assert.throws(() => JSON.parse(text(c.exampleUrl)), SyntaxError);
    else assert.doesNotThrow(() => JSON.parse(text(c.exampleUrl)), c.folder);
  }
});

test('layer 2 fails its schema; layers 3 to 8 pass the schemas (only a later layer can refuse them)', () => {
  for (const c of cases) {
    if (c.expected.layer === 1) continue;
    const v = validators[c.expected.schema];
    const ok = v(parse(c.exampleUrl));
    assert.equal(ok, c.expected.layer !== 2, `${c.folder} ${JSON.stringify(v.errors)}`);
  }
});

test('each example differs from its base only at the declared paths', () => {
  for (const c of cases) {
    if (c.expected.layer === 1) continue;
    assert.deepEqual(changed(parse(new URL(c.expected.base, root)), parse(c.exampleUrl)), [...c.expected.changedPaths].sort(), c.folder);
  }
});

test('layer 1 is the base file with its final closing brace removed and nothing else', () => {
  const c = cases.find((x) => x.expected.layer === 1);
  const base = JSON.stringify(parse(new URL(c.expected.base, root)), null, 2);
  assert.equal(text(c.exampleUrl), base.slice(0, base.lastIndexOf('\n')));
  const lines = text(c.exampleUrl).split('\n');
  assert.deepEqual(c.expected.diagnostics[0].path, { line: lines.length, column: lines.at(-1).length + 1 });
});

test('expected diagnostics: all five parts, stable unique rule ids in the layer, paths that exist', () => {
  const seen = new Set();
  for (const c of cases) {
    assert.ok(c.expected.diagnostics.length >= 1, c.folder);
    const doc = c.expected.layer === 1 ? null : parse(c.exampleUrl);
    for (const d of c.expected.diagnostics) {
      assert.deepEqual(Object.keys(d).sort(), ['hint', 'message', 'path', 'ruleId', 'severity'], c.folder);
      assert.ok(['error', 'warning', 'info'].includes(d.severity));
      assert.match(d.ruleId, /^CCIS-V[1-8]-\d{3}$/);
      assert.equal(Number(d.ruleId[6]), c.expected.layer, `${d.ruleId} is in layer ${c.expected.layer}`);
      assert.equal(seen.has(d.ruleId), false, `${d.ruleId} is unique`);
      seen.add(d.ruleId);
      assert.ok(d.message.length > 10 && d.hint.length > 10);
      if (doc) assert.equal(has(doc, d.path), true, `${c.folder} ${d.path}`);
    }
  }
});

test('the defects are plain: no number in any changed value, no threshold, dose or real code', () => {
  for (const c of cases) {
    if (c.expected.layer === 1) continue;
    const doc = parse(c.exampleUrl);
    for (const p of c.expected.changedPaths) {
      const v = p.split('/').slice(1).reduce((o, k) => o[k], doc);
      assert.equal(typeof v, 'string', `${c.folder} ${p}`);
      assert.equal(/\d/.test(v), false, `${c.folder} ${p}`);
    }
  }
});

test('parameters in every example stay disabled and value-free except the one structural defect', () => {
  for (const c of cases) {
    if (c.expected.layer === 1 || c.expected.schema !== 'analytics') continue;
    for (const [i, p] of parse(c.exampleUrl).parameters.entries()) {
      assert.equal(p.enabledByDefault, false, c.folder);
      if (!(c.expected.layer === 2 && i === 0)) assert.equal('value' in p, false, c.folder);
    }
  }
});

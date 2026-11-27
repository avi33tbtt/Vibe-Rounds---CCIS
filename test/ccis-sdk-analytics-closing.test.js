// Row 4.2d.2: outputs and the closing analytics members, proved on the snake examples. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  outputs, interpretation, executionProfile, evidence, provenance, tests,
  OUTPUT_KINDS, VALUE_TYPES, CARRIES, SOURCE_KINDS,
} from '../ccis-sdk-analytics.js';
import { SdkError } from '../ccis-sdk.js';
import { compareRoutes } from '../ccis-compile.js';

const dir = new URL('../ccis/examples/snake/', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('../ccis/schemas/analytics.schema.json', import.meta.url), 'utf8'));
const files = readdirSync(dir).filter((n) => n.includes('analytics'));
const refused = (fn, code, path) => {
  try { fn(); } catch (e) { assert.ok(e instanceof SdkError); if (code) assert.equal(e.code, code); if (path !== undefined) assert.equal(e.path, path); return e; }
  assert.fail('not refused');
};
const builders = { outputs, interpretation, executionProfile, evidence, provenance }; // no snake example has `tests` (D-243)
const out = (extra = {}) => ({ id: 'a', kind: 'value', valueType: 'integer', unit: '1', states: ['needs-data'], carries: ['warnings', 'limitations', 'missingDataNotes'], ...extra });

test('4.2d.2: the five members of all four snake examples are identical on the code route', () => {
  assert.equal(files.length, 4);
  for (const f of files) {
    const a = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    for (const [name, build] of Object.entries(builders)) {
      const r = compareRoutes([{ name: 'json', input: JSON.stringify(a[name]) }, { name: 'code', input: build(a[name]) }]);
      assert.equal(r.identical, true, `${f} ${name}`);
      assert.equal(r.routes[0].checksum, r.routes[1].checksum);
      assert.ok(Object.isFrozen(build(a[name])));
    }
  }
});

test('4.2d.2: the four enum lists equal the schema', () => {
  const d = schema.$defs.output.properties;
  assert.deepEqual([...OUTPUT_KINDS], d.kind.enum);
  assert.deepEqual([...VALUE_TYPES], d.valueType.enum);
  assert.deepEqual([...CARRIES], d.carries.items.enum);
  assert.deepEqual([...SOURCE_KINDS], schema.properties.evidence.properties.sources.items.properties.kind.enum);
});

test('4.2d.2: carries, kind rules', () => {
  refused(() => outputs([out({ carries: ['warnings', 'missingDataNotes'] })]), 'S-004');
  const { unit, ...noUnit } = out();
  refused(() => outputs([noUnit]), 'S-002', '0.unit');
  refused(() => outputs([out({ labels: ['a', 'b'] })]), 'S-004', '0.labels');
  assert.ok(outputs([out(), { id: 'c', kind: 'table', columns: [{ key: 'k', label: 'K' }], states: ['indeterminate'], carries: ['warnings', 'limitations', 'missingDataNotes', 'certainty'] }]));
});

test('4.2d.2: executionProfile integers', () => {
  const ok = { maxSteps: 1, maxDepth: 1, maxOutputBytes: 1 };
  assert.ok(executionProfile(ok));
  for (const bad of [0, 1.5, '9']) refused(() => executionProfile({ ...ok, maxSteps: bad }), 'S-003', 'maxSteps');
});

const t = (over = {}) => ({ id: 't', fixture: 'f-1', enables: [], expect: [{ output: 'a', state: 'needs-data' }], ...over });
test('4.2d.2: tests: testOnly and expect rules', () => {
  refused(() => tests([t({ enables: [{ parameter: 'p', testOnly: false }] })]), 'S-003', '0.enables.0.testOnly');
  refused(() => tests([t({ enables: [{ parameter: 'p' }] })]), 'S-002');
  refused(() => tests([t({ expect: [{ output: 'a', state: 'needs-data', label: 'x' }] })]), 'S-004', '0.expect.0');
  refused(() => tests([t({ expect: [{ output: 'a' }] })]), 'S-004');
  const spec = [t({ enables: [{ parameter: 'p', testOnly: true }], expect: [{ output: 'a', matchesFixture: true }] })];
  const r = compareRoutes([{ name: 'json', input: JSON.stringify(spec) }, { name: 'code', input: tests(spec) }]);
  assert.equal(r.identical, true);
  assert.ok(Object.isFrozen(tests(spec)[0].expect));
});

test('4.2d.2: x- allowed on an output, refused on interpretation; paths carry indices', () => {
  assert.equal(outputs([out({ 'x-note': 1 })])['0']['x-note'], 1);
  refused(() => interpretation({ meaning: 'm', prohibited: ['p'], 'x-a': 1 }), 'S-001', 'x-a');
  refused(() => outputs([out(), out({ kind: 'nope' })]), 'S-003', '1.kind');
});

test('4.2d.2: evidence may have no sources; provenance and interpretation are closed', () => {
  assert.ok(evidence({ statement: 's', sources: [] }));
  refused(() => evidence({ statement: 's', sources: [{ kind: 'blog', citation: 'c' }] }), 'S-003');
  refused(() => provenance({ origin: 'o' }), 'S-002', 'basis');
  refused(() => interpretation({ meaning: 'm', prohibited: [] }), 'S-003', 'prohibited');
});

test('4.2d.2: hostile string never in a message; purity scan', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const e = refused(() => outputs([out({ kind: evil })]), 'S-003');
  assert.ok(!String(e.message).includes(evil));
  const src = readFileSync(new URL('../ccis-sdk-analytics.js', import.meta.url), 'utf8');
  assert.ok(!/\b(eval|Function|Date\.now|Math\.random|fetch|readFile|import\()/.test(src.replace(/^import .*$/gm, '')));
});

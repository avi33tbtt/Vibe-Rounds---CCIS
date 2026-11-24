// Row 2.4: the compiler (canonical form, checksum, equivalence harness, fail closed). Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize, checksumOf, verifyChecksum, compileArtefact, compareRoutes, CANONICAL_FORM, COMPILER, COMPILE_REFUSALS } from '../ccis-compile.js';
import { canonicalJson } from '../ccis-demo-record.js';
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
const expected = read(new URL('../ccis/fixtures/compile/expected-checksums.json', import.meta.url)).checksums;
const WITH_MANIFEST = snakeFiles.filter((f) => 'manifest' in read(new URL(f, snakeDir)));
const WITHOUT_MANIFEST = snakeFiles.filter((f) => !WITH_MANIFEST.includes(f));
const compile = (input, options = { known, fixtures }) => compileArtefact(input, options);

// Three representations of one document. These are STAND-INS for authoring routes, not three real routes:
// the code SDK (row 4.2), the form editor (4.4) and FHIR Mode (6.1) plug into the same harness later.
const reverseMembers = (x) => (Array.isArray(x) ? x.map(reverseMembers)
  : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).reverse().map((k) => [k, reverseMembers(x[k])])) : x);
const standIns = (file) => {
  const committed = text(new URL(file, snakeDir));
  const parsed = JSON.parse(committed);
  return [
    { name: 'committed text', input: committed },
    { name: 'code route stand-in (in-memory, members reversed)', input: reverseMembers(parsed) },
    { name: 'form route stand-in (4-space indent, CRLF, members reversed)', input: JSON.stringify(reverseMembers(parsed), null, 4).replace(/\n/g, '\r\n') },
  ];
};

// (a) vectors worked by hand ---------------------------------------------------------------------------

test('vectors: sorted members, kept array order, the hand-checked checksum, and the SHA-256 of abc', () => {
  const c = canonicalize('{"b":1,"a":[true,null]}');
  assert.deepEqual(c, { ok: true, text: '{"a":[true,null],"b":1}' });
  assert.equal(checksumOf(c.text), 'sha256:51705a2c9eb3e7e410a58f696a770c3ac3885a0cf43eb7fc88f5e47c11d4d30d');
  assert.equal(checksumOf('abc'), 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(CANONICAL_FORM, 'ccis-canonical-json/1');
  assert.deepEqual(COMPILER, { name: 'ccis-compile', version: '0.1.0' });
});

test('canonical form: numbers, strings, whitespace, order of arrays, x- members and non-ASCII text', () => {
  assert.equal(canonicalize('{ "n": [ 1.0, 1e0, -0, 0.5, 10 ], "s": "é\\u0041\\n", "x-note": {"b":2,"a":1} }\r\n').text,
    '{"n":[1,1,0,0.5,10],"s":"éA\\n","x-note":{"a":1,"b":2}}');
  assert.equal(canonicalize([3, 1, 2]).text, '[3,1,2]');
  assert.equal(canonicalize('"é"').text, '"é"');
  assert.equal(canonicalize('0.1').text, '0.1');
});

test('the expected checksums were calculated independently and cover the 6 compilable files', () => {
  assert.deepEqual(Object.keys(expected).sort(), WITH_MANIFEST);
  assert.equal(WITH_MANIFEST.length, 6);
  assert.equal(WITHOUT_MANIFEST.length, 3);
});

// (b) equivalence harness on stand-ins -------------------------------------------------------------------

test('harness: three representations of each compilable file give identical bytes and the independently calculated checksum', () => {
  for (const f of WITH_MANIFEST) {
    const routes = standIns(f);
    const r = compareRoutes(routes);
    assert.equal(r.identical, true, f);
    assert.equal(r.firstDifference, null);
    assert.equal(r.routes.length, 3);
    for (const x of r.routes) assert.equal(x.checksum, expected[f], `${f} / ${x.name}`);
    for (const route of routes) assert.equal(compile(route.input).compiled.checksum, expected[f], `${f} compile / ${route.name}`);
  }
});

// (c) negative controls ----------------------------------------------------------------------------------

test('harness controls: a swapped array item, a changed number and a dropped member are each found, at the right place', () => {
  const base = { a: [1, 2, 3], m: { x: 1, y: 2 }, n: 5 };
  const swapped = { ...clone(base), a: [1, 3, 2] };
  const changed = { ...clone(base), n: 6 };
  const dropped = { ...clone(base), m: { x: 1 } };
  const shorter = { ...clone(base), a: [1, 2] };
  const kind = { ...clone(base), n: '5' };
  const expectDiff = (other, path, k) => {
    const r = compareRoutes([{ name: 'one', input: base }, { name: 'two', input: other }]);
    assert.equal(r.identical, false);
    assert.deepEqual(r.firstDifference, { route: 'two', path, kind: k });
  };
  expectDiff(swapped, '/a/1', 'different-value');
  expectDiff(changed, '/n', 'different-value');
  expectDiff(dropped, '/m/y', 'member-only-in-one');
  expectDiff(shorter, '/a', 'array-length');
  expectDiff(kind, '/n', 'different-value-kind');
  assert.equal(compareRoutes([{ name: 'one', input: base }, { name: 'two', input: clone(base) }]).identical, true);
});

test('harness: a refused route is reported as such, never as identical; fewer than two routes cannot be compared', () => {
  const r = compareRoutes([{ name: 'good', input: '{"a":1}' }, { name: 'bad', input: '{"a":1,"a":2}' }]);
  assert.equal(r.identical, false);
  assert.deepEqual(r.firstDifference, { route: 'bad', path: '/a', kind: 'route-refused' });
  assert.deepEqual(r.routes[1], { name: 'bad', ok: false, code: 'CCIS-C-002' });
  assert.equal(compareRoutes([{ name: 'only', input: '{}' }]).identical, false);
  assert.equal(compareRoutes('nope').identical, false);
});

test('harness output shows paths and kinds, never the values', () => {
  const r = compareRoutes([{ name: 'one', input: { secret: 'alpha' } }, { name: 'two', input: { secret: 'omega' } }]);
  const shown = JSON.stringify(r);
  assert.equal(shown.includes('alpha'), false);
  assert.equal(shown.includes('omega'), false);
});

// (d) every refusal id --------------------------------------------------------------------------------------

const refused = (input, code, options) => {
  const r = options === undefined ? compile(input) : compileArtefact(input, options);
  assert.equal(r.ok, false);
  assert.equal(r.code, code, r.reason);
  assert.equal('compiled' in r, false);
  assert.equal('checksum' in r, false);
  assert.equal('canonical' in r, false);
  assert.equal(typeof r.reason, 'string');
  return r;
};

test('the refusal catalogue has 8 ids, C-001 to C-008', () => {
  assert.deepEqual(COMPILE_REFUSALS.map((r) => r.code), ['CCIS-C-001', 'CCIS-C-002', 'CCIS-C-003', 'CCIS-C-004', 'CCIS-C-005', 'CCIS-C-006', 'CCIS-C-007', 'CCIS-C-008']);
});

test('C-001: text that is not JSON, with the place of the break', () => {
  for (const bad of ['{"a":', '{"a":1,}', '{"a":01}', "{'a':1}", '\uFEFF{"a":1}', '{"a":1} x', '', '{"a":"tab\there"}', '{"a":"\\x"}', '{"a":tru}']) {
    const r = refused(bad, 'CCIS-C-001');
    assert.match(r.reason, /line \d+, column \d+/);
  }
  assert.deepEqual(canonicalize('{\n  "a": ?\n}').position, { line: 2, column: 8 });
  assert.equal(refused('['.repeat(300) + ']'.repeat(300), 'CCIS-C-001').ok, false);
});

test('C-002: a repeated member name, at any depth, with its path', () => {
  assert.equal(refused('{"a":1,"a":2}', 'CCIS-C-002').path, '/a');
  assert.equal(refused('{"x":[{"b":1,"b":1}]}', 'CCIS-C-002').path, '/x/0/b');
  assert.equal(canonicalize('{"a":{"k":1},"b":{"k":2}}').ok, true);
});

test('C-003: numbers that cannot be held safely (text and in-memory)', () => {
  for (const bad of ['{"a":1e999}', '{"a":9007199254740993}', '{"a":-9007199254740993}', '{"a":0.12345678901234567890}', '{"a":1e20}', '{"a":1.23456789012345678}']) refused(bad, 'CCIS-C-003');
  for (const bad of [NaN, Infinity, -Infinity, 2 ** 60]) refused({ a: bad }, 'CCIS-C-003');
  for (const ok of ['{"a":9007199254740991}', '{"a":0.1}', '{"a":0.10}', '{"a":1.2345678901234567}', '{"a":1.5}', '{"a":-0}']) assert.equal(canonicalize(ok).ok, true, ok);
  assert.equal(refused('{"a":[1,{"b":1e999}]}', 'CCIS-C-003').path, '/a/1/b');
});

test('C-004: in-memory values that are not plain JSON, and cycles', () => {
  const cycle = { a: 1 }; cycle.self = cycle;
  class Thing { constructor() { this.a = 1; } }
  const sparse = [1]; sparse[3] = 2;
  const getter = {}; Object.defineProperty(getter, 'a', { get: () => 1, enumerable: true });
  const hidden = {}; Object.defineProperty(hidden, 'a', { value: 1, enumerable: false });
  const symbol = { [Symbol('s')]: 1 };
  for (const bad of [undefined, { a: undefined }, { a: () => 1 }, { a: Symbol('x') }, { a: 10n }, { a: new Date(0) }, { a: new Map() }, new Thing(), sparse, cycle, getter, hidden, symbol]) {
    refused(bad, 'CCIS-C-004');
  }
  const shared = { k: 1 };
  assert.equal(canonicalize({ a: shared, b: shared }).text, '{"a":{"k":1},"b":{"k":1}}');
  assert.equal(canonicalize(Object.assign(Object.create(null), { a: 1 })).text, '{"a":1}');
});

test('C-005: lone surrogates in strings and member names', () => {
  refused('{"a":"\\ud800"}', 'CCIS-C-005');
  refused('{"\\udc00":1}', 'CCIS-C-005');
  refused({ a: '\ud800' }, 'CCIS-C-005');
  refused({ ['\udc00']: 1 }, 'CCIS-C-005');
  assert.equal(canonicalize('{"a":"\\ud83d\\ude00"}').ok, true);
});

test('C-006: a member named __proto__, from text and from memory', () => {
  assert.equal(refused('{"a":{"__proto__":1}}', 'CCIS-C-006').path, '/a/__proto__');
  refused(JSON.parse('{"__proto__":1}'), 'CCIS-C-006');
});

test('C-007: an artefact that does not pass all eight layers gives no output (an unresolved dependency, and a layer 2 example)', () => {
  const pathway = text(new URL('snake-documentation.pathway.json', snakeDir));
  const lonely = refused(pathway, 'CCIS-C-007', { known: [JSON.parse(pathway)], fixtures });
  assert.match(lonely.reason, /layer 3, reference-integrity/);
  assert.ok(lonely.diagnostics.length > 0);
  assert.ok(lonely.diagnostics.every((d) => d.severity === 'error'));
  const dir = new URL('2-structural/', invalidDir);
  const file = readdirSync(dir).find((f) => f.endsWith('.json') && !f.includes('expected'));
  const r = refused(text(new URL(file, dir)), 'CCIS-C-007');
  assert.match(r.reason, /layer 2, structural/);
});

test('C-007 also covers a layer that did not run, and the same artefact compiles once the dependency is known', () => {
  const pathway = text(new URL('snake-documentation.pathway.json', snakeDir));
  assert.equal(compile(pathway).ok, true);
  assert.equal(compile(JSON.parse(pathway)).ok, true);
});

test('C-008: a lone node or binding has no manifest, so it cannot be named or pinned', () => {
  assert.equal(WITHOUT_MANIFEST.length, 3);
  for (const f of WITHOUT_MANIFEST) {
    const r = refused(text(new URL(f, snakeDir)), 'CCIS-C-008');
    assert.match(r.reason, /cannot be named or pinned/);
    assert.equal(canonicalize(text(new URL(f, snakeDir))).ok, true, 'it can still be canonicalised');
  }
});

// (e) old bytes stay valid -----------------------------------------------------------------------------------

test('the canonical text equals canonicalJson of the demo module on all 9 valid snake files', () => {
  for (const f of snakeFiles) {
    const doc = read(new URL(f, snakeDir));
    assert.equal(canonicalize(text(new URL(f, snakeDir))).text, canonicalJson(doc), f);
  }
});

// (f) determinism, warnings, the checksum is not in the artefact, verification ----------------------------------

test('compile: subject, versions, checksum, and byte-identical output on two runs with a frozen input', () => {
  for (const f of WITH_MANIFEST) {
    const doc = deepFreeze(read(new URL(f, snakeDir)));
    const before = JSON.stringify(doc);
    const a = compile(doc);
    const b = compile(doc);
    assert.equal(a.ok, true, f);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.equal(JSON.stringify(doc), before);
    assert.deepEqual(a.compiled.subject, { id: doc.manifest.id, type: doc.manifest.type, version: doc.manifest.version });
    assert.equal(a.compiled.canonicalForm, CANONICAL_FORM);
    assert.deepEqual(a.compiled.compiler, COMPILER);
    assert.equal(a.compiled.checksum, expected[f]);
    assert.equal(verifyChecksum(a.compiled.canonical, a.compiled.checksum).ok, true);
    assert.deepEqual(a.compiled.warnings, []);
    assert.equal(a.compiled.canonical.includes('sha256:'), false, 'the checksum is not held inside the artefact');
  }
});

test('warnings do not block, and are carried by rule id and path', () => {
  const e = clone(read(new URL('snake-envenomation.element.json', snakeDir)));
  e.fields.push({ key: 'testQuantity', label: 'A test quantity', type: 'quantity', cardinality: { min: 0, max: 1 }, units: ['{beats}/min'], epistemic: ['absent'], sourceClasses: ['clinician-entered'] });
  const r = compile(e, { known: [e, ...known.filter((k) => k.manifest?.id !== e.manifest.id)], fixtures });
  assert.equal(r.ok, true);
  assert.equal(r.compiled.warnings.length, 1);
  assert.equal(r.compiled.warnings[0].ruleId, 'CCIS-V4-011');
  assert.equal(typeof r.compiled.warnings[0].path, 'string');
});

test('verifyChecksum accepts the right value and refuses a changed byte, a wrong prefix, upper case, a short value and an unknown algorithm', () => {
  const t = '{"a":1}';
  const good = checksumOf(t);
  assert.equal(verifyChecksum(t, good).ok, true);
  assert.equal(verifyChecksum('{"a":2}', good).ok, false);
  assert.match(verifyChecksum('{"a":2}', good).reason, /does not match/);
  assert.equal(verifyChecksum(t, good.replace('sha256:', '')).ok, false);
  assert.equal(verifyChecksum(t, `sha256:${good.slice(7).toUpperCase()}`).ok, false);
  assert.equal(verifyChecksum(t, good.slice(0, -1)).ok, false);
  assert.match(verifyChecksum(t, `md5:${good.slice(7)}`).reason, /algorithm this version does not support/);
  assert.equal(verifyChecksum(t, 42).ok, false);
  assert.equal(verifyChecksum(5, good).ok, false);
  assert.equal(good, `sha256:${createHash('sha256').update(t).digest('hex')}`);
});

// (g) the library is pure --------------------------------------------------------------------------------------

test('source: no clock, randomness, network, file access, eval or dynamic import; the only imports are node:crypto and the validator', () => {
  const src = text(new URL('../ccis-compile.js', import.meta.url));
  const code = src.replace(/^\s*\/\/.*$/gm, '');
  for (const bad of [/new Date/, /Date\.now/, /Math\.random/, /\bfetch\b/, /XMLHttpRequest/, /readFile/, /writeFile/, /\beval\b/, /new Function/, /\bimport\(/, /\bprocess\b/, /localStorage/, /randomBytes|randomUUID/]) {
    assert.equal(bad.test(code), false, String(bad));
  }
  const imports = [...code.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['./ccis-validator.js', 'node:crypto']);
});

// (h) the CLI ------------------------------------------------------------------------------------------------------

const cli = (args) => {
  const o = []; const e = [];
  const code = main(args, { out: (s) => o.push(s), err: (s) => e.push(s) });
  return { code, out: o.join('\n'), err: e.join('\n') };
};
const path = (u) => fileURLToPath(u);

test('CLI: compile writes the exact bytes and the metadata; sha256sum of the file equals the checksum; the same bytes again are fine', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccis-compile-'));
  try {
    const f = 'snake-interval.analytics.json';
    const args = ['compile', path(new URL(f, snakeDir)), '--out', dir, '--known', path(snakeDir), '--fixtures', path(fixtureDir)];
    const first = cli(args);
    assert.equal(first.code, 0, first.err);
    assert.match(first.out, new RegExp(expected[f]));
    const bytes = text(join(dir, 'snake-interval.analytics.canonical.json'));
    assert.equal(bytes.endsWith('\n'), false);
    assert.equal(`sha256:${createHash('sha256').update(readFileSync(join(dir, 'snake-interval.analytics.canonical.json'))).digest('hex')}`, expected[f]);
    const meta = JSON.parse(text(join(dir, 'snake-interval.analytics.compiled.json')));
    assert.equal(meta.checksum, expected[f]);
    assert.equal('canonical' in meta, false);
    assert.equal(text(join(dir, 'snake-interval.analytics.compiled.json')), `${canonicalJson(meta)}\n`);
    assert.equal(cli(args).code, 0);
    writeFileSync(join(dir, 'snake-interval.analytics.canonical.json'), '{}');
    const clash = cli(args);
    assert.equal(clash.code, 2);
    assert.match(clash.err, /already holds different bytes/);
    assert.equal(text(join(dir, 'snake-interval.analytics.canonical.json')), '{}');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: a refusal prints the code and reason, exits 1 and writes nothing; usage errors exit 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccis-compile-'));
  try {
    const node = path(new URL('snake-node-clotting.node.json', snakeDir));
    const r = cli(['compile', node, '--out', dir, '--known', path(snakeDir)]);
    assert.equal(r.code, 1);
    assert.match(r.err, /refused CCIS-C-008/);
    assert.deepEqual(readdirSync(dir), []);
    const pathway = path(new URL('snake-documentation.pathway.json', snakeDir));
    const lonely = cli(['compile', pathway, '--out', dir]);
    assert.equal(lonely.code, 1);
    assert.match(lonely.err, /refused CCIS-C-007/);
    assert.match(lonely.err, /error CCIS-V3-/);
    assert.deepEqual(readdirSync(dir), []);
    assert.equal(cli(['compile', pathway]).code, 2);
    assert.equal(cli(['compile', '--out', dir]).code, 2);
    assert.equal(cli(['compile', pathway, node, '--out', dir]).code, 2);
    assert.equal(cli(['compile', path(new URL('nope.json', snakeDir)), '--out', dir]).code, 2);
    assert.equal(cli(['compile', pathway, '--out']).code, 2);
    assert.equal(cli(['compile', pathway, '--out', dir, '--what']).code, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: validate still works after the shared loaders were extracted', () => {
  const file = path(new URL('snake-interval.analytics.json', snakeDir));
  assert.equal(cli(['validate', file, '--known', path(snakeDir), '--fixtures', path(fixtureDir)]).code, 0);
  assert.equal(cli(['validate', file, '--known', path(new URL('nope/', snakeDir))]).code, 2);
  assert.equal(existsSync(path(snakeDir)), true);
});

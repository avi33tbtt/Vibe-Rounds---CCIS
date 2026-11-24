// Row 3.6: the local test marketplace (ccis-market.js, scripts/market-build.js, market/). Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { importEnvelope } from '../ccis-import.js';
import { canonicalize, checksumOf } from '../ccis-compile.js';
import { resolveCompatibility } from '../ccis-compat.js';
import { planRun } from '../ccis-run.js';
import {
  emptyMarket, publishArtefact, lintArtefact, resolve, heldFrom, pin, verifyPin, loadMarket, indexText,
  M_REFUSALS, LINT_RULES, PUBLISHABLE_TYPES, MARKET_FORMAT,
} from '../ccis-market.js';
import { buildMarket, main as buildMain, ORDER } from '../scripts/market-build.js';

const exDir = new URL('../ccis/examples/snake/', import.meta.url);
const invalidDir = new URL('../ccis/examples/invalid/', import.meta.url);
const fxDir = new URL('../ccis/fixtures/snake/', import.meta.url);
const marketDir = new URL('../market/', import.meta.url);
const text = (u) => readFileSync(u, 'utf8');
const read = (u) => JSON.parse(text(u));
const clone = (x) => JSON.parse(JSON.stringify(x));
const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };
const ex = (f) => read(new URL(f, exDir));
const fixtures = read(new URL('index.json', fxDir)).cases.map((c) => c.case);
const expected = read(new URL('../ccis/fixtures/compile/expected-checksums.json', import.meta.url)).checksums;
const snakeFiles = readdirSync(exDir).filter((f) => f.endsWith('.json')).sort();

const ELEMENT = ex('snake-envenomation.element.json');
const INTERVAL = ex('snake-interval.analytics.json');
const INTERVAL_011 = ex('snake-interval.analytics.0.1.1.json');
const PATH = ex('snake-documentation.pathway.json');
const NODE = ex('snake-node-clotting.node.json');
const BINDING = ex('snake-demo-terminology.binding.json');

// What the real market/ folder holds, read the way a client would read it.
function readFolder() {
  const files = {};
  const walk = (dir, base) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const rel = base === '' ? e.name : `${base}/${e.name}`;
      if (e.isDirectory()) walk(new URL(`${e.name}/`, dir), rel);
      else if (rel !== 'index.json' && e.name !== '.gitattributes') files[rel] = text(new URL(rel, marketDir));
    }
  };
  walk(marketDir, '');
  return { indexText: text(new URL('index.json', marketDir)), files };
}
const REAL = (() => { const r = loadMarket(readFolder()); assert.equal(r.ok, true, JSON.stringify(r)); return r.market; })();

const reached = new Set();
const SENTENCE = Object.fromEntries(M_REFUSALS.map((r) => [r.id, r.sentence]));
const refused = (r, id) => {
  assert.equal(r.ok, false, `expected ${id}`);
  assert.equal(r.refusal.id, id, JSON.stringify(r.refusal));
  assert.equal(r.refusal.reason, SENTENCE[id]);
  for (const k of ['market', 'entry', 'artefact', 'pin', 'held']) assert.equal(k in r, false, `a refusal carries no ${k}`);
  reached.add(id);
  return r.refusal;
};
const pub = (market, artefact, extra = {}) => publishArtefact({ market, artefact, fixtures, ...extra });
const must = (r) => { assert.equal(r.ok, true, JSON.stringify(r.refusal ?? r)); return r.market; };
const withManifest = (doc, over) => { const d = clone(doc); Object.assign(d.manifest, over); return d; };
const ELEMENT_MARKET = must(pub(emptyMarket(), ELEMENT));
const entryOf = (m, id, version) => m.index.entries.find((e) => e.id === id && e.version === version);
const INTERVAL_ID = 'snake.bite-to-antivenom-interval';
const edited = (market, fn) => { const m = clone(market); fn(m); return m; };

// =============================================================================================
// (a) The real market/ folder
// =============================================================================================

test('(a) the committed market/ loads and holds the six snake packages in order', () => {
  assert.equal(REAL.index.format, MARKET_FORMAT);
  assert.deepEqual(REAL.index.entries.map((e) => `${e.id}@${e.version}`), [
    'snake.bite-to-antivenom-interval@0.1.0', 'snake.bite-to-antivenom-interval@0.1.1',
    'snake.clotting-documentation-completeness@0.1.0', 'snake.clotting-documentation-completeness@0.1.1',
    'snake.documentation-path@0.1.0', 'snake.envenomation-timing@0.1.0',
  ]);
  assert.equal(indexText(REAL), text(new URL('index.json', marketDir)), 'the index text is exactly what the folder holds');
  assert.deepEqual(REAL.index.entries.map((e) => e.type).sort(), ['analytics-package', 'analytics-package', 'analytics-package', 'analytics-package', 'contextual-element', 'pathway']);
});

test('(a) every checksum equals the independent calculation and the sha256 of the file on disk', () => {
  for (const [file, sum] of Object.entries(expected)) {
    const m = ex(file).manifest;
    assert.equal(entryOf(REAL, m.id, m.version).checksum, sum, file);
  }
  for (const e of REAL.index.entries) {
    const bytes = readFileSync(new URL(e.path, marketDir));
    assert.equal(`sha256:${createHash('sha256').update(bytes).digest('hex')}`, e.checksum, e.path);
    assert.equal(text(new URL(e.path, marketDir)).endsWith('\n'), false, 'no trailing newline: sha256sum of the file is the checksum');
  }
});

test('(a) the build script rebuilds the same folder (--check passes) and two builds are byte-identical', () => {
  assert.equal(buildMain(['--check']), 0);
  const a = buildMarket();
  const b = buildMarket();
  assert.equal(indexText(a), indexText(b));
  assert.deepEqual(a.files, b.files);
  assert.equal(indexText(a), indexText(REAL));
  assert.deepEqual(a.files, REAL.files);
  assert.deepEqual(ORDER.length, 6);
});

test('(a) index entries hold no author prose and no clock; every entry passed all eight layers', () => {
  for (const e of REAL.index.entries) {
    assert.deepEqual(Object.keys(e).sort(), ['canonicalForm', 'checksum', 'compiler', 'id', 'path', 'references', 'standard', 'status', 'type', 'validation', 'version', 'warnings']);
    assert.equal(e.validation.outcome, 'passed');
    assert.equal(Object.values(e.validation.layers).length, 8);
    assert.ok(Object.values(e.validation.layers).every((o) => o === 'passed'));
    assert.deepEqual(e.validation.validator, { name: 'ccis-validator', version: '0.1.0' });
    assert.equal('assurance' in e.validation, false, 'no clinical claim is carried');
  }
  assert.equal(/\d{4}-\d{2}-\d{2}T/.test(text(new URL('index.json', marketDir))), false, 'no timestamp');
  assert.deepEqual(entryOf(REAL, 'snake.documentation-path', '0.1.0').references.map((r) => r.id).sort(),
    ['snake.bite-to-antivenom-interval', 'snake.clotting-documentation-completeness', 'snake.envenomation-timing']);
});

const RUNTIME = { standardMajors: [0], engine: { version: '0.1.0' }, operatorSet: { name: 'ccis-core-ops', majors: [0] }, limits: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 }, understoodExtensions: [] };
const REFS = [
  { id: 'snake.envenomation-timing', type: 'contextual-element', range: '^0.1.0' },
  { id: 'snake.documentation-path', type: 'pathway', version: '0.1.0' },
  { id: INTERVAL_ID, type: 'analytics-package', version: '0.1.1' },
  { id: 'snake.clotting-documentation-completeness', type: 'analytics-package', version: '0.1.1' },
];

test('(a) packages resolved from the market give the same compatibility outcome and run plan as the example files', () => {
  const got = heldFrom({ market: REAL, refs: REFS });
  assert.equal(got.ok, true);
  const direct = [ELEMENT, PATH, INTERVAL_011, ex('snake-completeness.analytics.0.1.1.json')];
  assert.deepEqual(got.held, direct, 'the parsed artefacts are the example files');
  const env = read(new URL('normal/normal-01-all-enabled.envelope.json', fxDir));
  const imported = importEnvelope(env, { held: direct });
  assert.equal(imported.ok, true);
  const viaMarket = resolveCompatibility({ pathway: got.held[1], held: got.held, context: imported.context, runtime: RUNTIME });
  const viaFiles = resolveCompatibility({ pathway: PATH, held: direct, context: imported.context, runtime: RUNTIME });
  assert.deepEqual(viaMarket, viaFiles);
  const sums = REFS.slice(2).map((r) => pin({ market: REAL, ref: r }).pin.checksum);
  const analytics = got.held.slice(2).map((a, i) => ({ analytic: a, checksum: sums[i] }));
  const planA = planRun({ pathway: got.held[1], analytics, held: got.held, importResult: imported, runtime: RUNTIME });
  const planB = planRun({ pathway: PATH, analytics: direct.slice(2).map((a) => ({ analytic: a, checksum: checksumOf(canonicalize(a).text) })), held: direct, importResult: imported, runtime: RUNTIME });
  assert.equal(planA.ok, true, JSON.stringify(planA.refusal));
  assert.deepEqual(planA, planB);
});

// =============================================================================================
// (b) Publish
// =============================================================================================

test('(b) dependency order is enforced and the refusal names the layer', () => {
  const r = refused(pub(emptyMarket(), INTERVAL), 'M-005');
  assert.equal(r.detail.layer.name, 'reference-integrity');
  assert.equal(r.detail.layer.number, 3);
  assert.equal(r.detail.code, 'CCIS-C-007');
  assert.ok(r.detail.diagnostics.some((d) => d.ruleId === 'CCIS-V3-004'));
  refused(pub(ELEMENT_MARKET, PATH), 'M-005');
  const m = must(pub(ELEMENT_MARKET, INTERVAL));
  assert.equal(m.index.entries.length, 2);
});

test('(b) the same bytes twice is a no-op; different bytes under one id and version are refused', () => {
  const once = pub(ELEMENT_MARKET, INTERVAL);
  const twice = pub(once.market, INTERVAL);
  assert.equal(twice.ok, true);
  assert.equal(twice.unchanged, true);
  assert.equal(twice.market, once.market, 'nothing was rebuilt');
  assert.equal(indexText(twice.market), indexText(once.market));
  const changed = clone(INTERVAL);
  changed.question = `${changed.question} (edited)`;
  const r = refused(pub(once.market, changed), 'M-006');
  assert.deepEqual(r.detail, { id: INTERVAL_ID, version: '0.1.0' });
  assert.equal(once.market.files[once.entry.path], canonicalize(INTERVAL).text, 'the stored bytes did not change');
  const reorder = (v) => (Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reorder(v[k])])) : v);
  const sameKeysOrder = reorder(INTERVAL);
  assert.notEqual(JSON.stringify(sameKeysOrder), JSON.stringify(INTERVAL));
  assert.equal(pub(once.market, sameKeysOrder).unchanged, true, 'member order does not matter');
});

test('(b) rejected and withdrawn are refused; deprecated and draft are accepted with their own status', () => {
  refused(pub(emptyMarket(), withManifest(ELEMENT, { status: 'rejected' })), 'M-003');
  refused(pub(emptyMarket(), withManifest(ELEMENT, { status: 'withdrawn' })), 'M-003');
  const dep = pub(emptyMarket(), withManifest(ELEMENT, { status: 'deprecated' }));
  assert.equal(dep.ok, true, JSON.stringify(dep.refusal));
  assert.equal(dep.entry.status, 'deprecated', 'the manifest status is never upgraded');
  assert.equal(ELEMENT_MARKET.index.entries[0].status, 'draft');
});

test('(b) a bad artefact from the invalid examples is refused and nothing is added', () => {
  let n = 0;
  for (const dir of readdirSync(invalidDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const f of readdirSync(new URL(`${dir.name}/`, invalidDir)).filter((x) => x.endsWith('.json') && !x.includes('expected'))) {
      const before = indexText(ELEMENT_MARKET);
      const r = refused(pub(ELEMENT_MARKET, read(new URL(`${dir.name}/${f}`, invalidDir))), 'M-005');
      assert.ok(r.detail.code.startsWith('CCIS-C-'));
      assert.equal(indexText(ELEMENT_MARKET), before);
      n += 1;
    }
  }
  assert.ok(n >= 8, `ran ${n} invalid examples`);
});

test('(b) not an object, a lone node and a lone binding are refused; so is a type that cannot be published', () => {
  for (const bad of [null, undefined, 'text', 5, [], [ELEMENT]]) refused(pub(emptyMarket(), bad), 'M-001');
  refused(pub('not a market', ELEMENT), 'M-001');
  refused(pub({ index: { format: 'other', entries: [] }, files: {} }, ELEMENT), 'M-001');
  refused(pub(emptyMarket(), ELEMENT, { fixtures: 'cases' }), 'M-001');
  // No manifest: it cannot be named or pinned, so the compiler refuses it (2.4, D-099) and nothing is added.
  for (const lone of [NODE, BINDING]) assert.ok(['CCIS-C-007', 'CCIS-C-008'].includes(refused(pub(emptyMarket(), lone), 'M-005').detail.code));
  for (const type of ['element-group', 'terminology-package', 'test-validation-package']) refused(pub(emptyMarket(), withManifest(ELEMENT, { type })), 'M-002');
  assert.deepEqual(PUBLISHABLE_TYPES, ['contextual-element', 'analytics-package', 'pathway']);
});

test('(b) a fixture warning is kept in the index entry, and a wrong fixture name is refused at layer 7', () => {
  const withTest = clone(INTERVAL);
  withTest.tests = [{ id: 'ownTest', fixture: 'normal-01-all-enabled', enables: [], expect: [{ output: INTERVAL.outputs[0].id, matchesFixture: true }] }];
  const r = publishArtefact({ market: ELEMENT_MARKET, artefact: withTest });
  assert.equal(r.ok, true, JSON.stringify(r.refusal));
  assert.deepEqual(r.entry.warnings.map((w) => w.ruleId), ['CCIS-V7-004'], 'the warning was kept, not dropped');
  for (const w of r.entry.warnings) assert.deepEqual(Object.keys(w).sort(), ['path', 'ruleId']);
  assert.deepEqual(pub(ELEMENT_MARKET, withTest).entry.warnings, [], 'with the fixture list there is no warning');
  const wrong = clone(withTest); wrong.tests[0].fixture = 'no-such-case';
  const f = refused(pub(ELEMENT_MARKET, wrong), 'M-005');
  assert.equal(f.detail.layer.name, 'test-verification');
});

test('(b) publishing does not change the market or the artefact it is given', () => {
  const market = deepFreeze(clone(ELEMENT_MARKET));
  const artefact = deepFreeze(clone(INTERVAL));
  const before = JSON.stringify([market, artefact]);
  const r = pub(market, artefact);
  assert.equal(r.ok, true);
  assert.equal(JSON.stringify([market, artefact]), before);
  assert.notEqual(r.market, market);
  assert.equal(market.index.entries.length, 1);
  assert.equal(r.market.index.entries.length, 2);
});

// =============================================================================================
// (c) The patient-data lint
// =============================================================================================

const lintIds = new Set();
const found = (artefact) => { const r = lintArtefact(artefact); r.findings.forEach((f) => lintIds.add(f.id)); return r; };
const idsAt = (r, path) => r.findings.filter((f) => f.path === path).map((f) => f.id);

test('(c) member names: each patient-record and cohort name is found, at the top, nested and in an x- member', () => {
  for (const name of ['patientName', 'patient_id', 'MRN', 'medicalRecordNumber', 'dateOfBirth', 'dob', 'address', 'homeAddress', 'phone', 'email', 'nhsNumber', 'nationalId', 'surname', 'firstName']) {
    assert.deepEqual(idsAt(found({ [name]: 'x' }), `/${name}`), ['L-001'], name);
    assert.deepEqual(idsAt(found({ nested: [{ [name]: 'x' }] }), `/nested/0/${name}`), ['L-001'], name);
    assert.deepEqual(idsAt(found({ 'x-extra': { [name]: 1 } }), `/x-extra/${name}`), ['L-001'], name);
  }
  for (const name of ['cohort', 'cohortMembers', 'cohort-definition', 'membership', 'members', 'memberIds']) {
    assert.deepEqual(idsAt(found({ [name]: [] }), `/${name}`), ['L-002'], name);
    assert.deepEqual(idsAt(found({ 'x-a': { [name]: [] } }), `/x-a/${name}`), ['L-002'], name);
  }
});

test('(c) an envelope-shaped object is found anywhere', () => {
  assert.deepEqual(idsAt(found({ observations: [], events: [] }), ''), ['L-003']);
  assert.deepEqual(idsAt(found({ 'x-demo': { observations: [{}], events: [] } }), '/x-demo'), ['L-003']);
  assert.deepEqual(idsAt(found({ case: { ref: 'a', other: 1 } }), '/case'), ['L-003']);
  assert.equal(lintArtefact({ observations: [] }).ok, true, 'one of the two members alone is not an envelope');
});

test('(c) strings: email, telephone, long digit run and date-of-birth phrase, in free text, nested and in an x- member', () => {
  const cases = [
    ['L-004', 'write to someone@example.org please'],
    ['L-005', 'ring +977 9812345678'],
    ['L-005', 'ring (555) 123-4567'],
    ['L-006', 'id 12345678'],
    ['L-006', '2026112400000001'],
    ['L-007', 'Date of birth is stated'],
    ['L-007', 'DOB recorded'],
    ['L-007', 'born on a Monday'],
  ];
  for (const [id, s] of cases) {
    assert.ok(idsAt(found({ question: s }), '/question').includes(id), s);
    assert.ok(idsAt(found({ a: { list: ['fine', s] } }), '/a/list/1').includes(id), s);
    assert.ok(idsAt(found({ 'x-note': s }), '/x-note').includes(id), s);
    assert.ok(idsAt(found({ 'x-note': { deeper: [s] } }), '/x-note/deeper/0').includes(id), s);
    assert.deepEqual(idsAt(found({ fine: 'plain words' }), '/fine'), [], 'control');
  }
});

test('(c) not plain JSON, self-reference and very deep nesting cannot be screened', () => {
  const loop = {}; loop.self = loop;
  assert.deepEqual(idsAt(found(loop), '/self'), ['L-008']);
  assert.deepEqual(idsAt(found({ when: new Date(0) }), '/when'), ['L-008']);
  assert.deepEqual(idsAt(found({ f: () => 1 }), '/f'), ['L-008']);
  assert.deepEqual(idsAt(found({ n: Infinity }), '/n'), ['L-008']);
  let deep = 'x'; for (let i = 0; i < 150; i += 1) deep = { d: deep };
  assert.equal(found(deep).findings[0].id, 'L-008');
  refused(pub(emptyMarket(), loop), 'M-004');
});

test('(c) no false positives: times, hex checksums, versions, codes and units are not data', () => {
  const benign = { a: ['2026-11-24T10:30:00Z', 'PT30M', '120 min', '5902-2', '0.1.1', 'sha256:2ec4b4d6f6767d3b15c1b3fe6eb7a5cfd0a935fad171b812e30a6875fb91aa32',
    'ab12345678cd', 'time of bite', 'result read time', 'a born-again idea', 'dobutamine'], population: 'adults', provenance: { derivedFrom: [] }, members_count: 3 };
  assert.deepEqual(lintArtefact(benign), { ok: true, findings: [] });
  assert.equal(lintArtefact({ a: '1234567' }).ok, true, 'seven digits are not a long run');
});

test('(c) findings hold only a rule id and a path; a member name that looks like data is not echoed', () => {
  const r = found({ 'person@example.org': 1, q: 'dob and someone@example.org' });
  for (const f of r.findings) assert.deepEqual(Object.keys(f).sort(), ['id', 'path']);
  assert.ok(r.findings.some((f) => f.path === '/[name]' && f.id === 'L-004'));
  assert.equal(JSON.stringify(r).includes('person@example.org'), false);
  assert.equal(JSON.stringify(r).includes('someone@'), false);
});

test('(c) a refused publish never shows the value (sentinel) and adds nothing', () => {
  const SENTINEL = 'sentinel.person.7731@example.org';
  const dirty = clone(ELEMENT);
  dirty['x-note'] = `contact ${SENTINEL}`;
  dirty.manifest['x-owner'] = { mrn: 'A-998877' };
  const r = refused(pub(emptyMarket(), dirty), 'M-004');
  assert.deepEqual(r.detail.findings.map((f) => `${f.id} ${f.path}`).sort(), ['L-001 /manifest/x-owner/mrn', 'L-004 /x-note']);
  const all = JSON.stringify(r);
  for (const bad of [SENTINEL, '7731', 'A-998877', 'sentinel']) assert.equal(all.includes(bad), false, bad);
  const free = clone(ELEMENT);
  free.intent = `${free.intent ?? ''} DOB 12 May`;
  refused(pub(emptyMarket(), free), 'M-004');
});

test('(c) all nine snake artefacts pass the lint, and the six publishable ones publish', () => {
  assert.equal(snakeFiles.length, 9);
  for (const f of snakeFiles) assert.deepEqual(lintArtefact(ex(f)), { ok: true, findings: [] }, f);
  assert.equal(REAL.index.entries.length, 6);
});

test('(c) the lint documents what it cannot do, and every rule is reached', () => {
  const src = text(new URL('../ccis-market.js', import.meta.url));
  assert.match(src, /screen, not a proof/);
  assert.match(src, /can miss\s+\/\/ data/);
  assert.deepEqual([...lintIds].sort(), LINT_RULES.map((r) => r.id).sort());
});

// =============================================================================================
// (d) Resolve and pin
// =============================================================================================

// A small market with several versions of the interval analytics: 0.1.0, 0.1.1, 0.1.2 (deprecated), 0.2.0.
const VERS = (() => {
  let m = ELEMENT_MARKET;
  for (const [doc, over] of [[INTERVAL, {}], [INTERVAL_011, {}], [INTERVAL_011, { version: '0.1.2', status: 'deprecated' }], [INTERVAL_011, { version: '0.2.0' }]]) {
    m = must(pub(m, withManifest(doc, over)));
  }
  return m;
})();
const REF = (extra) => ({ id: INTERVAL_ID, type: 'analytics-package', ...extra });

test('(d) resolve takes the highest satisfying version, flags deprecated, honours exact versions and ranges', () => {
  assert.equal(VERS.index.entries.length, 5);
  const caret = resolve({ market: VERS, ref: REF({ range: '^0.1.0' }) });
  assert.equal(caret.entry.version, '0.1.2');
  assert.equal(caret.deprecated, true);
  assert.equal(caret.artefact.manifest.version, '0.1.2');
  const exact = resolve({ market: VERS, ref: REF({ version: '0.1.1' }) });
  assert.equal(exact.entry.version, '0.1.1');
  assert.equal(exact.deprecated, false);
  assert.equal(resolve({ market: VERS, ref: REF({ range: '>=0.1.0' }) }).entry.version, '0.2.0');
  assert.equal(resolve({ market: VERS, ref: REF({ range: '~0.1.0 <0.1.2' }) }).entry.version, '0.1.1');
  assert.equal(resolve({ market: VERS, ref: { id: 'snake.envenomation-timing', type: 'contextual-element', range: '^0.1.0' } }).entry.version, '0.1.0');
});

test('(d) rejected and withdrawn versions are skipped by resolve', () => {
  const m = edited(VERS, (x) => { entryOf(x, INTERVAL_ID, '0.2.0').status = 'withdrawn'; entryOf(x, INTERVAL_ID, '0.1.2').status = 'rejected'; });
  assert.equal(resolve({ market: m, ref: REF({ range: '>=0.1.0' }) }).entry.version, '0.1.1');
  const none = edited(m, (x) => { for (const e of x.index.entries.filter((y) => y.id === INTERVAL_ID)) e.status = 'withdrawn'; });
  const r = refused(resolve({ market: none, ref: REF({ range: '^0.1.0' }) }), 'M-007');
  assert.deepEqual(r.detail.held, ['0.1.0', '0.1.1', '0.1.2', '0.2.0']);
});

test('(d) no match, a different type, a pre-release and a bad reference are refused', () => {
  refused(resolve({ market: VERS, ref: REF({ range: '>=1.0.0' }) }), 'M-007');
  refused(resolve({ market: VERS, ref: REF({ version: '9.9.9' }) }), 'M-007');
  refused(resolve({ market: VERS, ref: { id: 'snake.nothing', type: 'analytics-package', range: '^0.1.0' } }), 'M-007');
  refused(resolve({ market: VERS, ref: { id: INTERVAL_ID, type: 'pathway', range: '^0.1.0' } }), 'M-007');
  const pre = edited(ELEMENT_MARKET, (x) => { x.index.entries[0].version = '0.2.0-beta.1'; });
  refused(resolve({ market: pre, ref: { id: 'snake.envenomation-timing', type: 'contextual-element', range: '>=0.1.0' } }), 'M-007');
  refused(resolve({ market: VERS, ref: REF({ range: '^0.1.0', version: '0.1.0' }) }), 'M-001');
  refused(resolve({ market: VERS, ref: REF({}) }), 'M-001');
  refused(resolve({ market: VERS, ref: null }), 'M-001');
  refused(resolve({ market: { index: {} }, ref: REF({ version: '0.1.0' }) }), 'M-001');
  refused(heldFrom({ market: VERS, refs: 'x' }), 'M-001');
  refused(heldFrom({ market: VERS, refs: [REF({ range: '^0.1.0' }), REF({ range: '>=1.0.0' })] }), 'M-007');
  assert.deepEqual(heldFrom({ market: VERS, refs: [REF({ version: '0.1.0' }), REF({ version: '0.1.0' })] }).held.map((d) => d.manifest.version), ['0.1.0'], 'one artefact once');
});

test('(d) a pin names exactly id, type, version and checksum, and verifies', () => {
  const p = pin({ market: VERS, ref: REF({ version: '0.1.1' }) });
  assert.deepEqual(Object.keys(p.pin).sort(), ['checksum', 'id', 'type', 'version']);
  assert.equal(p.pin.checksum, entryOf(VERS, INTERVAL_ID, '0.1.1').checksum);
  assert.equal(p.pin.checksum, checksumOf(canonicalize(INTERVAL_011).text));
  assert.equal(pin({ market: VERS, ref: REF({ range: '^0.1.0' }) }).deprecated, true);
  const v = verifyPin({ market: VERS, pin: p.pin });
  assert.equal(v.ok, true);
  assert.equal(v.artefact.manifest.version, '0.1.1');
  refused(pin({ market: VERS, ref: REF({ range: '>=5.0.0' }) }), 'M-007');
});

test('(d) a pin with no checksum, a wrong checksum, an unknown version or a withdrawn version blocks use', () => {
  const good = pin({ market: VERS, ref: REF({ version: '0.1.1' }) }).pin;
  for (const bad of [undefined, '', null, 5]) refused(verifyPin({ market: VERS, pin: { ...good, checksum: bad } }), 'M-008');
  const noKey = { ...good }; delete noKey.checksum;
  refused(verifyPin({ market: VERS, pin: noKey }), 'M-008');
  const other = pin({ market: VERS, ref: REF({ version: '0.1.0' }) }).pin.checksum;
  refused(verifyPin({ market: VERS, pin: { ...good, checksum: other } }), 'M-009');
  refused(verifyPin({ market: VERS, pin: { ...good, checksum: `sha256:${'0'.repeat(64)}` } }), 'M-009');
  refused(verifyPin({ market: VERS, pin: { ...good, checksum: 'sha256:abc' } }), 'M-009');
  refused(verifyPin({ market: VERS, pin: { ...good, version: '7.7.7' } }), 'M-012');
  refused(verifyPin({ market: VERS, pin: { ...good, type: 'pathway' } }), 'M-012');
  refused(verifyPin({ market: VERS, pin: null }), 'M-001');
  refused(verifyPin({ market: VERS, pin: { id: good.id } }), 'M-001');
  const w = edited(VERS, (x) => { entryOf(x, INTERVAL_ID, '0.1.1').status = 'withdrawn'; });
  refused(verifyPin({ market: w, pin: good }), 'M-013');
});

test('(d) one changed byte in a stored file, or an index entry edited to another checksum, blocks use', () => {
  const good = pin({ market: VERS, ref: REF({ version: '0.1.1' }) }).pin;
  const entry = entryOf(VERS, INTERVAL_ID, '0.1.1');
  const flipped = edited(VERS, (x) => { x.files[entry.path] = x.files[entry.path].replace('"question":"', '"question":"X'); });
  assert.notEqual(flipped.files[entry.path], VERS.files[entry.path]);
  refused(verifyPin({ market: flipped, pin: good }), 'M-010');
  const forged = edited(VERS, (x) => { entryOf(x, INTERVAL_ID, '0.1.1').checksum = entryOf(x, INTERVAL_ID, '0.1.0').checksum; });
  refused(verifyPin({ market: forged, pin: good }), 'M-010');
  const forgedTo = verifyPin({ market: forged, pin: { ...good, checksum: entryOf(VERS, INTERVAL_ID, '0.1.0').checksum } });
  refused(forgedTo, 'M-010');
  const gone = edited(VERS, (x) => { delete x.files[entry.path]; });
  refused(verifyPin({ market: gone, pin: good }), 'M-010');
  refused(resolve({ market: gone, ref: REF({ version: '0.1.1' }) }), 'M-010');
});

test('(d) loading verifies every file against its entry; any problem refuses the whole market', () => {
  const folder = readFolder();
  const ok = loadMarket(folder);
  assert.equal(ok.ok, true);
  const idx = JSON.parse(folder.indexText);
  const first = idx.entries[0];
  const withIndex = (fn, files = folder.files) => { const i = clone(idx); fn(i); return loadMarket({ indexText: JSON.stringify(i), files }); };

  // shape
  refused(loadMarket({ indexText: '{', files: {} }), 'M-001');
  refused(loadMarket({ indexText: '{"format":"ccis-market/1","entries":[],"entries":[]}', files: {} }), 'M-001');
  refused(loadMarket({ indexText: '{"format":"other","entries":[]}', files: {} }), 'M-001');
  refused(loadMarket({ indexText: '{"format":"ccis-market/1","entries":[],"x":1}', files: {} }), 'M-001');
  refused(loadMarket({ indexText: folder.indexText, files: { ...folder.files, extra: 5 } }), 'M-001');
  refused(loadMarket({ files: {} }), 'M-001');
  refused(loadMarket(), 'M-001');
  refused(withIndex((i) => { delete i.entries[0].warnings; }), 'M-001');
  refused(withIndex((i) => { i.entries[0].extra = 1; }), 'M-001');
  assert.equal(loadMarket({ indexText: '{"format":"ccis-market/1","entries":[]}', files: {} }).ok, true, 'an empty market loads');

  // disagreement between index and files
  const changed = { ...folder.files, [first.path]: folder.files[first.path].replace('"question":"', '"question":"X') };
  refused(loadMarket({ indexText: folder.indexText, files: changed }), 'M-010');
  refused(withIndex((i) => { i.entries[0].checksum = i.entries[1].checksum; }), 'M-010');
  const missing = { ...folder.files }; delete missing[first.path];
  refused(loadMarket({ indexText: folder.indexText, files: missing }), 'M-010');
  refused(withIndex((i) => { i.entries[0].path = 'artefacts/elsewhere.json'; }), 'M-010');
  refused(withIndex((i) => { i.entries.push(clone(i.entries[0])); }), 'M-010');
  refused(withIndex((i) => { i.entries.reverse(); }), 'M-010');
  // a different but valid canonical file whose checksum the index was edited to match: the manifest still disagrees
  const swapped = canonicalize(ELEMENT).text;
  const other = { ...folder.files, [first.path]: swapped };
  refused(withIndex((i) => { i.entries[0].checksum = checksumOf(swapped); }, other), 'M-010');
  // a file that hashes right but is not in canonical form
  const pretty = JSON.stringify(JSON.parse(folder.files[first.path]), null, 1);
  refused(withIndex((i) => { i.entries[0].checksum = checksumOf(pretty); }, { ...folder.files, [first.path]: pretty }), 'M-010');
  // a stored file the index does not list
  refused(loadMarket({ indexText: folder.indexText, files: { ...folder.files, 'artefacts/stray.json': '{}' } }), 'M-011');
  assert.equal('market' in loadMarket({ indexText: folder.indexText, files: changed }), false, 'nothing partial is used');
});

// =============================================================================================
// (e) Purity and determinism
// =============================================================================================

test('(e) the module is pure and imports only committed CCIS modules', () => {
  const whole = text(new URL('../ccis-market.js', import.meta.url));
  const src = whole.replace(/^\s*\/\/.*$/gm, ''); // the header comment names what the code does not do
  const forbidden = [/\beval\b/, /\bFunction\b/, /\bimport\s*\(/, /\brequire\s*\(/, /node:/, /\bfs\b/, /\bDate\b/, /Math\.random/, /performance\.now/, /\bfetch\b/, /\bprocess\b/, /XMLHttpRequest/, /WebSocket/, /localStorage/];
  for (const re of forbidden) assert.equal(re.test(src), false, String(re));
  const imports = [...whole.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['./ccis-compile.js', './ccis-validator.js', './ccis-validation-record.js']);
  for (const banned of ['ccis-import', 'ccis-run', 'ccis-exec', 'ccis-bind', 'ccis-walk', 'ccis-compat', 'ccis-demo']) assert.equal(whole.includes(banned), false, banned);
});

test('(e) same input, same bytes; no input is changed by any function', () => {
  const frozen = deepFreeze(clone(VERS));
  const before = JSON.stringify(frozen);
  const calls = [
    () => resolve({ market: frozen, ref: REF({ range: '^0.1.0' }) }),
    () => pin({ market: frozen, ref: REF({ version: '0.1.0' }) }),
    () => verifyPin({ market: frozen, pin: deepFreeze(pin({ market: frozen, ref: REF({ version: '0.1.0' }) }).pin) }),
    () => heldFrom({ market: frozen, refs: deepFreeze([REF({ version: '0.1.0' })]) }),
    () => publishArtefact({ market: frozen, artefact: deepFreeze(withManifest(INTERVAL_011, { version: '0.3.0' })), fixtures: deepFreeze([...fixtures]) }),
    () => loadMarket(deepFreeze(readFolder())),
    () => lintArtefact(deepFreeze(clone(PATH))),
    () => indexText(frozen),
  ];
  for (const call of calls) assert.equal(JSON.stringify(call()), JSON.stringify(call()));
  assert.equal(JSON.stringify(frozen), before);
});

test('(e) no function takes a context, an envelope or a run record: each is refused as the wrong shape', () => {
  const envelope = read(new URL('normal/normal-01-all-enabled.envelope.json', fxDir));
  const imported = importEnvelope(envelope, { held: [ELEMENT, PATH, INTERVAL_011] });
  const runLike = { id: 'run-1', status: 'completed', package: { id: 'x' }, snapshot: { observations: [], events: [] } };
  for (const thing of [envelope, imported.context, runLike]) {
    assert.equal(publishArtefact({ market: ELEMENT_MARKET, artefact: thing, fixtures }).ok, false);
    refused(resolve({ market: ELEMENT_MARKET, ref: thing }), 'M-001');
    refused(pin({ market: ELEMENT_MARKET, ref: thing }), 'M-001');
    refused(verifyPin({ market: ELEMENT_MARKET, pin: thing }), 'M-001');
    refused(loadMarket({ indexText: thing, files: {} }), 'M-001');
  }
  refused(pub(emptyMarket(), envelope), 'M-004');
  assert.equal(pub(emptyMarket(), runLike).refusal.id, 'M-004', 'an envelope-shaped snapshot is caught by the screen');
});

test('(e) every refusal id and every lint rule has been reached', () => {
  for (const r of M_REFUSALS) assert.ok(reached.has(r.id), `${r.id} not reached`);
  assert.equal(new Set(M_REFUSALS.map((r) => r.id)).size, M_REFUSALS.length);
  assert.deepEqual(M_REFUSALS.map((r) => r.id), ['M-001', 'M-002', 'M-003', 'M-004', 'M-005', 'M-006', 'M-007', 'M-008', 'M-009', 'M-010', 'M-011', 'M-012', 'M-013']);
});

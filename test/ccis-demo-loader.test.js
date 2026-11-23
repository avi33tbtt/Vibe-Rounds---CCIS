import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadDemo } from '../ccis-demo-loader.js';
import { importReport } from '../ccis/validators/ccis-validators.js';

const ex = new URL('../ccis/examples/snake/', import.meta.url);
const fx = new URL('../ccis/fixtures/snake/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const exa = (f) => read(new URL(f, ex));
const clone = (x) => JSON.parse(JSON.stringify(x));
const deepFreeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };

const pkg = () => ({
  element: exa('snake-envenomation.element.json'),
  binding: exa('snake-demo-terminology.binding.json'),
  pathway: exa('snake-documentation.pathway.json'),
  nodes: [exa('snake-node-clotting.node.json'), exa('snake-node-antivenom.node.json')],
  analytics: [exa('snake-interval.analytics.0.1.1.json'), exa('snake-completeness.analytics.0.1.1.json')],
});
const index = read(new URL('index.json', fx));
const envOf = (c) => read(new URL(`${c.class}/${c.case}.envelope.json`, fx));
const base = () => envOf(index.cases.find((c) => c.case === 'normal-01-all-enabled'));

const validReport = (r) => { assert.equal(importReport(r.importReport), true, JSON.stringify(importReport.errors)); };
const refused = (r, text) => {
  assert.equal(r.ok, false);
  assert.equal(r.package, null);
  assert.equal(r.envelope, null, 'nothing reaches execution');
  validReport(r);
  assert.equal(r.importReport.outcome, 'refused');
  assert.deepEqual(r.importReport.records, []);
  assert.equal(r.importReport.counts.total, 0);
  assert.ok(r.importReport.refusalReason.includes(text), r.importReport.refusalReason);
};

test('source: header label, and no clock, randomness, network, file access, eval or dynamic import', () => {
  const src = readFileSync(new URL('../ccis-demo-loader.js', import.meta.url), 'utf8');
  assert.ok(src.startsWith('// DEMO RUNNER: replaced by rows 2.x and 3.x.'));
  for (const bad of [/\bDate\b/, /Math\.random/, /\bfetch\b/, /XMLHttpRequest/, /node:fs/, /readFile/, /\beval\b/, /new Function/, /\bimport\(/, /\bprocess\b/, /localStorage/]) {
    assert.equal(bad.test(src.replace(/^\/\/.*$/gm, '')), false, String(bad));
  }
});

test('valid artefacts load with every fixture envelope and give an ok, schema-valid report', () => {
  assert.ok(index.cases.length >= 23);
  for (const c of index.cases) {
    const env = envOf(c);
    const r = loadDemo(pkg(), env);
    assert.equal(r.ok, true, c.case);
    validReport(r);
    const rep = r.importReport;
    assert.equal(rep.outcome, 'read');
    assert.equal('refusalReason' in rep, false);
    assert.equal(rep.counts.accepted, rep.counts.total, 'every record in a fixture is accepted');
    assert.equal(rep.counts.total, env.observations.length + env.events.length + 2, 'observations, events, and 2 applied references');
    assert.equal(rep.appliedVersions.length, 2);
    assert.ok(rep.appliedVersions.every((a) => a.held === true));
    assert.equal(rep.envelope.version, env.envelope.version);
    assert.equal(rep.standard.version, '0.1.0');
    assert.deepEqual(r.envelope.observations, env.observations);
    assert.equal(r.package.analytics.length, 2);
  }
});

test('refused: a bad envelope (required part missing) names the category and keeps nothing', () => {
  const env = base(); delete env.observations;
  refused(loadDemo(pkg(), env), 'does not conform to the context envelope schema');
  refused(loadDemo(pkg(), 'text'), 'not an object');
  refused(loadDemo(pkg(), null), 'not an object');
  const noVersion = base(); delete noVersion.envelope.version;
  refused(loadDemo(pkg(), noVersion), 'major version not supported');
});

test('refused: an unknown major version, newer or older, is never read best-effort', () => {
  for (const v of ['1.0.0', '2.3.1']) {
    const env = base(); env.envelope.version = v;
    env.observations = 'a shape this reader does not know';
    const r = loadDemo(pkg(), env);
    refused(r, 'major version not supported');
    assert.equal(r.importReport.envelope.version, v);
  }
});

test('refused: a missing or wrong analytics package', () => {
  const a = pkg(); a.analytics.pop();
  refused(loadDemo(a, base()), 'an analytics package the pathway lists is missing');
  const none = pkg(); none.analytics = [];
  refused(loadDemo(none, base()), 'analytics packages missing');
  const old = pkg(); old.analytics[0] = exa('snake-interval.analytics.json'); old.analytics[0].manifest.version = '0.2.0';
  refused(loadDemo(old, base()), 'does not satisfy the pathway range');
  const dup = pkg(); dup.analytics.push(clone(dup.analytics[0]));
  refused(loadDemo(dup, base()), 'supplied twice');
  const noNode = pkg(); noNode.nodes.pop();
  refused(loadDemo(noNode, base()), 'decision node the pathway uses is missing');
  const noEl = pkg(); delete noEl.element;
  refused(loadDemo(noEl, base()), 'element, binding or pathway missing');
});

test('refused: an artefact that breaks its schema or carries an unknown critical field', () => {
  const a = pkg(); a.analytics[1]['x-fine'] = 1; a.analytics[1].dose = 'never';
  refused(loadDemo(a, base()), 'unrecognised critical field in analytics package');
  const b = pkg(); delete b.pathway.stages;
  refused(loadDemo(b, base()), 'pathway does not conform to its schema');
  const c = pkg(); c.element.manifest.standard.version = '1.0.0';
  refused(loadDemo(c, base()), 'standard major version not supported');
});

test('refused: an unknown critical field in the envelope, top level or nested, rejects the whole envelope', () => {
  const top = base(); top.diagnosis = 'x';
  refused(loadDemo(pkg(), top), 'unrecognised critical field');
  const nested = base(); nested.observations[0].patientName = 'x';
  refused(loadDemo(pkg(), nested), 'unrecognised critical field');
  const proto = JSON.parse(JSON.stringify(base()).replace('"inclusions"', '"__proto__":{"polluted":1},"inclusions"'));
  refused(loadDemo(pkg(), proto), 'unrecognised critical field');
  assert.equal({}.polluted, undefined);
});

test('refused: an applied version the demo does not hold is reported as not held, never swapped', () => {
  const env = base(); env.applied.elements[0].version = '0.2.0';
  const r = loadDemo(pkg(), env);
  refused(r, 'applied artefact version is not held');
  assert.deepEqual(r.importReport.appliedVersions.map((a) => a.held), [false, true]);
  const none = base(); none.applied.pathways = [];
  refused(loadDemo(pkg(), none), 'does not apply the supplied element and pathway');
});

test('x- extensions on the envelope load and are listed as ignored', () => {
  const env = base(); env['x-note'] = { anything: true };
  const r = loadDemo(pkg(), env);
  assert.equal(r.ok, true); validReport(r);
  assert.deepEqual(r.importReport.ignored, [{ path: '/x-note', reason: 'optional extension not used by the demo runner (IMP-112)' }]);
});

test('entered-in-error is rejected with its category and kept out of the usable envelope', () => {
  const env = base(); env.observations[0].status = 'entered-in-error';
  const id = env.observations[0].id;
  const r = loadDemo(pkg(), env);
  assert.equal(r.ok, true); validReport(r);
  const rec = r.importReport.records.find((x) => x.ref === id && x.recordKind === 'observation');
  assert.equal(rec.category, 'rejected');
  assert.deepEqual(rec.reasons, [{ code: 'excluded-by-policy', category: 'entered-in-error' }]);
  assert.equal(r.envelope.observations.some((o) => o.id === id), false);
  assert.equal(r.envelope.observations.length, env.observations.length - 1);
  assert.equal(r.importReport.counts.rejected, 1);
  assert.equal(r.importReport.counts.accepted + 1, r.importReport.counts.total);
});

test('a concept outside the applied element is unmapped: reported, kept out, not guessed', () => {
  const env = base();
  env.observations[0].concept = { id: 'snake.envenomation-timing.not-a-field', codes: [] };
  const id = env.observations[0].id;
  const r = loadDemo(pkg(), env);
  assert.equal(r.ok, true); validReport(r);
  const rec = r.importReport.records.find((x) => x.ref === id);
  assert.equal(rec.category, 'unmapped');
  assert.deepEqual(rec.reasons, [{ code: 'concept-not-in-applied-element' }]);
  assert.equal(r.envelope.observations.some((o) => o.id === id), false);
  assert.equal(r.importReport.counts.unmapped, 1);
});

test('hostile strings load as inert data: nothing is evaluated, nothing leaks into a refusal report', () => {
  const before = Object.keys(globalThis).sort().join();
  const hostile = '<img src=x onerror=alert(1)> {{7*7}} ${process.exit()} \'; DROP TABLE cases; --';
  const env = base(); env.envelope.producer.system = hostile;
  const r = loadDemo(pkg(), env);
  assert.equal(r.ok, true); validReport(r);
  assert.equal(r.importReport.envelope.producer.system, hostile, 'kept as plain data for the viewer to escape (row DS5)');
  assert.equal(Object.keys(globalThis).sort().join(), before);
  assert.equal({}.polluted, undefined);
  // the same text inside an envelope that is refused never reaches the refusal report
  const bad = base(); bad.envelope.producer.system = hostile; bad.diagnosis = hostile;
  const rf = loadDemo(pkg(), bad);
  refused(rf, 'unrecognised critical field');
  assert.equal(JSON.stringify(rf.importReport).includes('onerror'), false);
  assert.equal(rf.importReport.envelope.producer.system, 'unreadable');
});

test('pure and deterministic: frozen inputs are not touched and the same input gives byte-identical output', () => {
  const a = deepFreeze(pkg()); const env = deepFreeze(base());
  const one = JSON.stringify(loadDemo(a, env));
  const two = JSON.stringify(loadDemo(a, env));
  assert.equal(one, two);
  const refusedOne = JSON.stringify(loadDemo(a, deepFreeze({ ...base(), diagnosis: 1 })));
  assert.equal(refusedOne, JSON.stringify(loadDemo(a, deepFreeze({ ...base(), diagnosis: 1 }))));
});

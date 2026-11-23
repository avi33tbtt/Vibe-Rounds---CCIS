import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildCohort, stateKey, COHORT_LABEL } from '../scripts/demo-batch.js';
import { canonicalJson } from '../ccis-demo-record.js';

const fx = new URL('../ccis/fixtures/snake/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const index = read(new URL('index.json', fx));
const expectedOf = (c) => read(new URL(`${c.class}/${c.case}.expected.json`, fx));
const html = readFileSync(new URL('../ccis-viewer.html', import.meta.url), 'utf8');
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
const cohort = buildCohort();

test('class sizes equal the hand count of the fixture index (32 cases)', () => {
  // Counted by hand from the case names: 2 + 3 + 11 + 4 + 2 + 4 + 6.
  assert.deepEqual(
    Object.fromEntries(Object.entries(cohort.classes).map(([k, v]) => [k, v.cases])),
    { normal: 2, boundary: 3, missing: 11, conflicting: 4, 'out-of-scope': 2, 'unit-conversion': 4, estimated: 6 },
  );
  assert.equal(cohort.caseCount, 32);
  assert.equal(cohort.caseCount, index.cases.length);
  assert.deepEqual(cohort.byStatus, { completed: 32 });
});

test('analytic output counts equal the counts in the hand-calculated expected files', () => {
  const want = {};
  for (const c of index.cases) {
    const cls = (want[c.class] ??= {});
    for (const r of expectedOf(c).results) bump((cls[r.outputId] ??= {}), stateKey(r));
  }
  for (const [cls, v] of Object.entries(cohort.classes)) {
    for (const [out, counts] of Object.entries(want[cls])) assert.deepEqual(v.outputs[out], counts, `${cls} ${out}`);
  }
});

test('pathway node counts equal the nodes on the expected routes', () => {
  const want = {};
  for (const c of index.cases) {
    for (const step of expectedOf(c).pathwayRoute) if (step.node) bump((want[c.class] ??= {}), camel(step.node));
  }
  for (const [cls, v] of Object.entries(cohort.classes)) {
    for (const out of ['clottingTestDocumented', 'antivenomDocumented']) {
      const n = Object.values(v.outputs[out] ?? {}).reduce((a, b) => a + b, 0);
      assert.equal(n, (want[cls] ?? {})[camel(out)] ?? 0, `${cls} ${out}`);
    }
  }
});

test('totals are the sum of the classes; unknown is never counted as a value', () => {
  for (const [out, counts] of Object.entries(cohort.total)) {
    const sum = {};
    for (const v of Object.values(cohort.classes)) for (const [k, n] of Object.entries(v.outputs[out] ?? {})) sum[k] = (sum[k] ?? 0) + n;
    assert.deepEqual(counts, sum, out);
  }
  // Hand count: normal-01 and normal-02 are complete records; only normal-01 enables every parameter.
  assert.deepEqual(cohort.classes.normal.outputs.interval, { value: 2 });
  assert.deepEqual(cohort.classes.normal.outputs.overallStatus, { complete: 1, 'parameter-not-enabled': 1 });
  // missing-01 (no bite time): the interval is needs-data, never a value of zero.
  assert.equal(cohort.classes.missing.outputs.interval['needs-data'] >= 1, true);
});

test('the committed file equals a fresh build, byte for byte, and holds counts only', () => {
  const committed = readFileSync(new URL('../ccis/demo/cohort-demo.json', import.meta.url), 'utf8');
  assert.equal(committed, `${canonicalJson(cohort)}\n`);
  assert.equal(cohort.label, COHORT_LABEL);
  for (const c of index.cases) assert.equal(committed.includes(c.case), false, 'no case names in the file');
  assert.equal(/patient|subject|identifier|"value":\s*\{/i.test(committed.replace(COHORT_LABEL, '')), false);
});

test('viewer: the staged label and the second-package card are always on the page', () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
  const doc = dom.window.document;
  assert.equal(doc.getElementById('cohort-label').textContent, `${COHORT_LABEL}.`);
  assert.ok(doc.getElementById('second-package').textContent.includes('Second package: coming'));
  assert.equal(doc.querySelectorAll('#second-package input, #second-package button').length, 0, 'the card has no function');
});

test('viewer: the staged file renders with its label, totals and every class; a run record does not clear it', () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
  const doc = dom.window.document;
  const view = dom.window.ccisViewer;
  assert.equal(view.renderCohort(cohort), true);
  const box = doc.getElementById('cohort');
  assert.ok(box.textContent.includes(COHORT_LABEL));
  assert.equal(box.querySelector('dd').textContent, '32');
  const heads = [...box.querySelectorAll('h3')].map((h) => h.textContent);
  for (const k of Object.keys(cohort.classes)) assert.ok(heads.some((h) => h.startsWith(`Fixture class: ${k} (`)), k);
  view.render({});
  assert.ok(doc.getElementById('cohort').textContent.includes(COHORT_LABEL), 'record area and cohort area are separate');
});

test('viewer: a wrong label, wrong shapes and hostile text give one plain message and create nothing', () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
  const doc = dom.window.document;
  const view = dom.window.ccisViewer;
  const clone = () => JSON.parse(JSON.stringify(cohort));
  const bad = [null, [], {}, { ...clone(), label: 'Cohort engine' }, { ...clone(), caseCount: -1 }, { ...clone(), caseCount: '32' },
    { ...clone(), total: { out: { x: 'many' } } }, { ...clone(), classes: { a: { cases: 1, byStatus: {}, outputs: 5 } } }];
  for (const d of bad) {
    assert.equal(view.renderCohort(d), false);
    assert.equal(doc.getElementById('cohort').textContent, 'This file is not a staged cohort file this viewer can read.');
  }
  const hostile = clone();
  hostile.total = { '<img src=x onerror=alert(1)>': { '<script>1</script>': 1 } };
  assert.equal(view.renderCohort(hostile), true);
  const box = doc.getElementById('cohort');
  assert.equal(box.querySelectorAll('img, script').length, 0);
  assert.ok(box.textContent.includes('<img src=x onerror=alert(1)>'));
});

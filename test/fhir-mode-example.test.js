// Row 1.6a: the FHIR-Mode worked example. No converter exists (row 6.1); this checks the hand-written example only.
// Prototype. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { element } from '../ccis/validators/ccis-validators.js';

const dir = new URL('../ccis/examples/fhir-mode/', import.meta.url);
const raw = (f) => readFileSync(new URL(f, dir), 'utf8');
const files = ['snake-timing.questionnaire.json', 'snake-timing-fhir.element.json', 'snake-timing.mapping-report.json'];
const q = JSON.parse(raw(files[0]));
const el = JSON.parse(raw(files[1]));
const rep = JSON.parse(raw(files[2]));

const sourceConstructs = () => {
  const out = [];
  const walk = (items) => (items || []).forEach((it) => {
    out.push(`item:${it.linkId}`);
    (it.extension || []).forEach((e) => out.push(`extension:${it.linkId}#${e.url}`));
    walk(it.item);
  });
  walk(q.item);
  return out;
};
const numbers = (x, p = '') => (typeof x === 'number' ? [p] : x && typeof x === 'object' ? Object.entries(x).flatMap(([k, v]) => numbers(v, `${p}/${k}`)) : []);

test('(a) the converted element passes the element schema', () => {
  assert.equal(element(el), true, JSON.stringify(element.errors));
});

test('(b) every source item and extension appears once in the report, and nothing else does', () => {
  const src = sourceConstructs();
  assert.equal(new Set(src).size, src.length);
  const got = rep.entries.map((e) => e.source);
  assert.equal(new Set(got).size, got.length, 'duplicate report entry');
  assert.deepEqual([...got].sort(), [...src].sort());
});

test('(c) outcome counts add up to the number of source constructs', () => {
  const outcomes = ['mapped', 'mapped-with-note', 'excluded-by-policy', 'unsupported', 'ignored-presentation'];
  for (const e of rep.entries) assert.ok(outcomes.includes(e.outcome), e.outcome);
  let sum = 0;
  for (const o of outcomes) {
    assert.equal(rep.counts[o], rep.entries.filter((e) => e.outcome === o).length, o);
    sum += rep.counts[o];
  }
  assert.equal(sum, sourceConstructs().length);
  assert.equal(rep.counts.total, sum);
});

test('(d) mapped entries name element fields, and every element field is named', () => {
  const keys = new Set(el.fields.map((f) => f.key));
  const named = rep.entries.filter((e) => e.outcome === 'mapped' || e.outcome === 'mapped-with-note');
  for (const e of named) assert.ok(keys.has(e.field), `${e.source} names missing field ${e.field}`);
  assert.deepEqual([...new Set(named.map((e) => e.field))].sort(), [...keys].sort());
  assert.equal(named.length, keys.size, 'one entry per field');
  for (const e of rep.entries.filter((x) => x.outcome === 'mapped-with-note')) assert.ok(e.note && typeof e.confidence === 'number');
  for (const e of rep.entries.filter((x) => x.outcome === 'unsupported')) assert.ok(e.reason && e.hint);
});

test('(e) the unmapped item and both refused constructs are absent from the element', () => {
  const text = raw(files[1]);
  for (const bad of ['clinician-notes', 'bite-to-arrival-gap', 'calculated-expression', 'presentation-style', 'Questionnaire'])
    assert.equal(text.includes(bad), false, bad);
  for (const e of rep.entries.filter((x) => ['excluded-by-policy', 'unsupported', 'ignored-presentation'].includes(x.outcome)))
    assert.equal('field' in e, false, e.source);
});

test('(f) coded answers use only ccis-demo value sets and no real terminology url appears', () => {
  const choices = q.item.filter((i) => i.type === 'choice');
  assert.ok(choices.length > 0);
  for (const c of choices) assert.match(c.answerValueSet, /^ccis-demo\.[a-z-]+\|0\.1\.0$/);
  for (const f of el.fields.filter((x) => x.binding)) assert.equal(f.binding.codeSystem.id, 'ccis-demo');
  for (const f of files) {
    const t = raw(f);
    for (const m of t.match(/https?:\/\/[^\s"']+/g) || []) assert.match(m, /^https:\/\/example\.invalid\//, `${f}: ${m}`);
    for (const bad of [/hl7\.org/i, /snomed/i, /loinc/i, /icd-?1/i, /who\.int/i, /"system"/]) assert.equal(bad.test(t), false, `${f}: ${bad}`);
  }
});

test('(g) numbers only where allowed; unreviewed; limits are stated', () => {
  assert.deepEqual(numbers(q), []);
  for (const p of numbers(el)) assert.match(p, /\/cardinality\/(min|max)$/, p);
  for (const p of numbers(rep)) assert.match(p, /^\/counts\/|\/confidence$/, p);
  assert.equal(rep.result.review, 'unreviewed');
  const limits = rep.limits.join(' ').toLowerCase();
  assert.match(limits, /one-way/);
  assert.match(limits, /no sdc conformance/);
  assert.match(limits, /no real terminology/);
  assert.match(raw('README.md'), /one-way only/i);
});

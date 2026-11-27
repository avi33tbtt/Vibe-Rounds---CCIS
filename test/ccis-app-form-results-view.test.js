// Row 4.4c.1: the form results view (jsdom over a bare div). Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountFormResultsView } from '../ccis-app-form-results-view.js';
import { draftFromForm, FORM_TYPES } from '../ccis-app-form.js';
import { previewModel } from '../ccis-app-preview.js';
import { diffArtefacts } from '../ccis-app-diff.js';
import { HOSTILE, inert } from './hostile-kit.js';

const FORM = () => ({
  id: 'syn-el', name: 'Synthetic element', version: '0.1.0', publisher: 'Synthetic publisher', purpose: 'p', setting: 's', population: 'pop',
  rationale: 'r', origin: 'o', basis: 'b', exclusions: '',
  fields: [{ key: 'k1', label: 'Label', type: FORM_TYPES[0], min: '0', max: '1', epistemic: 'absent', sourceClasses: 'clinician-entered', units: 'mg', timeSemantics: 'event-time', constraints: '' }],
});
function mount() {
  const w = new JSDOM('<div id="r"></div>').window;
  const root = w.document.getElementById('r');
  const states = [];
  const v = mountFormResultsView({ document: w.document, root, onState: (s) => states.push(s) });
  return { root, states, v, last: () => states[states.length - 1] };
}
const ACCEPTED = () => draftFromForm(FORM());
const VERDICT = /\b(passed|valid|safe|approved)\b/i;

test('mount and clear show the fixed line and a quiet state', () => {
  const m = mount();
  assert.match(m.root.textContent, /No form result yet\./);
  assert.deepEqual(m.last(), { shown: false, refused: false, rows: 0 });
  m.v.show({ draft: ACCEPTED() }); m.v.clear();
  assert.match(m.root.textContent, /No form result yet\./);
  assert.deepEqual(m.last(), { shown: false, refused: false, rows: 0 });
});

test('refused: fixed line and one row; no checksum or tables', () => {
  const m = mount();
  const draft = draftFromForm({ ...FORM(), id: '' });
  assert.equal(draft.ok, false);
  m.v.show({ draft, preview: previewModel({}), diff: null });
  const t = m.root.textContent;
  assert.match(t, /Refused\. No element was produced\./);
  assert.ok(t.includes(`${draft.sdk.code} at ${draft.sdk.path}: ${draft.sdk.sentence}`));
  assert.doesNotMatch(t, /Checksum/);
  assert.equal(m.root.querySelectorAll('table').length, 0);
  assert.deepEqual(m.last(), { shown: true, refused: true, rows: 1 });
});

test('accepted: fixed line, checksum, validator rows or the empty line, no verdict word', () => {
  const m = mount();
  const draft = ACCEPTED();
  assert.equal(draft.ok, true);
  m.v.show({ draft });
  const t = m.root.textContent;
  assert.match(t, /Built from the form\. Status: draft\. This is not a validation\./);
  assert.ok(t.includes(`Checksum: ${draft.checksum}`));
  if (draft.diagnostics.length === 0) assert.match(t, /The validator reported no rows\./);
  else assert.equal(m.root.querySelectorAll('details')[0].querySelectorAll('li').length, draft.diagnostics.length);
  assert.doesNotMatch(t.replace('This is not a validation.', ''), VERDICT);
});

test('preview tables follow previewModel; dangling and truncated are shown', () => {
  const m = mount();
  const draft = ACCEPTED();
  const preview = previewModel(draft.spec);
  m.v.show({ draft, preview });
  const tables = [...m.root.querySelectorAll('table')];
  assert.equal(tables[0].querySelectorAll('tr').length - 1, preview.fieldRows.length);
  assert.match(m.root.textContent, new RegExp(preview.headline.replace(/\./g, '\\.')));
  const fake = { ok: true, headline: 'H.', notes: 'N.', truncated: true, fieldRows: [], moduleRows: [], edgeRows: [{ text: 'a needs b', dangling: true }] };
  m.v.show({ draft, preview: fake });
  assert.match(m.root.textContent, /Dangling/);
  assert.match(m.root.textContent, /Truncated\./);
  m.v.show({ draft, preview: { ok: false, sentence: 'Preview refused here.' } });
  assert.match(m.root.textContent, /Preview refused here\./);
});

test('diff: summary and rows; none kept; refused sentence', () => {
  const m = mount();
  const draft = ACCEPTED();
  m.v.show({ draft });
  assert.match(m.root.textContent, /No previous version kept\./);
  const other = draftFromForm({ ...FORM(), name: 'Renamed element' });
  const diff = diffArtefacts(draft.canonical, other.canonical);
  m.v.show({ draft: other, diff });
  assert.ok(m.root.textContent.includes(diff.summary));
  assert.ok(m.root.textContent.includes('changed manifest.name: "Synthetic element" -> "Renamed element"'));
  m.v.show({ draft, diff: { ok: false, sentence: 'Diff refused here.' } });
  assert.match(m.root.textContent, /Diff refused here\./);
});

test('cap: 150 diagnostics draw 100 rows and the more-rows line', () => {
  const m = mount();
  const diagnostics = Array.from({ length: 150 }, (_, i) => ({ layer: 'L', severity: 'info', ruleId: `R-${i}`, path: 'p', message: 'm' }));
  m.v.show({ draft: { ok: true, checksum: 'x', diagnostics } });
  assert.equal(m.root.querySelectorAll('li').length, 100);
  assert.match(m.root.textContent, /More rows exist than are shown\./);
  assert.equal(m.last().rows, 100);
});

test('hostile strings are inert, unchanged, and onState stays small', () => {
  const m = mount();
  for (const h of HOSTILE) {
    m.v.show({
      draft: { ok: true, checksum: h, diagnostics: [{ layer: h, severity: h, ruleId: h, path: h, message: h, hint: h }] },
      preview: { ok: true, headline: h, notes: h, fieldRows: [{ key: h, label: h, type: h, cardinality: h, units: h, states: h }], moduleRows: [{ id: h, appliesWhen: h, fieldCount: 1 }], edgeRows: [{ text: h, dangling: true }] },
      diff: { ok: true, summary: h, rows: [{ change: 'changed', path: h, before: h, after: h }] },
    });
    inert(m.root, 'form results view');
    assert.ok(m.root.textContent.includes(`Checksum: ${h}`));
    m.v.show({ draft: { ok: false, sdk: { code: h, path: h, sentence: h } } });
    inert(m.root, 'form results view refused');
  }
  for (const s of m.states) {
    assert.deepEqual(Object.keys(s), ['shown', 'refused', 'rows']);
    assert.equal(typeof s.shown, 'boolean'); assert.equal(typeof s.refused, 'boolean'); assert.ok(Number.isInteger(s.rows));
  }
});

test('source scan: only the DOM helper, no network, storage, clock, innerHTML, or action controls', () => {
  const src = readFileSync(new URL('../ccis-app-form-results-view.js', import.meta.url), 'utf8').replace(/^\/\/.*$/gm, '');
  assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map((x) => x[1]), ['./ccis-app-dom.js']);
  for (const bad of [/\bfetch\b/, /localStorage|sessionStorage|indexedDB/, /\bDate\b/, /Math\.random/, /innerHTML/, /el\('button'/]) assert.equal(bad.test(src), false, String(bad));
  assert.ok(/makeDom\(/.test(src));
  const m = mount(); m.v.show({ draft: ACCEPTED() });
  assert.equal(m.root.querySelectorAll('button').length, 0);
});

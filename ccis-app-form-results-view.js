// BROWSER APP, row 4.4c.1: the form results view. Prototype. Synthetic data only. Not for clinical use.
//
// Draws what the page already computed from the form: { draft, preview, diff } (each optional). It calls no builder, validator, compiler,
// diff or preview. It never says passed, valid, safe or approved, and has no Copy, Save, Publish or Approve control. Every list is capped
// at 100 rows. `onState` holds two booleans and a whole number. Elements come from createElement and textContent only (CSP, D-063).
// Not wired into the page yet (row 4.4d).

import { makeDom } from './ccis-app-dom.js';

const CAP = 100;
const S_NONE = 'No form result yet.';
const S_REFUSED = 'Refused. No element was produced.';
const S_BUILT = 'Built from the form. Status: draft. This is not a validation.';
const S_EMPTY = 'The validator reported no rows.';
const S_MORE = 'More rows exist than are shown.';
const S_NODIFF = 'No previous version kept.';

const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const rowsOf = (v) => (Array.isArray(v) ? v : []);

export function mountFormResultsView({ document, root, onState }) {
  const { el } = makeDom(document);
  const body = el('div');
  body.setAttribute('aria-live', 'polite');
  root.append(el('h2', 'Form result'), body);
  const report = (o) => { if (typeof onState === 'function') onState({ shown: false, refused: false, rows: 0, ...o }); };
  let drawn = 0;

  const list = (lines) => {
    const ul = el('ul');
    for (const t of lines.slice(0, CAP)) { ul.append(el('li', t)); drawn += 1; }
    const box = el('div');
    box.append(ul);
    if (lines.length > CAP) box.append(el('p', S_MORE, 'muted'));
    return box;
  };
  const table = (columns, rows) => {
    const t = el('table');
    const head = el('tr');
    for (const c of columns) head.append(el('th', c));
    t.append(head);
    for (const r of rows.slice(0, CAP)) {
      const tr = el('tr');
      for (const cell of r) tr.append(el('td', cell));
      t.append(tr);
      drawn += 1;
    }
    const box = el('div');
    box.append(t);
    if (rows.length > CAP) box.append(el('p', S_MORE, 'muted'));
    return box;
  };
  const part = (title, nodes) => {
    const d = el('details');
    d.open = true;
    d.append(el('summary', title), ...nodes);
    return d;
  };
  const s = (v) => (v === undefined || v === null ? '' : String(v));

  const previewPart = (p) => {
    if (!plain(p)) return null;
    if (!p.ok) return part('Preview', [el('p', s(p.sentence))]);
    const f = rowsOf(p.fieldRows).map((r) => [s(r.key), s(r.label), s(r.type), s(r.cardinality), s(r.units), s(r.states)]);
    const m = rowsOf(p.moduleRows).map((r) => [s(r.id), s(r.appliesWhen), s(r.fieldCount)]);
    const e = rowsOf(p.edgeRows).map((r) => [s(r.text), r.dangling ? 'Dangling' : '']);
    const nodes = [el('p', s(p.headline)), table(['key', 'label', 'type', 'cardinality', 'units', 'states'], f),
      table(['module', 'appliesWhen', 'fields'], m), table(['relationship', 'Dangling'], e), el('p', s(p.notes))];
    if (p.truncated) nodes.push(el('p', 'Truncated.'));
    return part('Preview', nodes);
  };
  const diffPart = (d) => {
    if (!plain(d)) return part('Compared with the previous version', [el('p', S_NODIFF)]);
    if (!d.ok) return part('Compared with the previous version', [el('p', s(d.sentence))]);
    const lines = rowsOf(d.rows).map((r) => {
      const sides = [r.before !== undefined ? s(r.before) : null, r.after !== undefined ? s(r.after) : null].filter((x) => x !== null);
      return `${s(r.change)} ${s(r.path)}: ${sides.join(' -> ')}`;
    });
    const nodes = [el('p', s(d.summary)), list(lines)];
    if (d.truncated) nodes.push(el('p', 'Truncated.'));
    return part('Compared with the previous version', nodes);
  };

  function clear() {
    body.textContent = '';
    drawn = 0;
    body.append(el('p', S_NONE));
    report({});
  }
  function show(model) {
    body.textContent = '';
    drawn = 0;
    const m = plain(model) ? model : {};
    const draft = plain(m.draft) ? m.draft : null;
    if (!draft) { body.append(el('p', S_NONE)); report({}); return; }
    if (!draft.ok) {
      const x = plain(draft.sdk) ? draft.sdk : {};
      body.append(el('p', S_REFUSED), el('p', `${s(x.code)} at ${s(x.path)}: ${s(x.sentence)}`));
      drawn = 1;
      report({ shown: true, refused: true, rows: drawn });
      return;
    }
    const diag = rowsOf(draft.diagnostics).map((d) => `${s(d.severity)} ${s(d.ruleId)} ${s(d.layer)} ${s(d.path)}: ${s(d.message)}${d.hint ? ` (${s(d.hint)})` : ''}`);
    body.append(el('p', S_BUILT), el('p', `Checksum: ${s(draft.checksum)}`),
      part('Validator rows', [diag.length ? list(diag) : el('p', S_EMPTY)]));
    const pv = previewPart(m.preview);
    if (pv) body.append(pv);
    body.append(diffPart(m.diff));
    report({ shown: true, rows: drawn });
  }

  clear();
  return { show, clear };
}

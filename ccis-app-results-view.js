// BROWSER APP, row 3.9a.1: the results view. Prototype. Synthetic data only. Not for clinical use.
//
// Elements are made with createElement and textContent only (CSP, D-063); no inline handlers, no storage, no network.
// Draws the output of resultsModel. onState carries booleans and counts, never a value, id or checksum (D-175).
// Not wired into the page yet (row 3.9a.2).

import { resultsModel } from './ccis-app-results.js';

const S_NONE = 'No run yet.';
const ROW_CAP = 50;
const NODE_CAP = 100;

export function mountResultsView({ document, root, onState }) {
  const el = (tag, content, cls) => {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (cls) node.className = cls;
    return node;
  };
  const body = el('div');
  body.setAttribute('aria-live', 'polite');
  root.append(el('h2', 'Results'), body);

  const state = (o) => onState({ shown: false, state: 'none', groups: 0, items: 0, trace: 0, missing: 0, ...o });
  const list = (items, cls) => {
    if (!items.length) return null;
    const ul = el('ul', undefined, cls);
    for (const t of items) ul.append(el('li', t));
    return ul;
  };
  const section = (title, parts, open) => {
    const d = el('details');
    d.open = open;
    d.append(el('summary', title), ...parts.filter(Boolean));
    return d;
  };

  function tableNode(v) {
    const t = el('table');
    const head = el('tr');
    for (const c of v.columns) head.append(el('th', String(c)));
    t.append(head);
    for (const row of v.rows.slice(0, ROW_CAP)) {
      const tr = el('tr');
      for (const cell of Array.isArray(row) ? row : [row]) tr.append(el('td', String(cell)));
      t.append(tr);
    }
    const box = el('div');
    box.append(t);
    if (v.rows.length > ROW_CAP) box.append(el('p', `and ${v.rows.length - ROW_CAP} more`, 'muted'));
    return box;
  }

  function itemNode(i) {
    const li = el('li');
    if (typeof i.display === 'string') li.append(el('span', `${i.outputId}: ${i.display}`));
    else li.append(el('span', `${i.outputId}:`), tableNode(i.display));
    for (const part of [list(i.warnings, 'small'), list(i.limitations, 'small'), list(i.missingDataNotes, 'small')]) if (part) li.append(part);
    return li;
  }

  function traceNodes(trace) {
    const parts = [];
    for (const n of trace.slice(0, NODE_CAP)) {
      const box = el('div');
      box.append(el('h4', n.node));
      const lines = n.inputs.map((i) => `${i.key}: ${i.state} (${i.records})`);
      for (const o of n.outcomes) lines.push(`${o.id}: ${o.matched ? 'matched' : 'not matched'}`);
      lines.push(n.takenText);
      box.append(list(lines));
      parts.push(box);
    }
    if (trace.length > NODE_CAP) parts.push(el('p', `and ${trace.length - NODE_CAP} more`, 'muted'));
    return parts;
  }

  const reset = () => {
    body.replaceChildren(el('p', S_NONE, 'muted'));
    state({});
  };

  function show(run) {
    const m = resultsModel(run);
    if (m.state !== 'completed') {
      body.replaceChildren(el('p', m.headline, 'refusal'), list(m.limitations));
      state({ state: m.state });
      return;
    }
    const parts = [el('p', m.headline)];
    parts.push(el('p', `Pathway ${m.scope.pathway}. Analytics ${m.scope.analytics.join(', ')}. Evaluation time ${m.scope.evaluationTime}.`));
    if (m.scope.testOnlyNote) parts.push(el('p', m.scope.testOnlyNote, 'refusal'));
    let items = 0;
    for (const g of m.groups) {
      const sec = el('div');
      const ul = el('ul');
      sec.append(el('h3', g.analytic), ul);
      for (const i of g.items) { ul.append(itemNode(i)); items += 1; }
      parts.push(sec);
    }
    parts.push(section('Decision path', traceNodes(m.trace), false));
    const missing = m.missing.map((x) => `${x.id} ${x.version}: ${x.reason}`.replace(/\s+:/, ':'));
    parts.push(section('Missing', [missing.length ? list(missing) : el('p', m.missingNote)], missing.length > 0));
    parts.push(section('Limitations', [list(m.limitations)], true));
    const p = m.provenance;
    parts.push(section('Provenance', [list([
      `Run id: ${p.id}`, `Standard ${p.standard}`, `Engine ${p.engine}`, `Operator set ${p.operatorSet}`,
      `Envelope checksum: ${p.checksums.envelope}`, `Context checksum: ${p.checksums.context}`, `Results checksum: ${p.checksums.results}`,
    ])], false));
    body.replaceChildren(...parts);
    state({ shown: true, state: 'completed', groups: m.groups.length, items, trace: m.trace.length, missing: m.missing.length });
  }

  reset();
  return { show, reset };
}

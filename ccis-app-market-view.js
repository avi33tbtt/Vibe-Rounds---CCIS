// BROWSER APP, row 3.8a: the market folder picker and its two views. Prototype. Synthetic data only. Not for clinical use.
//
// DOM only through createElement and textContent (CSP, D-063). One change listener added with addEventListener, no inline
// handlers. It reads only the files the person picks, on this device, and keeps nothing: Clear empties the view and state.
// Each reply goes through `loadFromFiles` (ccis-app-market.js), which is all or nothing.

import { loadFromFiles, marketView, refusalView } from './ccis-app-market.js';
import { makeDom } from './ccis-app-dom.js';

const READY = 'Ready. No market is loaded and nothing has been run.';
const COLUMNS = [['id', 'ID'], ['type', 'Type'], ['version', 'Version'], ['status', 'Status'], ['checksumShort', 'Checksum'], ['validationSummary', 'Validation record'], ['warningCount', 'Warnings']];

export function mountMarketView({ document, root, onState }) {
  const { el, text } = makeDom(document);
  const input = el('input');
  input.type = 'file';
  input.multiple = true;
  input.setAttribute('webkitdirectory', '');
  input.setAttribute('aria-label', 'Choose market folder');
  const clear = el('button', 'Clear');
  clear.type = 'button';
  const result = el('div');
  result.setAttribute('aria-live', 'polite');
  const label = el('label', 'Market folder (a copy of the market/ folder on this device): ');
  label.append(input);
  root.append(el('h2', 'Market'), label, text(' '), clear, result);

  let ticket = 0;
  const report = (loaded, entries, refused, message, market = null) => onState({ loaded, entries, refused, message, market });

  function showMarket(market) {
    const view = marketView(market);
    const wrap = el('div', undefined, 'table-wrap');
    const table = el('table');
    const head = el('tr');
    for (const [, title] of COLUMNS) head.append(el('th', title));
    table.append(el('thead'), el('tbody'));
    table.tHead.append(head);
    for (const row of view.rows) {
      const tr = el('tr');
      for (const [key] of COLUMNS) tr.append(el('td', String(row[key])));
      table.tBodies[0].append(tr);
    }
    wrap.append(table);
    const kinds = Object.keys(view.counts).sort().map((k) => `${view.counts[k]} ${k}`).join(', ');
    result.replaceChildren(
      el('p', `Loaded ${view.rows.length} entries (${kinds || 'none'}). Every file matched its checksum in the index.`),
      el('p', 'A loaded market is not a trusted market: a checksum shows the same bytes, not who published them or that they are safe. Validation records are software checks, not clinical safety.', 'muted'),
      wrap,
    );
    report(true, view.rows.length, false, `Market loaded: ${view.rows.length} entries. Nothing has been run.`, market);
  }

  function showRefusal(r) {
    const v = refusalView(r);
    const box = el('div', undefined, 'refusal');
    box.setAttribute('role', 'alert');
    box.append(el('strong', `Market refused (${v.id})`), el('p', v.sentence));
    if (v.detail.length) {
      const list = el('ul');
      for (const d of v.detail) list.append(el('li', d));
      box.append(list);
    }
    box.append(el('p', 'Nothing was loaded and nothing has been run.'));
    result.replaceChildren(box);
    report(false, 0, true, 'Market refused. Nothing was loaded and nothing has been run.');
  }

  input.addEventListener('change', async () => {
    const mine = ++ticket;
    let outcome;
    try {
      const items = [];
      for (const f of Array.from(input.files ?? [])) items.push({ path: f.webkitRelativePath || f.name, text: await f.text() });
      outcome = loadFromFiles(items);
    } catch {
      outcome = { ok: false, refusal: { id: 'M-001', detail: { code: 'read-failed' } } };
    }
    if (mine !== ticket) return; // a newer pick replaced this one
    if (outcome.ok) showMarket(outcome.market);
    else showRefusal(outcome.refusal);
  });

  const resetView = () => {
    ticket += 1;
    input.value = '';
    result.replaceChildren();
  };
  clear.addEventListener('click', () => {
    resetView();
    report(false, 0, false, READY);
  });
  return { reset: resetView }; // row 4.1c: the page clears this view when the marketplace view loads (no onState call)
}

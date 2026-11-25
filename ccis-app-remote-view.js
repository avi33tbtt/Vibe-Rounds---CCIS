// BROWSER APP, row 4.1b.1: the "Load from marketplace" view. Prototype. Synthetic data only. Not for clinical use.
//
// DOM only through makeDom (textContent), one click listener per button, no inline handler. The market address and the
// `fetchText` come in as parameters (the page reads the address from its CSP in row 4.1c). Each request is only a web
// address; nothing from a case or run record is ever given to it. A refusal shows its fixed sentence and never any detail,
// address or error text. Nothing is cached or stored: the market lives only in the `onState` receiver.

import { loadRemoteMarket, REMOTE_REFUSALS, goodBase } from './ccis-remote.js';
import { marketView } from './ccis-app-market.js';
import { makeDom } from './ccis-app-dom.js';

const READY = 'Ready. No market is loaded and nothing has been run.';
const COLUMNS = [['id', 'ID'], ['type', 'Type'], ['version', 'Version'], ['status', 'Status'], ['checksumShort', 'Checksum'], ['validationSummary', 'Validation record'], ['warningCount', 'Warnings']];

export function mountRemoteView({ document, root, base, fetchText, onState }) {
  const { el, text } = makeDom(document);
  root.append(el('h2', 'Marketplace'));
  if (!goodBase(base) || typeof fetchText !== 'function') {
    root.append(el('p', 'No marketplace address is set in this build.'));
    return;
  }
  const load = el('button', 'Load from marketplace');
  load.type = 'button';
  const clear = el('button', 'Clear');
  clear.type = 'button';
  const status = el('p');
  status.setAttribute('aria-live', 'polite');
  const result = el('div');
  result.setAttribute('aria-live', 'polite');
  root.append(
    el('p', `Address: ${base}`),
    el('p', 'Loading makes one request per market file to this address. Each request is only a web address: no patient data, case or run record is ever sent.'),
    load, text(' '), clear, status, result,
  );

  let ticket = 0;
  let busy = false;
  const report = (loaded, entries, refused, message, market) => onState({ loaded, entries, refused, message, ...(market ? { market } : {}), source: 'remote' });

  function showMarket(market, requests) {
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
      el('p', `Loaded ${view.rows.length} entries (${kinds || 'none'}). Every file matched its checksum in the index. ${requests} requests were made.`),
      el('p', 'A loaded market is not a trusted market: a checksum shows the same bytes, not who published them or that they are safe. Validation records are software checks, not clinical safety.'),
      wrap,
    );
    report(true, view.rows.length, false, `Market loaded: ${view.rows.length} entries. Nothing has been run.`, market);
  }

  function showRefusal(r) {
    const id = r && typeof r.id === 'string' ? r.id : 'unknown';
    const found = REMOTE_REFUSALS.find((x) => x.id === id);
    const box = el('div', undefined, 'refusal');
    box.setAttribute('role', 'alert');
    box.append(el('strong', `Market refused (${found ? id : 'unknown'})`), el('p', found ? found.sentence : 'Unrecognised refusal.'), el('p', 'Nothing was loaded and nothing has been run.'));
    result.replaceChildren(box);
    report(false, 0, true, 'Market refused. Nothing was loaded and nothing has been run.');
  }

  load.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const mine = ++ticket;
    load.disabled = true;
    result.replaceChildren();
    status.textContent = 'Loading. Nothing is used until every file has been checked.';
    let out;
    try { out = await loadRemoteMarket({ base, fetchText }); } catch { out = { ok: false, refusal: { id: 'R-002' } }; }
    if (mine !== ticket) return; // Clear was pressed meanwhile
    busy = false;
    load.disabled = false;
    status.textContent = '';
    if (out.ok) showMarket(out.market, out.requests.length);
    else showRefusal(out.refusal);
  });

  clear.addEventListener('click', () => {
    ticket += 1;
    busy = false;
    load.disabled = false;
    status.textContent = '';
    result.replaceChildren();
    report(false, 0, false, READY);
  });
}

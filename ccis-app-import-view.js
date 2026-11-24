// BROWSER APP, row 3.8b.1: the envelope file picker and its import report. Prototype. Synthetic data only. Not for clinical use.
//
// DOM only through createElement and textContent (CSP, D-063). addEventListener only, no inline handlers, no storage, no network.
// Reads only the one file the person picks, on this device. Shows counts, fixed sentences and opaque ids, never a value or unit (IMP-091).
// Not wired into the page yet (row 3.8b.2).

import { importEnvelope } from './ccis-import.js';
import { heldFromMarket, importReportView } from './ccis-app-import-report.js';

const MAX_BYTES = 5 * 1024 * 1024;
const NONE = 'No envelope is loaded.';
const S_BIG = 'The file is larger than 5 MB and was not read.';
const S_NO_MARKET = 'Load a market first. An envelope is checked against the held artefacts of the market.';
const S_JSON = 'The file is not valid JSON.';
const S_NOTE = 'Nothing was applied to any patient record. This is an import report, not a clinical result.';

export function mountImportView({ document, root, getMarket, onState }) {
  const el = (tag, content, cls) => {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (cls) node.className = cls;
    return node;
  };
  const input = el('input');
  input.type = 'file';
  input.accept = '.json';
  input.setAttribute('aria-label', 'Choose envelope file');
  const clear = el('button', 'Clear');
  clear.type = 'button';
  const result = el('div');
  result.setAttribute('aria-live', 'polite');
  const label = el('label', 'Envelope file (an export from the EMR Enhancer, on this device): ');
  label.append(input);
  root.append(el('h2', 'Import'), label, document.createTextNode(' '), clear, result);

  let ticket = 0;
  const state = (o) => onState({ imported: false, refused: false, accepted: 0, rejected: 0, unmapped: 0, ambiguous: 0, applied: [], message: NONE, ...o });
  const stop = (sentence, refused) => {
    result.replaceChildren(el('p', sentence, 'refusal'), el('p', S_NOTE, 'muted'));
    state({ refused, message: sentence });
  };
  const list = (title, items) => {
    if (!items.length) return null;
    const ul = el('ul');
    for (const t of items) ul.append(el('li', t));
    const box = el('div');
    box.append(el('h3', title), ul);
    return box;
  };
  const ids = (title, r) => list(title, [...r.ids, ...(r.more ? [`and ${r.more} more`] : [])]);

  function show(v) {
    if (v.outcome !== 'read') return stop(v.refusalSentence, true);
    const c = v.counts;
    const parts = [
      el('p', `Envelope read. Version ${v.header.version}, exported at ${v.header.exportedAt}, from ${v.header.producer.system} ${v.header.producer.version}.`),
      el('p', `${c.accepted} accepted, ${c.rejected} rejected, ${c.unmapped} unmapped, ${c.ambiguous} ambiguous, ${c.total} in total.`),
      list('Reasons', v.reasons.map((r) => `${r.sentence} (${r.count})`)),
      ids('Rejected record ids', v.refs.rejected),
      ids('Unmapped record ids', v.refs.unmapped),
      ids('Ambiguous record ids', v.refs.ambiguous),
      list('Notes', v.notes.map((n) => `${n.code} (${n.count})`)),
      list('Applied versions', v.applied.map((a) => `${a.type} ${a.id} ${a.version}${a.held ? '' : ' (not held)'}`)),
      list('Ignored paths', v.ignoredPaths),
      el('p', S_NOTE, 'muted'),
    ].filter(Boolean);
    result.replaceChildren(...parts);
    state({ imported: true, applied: v.applied, accepted: c.accepted, rejected: c.rejected, unmapped: c.unmapped, ambiguous: c.ambiguous, message: `Envelope read: ${c.total} records. Nothing has been run.` });
  }

  input.addEventListener('change', async () => {
    const mine = ++ticket;
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > MAX_BYTES) return stop(S_BIG, true);
    const market = getMarket();
    if (market === null || market === undefined) return stop(S_NO_MARKET, false);
    let text;
    try {
      text = await file.text();
    } catch {
      return stop('The file could not be read.', true);
    }
    if (mine !== ticket) return; // a newer pick or Clear replaced this one
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return stop(S_JSON, true);
    }
    show(importReportView(importEnvelope(parsed, { held: heldFromMarket(market) })));
  });

  const reset = () => {
    ticket += 1;
    input.value = '';
    result.replaceChildren();
    state({});
  };
  clear.addEventListener('click', reset);
  return { reset };
}

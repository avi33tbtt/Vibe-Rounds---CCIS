// BROWSER APP, row 3.8d.1: the compatibility catalogue view. Prototype. Synthetic data only. Not for clinical use.
//
// Elements are made with createElement and textContent only (CSP, D-063); no inline handlers, no storage, no network.
// Shows ids, versions, outcomes and fixed or catalogue sentences; findings never carry a patient value.
// Not wired into the page yet (row 3.8d.2).

import { catalogueModel } from './ccis-app-catalogue.js';
import { OUTCOMES } from './ccis-compat.js';
import { makeDom } from './ccis-app-dom.js';

const S_NONE = 'No compatibility result yet.';
const S_F12 = 'The pathway row does not check data. Packages marked Needs data cannot run without it.';
const OPEN = ['needs-data', 'incompatible', 'not-eligible', 'other'];
const CAP = 50;

export function mountCatalogueView({ document, root, onState }) {
  const { el } = makeDom(document);
  const body = el('div');
  body.setAttribute('aria-live', 'polite');
  root.append(el('h2', 'Compatibility'), body);

  const state = (o) => onState({ shown: false, rows: 0, needsData: 0, incompatible: 0, other: 0, ...o });
  const list = (title, items) => {
    if (!items.length) return null;
    const ul = el('ul');
    for (const t of items) ul.append(el('li', t));
    const box = el('div');
    box.append(el('h4', title), ul);
    return box;
  };

  function rowNode(r, open) {
    const d = el('details');
    d.open = open;
    d.append(el('summary', `${r.kind} ${r.id} ${r.version}: ${r.label}`));
    d.append(el('p', r.mayRun ? 'Can be run as a preview.' : 'Cannot be run.'));
    const lines = r.explanations.map((e) => `${e.check}, ${e.reason}: ${e.meaning}${e.detail ? ` ${e.detail}` : ''}${e.needs ? ` Needs: ${e.needs}` : ''}`);
    const shown = lines.slice(0, CAP);
    if (lines.length > CAP) shown.push(`and ${lines.length - CAP} more`);
    for (const part of [list('Reasons', shown), list('Satisfied', r.satisfied), list('Needed', r.needed)]) if (part) d.append(part);
    return d;
  }

  const showSentence = (sentence) => {
    body.replaceChildren(el('p', sentence, 'refusal'));
    state({});
  };
  const reset = () => {
    body.replaceChildren(el('p', S_NONE, 'muted'));
    state({});
  };

  function showResult(result) {
    const m = catalogueModel(result);
    const parts = m.banners.map((b) => el('p', b, 'muted'));
    const names = [...Object.keys(OUTCOMES).map((k) => [k, OUTCOMES[k]]), ['other', 'Unrecognised']];
    parts.push(el('p', `${names.map(([k, label]) => `${label} ${m.counts[k]}`).join(', ')}.`));
    if (m.rows.length > 0 && m.rows[0].outcome !== 'needs-data' && m.rows.slice(1).some((r) => r.outcome === 'needs-data')) parts.push(el('p', S_F12, 'refusal'));
    for (const key of Object.keys(m.groups)) {
      const idxs = m.groups[key];
      if (!idxs.length) continue;
      const section = el('div');
      section.append(el('h3', `${m.rows[idxs[0]].label} (${idxs.length})`));
      for (const i of idxs) section.append(rowNode(m.rows[i], OPEN.includes(key)));
      parts.push(section);
    }
    body.replaceChildren(...parts);
    state({ shown: true, rows: m.rows.length, needsData: m.counts['needs-data'], incompatible: m.counts.incompatible, other: m.counts.other });
  }

  reset();
  return { showResult, showSentence, reset };
}

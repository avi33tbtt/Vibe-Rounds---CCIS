// BROWSER APP, row 3.8c.1: the context and pathway drop-downs. Prototype. Synthetic data only. Not for clinical use.
//
// Elements are made with createElement and textContent only (CSP, D-063); listeners through addEventListener; nothing is stored.
// Choosing runs nothing. A pathway that does not reference the chosen context is flagged, not blocked (D-155).
// Not wired into the page yet (row 3.8c.2).

import { selectorModel, selectOption, selectionView } from './ccis-app-selector.js';

const S_LOAD = 'Load a market to choose a context and a pathway.';
const S_NONE = 'Nothing is chosen.';
const S_MISMATCH = 'This pathway does not reference the chosen context.';
const S_NOT_RUN = 'Nothing has been run.';
const EMPTY = () => ({ contextKey: null, pathwayKey: null });

export function mountSelectorView({ document, root, onState }) {
  const el = (tag, content, cls) => {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (cls) node.className = cls;
    return node;
  };
  const choose = (what) => {
    const select = el('select');
    select.setAttribute('aria-label', `Choose a ${what}`);
    const label = el('label', `${what[0].toUpperCase()}${what.slice(1)}: `);
    label.append(select);
    return { select, label, what };
  };
  const ctx = choose('context');
  const pth = choose('pathway');
  const clear = el('button', 'Clear');
  clear.type = 'button';
  const line = el('p');
  line.setAttribute('aria-live', 'polite');
  root.append(el('h2', 'Choose'), ctx.label, document.createTextNode(' '), pth.label, document.createTextNode(' '), clear, line);

  let loaded = false;
  let applied = [];
  let model = selectorModel({});
  let selection = EMPTY();

  const optionText = (i) => `${i.id} ${i.version} (${i.status})${i.deprecated ? ' (deprecated)' : ''}${i.appliedByImport ? ' (applied by import)' : ''}`;
  const fill = (part, items, key) => {
    const options = [el('option', `Choose a ${part.what}`)];
    options[0].value = '';
    for (const i of items) {
      const o = el('option', optionText(i));
      o.value = i.key;
      options.push(o);
    }
    part.select.replaceChildren(...options);
    part.select.value = key ?? '';
    part.select.disabled = !loaded;
  };

  function draw() {
    const v = selectionView(model, selection);
    const nothing = selection.contextKey === null && selection.pathwayKey === null;
    const parts = nothing ? [loaded ? S_NONE : S_LOAD] : [`Context: ${v.contextLabel}. Pathway: ${v.pathwayLabel}.`];
    if (v.mismatch) parts.push(S_MISMATCH);
    parts.push(S_NOT_RUN);
    const message = parts.join(' ');
    fill(ctx, model.contexts, selection.contextKey);
    fill(pth, model.pathways, selection.pathwayKey);
    line.textContent = message;
    onState({ contextChosen: selection.contextKey !== null, pathwayChosen: selection.pathwayKey !== null, mismatch: v.mismatch, ready: v.ready, message });
  }
  const rebuild = (market) => {
    model = selectorModel({ market, importResult: { report: { appliedVersions: applied } } });
    selection = selectOption(model, selection, {}); // stale keys fall away
  };

  const change = (part, kind) => () => {
    const key = part.select.value;
    selection = key === '' ? { ...selection, [kind]: null } : selectOption(model, selection, { kind: kind === 'contextKey' ? 'context' : 'pathway', key });
    draw();
  };
  ctx.select.addEventListener('change', change(ctx, 'contextKey'));
  pth.select.addEventListener('change', change(pth, 'pathwayKey'));
  clear.addEventListener('click', () => {
    selection = EMPTY();
    draw();
  });

  let held = null;
  const api = {
    selectedPathwayKey: () => selection.pathwayKey,
    setMarket(market) {
      held = market ?? null;
      loaded = held !== null;
      applied = [];
      selection = EMPTY();
      rebuild(held);
      draw();
    },
    setImport(appliedVersions) {
      applied = Array.isArray(appliedVersions) ? appliedVersions : [];
      rebuild(held);
      draw();
    },
    reset() {
      held = null;
      loaded = false;
      applied = [];
      selection = EMPTY();
      rebuild(null);
      draw();
    },
  };
  draw();
  return api;
}

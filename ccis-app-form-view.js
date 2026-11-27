// BROWSER APP, row 4.4c: the form view, inputs only. Prototype. Synthetic data only. Not for clinical use.
//
// Text boxes for a contextual element and one card per field. After every edit it hands the page a fresh plain object of strings
// (the shape `draftFromForm` reads); it calls no builder, validator or compiler and imports no SDK constant (the page passes `types` and
// `lists`). There is no status input: a form cannot set a status. The form lives only in the inputs: no storage, timers or network.
// `onState` holds a whole number and a boolean. Elements come from createElement and textContent only (CSP, D-063). Not wired yet (4.4d).

import { makeDom } from './ccis-app-dom.js';

const MAX_FIELDS = 50;
const TOP = ['id', 'name', 'version', 'publisher', 'purpose', 'setting', 'population', 'rationale', 'origin', 'basis'];
const SMALL = ['key', 'label', 'min', 'max'];
const AREAS = ['epistemic', 'sourceClasses', 'units', 'constraints'];
const STATUS_LINE = 'Status: draft (fixed). A form cannot set a status.';

export function mountFormView({ document, root, onState, onForm, types, lists }) {
  const { el, text } = makeDom(document);
  const list = (k) => (lists && Array.isArray(lists[k]) ? lists[k] : []);
  const labelled = (label, node) => {
    node.setAttribute('aria-label', label);
    const wrap = el('label');
    wrap.append(text(`${label}: `), node);
    return wrap;
  };
  const input = (label) => { const n = el('input'); n.type = 'text'; return { n, wrap: labelled(label, n) }; };
  const area = (label) => { const n = el('textarea'); return { n, wrap: labelled(label, n) }; };
  const pick = (label, values) => {
    const n = el('select');
    for (const v of values) n.append(el('option', v));
    return { n, wrap: labelled(label, n) };
  };
  const button = (name) => { const b = el('button', name); b.type = 'button'; return b; };

  const top = {};
  const topBox = el('div');
  for (const k of TOP) { top[k] = input(k); topBox.append(top[k].wrap, el('br')); }
  top.exclusions = area('exclusions');
  topBox.append(top.exclusions.wrap);
  const cardsBox = el('div');
  const add = button('Add field');
  const reset = button('Reset form');
  let cards = [];
  let touched = false;

  const read = (c) => {
    const f = {};
    for (const k of SMALL) f[k] = c.parts[k].n.value;
    f.type = c.parts.type.n.value;
    f.timeSemantics = c.parts.timeSemantics.n.value;
    for (const k of AREAS) f[k] = c.parts[k].n.value;
    return f;
  };
  const sync = () => {
    add.disabled = cards.length >= MAX_FIELDS;
    for (const c of cards) c.remove.disabled = cards.length <= 1;
    const form = {};
    for (const k of TOP) form[k] = top[k].n.value;
    form.exclusions = top.exclusions.n.value;
    form.fields = cards.map(read);
    if (typeof onForm === 'function') onForm(form);
    if (typeof onState === 'function') onState({ fields: cards.length, touched });
  };
  const edited = () => { touched = true; sync(); };

  const newCard = () => {
    const box = el('div', undefined, 'field-card');
    const parts = {};
    for (const k of SMALL) parts[k] = input(k);
    parts.type = pick('type', Array.isArray(types) ? types : []);
    parts.timeSemantics = pick('timeSemantics', ['', ...list('timeSemantics')]);
    for (const k of AREAS) parts[k] = area(k);
    const hints = { epistemic: list('epistemic'), sourceClasses: list('sourceClasses') };
    const remove = button('Remove field');
    for (const k of [...SMALL, 'type', 'timeSemantics', ...AREAS]) {
      box.append(parts[k].wrap);
      if (hints[k]) box.append(el('p', `Allowed: ${hints[k].join(', ')}`, 'muted'));
      box.append(el('br'));
      parts[k].n.addEventListener(parts[k].n.tagName === 'SELECT' ? 'change' : 'input', edited);
    }
    box.append(remove);
    const card = { box, parts, remove };
    remove.addEventListener('click', () => {
      if (cards.length <= 1) return;
      cards = cards.filter((c) => c !== card);
      box.remove();
      edited();
    });
    return card;
  };
  const addCard = () => { const c = newCard(); cards.push(c); cardsBox.append(c.box); };

  for (const k of [...TOP, 'exclusions']) top[k].n.addEventListener('input', edited);
  add.addEventListener('click', () => { if (cards.length < MAX_FIELDS) { addCard(); edited(); } });
  reset.addEventListener('click', () => {
    for (const k of [...TOP, 'exclusions']) top[k].n.value = '';
    cards = [];
    cardsBox.textContent = '';
    addCard();
    touched = false;
    sync();
  });

  addCard();
  root.append(el('h2', 'Form (contextual element)'), el('p', STATUS_LINE, 'muted'), topBox, el('h3', 'Fields'), cardsBox, add, text(' '), reset);
  sync();
}

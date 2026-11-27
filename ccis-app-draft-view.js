// BROWSER APP, row 4.3b.1: the AI draft view. Prototype. Synthetic data only. Not for clinical use.
//
// An off-by-default switch, a password-type key field, one source, an instruction, Draft and Clear. It shows a draft as labelled
// text rows and nothing else: no publish, validate, approve or save control. The view knows no client, address or clock; the page
// injects `draft` (draftForPage with its client bound). The key lives only in the input and is cleared after every outcome.
// `onState` holds booleans and counts, never the key, an instruction, a source or a sentence. Elements come from createElement and
// textContent only (CSP, D-063). Not wired into the page yet (row 4.3b.2).

import { makeDom } from './ccis-app-dom.js';
import { draftModel } from './ccis-app-draft.js';

const NOTICE = 'Off by default. It only drafts. A human must review every draft. Nothing here publishes or validates.';
const S_DEFECT = 'Drafting stopped unexpectedly. Nothing was drafted.';
const DEFAULT_MODEL = 'claude-sonnet-5-5';

export function mountDraftView({ document, root, onState, draft, types, kinds, onDraft }) {
  const { el, text } = makeDom(document);
  const field = (label, type, value) => {
    const input = el('input');
    input.type = type;
    input.setAttribute('aria-label', label);
    if (value !== undefined) input.value = value;
    if (type === 'password') input.setAttribute('autocomplete', 'off');
    const wrap = el('label');
    wrap.append(text(`${label}: `), input);
    return { input, wrap };
  };
  const pick = (label, values) => {
    const select = el('select');
    select.setAttribute('aria-label', label);
    for (const v of Array.isArray(values) ? values : []) select.append(el('option', v));
    const wrap = el('label');
    wrap.append(text(`${label}: `), select);
    return { select, wrap };
  };
  const sw = el('input');
  sw.type = 'checkbox';
  sw.setAttribute('aria-label', 'Allow AI drafting');
  const swLabel = el('label');
  swLabel.append(sw, text(' Allow AI drafting'));
  const key = field('API key (kept in this page only)', 'password');
  const model = field('Model', 'text', DEFAULT_MODEL);
  const type = pick('Artefact type', types);
  const kind = pick('Source kind', kinds);
  const cite = field('Source citation', 'text');
  const passage = field('Source passage', 'text');
  const instr = field('Instruction', 'text');
  const go = el('button', 'Draft');
  go.type = 'button';
  go.disabled = true;
  const clear = el('button', 'Clear');
  clear.type = 'button';
  const status = el('p');
  status.setAttribute('aria-live', 'polite');
  const out = el('div');
  root.append(el('h2', 'Draft (AI)'), el('p', NOTICE, 'muted'), swLabel, el('br'), key.wrap, el('br'), model.wrap, el('br'), type.wrap, el('br'),
    kind.wrap, el('br'), cite.wrap, el('br'), passage.wrap, el('br'), instr.wrap, el('br'), go, text(' '), clear, status, out);

  const inputs = [key, model, cite, passage, instr].map((f) => f.input);
  let outcome = { drafted: false, refused: false, rows: 0 };
  const filled = () => inputs.every((i) => i.value.trim() !== '');
  const state = () => onState({ enabled: sw.checked, hasKey: key.input.value !== '', ready: !go.disabled, ...outcome });
  const say = (s, cls) => { status.className = cls ?? 'muted'; status.textContent = s; };
  const wipe = () => { out.textContent = ''; say(''); outcome = { drafted: false, refused: false, rows: 0 }; };
  const refresh = () => { go.disabled = !(sw.checked && filled()); state(); };
  const edited = () => { wipe(); refresh(); };

  sw.addEventListener('change', () => { if (!sw.checked) key.input.value = ''; edited(); });
  for (const n of [...inputs, type.select, kind.select]) { n.addEventListener('input', edited); n.addEventListener('change', edited); }
  clear.addEventListener('click', () => { key.input.value = ''; wipe(); refresh(); });

  const show = (m) => {
    const rows = el('tbody');
    for (const r of m.rows) { const tr = el('tr'); tr.append(el('td', r.member), el('td', r.basis)); rows.append(tr); }
    const head = el('thead');
    const hr = el('tr');
    hr.append(el('th', 'Member'), el('th', 'Basis'));
    head.append(hr);
    const table = el('table');
    table.append(head, rows);
    out.append(el('p', m.label), el('p', m.headline), table, el('p', m.notes));
  };

  go.addEventListener('click', async () => {
    if (go.disabled) return;
    const request = { artefactType: type.select.value, standardVersion: '0.1.0', instruction: instr.input.value,
      sources: [{ id: 'src-1', kind: kind.select.value, citation: cite.input.value, passage: passage.input.value }], terminology: [] };
    let r;
    try { r = await draft({ enabled: sw.checked, key: key.input.value, model: model.input.value, request }); } catch { r = { ok: false, sentence: S_DEFECT }; }
    key.input.value = '';
    out.textContent = '';
    try {
      if (!r || r.ok !== true) throw new Error('refused');
      const m = draftModel(r.draft);
      show(m);
      say('Draft ready for review. It is not published or validated.');
      outcome = { drafted: true, refused: false, rows: m.rows.length };
      if (typeof onDraft === 'function') { try { onDraft(r.draft); } catch { /* the page's hook failing does not undo the draft */ } }
    } catch {
      const s = r && typeof r.sentence === 'string' ? r.sentence : S_DEFECT;
      const extra = r && typeof r.code === 'string' ? ` Code: ${r.code}.${typeof r.path === 'string' ? ` Member: ${r.path}.` : ''}` : '';
      say(s + extra, 'refusal');
      outcome = { drafted: false, refused: true, rows: 0 };
    }
    refresh();
  });
  refresh();
  say('');
}

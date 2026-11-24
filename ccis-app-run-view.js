// BROWSER APP, row 3.9.1: the run view. Prototype. Synthetic data only. Not for clinical use.
//
// Package multi-select, a needs-data box, a typed evaluation time and a Run button. It shows a status sentence and counts only;
// results are drawn in row 3.9a. The view reads no clock (the time is typed), keeps no record (the page gets it through onRun),
// and its state holds booleans and counts, never an id, a time or a record. Elements are made with createElement and textContent
// only (CSP, D-063): no inline handlers, no storage, no network. Not wired into the page yet (row 3.9.1a).

const S_NOT_READY = 'Load a market, choose a pathway and import an envelope first.';
const S_FAILED = 'The run failed. The record holds the reason and no results.';
const S_DEFECT = 'The run could not be completed.';

export function mountRunView({ document, root, onState, run, onRun }) {
  const el = (tag, content, cls) => {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (cls) node.className = cls;
    return node;
  };
  const list = el('div');
  const needs = el('input');
  needs.type = 'checkbox';
  needs.setAttribute('aria-label', 'Also run items that need data');
  const needsLabel = el('label');
  needsLabel.append(needs, document.createTextNode(' Also run items that need data'));
  const time = el('input');
  time.type = 'text';
  time.setAttribute('aria-label', 'Evaluation time');
  const timeLabel = el('label', 'Evaluation time (for example 2026-01-01T00:00:00Z): ');
  timeLabel.append(time);
  const go = el('button', 'Run');
  go.type = 'button';
  go.disabled = true;
  const clear = el('button', 'Clear');
  clear.type = 'button';
  const status = el('p');
  status.setAttribute('aria-live', 'polite');
  root.append(el('h2', 'Run'), list, needsLabel, el('br'), timeLabel, document.createTextNode(' '), go, document.createTextNode(' '), clear, status);

  let ready = false;
  let boxes = []; // { id, box }
  let outcome = { ran: false, failed: false, results: 0, skipped: 0, refused: false };

  const selected = () => boxes.filter((b) => b.box.checked).length;
  const state = () => onState({ ready, selected: selected(), ...outcome });
  const say = (text, cls) => {
    status.className = cls ?? 'muted';
    status.textContent = text;
  };
  const refresh = () => {
    go.disabled = !(ready && selected() > 0 && time.value.trim() !== '');
    if (!ready) say(S_NOT_READY);
    else if (status.textContent === S_NOT_READY) say('');
    state();
  };
  const forget = () => {
    outcome = { ran: false, failed: false, results: 0, skipped: 0, refused: false };
    say('');
  };

  const edited = () => { forget(); refresh(); }; // a changed choice or time makes an earlier status stale
  list.addEventListener('change', edited);
  needs.addEventListener('change', edited);
  time.addEventListener('input', edited);
  time.addEventListener('change', edited);

  go.addEventListener('click', () => {
    if (go.disabled) return;
    let r;
    try {
      r = run({ only: boxes.filter((b) => b.box.checked).map((b) => b.id), runNeedsData: needs.checked, evaluationTime: time.value });
    } catch {
      r = { ok: false, sentence: S_DEFECT };
    }
    if (!r || r.ok !== true) {
      outcome = { ran: false, failed: false, results: 0, skipped: 0, refused: true };
      say(r && typeof r.sentence === 'string' ? r.sentence : S_DEFECT, 'refusal');
      return state();
    }
    const record = r.record;
    const results = Array.isArray(record?.results) ? record.results.length : 0;
    const skipped = Array.isArray(r.skipped) ? r.skipped.length : 0;
    if (typeof onRun === 'function') onRun(record, r.skipped);
    if (record?.status === 'failed') {
      outcome = { ran: true, failed: true, results: 0, skipped, refused: false };
      say(S_FAILED, 'refusal');
    } else {
      outcome = { ran: true, failed: false, results, skipped, refused: false };
      say(`Run complete: ${results} results, ${skipped} skipped.`);
    }
    state();
  });

  const api = {
    setChoices(rows) {
      boxes = [];
      const nodes = [];
      for (const r of Array.isArray(rows) ? rows : []) {
        const box = el('input');
        box.type = 'checkbox';
        box.checked = r.mayRun === true;
        const label = el('label');
        label.append(box, document.createTextNode(` ${String(r.id)} ${String(r.version)} (${String(r.label)})`));
        nodes.push(label, el('br'));
        boxes.push({ id: String(r.id), box });
      }
      list.replaceChildren(...nodes);
      forget();
      refresh();
    },
    setReady(value) {
      ready = value === true;
      if (!ready) forget();
      refresh();
    },
    reset() {
      time.value = '';
      forget();
      refresh();
    },
  };
  clear.addEventListener('click', api.reset);
  refresh();
  return api;
}

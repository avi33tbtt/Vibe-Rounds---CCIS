// BROWSER APP, row 3.9b.1: the export view. Prototype. Synthetic data only. Not for clinical use.
//
// Elements are made with createElement and textContent only (CSP, D-063); no inline handlers, no storage, no network.
// Shows the verification line, notices, file name, size and checksum, and a Download button. The view never touches
// Blob or URL: saving is a function the page hands in (`save`, row 3.9b.2). The file text stays in this closure and
// never reaches the DOM or onState (D-181). Not wired into the page yet.

import { exportModel } from './ccis-app-export.js';

const S_NONE = 'Nothing to export yet.';
const S_NO_SAVE = 'Saving is not available here.';
const S_FAILED = 'The file could not be saved.';

export function mountExportView({ document, root, onState, save }) {
  const el = (tag, content, cls) => {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (cls) node.className = cls;
    return node;
  };
  const body = el('div');
  body.setAttribute('aria-live', 'polite');
  root.append(el('h2', 'Export'), body);

  const state = (o) => onState({ shown: false, verified: false, saved: false, ...o });
  let text = null; // the file text, held here only
  let filename = null;
  let verified = false;

  const reset = () => {
    text = null;
    filename = null;
    verified = false;
    body.replaceChildren(el('p', S_NONE, 'muted'));
    state({});
  };

  function show(record) {
    const m = exportModel(record);
    if (!m.ok) {
      text = null;
      filename = null;
      verified = false;
      body.replaceChildren(el('p', m.sentence, 'refusal'));
      state({});
      return;
    }
    text = m.text;
    filename = m.filename;
    verified = m.verification.ok === true;
    const status = el('p', undefined, 'muted');
    const button = el('button', 'Download run record');
    button.type = 'button';
    const parts = [el('p', m.verification.line, verified ? undefined : 'refusal')];
    for (const n of m.notices) parts.push(el('p', n, 'muted'));
    parts.push(el('p', `File: ${m.filename}. ${m.bytes} bytes. Checksum: ${m.checksum}.`));
    parts.push(button);
    if (typeof save !== 'function') {
      button.disabled = true;
      status.textContent = S_NO_SAVE;
    }
    parts.push(status);
    body.replaceChildren(...parts);
    state({ shown: true, verified });

    button.addEventListener('click', () => {
      if (typeof save !== 'function' || text === null) return;
      let ok = false;
      try {
        ok = save({ filename, text }) !== false;
      } catch {
        ok = false;
      }
      status.textContent = ok ? `Saved as ${filename}.` : S_FAILED;
      state({ shown: true, verified, saved: ok });
    });
  }

  reset();
  return { show, reset };
}

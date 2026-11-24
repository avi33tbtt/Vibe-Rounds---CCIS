// BROWSER APP, row 3.8a: market folder mapping and view models. Prototype. Synthetic data only. Not for clinical use.
//
// Pure: no DOM, no file access, no network, no clock. It turns the files a person picked into the input that
// `loadMarket` (ccis-market.js, the only gate) needs, and turns a market or a refusal into plain rows for the page.
// A picked file is `{ path, text }`: the browser's relative path (first segment is the chosen folder) and the exact text.
//
//   marketInputFromFiles(items) -> { ok: true, indexText, files } | { ok: false, refusal }
//   loadFromFiles(items)        -> loadMarket's result, or the refusal above
//   marketView(market)          -> { rows, counts }   (index data only: never an artefact body, never a fixture value)
//   refusalView(refusal)        -> { id, sentence, detail: ['key: value', ...] }   (allow-listed keys, strings only)
//
// Only `.gitattributes` at the top of the folder is skipped, by exact name. Any other unexpected file is passed on and
// `loadMarket` refuses the whole market (M-011). Text is never normalised: a byte-order mark or a changed line ending
// changes the checksum and the market is refused (M-010).

import { loadMarket, M_REFUSALS } from './ccis-market.js';

const SENTENCE = Object.fromEntries(M_REFUSALS.map((r) => [r.id, r.sentence]));
const SKIPPED = ['.gitattributes'];
const SHOWN_DETAIL = ['id', 'version', 'path', 'layer', 'rule', 'code'];
const CHECKSUM_SHOWN = 'sha256:'.length + 12;

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const refusal = (detail) => ({ ok: false, refusal: detail === undefined ? { id: 'M-001', reason: SENTENCE['M-001'] } : { id: 'M-001', reason: SENTENCE['M-001'], detail } });

export function marketInputFromFiles(items) {
  if (!Array.isArray(items)) return refusal();
  let indexText = null;
  const files = {};
  for (const item of items) {
    if (!isObj(item) || typeof item.path !== 'string' || typeof item.text !== 'string') return refusal();
    const parts = item.path.split('/');
    if (parts.length < 2 || parts.some((p) => p === '' || p === '.' || p === '..')) return refusal({ code: 'bad-path' });
    const rel = parts.slice(1).join('/');
    if (SKIPPED.includes(rel)) continue;
    if (rel === 'index.json') {
      if (indexText !== null) return refusal({ code: 'duplicate-path' });
      indexText = item.text;
      continue;
    }
    if (Object.hasOwn(files, rel)) return refusal({ code: 'duplicate-path' });
    // defineProperty, so a file named `__proto__` is a real own entry that loadMarket can refuse, never a hidden one.
    Object.defineProperty(files, rel, { value: item.text, enumerable: true, writable: true, configurable: true });
  }
  if (indexText === null) return refusal({ code: 'no-index' });
  return { ok: true, indexText, files };
}

export function loadFromFiles(items) {
  const r = marketInputFromFiles(items);
  if (!r.ok) return r;
  return loadMarket({ indexText: r.indexText, files: r.files });
}

const text = (x, fallback) => (typeof x === 'string' ? x : fallback);

function validationSummary(v) {
  if (!isObj(v)) return 'none recorded';
  const layers = isObj(v.layers) ? Object.values(v.layers) : [];
  const passed = layers.filter((s) => s === 'passed').length;
  return `${text(v.outcome, 'unknown')} (${passed} of ${layers.length} layers passed)`;
}

export function marketView(market) {
  const entries = isObj(market) && isObj(market.index) && Array.isArray(market.index.entries) ? market.index.entries : [];
  const counts = {};
  const rows = entries.map((e) => {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    return {
      id: e.id,
      type: e.type,
      version: e.version,
      status: text(e.status, 'unknown'),
      deprecated: e.status === 'deprecated',
      checksumShort: e.checksum.slice(0, CHECKSUM_SHOWN),
      warningCount: Array.isArray(e.warnings) ? e.warnings.length : 0,
      validationSummary: validationSummary(e.validation),
    };
  });
  return { rows, counts };
}

export function refusalView(r) {
  const id = isObj(r) && typeof r.id === 'string' ? r.id : 'unknown';
  const sentence = SENTENCE[id] ?? 'Unrecognised refusal. Nothing was loaded.';
  const detail = [];
  if (isObj(r) && isObj(r.detail)) {
    for (const key of SHOWN_DETAIL) {
      if (typeof r.detail[key] === 'string') detail.push(`${key}: ${r.detail[key].slice(0, 120)}`);
    }
  }
  return { id, sentence, detail };
}

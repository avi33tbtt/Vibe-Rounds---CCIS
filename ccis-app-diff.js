// BROWSER APP, row 4.4a: the pure diff of two canonical artefacts. Prototype. Synthetic data only. Not for clinical use.
//
// Rows say what was added, removed, changed or reordered, by a readable path (`fields[dose].label`). An array of objects that all carry a
// unique string `key` (else `id`) is matched by that value, so inserting a field shifts nothing; any other array is compared by position.
// Values are shown as short text (cut at 120 characters; objects and lists summarised). Pure: no DOM, network, storage or clock.

const REFUSED = 'The previous or the new version is not an artefact document.';
const MAX_ROWS = 200;
const MAX_DEPTH = 100;
const CUT = 120;

const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const show = (v) => {
  if (Array.isArray(v)) return `list of ${v.length} items`;
  if (plain(v)) return `object of ${Object.keys(v).length} members`;
  const t = JSON.stringify(v);
  return t.length > CUT ? `${t.slice(0, CUT)}...` : t;
};
const load = (x) => {
  const v = typeof x === 'string' ? JSON.parse(x) : x;
  if (!plain(v)) throw new Error('not an artefact');
  return v;
};
const keyed = (arr) => {
  if (arr.length === 0 || !arr.every(plain)) return null;
  for (const name of ['key', 'id']) {
    const vals = arr.map((x) => x[name]);
    if (vals.every((v) => typeof v === 'string') && new Set(vals).size === vals.length) return name;
  }
  return null;
};
const dot = (p, k) => (p === '' ? k : `${p}.${k}`);

function walk(a, b, path, rows, depth) {
  if (depth > MAX_DEPTH) throw new Error('too deep');
  const ka = kindOf(a);
  if (ka !== kindOf(b)) { rows.push({ path, change: 'changed', before: show(a), after: show(b) }); return; }
  if (ka === 'object') {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const p = dot(path, k);
      if (!(k in a)) rows.push({ path: p, change: 'added', after: show(b[k]) });
      else if (!(k in b)) rows.push({ path: p, change: 'removed', before: show(a[k]) });
      else walk(a[k], b[k], p, rows, depth + 1);
    }
  } else if (ka === 'array') {
    const name = keyed(a) && keyed(a) === keyed(b) ? keyed(a) : null;
    if (name) {
      const ia = new Map(a.map((x) => [x[name], x]));
      const ib = new Map(b.map((x) => [x[name], x]));
      for (const [k, x] of ia) if (!ib.has(k)) rows.push({ path: `${path}[${k}]`, change: 'removed', before: show(x) });
      for (const [k, x] of ib) if (!ia.has(k)) rows.push({ path: `${path}[${k}]`, change: 'added', after: show(x) });
      for (const [k, x] of ia) if (ib.has(k)) walk(x, ib.get(k), `${path}[${k}]`, rows, depth + 1);
      const order = (m, other) => [...m.keys()].filter((k) => other.has(k)).join('\u0000');
      if (order(ia, ib) !== order(ib, ia)) rows.push({ path, change: 'reordered', before: show(a), after: show(b) });
    } else {
      for (let i = 0; i < Math.min(a.length, b.length); i += 1) walk(a[i], b[i], `${path}[${i}]`, rows, depth + 1);
      for (let i = b.length; i < a.length; i += 1) rows.push({ path: `${path}[${i}]`, change: 'removed', before: show(a[i]) });
      for (let i = a.length; i < b.length; i += 1) rows.push({ path: `${path}[${i}]`, change: 'added', after: show(b[i]) });
    }
  } else if (a !== b) rows.push({ path, change: 'changed', before: show(a), after: show(b) });
}

export function diffArtefacts(before, after) {
  const rows = [];
  try { walk(load(before), load(after), '', rows, 0); } catch { return Object.freeze({ ok: false, sentence: REFUSED }); }
  rows.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
  const shown = rows.slice(0, MAX_ROWS).map((r) => Object.freeze(r));
  const n = (c) => shown.filter((r) => r.change === c).length;
  const changed = n('changed') + n('reordered');
  const summary = shown.length === 0 ? 'No differences.' : `${n('added')} added, ${n('removed')} removed, ${changed} changed.`;
  return Object.freeze({ ok: true, same: shown.length === 0, summary, rows: Object.freeze(shown), truncated: rows.length > MAX_ROWS });
}

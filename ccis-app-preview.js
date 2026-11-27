// BROWSER APP, row 4.4b: the readable preview model of a contextual element. Prototype. Synthetic data only. Not for clinical use.
//
// Text rows only: fields, modules, then relationships as readable sentences. It never changes or implies the manifest status, never
// repairs a dangling relationship (the validator owns that finding), and never throws on a malformed member. Pure: no DOM, network,
// storage or clock.

const REFUSED = 'The preview needs a contextual element document.';
const HEADLINE = 'Preview only. It is not a validation result.';
const MAX_ROWS = 500;

const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const txt = (v) => (typeof v === 'string' ? v : '');
const items = (v) => (Array.isArray(v) ? v.filter(plain) : []);
const joined = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').join(', ') : '');
const noun = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const cardinality = (c) => {
  if (!plain(c) || !Number.isInteger(c.min) || !(Number.isInteger(c.max) || c.max === 'unbounded')) return '';
  return c.min === c.max ? `exactly ${c.min}` : `${c.min} to ${c.max}`;
};
const load = (x) => {
  const v = typeof x === 'string' ? JSON.parse(x) : x;
  if (!plain(v) || !plain(v.manifest) || v.manifest.type !== 'contextual-element') throw new Error('not an element');
  return v;
};

export function previewModel(input) {
  let doc;
  try { doc = load(input); } catch { return Object.freeze({ ok: false, sentence: REFUSED }); }
  const edges = items(doc.relationships);
  const linkedKeys = new Set(edges.flatMap((e) => [txt(e.from), txt(e.to)]));
  const row = (f, module) => ({
    key: txt(f.key), label: txt(f.label), type: txt(f.type), cardinality: cardinality(f.cardinality), units: joined(f.units),
    states: joined(f.epistemic), module, linked: linkedKeys.has(txt(f.key)),
  });
  const modules = items(doc.modules);
  const allFields = [...items(doc.fields).map((f) => row(f, '')), ...modules.flatMap((m) => items(m.fields).map((f) => row(f, txt(m.id))))];
  const labels = new Map();
  for (const f of allFields) if (!labels.has(f.key)) labels.set(f.key, f.label || f.key);
  const nameOf = (k) => (labels.has(k) ? labels.get(k) : k);
  const allModules = modules.map((m) => ({ id: txt(m.id), appliesWhen: txt(m.appliesWhen), fieldCount: items(m.fields).length }));
  const allEdges = edges.map((e) => {
    const from = txt(e.from); const to = txt(e.to); const kind = txt(e.kind);
    return { from, kind, to, text: `${nameOf(from)} ${kind.replace(/-/g, ' ')} ${nameOf(to)}`, dangling: !labels.has(from) || !labels.has(to) };
  });
  const fieldRows = allFields.slice(0, MAX_ROWS);
  const moduleRows = allModules.slice(0, MAX_ROWS - fieldRows.length);
  const edgeRows = allEdges.slice(0, MAX_ROWS - fieldRows.length - moduleRows.length);
  const truncated = fieldRows.length + moduleRows.length + edgeRows.length < allFields.length + allModules.length + allEdges.length;
  const freeze = (rows) => Object.freeze(rows.map((r) => Object.freeze(r)));
  return Object.freeze({
    ok: true, headline: HEADLINE, title: txt(doc.manifest.name), status: txt(doc.manifest.status),
    fieldRows: freeze(fieldRows), moduleRows: freeze(moduleRows), edgeRows: freeze(edgeRows),
    notes: `${noun(fieldRows.length, 'field')}, ${noun(moduleRows.length, 'module')}, ${noun(edgeRows.length, 'relationship')}.`, truncated,
  });
}

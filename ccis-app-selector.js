// Row 3.8c: pure model for choosing one context and one pathway from the loaded market.
// No clock, no storage, no network. Nothing here runs a pathway or judges compatibility.
// Output holds ids, versions, statuses and fixed sentences only.

const BLOCKED = ['rejected', 'withdrawn'];
const NOTHING = 'Nothing chosen.';
const KINDS = { 'contextual-element': 'contexts', pathway: 'pathways' };

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const keyOf = (id, version) => `${id}@${version}`;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // code-unit order, never localeCompare
const uniqSorted = (list) => [...new Set(list)].sort(cmp);

export function selectorModel({ market, importResult } = {}) {
  const model = { contexts: [], pathways: [] };
  const entries = isObj(market) && isObj(market.index) && Array.isArray(market.index.entries) ? market.index.entries : [];
  const applied = new Set();
  const list = importResult?.report?.appliedVersions;
  if (Array.isArray(list)) for (const a of list) if (isObj(a)) applied.add(keyOf(a.id, a.version));

  for (const e of entries) {
    const bucket = Object.hasOwn(KINDS, e.type) ? KINDS[e.type] : null;
    if (bucket === null || BLOCKED.includes(e.status)) continue;
    const item = {
      key: keyOf(e.id, e.version),
      id: e.id,
      version: e.version,
      status: typeof e.status === 'string' ? e.status : 'unknown',
      deprecated: e.status === 'deprecated',
      appliedByImport: applied.has(keyOf(e.id, e.version)),
    };
    if (bucket === 'pathways') {
      const refs = Array.isArray(e.references) ? e.references : [];
      item.contextKeys = uniqSorted(
        refs.filter((r) => isObj(r) && r.type === 'contextual-element' && typeof r.version === 'string').map((r) => keyOf(r.id, r.version)),
      );
    }
    model[bucket].push(item);
  }
  const order = (a, b) => cmp(a.id, b.id) || cmp(a.version, b.version);
  model.contexts.sort(order);
  model.pathways.sort(order);
  return model;
}

const hasKey = (items, key) => typeof key === 'string' && items.some((i) => i.key === key);
const clean = (model, selection) => ({
  contextKey: hasKey(model.contexts, selection?.contextKey) ? selection.contextKey : null,
  pathwayKey: hasKey(model.pathways, selection?.pathwayKey) ? selection.pathwayKey : null,
});

// Returns a new selection. A key that is not in the model changes nothing.
export function selectOption(model, selection, action) {
  const now = clean(model, selection);
  if (!isObj(action)) return now;
  if (action.kind === 'clear') return { contextKey: null, pathwayKey: null };
  if (action.kind === 'context' && hasKey(model.contexts, action.key)) return { ...now, contextKey: action.key };
  if (action.kind === 'pathway' && hasKey(model.pathways, action.key)) return { ...now, pathwayKey: action.key };
  return now;
}

export function selectionView(model, selection) {
  const now = clean(model, selection);
  const context = model.contexts.find((i) => i.key === now.contextKey) ?? null;
  const pathway = model.pathways.find((i) => i.key === now.pathwayKey) ?? null;
  const both = context !== null && pathway !== null;
  const mismatch = both && !pathway.contextKeys.includes(context.key);
  return {
    contextLabel: context ? `${context.id} ${context.version}` : NOTHING,
    pathwayLabel: pathway ? `${pathway.id} ${pathway.version}` : NOTHING,
    mismatch,
    ready: both && !mismatch,
  };
}

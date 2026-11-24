// BROWSER APP, row 3.9a: pure results model. Prototype. Synthetic data only. Not for clinical use.
//
// Turns the { ok, record, skipped } of runForPage into plain rows a view can draw. No DOM, clock, storage or
// network. Values are shown as the record holds them: no rounding, no unit conversion. A missing value is
// never "0", "normal" or "none" (unknown never becomes false). recordIds, the snapshot and the context are
// never copied (D-173).

const S_NONE = 'No run yet.';
const S_FAILED = 'The run failed. No results.';
const S_NO_VALUE = 'No value.';
const S_UNKNOWN_KIND = 'Not displayed: unknown result kind.';
const S_NO_MATCH = 'No outcome matched (indeterminate).';
const S_NOTHING_MISSING = 'Nothing skipped or omitted.';
const S_TEST_ONLY = 'Test-only parameters. Not clinical values.';
const S_PROTOTYPE = 'Prototype. Synthetic data only. Not for clinical use.';
const S_NO_CHECKSUM = 'none';

export const RESULTS_SENTENCES = Object.freeze([S_NONE, S_FAILED, S_NO_VALUE, S_UNKNOWN_KIND, S_NO_MATCH, S_NOTHING_MISSING, S_TEST_ONLY, S_PROTOTYPE]);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);
const text = (v) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));
const copy = (v) => JSON.parse(JSON.stringify(v));

function displayOf(item) {
  const v = item.value;
  if (item.kind === 'value') {
    if (!isObj(v) || v.amount === undefined || v.amount === null) return S_NO_VALUE;
    return v.unit === undefined || v.unit === null || v.unit === '' || v.unit === '1' ? text(v.amount) : `${text(v.amount)} ${text(v.unit)}`;
  }
  if (item.kind === 'classification') return isObj(v) && typeof v.label === 'string' && v.label !== '' ? v.label : S_NO_VALUE;
  if (item.kind === 'table') return isObj(v) && Array.isArray(v.columns) && Array.isArray(v.rows) ? copy({ columns: v.columns, rows: v.rows }) : S_NO_VALUE;
  return S_UNKNOWN_KIND;
}

const empty = (state, headline) => ({
  state, headline, groups: [], trace: [], missing: [], missingNote: S_NOTHING_MISSING,
  scope: null, limitations: [S_PROTOTYPE], provenance: null,
});

export function resultsModel(run) {
  if (!isObj(run) || !isObj(run.record)) return empty('none', S_NONE);
  const rec = run.record;
  if (rec.status === 'failed') return empty('failed', S_FAILED);

  const groups = [];
  const byAnalytic = new Map();
  const limitations = [S_PROTOTYPE];
  const addLimits = (list) => { for (const l of arr(list)) { const t = text(l); if (t !== '' && !limitations.includes(t)) limitations.push(t); } };
  addLimits(rec.limitations);
  let count = 0;
  for (const r of arr(rec.results)) {
    if (!isObj(r)) continue;
    const key = text(r['x-analytic']);
    if (!byAnalytic.has(key)) { const g = { analytic: key, items: [] }; byAnalytic.set(key, g); groups.push(g); }
    byAnalytic.get(key).items.push({
      outputId: text(r.outputId), kind: text(r.kind), display: displayOf(r),
      warnings: arr(r.warnings).map(text), limitations: arr(r.limitations).map(text), missingDataNotes: arr(r.missingDataNotes).map(text),
    });
    addLimits(r.limitations);
    count += 1;
  }

  const trace = arr(rec['x-trace']).filter(isObj).map((t) => ({
    node: text(t.node),
    inputs: arr(t.inputs).filter(isObj).map((i) => ({ key: text(i.key), concept: text(i.concept), state: text(i.state), records: i.records })),
    outcomes: arr(t.outcomes).filter(isObj).map((o) => ({ id: text(o.id), matched: o.matched === true })),
    taken: t.taken === null || t.taken === undefined ? null : text(t.taken),
    takenText: t.taken === null || t.taken === undefined ? S_NO_MATCH : text(t.taken),
  }));

  const missing = arr(run.skipped).filter(isObj).map((s) => ({
    id: text(s.id), version: text(s.version),
    reason: [text(s.outcome), arr(s.reasons).map(text).join(', ')].filter((x) => x !== '').join(': '),
  }));
  if (isObj(rec['x-omitted'])) for (const k of Object.keys(rec['x-omitted'])) missing.push({ id: k, version: '', reason: 'omitted' });

  const testOnly = rec['x-testOnly'] === true;
  const ref = (r) => (isObj(r) ? `${text(r.id)} ${text(r.version)}` : '');
  const cs = isObj(rec['x-checksums']) ? rec['x-checksums'] : {};
  const sum = (v) => (typeof v === 'string' && v !== '' ? v : S_NO_CHECKSUM);
  return {
    state: 'completed',
    headline: `Run complete: ${count} results.`,
    groups, trace, missing, missingNote: S_NOTHING_MISSING,
    scope: {
      pathway: ref(rec.package),
      analytics: arr(rec['x-analytics']).map(ref),
      evaluationTime: isObj(rec.evaluationTime) ? text(rec.evaluationTime.value) : '',
      testOnly,
      ...(testOnly ? { testOnlyNote: S_TEST_ONLY } : {}),
    },
    limitations,
    provenance: {
      id: text(rec.id),
      standard: isObj(rec.standard) ? text(rec.standard.version) : '',
      engine: isObj(rec.engine) ? text(rec.engine.version) : '',
      operatorSet: isObj(rec.operatorSet) ? `${text(rec.operatorSet.name)} ${text(rec.operatorSet.version)}` : '',
      checksums: { envelope: sum(cs.envelope), context: sum(cs.context), results: sum(cs.results) },
    },
  };
}

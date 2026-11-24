// BROWSER APP, row 3.9: pure in-page run adapter. Prototype. Synthetic data only. Not for clinical use.
//
//   runForPage({ market, pathwayKey, importResult, supplied, evaluationTime, runNeedsData })
//     -> { ok: true, record, skipped } | { ok: false, sentence }
//
// The browser twin of the CLI `run` command (ccis-cli-flow.js, runCmd): the same pins, planner and executor, but the
// market is an object already in memory. No clock, randomness, storage or network: the evaluation time is an input.
// Refusals are fixed sentences and never echo input. A `failed` record (a refused import) is still a record (D-044).
// Imports only bundle-safe modules (ccis-cli-flow.js is not, D-141). Nothing passed in is changed.

import { pin, resolve, verifyPin } from './ccis-market.js';
import { planRun, executeRun } from './ccis-run.js';
import { APP_RUNTIME } from './ccis-app-catalogue.js';
import { heldFromMarket } from './ccis-app-import-report.js';

const S_NO_MARKET = 'Load a market first.';
const S_NO_KEY = 'Choose a pathway first.';
const S_NOT_FOUND = 'The chosen pathway is not in the market.';
const S_NO_IMPORT = 'Import an envelope first.';
const S_NO_TIME = 'An evaluation time is needed.';
const S_PIN = 'The market could not be checked against its pins.';
const S_REFUSED = 'The run was refused.';
const S_DEFECT = 'The run could not be completed.';

export const RUN_SENTENCES = Object.freeze([S_NO_MARKET, S_NO_KEY, S_NOT_FOUND, S_NO_IMPORT, S_NO_TIME, S_PIN, S_REFUSED, S_DEFECT]);

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const no = (sentence) => ({ ok: false, sentence });
// The rule id comes from the planner's fixed list, never from input.
const refused = (r) => no(isObj(r) && isObj(r.refusal) && /^R-\d{3}$/.test(String(r.refusal.id)) ? `${S_REFUSED} Rule ${r.refusal.id}.` : S_REFUSED);

// Resolve, pin and re-check one reference against the market, as the CLI does. Returns the artefact and its checksum, or null.
function pinned(market, ref) {
  if (!resolve({ market, ref }).ok) return null;
  const p = pin({ market, ref });
  if (!p.ok) return null;
  const v = verifyPin({ market, pin: p.pin });
  return v.ok ? { artefact: v.artefact, checksum: p.pin.checksum } : null;
}

export function runForPage({ market, pathwayKey, importResult, supplied, evaluationTime, runNeedsData } = {}) {
  const entries = isObj(market) && isObj(market.index) && Array.isArray(market.index.entries) ? market.index.entries : null;
  if (entries === null) return no(S_NO_MARKET);
  if (typeof pathwayKey !== 'string' || pathwayKey === '') return no(S_NO_KEY);
  const hit = entries.find((e) => e.type === 'pathway' && `${e.id}@${e.version}` === pathwayKey);
  if (!hit || typeof market.files?.[hit.path] !== 'string') return no(S_NOT_FOUND);
  if (!isObj(importResult)) return no(S_NO_IMPORT);
  if (typeof evaluationTime !== 'string') return no(S_NO_TIME);
  try {
    const top = pinned(market, { id: hit.id, type: 'pathway', range: hit.version });
    if (top === null) return no(S_PIN);
    const pathway = top.artefact;
    const analytics = [];
    for (const a of Array.isArray(pathway.analytics) ? pathway.analytics : []) {
      const p = pinned(market, a?.ref);
      if (p === null) return no(S_PIN);
      analytics.push({ analytic: p.artefact, checksum: p.checksum });
    }
    const planned = planRun({
      pathway,
      analytics,
      held: heldFromMarket(market),
      importResult,
      runtime: APP_RUNTIME,
      request: { mode: 'preview', runNeedsData: runNeedsData === true },
    });
    if (!planned.ok) return refused(planned);
    const done = executeRun({ plan: planned.plan, supplied: isObj(supplied) ? supplied : {}, evaluationTime });
    if (!done.ok) return refused(done);
    const items = Array.isArray(done.record['x-plan']?.items) ? done.record['x-plan'].items : [];
    const skipped = JSON.parse(JSON.stringify(items.filter((i) => i.action !== 'run')));
    return { ok: true, record: done.record, skipped };
  } catch {
    return no(S_DEFECT); // a defect never echoes its message
  }
}

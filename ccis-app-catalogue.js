// BROWSER APP, row 3.8d: pure compatibility catalogue model. Prototype. Synthetic data only. Not for clinical use.
//
// Turns one compatibility result into rows a page can show. No clock, storage or network. Imports only
// bundle-safe modules. Unknown never becomes compatible: an outcome or reason this page does not know is
// shown as unrecognised and grouped apart (D-161). Findings name ids, keys and versions, never patient values.

import { resolveCompatibility, COMPAT_REASONS, OUTCOMES, PREVIEW_BANNER } from './ccis-compat.js';
import { heldFromMarket } from './ccis-app-import-report.js';

// A copy of CLI_RUNTIME (ccis-cli-flow.js is not bundle-safe, D-141); a test keeps the two equal.
export const APP_RUNTIME = Object.freeze({
  standardMajors: Object.freeze([0]),
  engine: Object.freeze({ version: '0.1.0' }),
  operatorSet: Object.freeze({ name: 'ccis-core-ops', majors: Object.freeze([0]) }),
  limits: Object.freeze({ maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 }),
  understoodExtensions: Object.freeze([]),
});

const S_NO_MARKET = 'Load a market first.';
const S_NO_KEY = 'Choose a pathway first.';
const S_NOT_FOUND = 'The chosen pathway is not in the market.';
const S_UNKNOWN_REASON = 'The reason is not recognised by this version of the page.';
const OTHER = 'other';
const OTHER_LABEL = 'Unrecognised outcome';

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const MEANING = new Map(COMPAT_REASONS.map((r) => [r.id, r.meaning]));
const text = (v) => (typeof v === 'string' ? v : '');
const strings = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []);

export function compatibilityFor({ market, pathwayKey, context } = {}) {
  const entries = isObj(market) && isObj(market.index) && Array.isArray(market.index.entries) ? market.index.entries : null;
  if (entries === null) return { ok: false, sentence: S_NO_MARKET };
  if (typeof pathwayKey !== 'string' || pathwayKey === '') return { ok: false, sentence: S_NO_KEY };
  const hit = entries.find((e) => e.type === 'pathway' && `${e.id}@${e.version}` === pathwayKey);
  if (!hit || typeof market.files?.[hit.path] !== 'string') return { ok: false, sentence: S_NOT_FOUND };
  const result = resolveCompatibility({
    pathway: JSON.parse(market.files[hit.path]),
    held: heldFromMarket(market),
    context: context === undefined ? null : context,
    runtime: APP_RUNTIME,
    request: { mode: 'preview' },
  });
  return { ok: true, result };
}

function rowOf(entry) {
  const known = Object.hasOwn(OUTCOMES, entry?.outcome);
  const checks = Array.isArray(entry?.checks) ? entry.checks : [];
  const explanations = [];
  for (const c of checks) {
    for (const f of Array.isArray(c?.findings) ? c.findings : []) {
      explanations.push({
        check: text(c.name),
        state: text(f.state),
        reason: text(f.reason),
        meaning: MEANING.has(f.reason) ? MEANING.get(f.reason) : S_UNKNOWN_REASON,
        detail: text(f.detail),
        needs: text(f.needs),
      });
    }
  }
  return {
    kind: text(entry?.ref?.type),
    id: text(entry?.ref?.id),
    version: text(entry?.ref?.version),
    outcome: known ? entry.outcome : OTHER,
    label: known ? OUTCOMES[entry.outcome] : OTHER_LABEL,
    mayRun: entry?.policy?.mayRun === true,
    explanations,
    satisfied: strings(entry?.satisfied),
    needed: strings(entry?.needed),
  };
}

export function catalogueModel(result) {
  const entries = isObj(result) ? [result.pathway, ...(Array.isArray(result.packages) ? result.packages : [])].filter(isObj) : [];
  const rows = entries.map(rowOf);
  const groups = {};
  for (const k of [...Object.keys(OUTCOMES), OTHER]) groups[k] = [];
  rows.forEach((r, i) => groups[r.outcome].push(i));
  const counts = {};
  for (const k of Object.keys(groups)) counts[k] = groups[k].length;
  const policy = isObj(result) && isObj(result.pathway) && isObj(result.pathway.policy) ? result.pathway.policy : {};
  const banners = [...new Set([PREVIEW_BANNER, ...(Array.isArray(policy.banners) ? policy.banners.map((b) => text(b?.text)).filter(Boolean) : [])])];
  return { rows, groups, counts, banners };
}

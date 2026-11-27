// CCIS GOVERNED AI DRAFTING, row 4.3: the gate. Prototype. Synthetic data only. Not for clinical use.
//
// Decides what may be sent to an AI model and what may be accepted back. No model call, no network, no UI here (rows 4.3a, 4.3b).
// CCIS-REQ-054: nothing here publishes, validates or approves. 074: off unless enabled, labelled. 086: a draft goes through the same
// SDK builders as every route. 087: drafts only, terminology supplied not invented, unresolved assumptions named. Pure.
import { SdkError } from './ccis-sdk.js';
import { element } from './ccis-sdk-element.js';
import { pathway } from './ccis-sdk-pathway.js';
import { analytics, SOURCE_KINDS } from './ccis-sdk-analytics.js';

export const AI_ENABLED_DEFAULT = false;
export const DRAFT_LABEL = 'AI-drafted, unreviewed. Not clinically validated.';
export const DRAFT_REFUSALS = [
  { code: 'AI-001', sentence: 'AI drafting is switched off.' },
  { code: 'AI-002', sentence: 'A member is not allowed in the request.' },
  { code: 'AI-003', sentence: 'A request member is missing, has the wrong type or is out of bounds.' },
  { code: 'AI-004', sentence: 'A draft must stay a draft: it cannot be published, validated or approved.' },
  { code: 'AI-005', sentence: 'A member of the draft has no supplied source and no stated assumption.' },
  { code: 'AI-006', sentence: 'The authoring pipeline refused the draft.' },
];
export class DraftError extends Error {
  constructor(code, path, sdkCode) {
    super(DRAFT_REFUSALS.find((r) => r.code === code).sentence);
    this.name = 'DraftError';
    this.code = code;
    this.path = path;
    if (sdkCode) this.sdkCode = sdkCode;
  }
}
const BUILDERS = { 'contextual-element': element, pathway, 'analytics-package': analytics };
export const DRAFT_TYPES = Object.freeze(Object.keys(BUILDERS));
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (max) => (v) => typeof v === 'string' && /^\S/.test(v) && v.length <= max;
const closed = (v, checks, path, code) => {
  if (!plain(v)) throw new DraftError(code, path);
  for (const k of Object.keys(v).sort()) if (!(k in checks)) throw new DraftError(code, path ? `${path}.${k}` : k);
  for (const [k, ok] of Object.entries(checks)) if (!ok(v[k])) throw new DraftError('AI-003', path ? `${path}.${k}` : k);
  return v;
};
const items = (min, max, one, path) => (v) => Array.isArray(v) && v.length >= min && v.length <= max
  && v.every((x, i) => { closed(x, one, `${path}.${i}`, 'AI-002'); return true; });

// What may be sent. Absent or non-true `enabled` is off. Only these members exist: no context, run record, envelope or patient field.
export function draftRequest(spec) {
  if (!plain(spec) || spec.enabled !== true) throw new DraftError('AI-001', 'enabled');
  const { enabled, ...rest } = spec;
  closed(rest, {
    artefactType: (x) => typeof x === 'string' && Object.hasOwn(BUILDERS, x), standardVersion: (x) => /^\d+\.\d+\.\d+$/.test(x), instruction: text(2000),
    sources: items(1, 20, { id: (x) => /^[a-z][a-z0-9-]*$/.test(x), kind: (x) => SOURCE_KINDS.includes(x), citation: text(500), passage: text(2000) }, 'sources'),
    terminology: items(0, 50, { system: text(200), code: text(200), display: text(200) }, 'terminology'),
  }, '', 'AI-002');
  return Object.freeze(JSON.parse(JSON.stringify(rest)));
}

// What may be accepted back: a draft through the SDK builder, still a draft, every member sourced or marked an assumption.
export function acceptDraft(response, { artefactType, sources }) {
  const build = Object.hasOwn(BUILDERS, artefactType) ? BUILDERS[artefactType] : undefined;
  if (!build) throw new DraftError('AI-003', 'artefactType');
  closed(response, { artefact: plain, trace: Array.isArray, assumptions: Array.isArray }, '', 'AI-006');
  const m = response.artefact.manifest;
  if (plain(m) && ('validation' in m || (m.status !== undefined && m.status !== 'draft'))) throw new DraftError('AI-004', 'artefact.manifest');
  let artefact;
  try { artefact = build(response.artefact); } catch (e) {
    if (e instanceof SdkError) throw new DraftError('AI-006', e.path ? `artefact.${e.path}` : 'artefact', e.code);
    throw e;
  }
  const ids = new Set(sources.map((s) => s.id));
  const covered = new Set();
  response.trace.forEach((t, i) => {
    closed(t, { member: text(100), source: text(100) }, `trace.${i}`, 'AI-006');
    if (!ids.has(t.source)) throw new DraftError('AI-005', `trace.${i}.source`);
    if (!Object.hasOwn(artefact, t.member)) throw new DraftError('AI-005', `trace.${i}.member`);
    covered.add(t.member);
  });
  response.assumptions.forEach((a, i) => { closed(a, { member: text(100), note: text(500) }, `assumptions.${i}`, 'AI-006'); covered.add(a.member); });
  for (const k of Object.keys(artefact)) if (k !== 'manifest' && !covered.has(k)) throw new DraftError('AI-005', k);
  const assumptions = Object.freeze(response.assumptions.map((a) => Object.freeze({ member: a.member, note: a.note })));
  return Object.freeze({ artefact, label: DRAFT_LABEL, status: 'draft', sourceClass: 'AI-proposed', assumptions });
}

// BROWSER APP, row 4.3b: pure page model for governed AI drafting. Prototype. Synthetic data only. Not for clinical use.
//
//   draftForPage({ enabled, key, model, request, client }) -> { ok: true, draft } | { ok: false, sentence, code?, path? }
//   draftModel(draft) -> frozen { label, status, sourceClass, headline, rows, notes }
//
// Runs the whole path once: request gate (ccis-draft.js), model call (injected client, ccis-app-ai.js), accept gate.
// A draft is only ever a draft: nothing here publishes, validates or approves. Pure: no page access and no I/O.
// Refusals are fixed sentences and never echo input, a key, a reply or an address. The key is never copied into a result.

import { draftRequest, acceptDraft, DraftError } from './ccis-draft.js';
import { AiError } from './ccis-app-ai.js';

const S = {
  'AI-001': 'AI drafting is off. Switch it on to ask for a draft.',
  'AI-002': 'The request has a member that is not allowed. Only the instruction, sources and terminology may be sent.',
  'AI-003': 'The request is incomplete or out of bounds. Check the artefact type, version, instruction and sources.',
  'AI-004': 'The draft was refused: a draft cannot be published, validated or approved.',
  'AI-005': 'The draft was refused: a member has no source and no stated assumption.',
  'AI-006': 'The draft was refused: it does not pass the authoring rules.',
  'AIC-001': 'The key or the model name is not acceptable.',
  'AIC-002': 'The model request failed. Check the key, and that this page was built to allow the connection.',
  'AIC-003': 'The model reply could not be used as a draft.',
  'AIC-004': 'The request could not be sent in the allowed form.',
};
export const DRAFT_SENTENCES = Object.freeze(S);
const NO_CLIENT = 'No model connection is available on this page.';
const UNEXPECTED = 'Drafting stopped unexpectedly. Nothing was drafted.';
const HEADLINE = 'Draft only. A human must review it. It is not published or validated.';

const fail = (sentence, e) => Object.freeze(e && e.code ? { ok: false, sentence, code: e.code, path: e.path } : { ok: false, sentence });
const words = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

export async function draftForPage({ enabled, key, model, request, client } = {}) {
  try {
    const payload = draftRequest({ ...request, enabled });
    const call = typeof client === 'function' ? client : client && typeof client === 'object' ? client.draftWithModel : undefined;
    if (typeof call !== 'function') return fail(NO_CLIENT);
    const reply = await call.call(client, { payload, model, key });
    const accepted = acceptDraft(reply, { artefactType: payload.artefactType, sources: payload.sources });
    const trace = Object.freeze(reply.trace.map((t) => Object.freeze({ member: t.member, source: t.source })));
    return Object.freeze({ ok: true, draft: Object.freeze({ ...accepted, trace }) });
  } catch (e) {
    if (e instanceof DraftError && Object.hasOwn(S, e.code)) return fail(S[e.code], e);
    if (e instanceof AiError && Object.hasOwn(S, e.code)) return fail(S[e.code]);
    return fail(UNEXPECTED);
  }
}

export function draftModel(draft) {
  const notes = new Map(draft.assumptions.map((a) => [a.member, a.note]));
  const src = new Map(draft.trace.map((t) => [t.member, t.source]));
  const rows = Object.keys(draft.artefact).filter((m) => m !== 'manifest').map((member) => Object.freeze({
    member, basis: notes.has(member) ? `Assumption: ${notes.get(member)}` : `Source: ${src.get(member)}`,
  }));
  return Object.freeze({
    label: draft.label, status: draft.status, sourceClass: draft.sourceClass, headline: HEADLINE, rows: Object.freeze(rows),
    notes: `${words(rows.length, 'member')}, ${words(draft.assumptions.length, 'assumption')}.`,
  });
}

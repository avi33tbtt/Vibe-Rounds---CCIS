// CCIS APP AI ADAPTER (row 4.3a): one request to the model API through an injected fetch. Pure: it never names the global,
// reads no storage, sets no timer. Prototype. Synthetic data only. Not for clinical use.
//
// The only input is the whitelisted payload from draftRequest (row 4.3), so no patient data or run record can ride along. The key
// is a parameter: it goes in one header, is never stored or logged, and no error quotes it, the address, the status or the body.
// The reply is parsed here and judged by acceptDraft, not here.

export const AI_ENDPOINT = 'https://api.anthropic.com/v1/messages';
export const AI_ORIGIN = new URL(AI_ENDPOINT).origin;
export const MAX_REPLY_CHARS = 200000;
export const MAX_TOKENS = 4000;
export const SYSTEM_RULES = Object.freeze([
  'You draft a clinical-intelligence artefact for human review. You only draft.',
  'Reply with one JSON object with exactly the members artefact, trace and assumptions, and nothing else.',
  'Use no numeric literal in any expression; thresholds exist only as declared parameters without values.',
  'Every member of the artefact must trace to a supplied source id, or be named in assumptions with a note.',
  'Use only the supplied terminology; never invent a code. Never claim clinical validity.',
]);
export const AI_REFUSALS = [
  { code: 'AIC-001', sentence: 'The key or the model name is not acceptable.' },
  { code: 'AIC-002', sentence: 'The model request failed.' },
  { code: 'AIC-003', sentence: 'The model reply is not usable.' },
  { code: 'AIC-004', sentence: 'The payload is not a drafting request payload.' },
];
export class AiError extends Error {
  constructor(code, path = '') {
    super(AI_REFUSALS.find((r) => r.code === code).sentence);
    this.name = 'AiError';
    this.code = code;
    this.path = path;
  }
}
const OPTIONS = { method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', mode: 'cors' };
const MEMBERS = ['artefactType', 'instruction', 'sources', 'standardVersion', 'terminology'];
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function makeAiClient(fetchFn) {
  if (typeof fetchFn !== 'function') throw new Error('fetch function is not acceptable');
  return async function draftWithModel({ payload, model, key } = {}) {
    if (typeof key !== 'string' || !/^\S{1,200}$/.test(key)) throw new AiError('AIC-001', 'key');
    if (typeof model !== 'string' || !/^claude-[a-z0-9-]+$/.test(model)) throw new AiError('AIC-001', 'model');
    if (!plain(payload) || JSON.stringify(Object.keys(payload).sort()) !== JSON.stringify(MEMBERS)) throw new AiError('AIC-004', 'payload');
    const body = JSON.stringify({ model, max_tokens: MAX_TOKENS, system: SYSTEM_RULES.join(' '), messages: [{ role: 'user', content: JSON.stringify(payload) }] });
    const headers = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'x-api-key': key };
    let data;
    try {
      const res = await fetchFn(AI_ENDPOINT, { ...OPTIONS, headers, body });
      if (!(res && res.ok === true && res.status === 200 && res.redirected !== true)) throw new Error('x');
      data = JSON.parse(await res.text());
    } catch { throw new AiError('AIC-002'); }
    const blocks = plain(data) && Array.isArray(data.content) ? data.content.filter((b) => plain(b) && b.type === 'text' && typeof b.text === 'string') : [];
    const text = blocks.map((b) => b.text).join('').trim();
    if (blocks.length === 0 || text.length > MAX_REPLY_CHARS) throw new AiError('AIC-003', 'reply');
    const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text);
    let out;
    try { out = JSON.parse(fenced ? fenced[1] : text); } catch { throw new AiError('AIC-003', 'reply'); }
    if (!plain(out) || Object.keys(out).some((k) => !['artefact', 'trace', 'assumptions'].includes(k))) throw new AiError('AIC-003', 'reply');
    return Object.freeze(out);
  };
}

// CCIS CODE-AUTHORING SDK (row 4.2). Prototype. Synthetic data only. Not for clinical use.
//
// Typed builders that return plain, frozen JSON: the same artefact a file holds, so it goes through the same canonicalizer,
// checksum and validator (CCIS-REQ-086). Pure: no file, network, clock or randomness. A builder never invents content: no
// default code, display, mapping status or note; an omitted required member is refused. Errors are fixed sentences with a
// code and a path and never quote the refused value. Only the terminology binding exists so far (rows 4.2a to 4.2d add the rest).

export const SDK_REFUSALS = [
  { code: 'S-001', sentence: 'A member is not part of this artefact.' },
  { code: 'S-002', sentence: 'A required member is missing.' },
  { code: 'S-003', sentence: 'A member has the wrong type or an unacceptable value.' },
  { code: 'S-004', sentence: 'The members together break a rule of this artefact.' },
];
export const MAPPING_STATUSES = Object.freeze(['mapped', 'lossy', 'low-confidence', 'unmapped']);

export class SdkError extends Error {
  constructor(code, path) {
    super(SDK_REFUSALS.find((r) => r.code === code).sentence);
    this.name = 'SdkError';
    this.code = code;
    this.path = path;
  }
}

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const token = (v) => typeof v === 'string' && /^\S+$/.test(v);
const sentence = (v) => typeof v === 'string' && /^\S.*$/s.test(v);
const at = (path, key) => (path ? `${path}.${key}` : key);

// rules: { allowed: { member: check }, required: [members], closed? }. `x-` members pass as JSON data unless `closed`. Returns a frozen copy.
function shape(spec, rules, path) {
  if (!isPlain(spec)) throw new SdkError('S-003', path);
  const out = {};
  for (const key of Object.keys(spec).sort()) {
    const here = at(path, key);
    if (key.startsWith('x-') && !rules.closed) {
      const text = JSON.stringify(spec[key]);
      if (text === undefined) throw new SdkError('S-003', here);
      out[key] = JSON.parse(text);
    } else if (Object.hasOwn(rules.allowed, key)) {
      out[key] = rules.allowed[key](spec[key], here);
    } else {
      throw new SdkError('S-001', here);
    }
  }
  for (const key of rules.required) if (!(key in out)) throw new SdkError('S-002', at(path, key));
  return Object.freeze(out);
}
const need = (ok, path) => { if (!ok) throw new SdkError('S-003', path); };
// An array kept in the order given (never sorted); too short or not an array is an unacceptable value.
const list = (v, path, min, item) => {
  need(Array.isArray(v) && v.length >= min, path);
  return Object.freeze(v.map((x, i) => item(x, at(path, i))));
};

const systemRef = (v, path) => {
  const r = shape(v, {
    allowed: {
      id: (x, p) => { need(token(x), p); return x; },
      version: (x, p) => { need(token(x), p); return x; },
      noVersionPublished: (x, p) => { need(x === true, p); return x; },
    },
    required: ['id'],
  }, path);
  if (('version' in r) === ('noVersionPublished' in r)) throw new SdkError('S-004', path); // exactly one of the two
  return r;
};

const mapping = (v, path) => {
  const m = shape(v, {
    allowed: {
      status: (x, p) => { need(MAPPING_STATUSES.includes(x), p); return x; },
      confidence: (x, p) => { need(typeof x === 'number' && x >= 0 && x <= 1, p); return x; },
      note: (x, p) => { need(sentence(x), p); return x; },
    },
    required: ['status'],
  }, path);
  if ((m.status === 'lossy' || m.status === 'low-confidence') && !('confidence' in m && 'note' in m)) throw new SdkError('S-004', path);
  if (m.status === 'unmapped' && !('note' in m)) throw new SdkError('S-004', path);
  return m;
};

// A binding ties a concept to a code by code-system reference, never by label. An unmapped binding carries no code or system.
export function binding(spec) {
  const b = shape(spec, {
    allowed: {
      codeSystem: systemRef,
      valueSet: systemRef,
      code: (x, p) => { need(token(x), p); return x; },
      display: (x, p) => { need(typeof x === 'string', p); return x; },
      mapping,
    },
    required: ['mapping'],
  }, '');
  const carriesCode = ['code', 'codeSystem', 'valueSet'].some((k) => k in b);
  if (b.mapping.status === 'unmapped') { if (carriesCode) throw new SdkError('S-004', ''); }
  else for (const k of ['codeSystem', 'code']) if (!(k in b)) throw new SdkError('S-002', k);
  return b;
}

export const OUTCOME_KINDS = Object.freeze(['answer', 'missing-data', 'conflicting', 'indeterminate']);
export const INPUT_STATES = Object.freeze(['present', 'absent', 'unknown', 'not-collected', 'not-applicable', 'explicitly-negative', 'entered-in-error', 'conflicting']);
const idText = (x, p) => { need(typeof x === 'string' && /^[a-z][a-z0-9-]*$/.test(x), p); return x; };
const keyText = (x, p) => { need(typeof x === 'string' && /^[a-z][A-Za-z0-9]*$/.test(x), p); return x; };
const artefactId = (x, p) => { need(typeof x === 'string' && /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(x), p); return x; };
const textOf = (x, p) => { need(sentence(x), p); return x; };

const nodeInput = (v, p) => shape(v, { allowed: { key: keyText, element: artefactId, field: keyText }, required: ['key', 'element', 'field'] }, p);
const nodeWhen = (v, p) => shape(v, { closed: true, allowed: { input: keyText, is: (x, q) => { need(INPUT_STATES.includes(x), q); return x; } }, required: ['input', 'is'] }, p);
const nodeNext = (v, p) => {
  const n = shape(v, { closed: true, allowed: { stage: idText, end: (x, q) => { need(x === true, q); return x; } }, required: [] }, p);
  if (('stage' in n) === ('end' in n)) throw new SdkError('S-004', p); // exactly one of the two
  return n;
};
const nodeOutcome = (v, p) => shape(v, {
  allowed: { id: idText, kind: (x, q) => { need(OUTCOME_KINDS.includes(x), q); return x; }, when: (x, q) => list(x, q, 1, nodeWhen), next: nodeNext, note: textOf },
  required: ['id', 'kind', 'when', 'next'],
}, p);

// A question about the record with an outcome for every state. Whether each `when.input` names a declared input stays with the
// validator (layer 3): the SDK adds no rule the file route lacks.
export function decisionNode(spec) {
  const n = shape(spec, {
    allowed: { id: idText, question: textOf, inputs: (x, p) => list(x, p, 1, nodeInput), preconditions: (x, p) => list(x, p, 0, textOf), outcomes: (x, p) => list(x, p, 2, nodeOutcome) },
    required: ['id', 'question', 'inputs', 'outcomes'],
  }, '');
  if (!n.outcomes.some((o) => o.kind === 'indeterminate')) throw new SdkError('S-004', 'outcomes');
  return n;
}

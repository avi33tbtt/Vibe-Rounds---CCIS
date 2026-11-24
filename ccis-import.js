// CCIS importer (row 3.1). Prototype. Synthetic data only. Not for clinical use.
//
// Pure: takes parsed JSON objects, never reads files, the clock, randomness or the network.
//
//   importEnvelope(envelope, { held, supportedEnvelopeMajors, expectedChecksum })
//     -> { ok, outcome, context, contextChecksum, envelopeChecksum, report }
//
// - The trust boundary (IMP-001). One envelope in; a canonical context holding ONLY accepted
//   records, and an import report in which every record is in exactly one category (IMP-100, 105).
// - Accepted records are kept unchanged: no coercion, no unit conversion, no filled-in value or time
//   (IMP-108). Conversion lives in the executor, through a package's declared `convert`.
// - Whole-envelope refusal (fail closed): not an object, unsupported major, schema failure or an
//   unrecognised critical field, an applied artefact not held, a duplicate record id, a checksum
//   mismatch. A refusal has no records and no context. Reasons never quote the input (IMP-091).
// - Reports name a category and a code, never a value, a unit or a code text.
// - Observations and events in the context are sorted by id (code-unit order), so two envelopes that
//   differ only in record order give the same context bytes.

import { contextEnvelope as vEnvelope, importReport as vReport } from './ccis/validators/ccis-validators.js';
import { canonicalize, checksumOf, verifyChecksum } from './ccis-compile.js';

export const IMPORTER_VERSION = '0.1.0';
export const STANDARD_VERSION = '0.1.0';
export const CONTEXT_FORM = 'ccis-context/1';

export const REJECTION_CODES = Object.freeze({
  'excluded-by-policy': 'The record is excluded by import policy (entered in error); it is not used.',
  'concept-not-in-applied-element': 'The concept is not a field of any applied element; kept out of matching and not guessed (unmapped).',
  'source-class-not-allowed': 'The source class of the record is not permitted for this field.',
  'state-not-allowed': 'The explicit state of the record is not permitted for this field.',
  'kind-mismatch': 'The kind of value differs from the type the field declares.',
  'unit-not-allowed': 'The unit is not one of the units the field permits; never converted or assumed.',
  'correction-target-missing': 'The record corrects an id that is not in the envelope.',
});

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const major = (v) => (typeof v === 'string' && SEMVER.test(v) ? Number(v.split('.')[0]) : null);
const fails = (v, d) => v(d) !== true;
const hasExtraField = (v) => (v.errors ?? []).some((e) => e.keyword === 'additionalProperties');
// The context owns its data: later changes to the caller's envelope cannot reach it.
const clone = (x) => structuredClone(x);
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Header of the report: echoed only after the envelope passed its schema; otherwise fixed placeholders,
// so hostile text never travels into a refusal report.
const UNREADABLE = { version: '0.0.0', exportedAt: 'unreadable', producer: { system: 'unreadable', version: '0.0.0' } };

function buildReport(parts) {
  const records = parts.records ?? [];
  const counts = { accepted: 0, rejected: 0, unmapped: 0, ambiguous: 0, total: records.length };
  for (const r of records) counts[r.category] += 1;
  if (counts.accepted + counts.rejected + counts.unmapped + counts.ambiguous !== counts.total) {
    throw new Error('defect: a record is in none of the four categories (IMP-105)');
  }
  const rep = {
    outcome: parts.refusalReason ? 'refused' : 'read',
    ...(parts.refusalReason ? { refusalReason: parts.refusalReason } : {}),
    envelope: parts.header ?? UNREADABLE,
    inclusions: { identity: false, narrative: false, enteredInError: false },
    importer: { version: IMPORTER_VERSION },
    standard: { version: STANDARD_VERSION },
    appliedVersions: parts.appliedVersions ?? [],
    records,
    counts,
    ignored: parts.ignored ?? [],
  };
  if (vReport(rep) !== true) throw new Error('defect: the importer built an import report that fails its schema');
  return rep;
}

const refuse = (refusalReason, extra = {}) => ({
  ok: false,
  outcome: 'refused',
  context: null,
  contextChecksum: null,
  envelopeChecksum: extra.envelopeChecksum ?? null,
  report: buildReport({ refusalReason, header: extra.header, appliedVersions: extra.appliedVersions }),
});

// Every `x-` member at any depth, as a JSON pointer. Whitespace in a name is percent-encoded so the
// path stays a single token.
const pointerPart = (k) => k.replace(/~/g, '~0').replace(/\//g, '~1').replace(/\s/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
function findExtensions(value, path, out) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => findExtensions(v, `${path}/${i}`, out));
  } else if (isObj(value)) {
    for (const k of Object.keys(value)) {
      const p = `${path}/${pointerPart(k)}`;
      if (k.startsWith('x-')) out.push({ path: p, reason: 'optional extension not used by the importer (IMP-112)' });
      else findExtensions(value[k], p, out);
    }
  }
  return out;
}

// Zone states of an observation, any of its times.
function timeNotes(o) {
  const notes = [];
  if (isObj(o.recorded) && o.recorded.state === 'unknown') notes.push('recorded-time-unknown');
  const zones = [o.effective, o.recorded, o.collected, o.kind === 'datetime' ? o.value : undefined];
  if (zones.some((t) => isObj(t) && t.zone === 'unknown')) notes.push('time-zone-unknown');
  return notes;
}

const reject = (o, code, extra = {}) => ({ ref: o.id, recordKind: 'observation', category: 'rejected', reasons: [{ code, ...extra }] });

function judgeObservation(o, fieldOf, idsInEnvelope) {
  if (o.status === 'entered-in-error') return reject(o, 'excluded-by-policy', { category: 'entered-in-error' });
  const field = fieldOf.get(o.concept.id);
  if (!field) return { ref: o.id, recordKind: 'observation', category: 'unmapped', reasons: [{ code: 'concept-not-in-applied-element' }] };
  if (Array.isArray(field.sourceClasses) && !field.sourceClasses.includes(o.sourceClass)) return reject(o, 'source-class-not-allowed');
  if (o.state !== undefined && Array.isArray(field.epistemic) && !field.epistemic.includes(o.state)) return reject(o, 'state-not-allowed');
  if (o.kind !== field.type) return reject(o, 'kind-mismatch');
  if (o.unit !== undefined && !(Array.isArray(field.units) && field.units.includes(o.unit))) return reject(o, 'unit-not-allowed');
  if (o.correctionOf !== undefined && !idsInEnvelope.has(o.correctionOf)) return reject(o, 'correction-target-missing');
  const notes = timeNotes(o);
  return { ref: o.id, recordKind: 'observation', category: 'accepted', ...(notes.length ? { notes } : {}) };
}

export function importEnvelope(envelope, options = {}) {
  const held = Array.isArray(options.held) ? options.held : [];
  const majors = Array.isArray(options.supportedEnvelopeMajors) ? options.supportedEnvelopeMajors : [0];

  if (!isObj(envelope)) return refuse('envelope refused: not an object');

  const canon = canonicalize(envelope);
  if (!canon.ok) return refuse('envelope refused: the envelope cannot be put in canonical form');
  const envelopeChecksum = checksumOf(canon.text);

  if (options.expectedChecksum !== undefined) {
    const v = verifyChecksum(canon.text, options.expectedChecksum);
    if (!v.ok) return refuse('envelope refused: the checksum does not match the expected value (IMP-014)', { envelopeChecksum });
  }

  const envMajor = isObj(envelope.envelope) ? major(envelope.envelope.version) : null;
  if (!majors.includes(envMajor)) {
    // Checked before the schema: a newer major may have a different shape and is never read best-effort.
    return refuse('envelope refused: major version not supported (IMP-114, IMP-115)', {
      envelopeChecksum,
      ...(envMajor === null ? {} : { header: { ...UNREADABLE, version: envelope.envelope.version } }),
    });
  }
  if (fails(vEnvelope, envelope)) {
    return refuse(hasExtraField(vEnvelope) ? 'envelope refused: unrecognised critical field (IMP-113)' : 'envelope refused: does not conform to the context envelope schema', { envelopeChecksum });
  }

  const header = {
    version: envelope.envelope.version,
    exportedAt: envelope.envelope.exportedAt,
    producer: { system: envelope.envelope.producer.system, version: envelope.envelope.producer.version },
  };

  // Applied references: held exactly, by id, type and version (IMP-107).
  const refs = [...envelope.applied.elements, ...envelope.applied.pathways];
  const heldFor = (r) => held.find((a) => isObj(a) && isObj(a.manifest) && a.manifest.id === r.id && a.manifest.type === r.type && a.manifest.version === r.version);
  const appliedVersions = refs.map((r) => ({ id: r.id, type: r.type, version: r.version, held: heldFor(r) !== undefined }));
  if (appliedVersions.some((a) => !a.held)) return refuse('envelope refused: an applied artefact version is not held (IMP-107)', { header, appliedVersions, envelopeChecksum });

  // Concept id -> field, from the applied elements.
  const fieldOf = new Map();
  for (const r of envelope.applied.elements) {
    const el = heldFor(r);
    if (!Array.isArray(el.fields)) return refuse('envelope refused: a held element has no readable fields', { header, appliedVersions, envelopeChecksum });
    for (const f of el.fields) {
      if (!isObj(f) || typeof f.key !== 'string') return refuse('envelope refused: a held element has no readable fields', { header, appliedVersions, envelopeChecksum });
      fieldOf.set(`${r.id}.${kebab(f.key)}`, f);
    }
  }

  // One record id may name one record (IMP-105 cannot hold otherwise). The reason names no id.
  const seen = new Set();
  for (const rec of [...envelope.observations, ...envelope.events]) {
    if (seen.has(rec.id)) return refuse('envelope refused: a record id is used more than once (IMP-105)', { header, appliedVersions, envelopeChecksum });
    seen.add(rec.id);
  }
  const obsIds = new Set(envelope.observations.map((o) => o.id));

  const records = refs.map((r) => ({ ref: r.id, recordKind: 'reference', category: 'accepted' }));
  const keepObs = [];
  const keepEvents = [];
  for (const o of envelope.observations) {
    const j = judgeObservation(o, fieldOf, obsIds);
    records.push(j);
    if (j.category === 'accepted') keepObs.push(o);
  }
  for (const e of envelope.events) {
    if (e.status === 'entered-in-error') {
      records.push({ ref: e.id, recordKind: 'event', category: 'rejected', reasons: [{ code: 'excluded-by-policy', category: 'entered-in-error' }] });
    } else {
      records.push({ ref: e.id, recordKind: 'event', category: 'accepted' });
      keepEvents.push(e);
    }
  }

  const context = {
    contextForm: CONTEXT_FORM,
    envelope: clone({ version: envelope.envelope.version, exportedAt: envelope.envelope.exportedAt, producer: envelope.envelope.producer }),
    case: clone(envelope.case),
    applied: clone(envelope.applied),
    inclusions: clone(envelope.inclusions),
    observations: clone([...keepObs].sort(byId)),
    events: clone([...keepEvents].sort(byId)),
  };
  const ctxCanon = canonicalize(context);
  if (!ctxCanon.ok) throw new Error('defect: the importer built a context that cannot be put in canonical form');

  const ignored = findExtensions(envelope, '', []).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return {
    ok: true,
    outcome: 'read',
    context,
    contextChecksum: checksumOf(ctxCanon.text),
    envelopeChecksum,
    report: buildReport({ header, appliedVersions, records, ignored }),
  };
}

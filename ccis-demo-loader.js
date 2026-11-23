// DEMO RUNNER: replaced by rows 2.x and 3.x.
// Prototype. Synthetic data only. Not for clinical use.
//
// Demo loader (row DS1). Pure: takes parsed JSON objects, never reads files, the clock or the network.
//
//   loadDemo({ element, binding, pathway, nodes, analytics }, envelope)
//     -> { ok, package, envelope, importReport }
//
// - Artefacts and the envelope are checked with the committed validators (no eval).
// - `importReport` always validates against import-report.schema.json (a defect throws).
// - On refusal `ok` is false, `package` and `envelope` are null, and the report has no records
//   (IMP-113, IMP-114). Broken input never reaches execution.
// - On success `envelope` is a copy holding only the ACCEPTED observations and events. Rejected
//   (entered-in-error) and unmapped records stay out of it (IMP-091, IMP-095, IMP-103). The caller keeps
//   the original envelope for the run-record snapshot (row DS3).
// - Reasons name a category, never the content (IMP-091). Nothing from the input is evaluated.
// - Strictness specific to the demo: every analytics package the pathway lists must be supplied.

import {
  element as vElement, terminologyBinding as vBinding, decisionNode as vNode, pathway as vPathway,
  analytics as vAnalytics, contextEnvelope as vEnvelope, importReport as vReport,
} from './ccis/validators/ccis-validators.js';

export const DEMO_STANDARD_VERSION = '0.1.0';
export const DEMO_IMPORTER_VERSION = '0.1.0';
const SUPPORTED_ENVELOPE_MAJORS = [0];
const SUPPORTED_STANDARD_MAJORS = [0];

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const major = (v) => (typeof v === 'string' && SEMVER.test(v) ? Number(v.split('.')[0]) : null);
const sameRef = (a, b) => a.id === b.id && a.type === b.type && a.version === b.version;
const fails = (v, d) => v(d) !== true;
const hasExtraField = (v) => (v.errors ?? []).some((e) => e.keyword === 'additionalProperties');

// ^x.y.z only. For 0.y.z the caret keeps the minor fixed (semver). Anything else is unsupported, not guessed.
function satisfies(range, version) {
  const r = typeof range === 'string' ? /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range) : null;
  const v = SEMVER.exec(version);
  if (!r || !v) return false;
  const [a, b, c] = [r[1], r[2], r[3]].map(Number);
  const [x, y, z] = [v[1], v[2], v[3]].map(Number);
  if (a > 0) return x === a && (y > b || (y === b && z >= c));
  return x === 0 && y === b && z >= c;
}

// Header of the report. Echoed only when the envelope passed its schema; otherwise fixed placeholders,
// so hostile text never travels into a refusal report.
const UNREADABLE = { version: '0.0.0', exportedAt: 'unreadable', producer: { system: 'unreadable', version: '0.0.0' } };

function report(parts) {
  const records = parts.records ?? [];
  const counts = { accepted: 0, rejected: 0, unmapped: 0, ambiguous: 0, total: records.length };
  for (const r of records) counts[r.category] += 1;
  const rep = {
    outcome: parts.refusalReason ? 'refused' : 'read',
    ...(parts.refusalReason ? { refusalReason: parts.refusalReason } : {}),
    envelope: parts.header ?? UNREADABLE,
    inclusions: { identity: false, narrative: false, enteredInError: false },
    importer: { version: DEMO_IMPORTER_VERSION },
    standard: { version: DEMO_STANDARD_VERSION },
    appliedVersions: parts.appliedVersions ?? [],
    records,
    counts,
    ignored: parts.ignored ?? [],
  };
  if (vReport(rep) !== true) throw new Error('defect: the loader built an import report that fails its schema');
  return rep;
}

const refuse = (refusalReason, extra = {}) => ({
  ok: false, package: null, envelope: null, importReport: report({ refusalReason, ...extra }),
});

function checkPackage(a) {
  if (!isObj(a)) return 'artefact refused: no artefacts supplied';
  if (!isObj(a.element) || !isObj(a.binding) || !isObj(a.pathway)) return 'artefact refused: element, binding or pathway missing';
  if (!Array.isArray(a.nodes) || a.nodes.length === 0) return 'artefact refused: decision nodes missing';
  if (!Array.isArray(a.analytics) || a.analytics.length === 0) return 'artefact refused: analytics packages missing';
  const checks = [
    [vElement, a.element, 'element'], [vBinding, a.binding, 'terminology binding'], [vPathway, a.pathway, 'pathway'],
    ...a.nodes.map((n) => [vNode, n, 'decision node']), ...a.analytics.map((x) => [vAnalytics, x, 'analytics package']),
  ];
  for (const [v, d, what] of checks) {
    if (!isObj(d) || fails(v, d)) {
      return hasExtraField(v) ? `artefact refused: unrecognised critical field in ${what} (IMP-113)` : `artefact refused: ${what} does not conform to its schema`;
    }
  }
  for (const m of [a.element.manifest, a.pathway.manifest, ...a.analytics.map((x) => x.manifest)]) {
    if (!SUPPORTED_STANDARD_MAJORS.includes(major(m.standard.version))) return 'artefact refused: standard major version not supported';
  }
  const ids = a.analytics.map((x) => x.manifest.id);
  if (new Set(ids).size !== ids.length) return 'artefact refused: the same analytics package supplied twice';
  const nodeIds = new Set(a.nodes.map((n) => n.id));
  for (const n of a.pathway.nodes) if (!nodeIds.has(n.id)) return 'artefact refused: a decision node the pathway uses is missing';
  for (const e of a.pathway.elements) {
    if (e.id !== a.element.manifest.id || !satisfies(e.range, a.element.manifest.version)) return 'artefact refused: the supplied element does not satisfy the pathway';
  }
  for (const { ref } of a.pathway.analytics ?? []) {
    const found = a.analytics.find((x) => x.manifest.id === ref.id);
    if (!found) return 'artefact refused: an analytics package the pathway lists is missing';
    if (!satisfies(ref.range, found.manifest.version)) return 'artefact refused: an analytics package does not satisfy the pathway range';
  }
  return null;
}

export function loadDemo(artefacts, envelope) {
  const pkgProblem = checkPackage(artefacts);
  if (pkgProblem) return refuse(pkgProblem);

  if (!isObj(envelope)) return refuse('envelope refused: not an object');
  const envMajor = isObj(envelope.envelope) ? major(envelope.envelope.version) : null;
  if (!SUPPORTED_ENVELOPE_MAJORS.includes(envMajor)) {
    // Checked before the schema: a newer major may have a different shape and is never read best-effort (IMP-114).
    return refuse('envelope refused: major version not supported (IMP-114, IMP-115)', envMajor === null ? {} : { header: { ...UNREADABLE, version: envelope.envelope.version } });
  }
  if (fails(vEnvelope, envelope)) {
    return refuse(hasExtraField(vEnvelope) ? 'envelope refused: unrecognised critical field (IMP-113)' : 'envelope refused: does not conform to the context envelope schema');
  }

  const header = { version: envelope.envelope.version, exportedAt: envelope.envelope.exportedAt, producer: { system: envelope.envelope.producer.system, version: envelope.envelope.producer.version } };
  const el = artefacts.element.manifest;
  const pw = artefacts.pathway.manifest;
  const held = [
    ...envelope.applied.elements.map((r) => ({ ref: r, ok: sameRef(r, { id: el.id, type: el.type, version: el.version }) })),
    ...envelope.applied.pathways.map((r) => ({ ref: r, ok: sameRef(r, { id: pw.id, type: pw.type, version: pw.version }) })),
  ];
  const appliedVersions = held.map(({ ref, ok }) => ({ id: ref.id, type: ref.type, version: ref.version, held: ok }));
  if (held.some((h) => !h.ok)) return refuse('envelope refused: an applied artefact version is not held (IMP-107)', { header, appliedVersions });
  if (!envelope.applied.pathways.some((r) => r.id === pw.id) || !envelope.applied.elements.some((r) => r.id === el.id)) {
    return refuse('envelope refused: the envelope does not apply the supplied element and pathway', { header, appliedVersions });
  }

  const concepts = new Set(artefacts.element.fields.map((f) => `${el.id}.${kebab(f.key)}`));
  const records = held.map(({ ref }) => ({ ref: ref.id, recordKind: 'reference', category: 'accepted' }));
  const keepObs = [];
  const keepEvents = [];
  for (const o of envelope.observations) {
    if (o.status === 'entered-in-error') {
      records.push({ ref: o.id, recordKind: 'observation', category: 'rejected', reasons: [{ code: 'excluded-by-policy', category: 'entered-in-error' }] });
    } else if (!concepts.has(o.concept.id)) {
      records.push({ ref: o.id, recordKind: 'observation', category: 'unmapped', reasons: [{ code: 'concept-not-in-applied-element' }] });
    } else {
      records.push({ ref: o.id, recordKind: 'observation', category: 'accepted' });
      keepObs.push(o);
    }
  }
  for (const e of envelope.events) {
    if (e.status === 'entered-in-error') {
      records.push({ ref: e.id, recordKind: 'event', category: 'rejected', reasons: [{ code: 'excluded-by-policy', category: 'entered-in-error' }] });
    } else {
      records.push({ ref: e.id, recordKind: 'event', category: 'accepted' });
      keepEvents.push(e);
    }
  }
  const ignored = Object.keys(envelope).filter((k) => k.startsWith('x-')).sort()
    .map((k) => ({ path: `/${k}`, reason: 'optional extension not used by the demo runner (IMP-112)' }));

  return {
    ok: true,
    package: {
      element: artefacts.element, binding: artefacts.binding, pathway: artefacts.pathway, nodes: artefacts.nodes,
      analytics: [...artefacts.analytics].sort((a, b) => (a.manifest.id < b.manifest.id ? -1 : 1)),
    },
    envelope: { ...envelope, observations: keepObs, events: keepEvents },
    importReport: report({ header, appliedVersions, records, ignored }),
  };
}

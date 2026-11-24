// Row 3.8b: pure view model for an import result. No DOM, no clock, no storage.
// It carries categories, fixed sentences, opaque record ids and counts. Never a value, unit or code text (IMP-091).
import { REJECTION_CODES } from './ccis-import.js';

const BLOCKED = ['rejected', 'withdrawn'];
const ID_CAP = 200;
const UNRECOGNISED = 'The reason is not recognised by this version of the page.';
const NOTE_CODES = ['recorded-time-unknown', 'time-zone-unknown'];

// Same rule as `heldAll` in ccis-cli-flow.js (D-142): every non-blocked entry, parsed. No market gives null.
export function heldFromMarket(market) {
  if (market === null || market === undefined) return null;
  return market.index.entries
    .filter((e) => !BLOCKED.includes(e.status))
    .map((e) => JSON.parse(market.files[e.path]));
}

const capIds = (ids) => ({ ids: ids.slice(0, ID_CAP), more: Math.max(0, ids.length - ID_CAP) });
const tally = (codes) => {
  const m = new Map();
  for (const c of codes) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
};

export function importReportView(result) {
  const report = result?.report;
  if (!result || result.ok !== true || !report || report.outcome !== 'read') {
    const sentence = report?.refusalReason ?? result?.refusalReason;
    return { outcome: 'refused', refusalSentence: typeof sentence === 'string' ? sentence : 'The envelope was refused.' };
  }
  const records = report.records;
  const of = (cat) => records.filter((r) => r.category === cat && r.recordKind !== 'reference');
  const codes = records.flatMap((r) => (r.reasons ?? []).map((x) => x.code));
  const notes = records.flatMap((r) => (r.notes ?? []).filter((n) => NOTE_CODES.includes(n)));
  return {
    outcome: 'read',
    header: {
      version: report.envelope.version,
      exportedAt: report.envelope.exportedAt,
      producer: { system: report.envelope.producer.system, version: report.envelope.producer.version },
    },
    counts: { ...report.counts },
    reasons: tally(codes).map(([code, count]) => ({
      code,
      sentence: Object.hasOwn(REJECTION_CODES, code) ? REJECTION_CODES[code] : UNRECOGNISED,
      count,
    })),
    refs: {
      rejected: capIds(of('rejected').map((r) => r.ref)),
      unmapped: capIds(of('unmapped').map((r) => r.ref)),
      ambiguous: capIds(of('ambiguous').map((r) => r.ref)),
    },
    notes: tally(notes).map(([code, count]) => ({ code, count })),
    applied: report.appliedVersions.map((a) => ({ id: a.id, type: a.type, version: a.version, held: a.held === true })),
    ignoredPaths: report.ignored.map((i) => i.path),
  };
}

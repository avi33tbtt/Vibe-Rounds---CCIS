// BROWSER APP, row 3.9b: pure run record export. Prototype. Synthetic data only. Not for clinical use.
//
// Turns a run record into the exact file text a person can save, a file name, a checksum of that text and a
// verification line. No DOM, clock, network or storage; nothing is downloaded here (row 3.9b.1). The text is the
// canonical record plus a newline: the bytes the CLI `run --out` writes, so `show` reads it. The verification line
// is computed on the exported text and claims only the id and the results checksum, because F-11 is open: a
// changed `context` byte still verifies (D-143, D-179).

import { canonicalize, checksumOf } from './ccis-compile.js';
import { verifyRecord } from './ccis-run.js';

const S_NONE = 'No run to export.';
const S_CANON = 'The record could not be put in canonical form.';
const S_OK = 'Verified: id and results checksum match.';
const S_SNAPSHOT = 'This file holds the input snapshot. Synthetic data only. Not for clinical use.';
const S_TEST_ONLY = 'Test-only parameters. Not clinical values.';
const FALLBACK_NAME = 'ccis-run-record.json';

export const EXPORT_SENTENCES = Object.freeze([S_NONE, S_CANON, S_OK, S_SNAPSHOT, S_TEST_ONLY]);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const notVerified = (problems) => `Not verified: ${problems.join(', ')}.`;

export function exportModel(record) {
  if (!isObj(record)) return { ok: false, sentence: S_NONE };
  let canon;
  try {
    canon = canonicalize(record);
  } catch {
    return { ok: false, sentence: S_CANON };
  }
  if (!canon || canon.ok !== true || typeof canon.text !== 'string') return { ok: false, sentence: S_CANON };
  const text = `${canon.text}\n`;

  let verification;
  try {
    const v = verifyRecord(JSON.parse(text));
    verification = v.ok === true ? { ok: true, line: S_OK } : { ok: false, line: notVerified(Array.isArray(v.problems) && v.problems.length ? v.problems : ['unreadable']) };
  } catch {
    verification = { ok: false, line: notVerified(['unreadable']) };
  }

  const notices = [S_SNAPSHOT];
  if (record['x-testOnly'] === true) notices.push(S_TEST_ONLY);
  return {
    ok: true,
    filename: typeof record.id === 'string' && /^run-[0-9a-f]{64}$/.test(record.id) ? `${record.id}.json` : FALLBACK_NAME,
    text,
    bytes: new TextEncoder().encode(text).length,
    checksum: checksumOf(text),
    verification,
    notices,
  };
}

// CCIS REMOTE MARKET LOADER (row 4.1): read a market from a web address, or refuse. Prototype. Synthetic data only. Not for clinical use.
//
// Pure library: no network of its own, no file access, no clock, no randomness, no eval, no dynamic import. The network is an
// injected function `fetchText(url)` that takes ONE string and nothing else (no body, no headers), so nothing this module
// holds can reach a request: patient data cannot be sent by construction. It imports only `loadMarket`.
//
//   loadRemoteMarket({ base, fetchText, limits }) -> Promise<{ ok: true, market, requests } | { ok: false, refusal }>
//
// Order: `base + 'index.json'`, then every listed path once, sorted, one at a time. All paths are checked before any file is
// requested. After the last file `loadMarket` checks every checksum; any problem refuses the whole market (all or nothing).
// A passing check proves the same bytes, not who published them (signing is row 6.2). Nothing is cached or stored.
import { loadMarket } from './ccis-market.js';

export const REMOTE_REFUSALS = [
  { id: 'R-001', sentence: 'The base address or the fetch function is not acceptable. The base must be an https address that ends in a slash, with no user, query or fragment.' },
  { id: 'R-002', sentence: 'A request failed or returned something other than text. Nothing was loaded.' },
  { id: 'R-003', sentence: 'The index is too large, is not JSON, or does not have the shape of a market index.' },
  { id: 'R-004', sentence: 'An index path is unsafe or there are too many entries. No file was requested.' },
  { id: 'R-005', sentence: 'A file is larger than the limit. Nothing was loaded.' },
  { id: 'R-006', sentence: 'The downloaded market did not verify, so nothing is used.' },
];
const SENTENCE = Object.fromEntries(REMOTE_REFUSALS.map((r) => [r.id, r.sentence]));
const refuse = (id, detail) => ({ ok: false, refusal: detail === undefined ? { id, reason: SENTENCE[id] } : { id, reason: SENTENCE[id], detail } });

export const DEFAULT_LIMITS = Object.freeze({ indexBytes: 256 * 1024, fileBytes: 512 * 1024, entries: 200 });
const SEGMENT = /^[A-Za-z0-9._-]+$/;
const bytesOf = (t) => new TextEncoder().encode(t).length;
// `limits` may only lower the defaults.
const lower = (given, key) => (Number.isInteger(given?.[key]) && given[key] > 0 ? Math.min(given[key], DEFAULT_LIMITS[key]) : DEFAULT_LIMITS[key]);

export function goodBase(base) {
  if (typeof base !== 'string' || !base.startsWith('https://') || !base.endsWith('/')) return false;
  let u;
  try { u = new URL(base); } catch { return false; }
  return u.protocol === 'https:' && u.username === '' && u.password === '' && u.search === '' && u.hash === '' && u.href === base;
}

// A relative path under `artefacts/`, plain segments only: no `..`, no backslash, no scheme, no empty segment, no escapes.
function goodPath(p) {
  if (typeof p !== 'string') return false;
  const parts = p.split('/');
  return parts.length >= 2 && parts[0] === 'artefacts' && parts.every((s) => SEGMENT.test(s) && s !== '.' && s !== '..');
}

export async function loadRemoteMarket({ base, fetchText, limits } = {}) {
  if (!goodBase(base) || typeof fetchText !== 'function') return refuse('R-001');
  const max = { indexBytes: lower(limits, 'indexBytes'), fileBytes: lower(limits, 'fileBytes'), entries: lower(limits, 'entries') };
  const requests = [];
  // One string in, one string out. Any failure is one fixed sentence: the URL and the error text are never quoted.
  const get = async (rel, cap, tooBig) => {
    const url = base + rel;
    requests.push(url);
    let text;
    try { text = await fetchText(url); } catch { return { refusal: refuse('R-002') }; }
    if (typeof text !== 'string') return { refusal: refuse('R-002') };
    if (bytesOf(text) > cap) return { refusal: refuse(tooBig) };
    return { text };
  };

  const idx = await get('index.json', max.indexBytes, 'R-003');
  if (idx.refusal) return idx.refusal;
  let parsed;
  try { parsed = JSON.parse(idx.text); } catch { return refuse('R-003'); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.entries)) return refuse('R-003');
  if (parsed.entries.length > max.entries) return refuse('R-004');
  const paths = parsed.entries.map((e) => e?.path);
  if (!paths.every(goodPath)) return refuse('R-004');

  const files = {};
  for (const path of [...new Set(paths)].sort()) {
    const got = await get(path, max.fileBytes, 'R-005');
    if (got.refusal) return got.refusal;
    files[path] = got.text;
  }
  const loaded = loadMarket({ indexText: idx.text, files });
  if (!loaded.ok) return refuse('R-006', { refusedBy: loaded.refusal.id });
  return { ok: true, market: loaded.market, requests };
}

// CCIS LOCAL TEST MARKETPLACE (row 3.6): publish, resolve, pin. Prototype. Synthetic data only. Not for clinical use.
//
// Pure library: no file access, no network, no clock, no randomness, no eval, no dynamic import. It imports only
// committed CCIS modules. A market is a plain value `{ index, files }`: `index` lists entries, `files` maps a relative
// path to the exact canonical text of one artefact. Every function returns a new value and never changes its input.
// Reading and writing the `market/` folder is done by `scripts/market-build.js` only.
//
//   publishArtefact({ market, artefact, fixtures }) -> { ok: true, market, entry, unchanged } | { ok: false, refusal }
//   lintArtefact(artefact)                          -> { ok, findings: [{ id, path }] }   (never holds a value)
//   resolve({ market, ref })                        -> { ok: true, entry, artefact, deprecated } | { ok: false, refusal }
//   heldFrom({ market, refs })                      -> { ok: true, held } | { ok: false, refusal }
//   pin({ market, ref })                            -> { ok: true, pin, deprecated } | { ok: false, refusal }
//   verifyPin({ market, pin })                      -> { ok: true, entry, artefact } | { ok: false, refusal }
//   loadMarket({ indexText, files })                -> { ok: true, market } | { ok: false, refusal }   (all or nothing)
//   indexText(market)                               -> the exact text of market/index.json
//
// WHAT A CHECKSUM AND THE LINT DO NOT PROVE. A checksum proves the same bytes, not who published them or that they
// are safe (CCIS-REQ-094, A-005; signing is row 6.2). The patient-data lint is a screen, not a proof: it can miss
// data and it can refuse a harmless string. Nothing here is "trusted" or "verified safe".

import { canonicalize, checksumOf, compileArtefact, CANONICAL_FORM } from './ccis-compile.js';
import { satisfiesReference, compareSemver, validateArtefact } from './ccis-validator.js';
import { buildValidationRecord } from './ccis-validation-record.js';
import { conceptOwners } from './ccis-concept-owners.js';

export const MARKET_FORMAT = 'ccis-market/1';
export const PUBLISHABLE_TYPES = ['contextual-element', 'analytics-package', 'pathway', 'rule-pack'];
const BLOCKED_STATUS = ['rejected', 'withdrawn'];

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const str = (x) => typeof x === 'string' && x !== '';
const pathOf = (id, version) => `artefacts/${id}/${version}.json`;
const compareEntries = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : (compareSemver(a.version, b.version) ?? 0));

// ---------------------------------------------------------------------------------------------
// Refusals: fixed sentences. A detail holds only rule ids, paths, layer names, codes and versions the market holds.
// It never holds a value from the artefact, so a refusal cannot leak what the lint found.
// ---------------------------------------------------------------------------------------------

export const M_REFUSALS = [
  { id: 'M-001', sentence: 'An input has the wrong shape (the market, the artefact, the reference, the pin or the index text is not what this call needs).' },
  { id: 'M-002', sentence: 'The artefact type cannot be published here. Only contextual elements, analytics packages, pathways and rule packs can.' },
  { id: 'M-003', sentence: 'The manifest status is rejected or withdrawn, so this version cannot be published. Publish a new version instead.' },
  { id: 'M-004', sentence: 'The patient-data screen refused the artefact. Reword the places named by path. The screen is not a proof either way.' },
  { id: 'M-005', sentence: 'The compiler refused the artefact, so nothing was added.' },
  { id: 'M-006', sentence: 'This id and version is already published with different bytes. Releases are immutable: publish a new version.' },
  { id: 'M-007', sentence: 'No published version satisfies the reference.' },
  { id: 'M-008', sentence: 'The pin has no checksum. A pin without one blocks use and is never defaulted to the latest version.' },
  { id: 'M-009', sentence: 'The pinned checksum does not match the checksum of the published bytes.' },
  { id: 'M-010', sentence: 'The index and the stored file disagree (missing file, changed bytes, wrong name or order, or a different manifest).' },
  { id: 'M-011', sentence: 'A stored file is not listed in the index, so the whole market is refused.' },
  { id: 'M-012', sentence: 'The market holds no such id, type and version.' },
  { id: 'M-013', sentence: 'The pinned version is rejected or withdrawn, so it blocks use.' },
  { id: 'M-014', sentence: 'A concept in this element already has an owner element in the market. Name the existing owner instead of owning the concept again.' },
];
const SENTENCE = Object.fromEntries(M_REFUSALS.map((r) => [r.id, r.sentence]));
const refuse = (id, detail) => ({ ok: false, refusal: detail === undefined ? { id, reason: SENTENCE[id] } : { id, reason: SENTENCE[id], detail } });

// ---------------------------------------------------------------------------------------------
// Patient-data lint (L-001 and up). A structural and narrow-pattern screen. It reads every member name and every
// string, including everything under `x-` members. A finding is `{ id, path }`: the rule and the place, never the value.
// ---------------------------------------------------------------------------------------------

export const LINT_RULES = [
  { id: 'L-001', meaning: 'A member is named like a patient record field (name, id, record number, birth date, address, phone, email, national id).' },
  { id: 'L-002', meaning: 'A member is named like a cohort or its membership.' },
  { id: 'L-003', meaning: 'An object has the shape of an import envelope (observations and events together, or a case with a ref).' },
  { id: 'L-004', meaning: 'A string looks like an email address.' },
  { id: 'L-005', meaning: 'A string looks like a telephone number.' },
  { id: 'L-006', meaning: 'A string holds a run of 8 or more digits.' },
  { id: 'L-007', meaning: 'A string holds a date-of-birth phrase.' },
  { id: 'L-008', meaning: 'A value is not plain JSON (or is nested too deeply or refers to itself), so it cannot be screened.' },
];

const RECORD_NAME = /^(patient(name|id|identifier|record|number|ref)?|mrn|medicalrecord(number)?|dateofbirth|dob|birthdate|birthday|(home|street|postal|mailing|email|ip)?address|phone(number)?|telephone|mobile(number)?|email|nhs(number)?|national(id|identifier)|ssn|socialsecurity(number)?|passport(number)?|surname|givenname|firstname|lastname|fullname)$/;
const COHORT_NAME = /^(cohort.*|members|membership|memberids?)$/;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /\+\d[\d\s().-]{7,}\d|\b\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/;
const DIGITS = /(?<![0-9A-Za-z])\d{8,}(?![0-9A-Za-z])/;
const BIRTH = /\b(date of birth|d\.o\.b\.?|dob|born on|birth ?date|birthday)\b/i;
const normName = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const textRules = (s) => [[EMAIL, 'L-004'], [PHONE, 'L-005'], [DIGITS, 'L-006'], [BIRTH, 'L-007']].filter(([re]) => re.test(s)).map(([, id]) => id);
// A member name is also screened as text, but without the date-of-birth phrase: a name like "dob" is L-001 already.
const nameRules = (s) => textRules(s).filter((id) => id !== 'L-007');
const MAX_LINT_DEPTH = 100;
const MAX_FINDINGS = 50;

export function lintArtefact(artefact) {
  const findings = [];
  const add = (id, path) => { if (findings.length < MAX_FINDINGS) findings.push({ id, path }); };
  // A member name that itself looks like data is shown as [name] in the path, so a path never echoes a value.
  const seg = (name) => (nameRules(name).length > 0 ? '[name]' : String(name).replace(/~/g, '~0').replace(/\//g, '~1'));
  const walk = (v, path, depth, stack) => {
    if (typeof v === 'string') { for (const id of textRules(v)) add(id, path); return; }
    if (v === null || typeof v === 'boolean') return;
    if (typeof v === 'number') { if (!Number.isFinite(v)) add('L-008', path); return; }
    const plain = Array.isArray(v) || isObj(v);
    if (!plain || depth > MAX_LINT_DEPTH || stack.has(v)) { add('L-008', path); return; }
    stack.add(v);
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${path}/${i}`, depth + 1, stack));
    } else {
      const names = Object.keys(v).sort();
      if (names.includes('observations') && names.includes('events')) add('L-003', path);
      if (isObj(v.case) && 'ref' in v.case) add('L-003', `${path}/case`);
      for (const name of names) {
        const here = `${path}/${seg(name)}`;
        const n = normName(name);
        if (RECORD_NAME.test(n)) add('L-001', here);
        if (COHORT_NAME.test(n)) add('L-002', here);
        for (const id of nameRules(name)) add(id, here);
        walk(v[name], here, depth + 1, stack);
      }
    }
    stack.delete(v);
  };
  walk(artefact, '', 0, new Set());
  return { ok: findings.length === 0, findings };
}

// ---------------------------------------------------------------------------------------------
// The market value
// ---------------------------------------------------------------------------------------------

export const emptyMarket = () => ({ index: { format: MARKET_FORMAT, entries: [] }, files: {} });

const isMarket = (m) => isObj(m) && isObj(m.index) && m.index.format === MARKET_FORMAT && Array.isArray(m.index.entries)
  && m.index.entries.every((e) => isObj(e) && str(e.id) && str(e.type) && str(e.version) && str(e.checksum) && str(e.path)) && isObj(m.files);

export function indexText(market) {
  const sorted = { format: MARKET_FORMAT, entries: market.index.entries.slice().sort(compareEntries) };
  return `${canonicalize(sorted).text}\n`;
}

const parsedFiles = (market) => market.index.entries.map((e) => JSON.parse(market.files[e.path]));

function layerOf(reason) {
  const m = /\(layer (\d), ([a-z-]+),/.exec(typeof reason === 'string' ? reason : '');
  return m ? { number: Number(m[1]), name: m[2] } : null;
}

// Concept keys an artefact provides (owns) and requires (uses without owning, or reads as a rule input). Codes only (ED-12, ED-52).
const sortedUnique = (xs) => [...new Set(xs)].sort();
export function conceptsOf(doc) {
  const type = isObj(doc) && isObj(doc.manifest) ? doc.manifest.type : undefined;
  if (type === 'contextual-element') {
    const rows = conceptOwners([doc]);
    return { provides: sortedUnique(rows.filter((c) => c.owners.length > 0).map((c) => c.concept)), requires: sortedUnique(rows.filter((c) => c.owners.length === 0 && c.users.length > 0).map((c) => c.concept)) };
  }
  if (type === 'rule-pack') return { provides: [], requires: sortedUnique((Array.isArray(doc.inputs) ? doc.inputs : []).map((i) => (isObj(i) ? i.concept : undefined)).filter(str)) };
  return { provides: [], requires: [] };
}

// ---------------------------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------------------------

export function publishArtefact({ market, artefact, fixtures } = {}) {
  if (!isMarket(market) || !isObj(artefact)) return refuse('M-001');
  if (fixtures !== undefined && !(Array.isArray(fixtures) && fixtures.every((f) => typeof f === 'string'))) return refuse('M-001');

  const lint = lintArtefact(artefact);
  if (!lint.ok) return refuse('M-004', { findings: lint.findings });

  const declared = isObj(artefact.manifest) ? artefact.manifest.type : undefined;
  if (typeof declared === 'string' && !PUBLISHABLE_TYPES.includes(declared)) return refuse('M-002');

  const known = parsedFiles(market);
  const compiled = compileArtefact(artefact, { known: [...known, artefact], fixtures });
  if (!compiled.ok) {
    const detail = { code: compiled.code, layer: layerOf(compiled.reason), diagnostics: (compiled.diagnostics ?? []).map((d) => ({ ruleId: d.ruleId, path: d.path })) };
    return refuse('M-005', detail);
  }
  const { subject, checksum, canonical, warnings } = compiled.compiled;
  if (!PUBLISHABLE_TYPES.includes(subject.type)) return refuse('M-002');
  if (BLOCKED_STATUS.includes(artefact.manifest.status)) return refuse('M-003');
  if (subject.type === 'contextual-element') {
    // ED-12: one owner element per concept. Ids and concept codes only; the highest version of an id wins (conceptOwners).
    const clash = conceptOwners([...known, artefact]).filter((c) => c.status === 'second-owner' && c.owners.some((o) => o.element === subject.id));
    if (clash.length > 0) {
      const elements = [...new Set(clash.flatMap((c) => c.owners.map((o) => o.element)))].sort();
      return refuse('M-014', { concepts: clash.map((c) => c.concept).sort(), elements });
    }
  }

  const held = market.index.entries.find((e) => e.id === subject.id && compareSemver(e.version, subject.version) === 0);
  if (held) {
    if (held.checksum === checksum && held.type === subject.type) return { ok: true, market, entry: held, unchanged: true };
    return refuse('M-006', { id: subject.id, version: held.version });
  }

  const result = validateArtefact(artefact, { known: [...known, artefact], fixtures });
  const made = buildValidationRecord(artefact, result);
  if (!made.ok) return refuse('M-005', { code: 'CCIS-C-007', layer: null, diagnostics: [] });
  const m = artefact.manifest;
  const entry = {
    id: subject.id,
    type: subject.type,
    version: subject.version,
    checksum,
    canonicalForm: CANONICAL_FORM,
    compiler: compiled.compiled.compiler,
    standard: made.record.standard.version,
    status: m.status,
    path: pathOf(subject.id, subject.version),
    warnings,
    ...conceptsOf(artefact),
    validation: {
      validator: made.record.validator,
      outcome: made.record.outcome,
      layers: Object.fromEntries(Object.entries(made.record.layers).map(([name, l]) => [name, l.outcome])),
    },
    references: (Array.isArray(m.references) ? m.references : []).map((r) => {
      const out = { id: r.id, type: r.type };
      if (typeof r.version === 'string') out.version = r.version;
      if (typeof r.range === 'string') out.range = r.range;
      return out;
    }),
  };
  const next = {
    index: { format: MARKET_FORMAT, entries: [...market.index.entries, entry].sort(compareEntries) },
    files: { ...market.files, [entry.path]: canonical },
  };
  return { ok: true, market: next, entry, unchanged: false };
}

// ---------------------------------------------------------------------------------------------
// Resolve, held, pin
// ---------------------------------------------------------------------------------------------

const refOk = (r) => isObj(r) && str(r.id) && str(r.type) && (str(r.version) !== str(r.range));

export function resolve({ market, ref } = {}) {
  if (!isMarket(market) || !refOk(ref)) return refuse('M-001');
  const same = market.index.entries.filter((e) => e.id === ref.id && e.type === ref.type);
  const usable = same.filter((e) => !BLOCKED_STATUS.includes(e.status) && satisfiesReference(ref, e.version));
  if (usable.length === 0) return refuse('M-007', { held: same.map((e) => e.version) });
  usable.sort((a, b) => compareSemver(b.version, a.version));
  const entry = usable[0];
  const text = market.files[entry.path];
  if (typeof text !== 'string') return refuse('M-010', { id: entry.id, version: entry.version });
  return { ok: true, entry, artefact: JSON.parse(text), deprecated: entry.status === 'deprecated' };
}

export function heldFrom({ market, refs } = {}) {
  if (!Array.isArray(refs)) return refuse('M-001');
  const held = [];
  const seen = new Set();
  for (const ref of refs) {
    const r = resolve({ market, ref });
    if (!r.ok) return r;
    const key = `${r.entry.id}|${r.entry.type}|${r.entry.version}`;
    if (!seen.has(key)) { seen.add(key); held.push(r.artefact); }
  }
  return { ok: true, held };
}

export function pin({ market, ref } = {}) {
  const r = resolve({ market, ref });
  if (!r.ok) return r;
  const { id, type, version, checksum } = r.entry;
  return { ok: true, pin: { id, type, version, checksum }, deprecated: r.deprecated };
}

export function verifyPin({ market, pin: p } = {}) {
  if (!isMarket(market) || !isObj(p) || !str(p.id) || !str(p.type) || !str(p.version)) return refuse('M-001');
  if (!str(p.checksum)) return refuse('M-008');
  const entry = market.index.entries.find((e) => e.id === p.id && e.type === p.type && e.version === p.version);
  if (!entry) return refuse('M-012');
  const text = market.files[entry.path];
  if (typeof text !== 'string' || checksumOf(text) !== entry.checksum) return refuse('M-010', { id: entry.id, version: entry.version });
  if (p.checksum !== entry.checksum) return refuse('M-009', { id: entry.id, version: entry.version });
  if (BLOCKED_STATUS.includes(entry.status)) return refuse('M-013', { id: entry.id, version: entry.version });
  return { ok: true, entry, artefact: JSON.parse(text) };
}

// ---------------------------------------------------------------------------------------------
// Load: every file is checked against its index entry; any problem refuses the whole market
// ---------------------------------------------------------------------------------------------

// Entries of the highest version of each id that declare the concept. Ids only; entries without the two members are not declared.
const byConcept = (side) => ({ market, concept } = {}) => {
  if (!isMarket(market)) return refuse('M-001');
  const best = new Map();
  for (const e of market.index.entries) { const c = best.get(e.id); if (!c || (compareSemver(e.version, c.version) ?? 0) > 0) best.set(e.id, e); }
  const entries = typeof concept !== 'string' ? [] : [...best.values()].filter((e) => Array.isArray(e[side]) && e[side].includes(concept)).map((e) => ({ id: e.id, type: e.type, version: e.version })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { ok: true, entries };
};
export const providersOf = byConcept('provides');
export const requirersOf = byConcept('requires');

const ENTRY_MEMBERS = ['id', 'type', 'version', 'checksum', 'canonicalForm', 'compiler', 'standard', 'status', 'path', 'warnings', 'validation', 'references'];

export function loadMarket({ indexText: text, files } = {}) {
  if (typeof text !== 'string' || !isObj(files) || !Object.values(files).every((f) => typeof f === 'string')) return refuse('M-001');
  const c = canonicalize(text);
  if (!c.ok) return refuse('M-001');
  const parsed = JSON.parse(c.text);
  if (!isObj(parsed) || parsed.format !== MARKET_FORMAT || !Array.isArray(parsed.entries) || Object.keys(parsed).length !== 2) return refuse('M-001');
  for (const e of parsed.entries) {
    if (!isObj(e) || !ENTRY_MEMBERS.every((k) => k in e)) return refuse('M-001');
    const extra = Object.keys(e).filter((k) => !ENTRY_MEMBERS.includes(k));
    const both = 'provides' in e && 'requires' in e;
    if (extra.length !== (both ? 2 : 0) || (both && !(extra.includes('provides') && extra.includes('requires')))) return refuse('M-001');
    if (both && ![e.provides, e.requires].every((l) => Array.isArray(l) && l.every(str))) return refuse('M-001');
    if (!str(e.id) || !str(e.type) || !str(e.version) || !str(e.checksum) || !str(e.path)) return refuse('M-001');
  }
  const listed = new Set();
  for (const e of parsed.entries) {
    if (e.path !== pathOf(e.id, e.version) || listed.has(e.path)) return refuse('M-010', { id: e.id, version: e.version });
    listed.add(e.path);
    const file = files[e.path];
    if (typeof file !== 'string' || checksumOf(file) !== e.checksum) return refuse('M-010', { id: e.id, version: e.version });
    const again = canonicalize(file);
    const doc = again.ok ? JSON.parse(file) : null;
    const m = isObj(doc) && isObj(doc.manifest) ? doc.manifest : null;
    const c = 'provides' in e && doc !== null ? conceptsOf(doc) : null;
    if (c !== null && (JSON.stringify(c.provides) !== JSON.stringify(e.provides) || JSON.stringify(c.requires) !== JSON.stringify(e.requires))) return refuse('M-010', { id: e.id, version: e.version });
    if (!again.ok || again.text !== file || m === null || m.id !== e.id || m.type !== e.type || m.version !== e.version) {
      return refuse('M-010', { id: e.id, version: e.version });
    }
  }
  if (Object.keys(files).some((k) => !listed.has(k))) return refuse('M-011');
  const market = { index: { format: MARKET_FORMAT, entries: parsed.entries }, files: { ...files } };
  // The index must already be in the canonical order, so one market has one index text.
  if (canonicalize(market.index).text !== canonicalize({ format: MARKET_FORMAT, entries: parsed.entries.slice().sort(compareEntries) }).text) return refuse('M-010');
  return { ok: true, market };
}

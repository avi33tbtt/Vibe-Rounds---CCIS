// CCIS CLI FLOW (row 3.7): import, compat, run (market mode) and show over a local market folder.
// Prototype. Synthetic data only. Not for clinical use.
//
//   node ccis-cli.js import --envelope <file> --market <dir> [--out <file>] [--json]
//   node ccis-cli.js compat --envelope <file> --market <dir> --pathway <id> [--range <range>] [--json]
//   node ccis-cli.js run    --market <dir> --pathway <id> --envelope <file> --out <file> --at <time> [--params <file>] [--run-needs-data] [--range <range>]
//   node ccis-cli.js show   <record> [--json]
//
// This file and `ccis-cli.js` are the only ones that read or write the disk. All logic is calls to the committed
// pure modules. No network, no clock (`--at` is required), no randomness, no eval.
//
// Exit codes: 0 done (for `run`, a record was written; a `failed` record counts; for `compat`, any outcome is a result);
// 1 refused (an M-, R- or import reason is printed and nothing is written; for `show`, the record fails verification);
// 2 usage error (bad arguments, an unreadable or non-JSON file, an output path that already holds different bytes).
//
// Output never holds an observation value. A refusal prints a rule id, a fixed sentence and ids or paths only.
// Enabled parameter values come only from `--params`; nothing is built in. Checksums for a run come from verified pins.
// `--run-needs-data` is the caller's opt-in from row 3.5 (F-10 stays open, D-112 stays open).

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { canonicalize } from './ccis-compile.js';
import { loadMarket, resolve, pin, verifyPin, M_REFUSALS } from './ccis-market.js';
import { importEnvelope } from './ccis-import.js';
import { resolveCompatibility, OUTCOMES } from './ccis-compat.js';
import { planRun, executeRun, verifyRecord } from './ccis-run.js';

// What this command line offers the engine: the same description the run tests use.
export const CLI_RUNTIME = Object.freeze({
  standardMajors: [0],
  engine: { version: '0.1.0' },
  operatorSet: { name: 'ccis-core-ops', majors: [0] },
  limits: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 },
  understoodExtensions: [],
});

const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const BLOCKED = ['rejected', 'withdrawn'];
const DEFAULT_RANGE = '>=0.0.0';

const USAGES = {
  import: 'usage: node ccis-cli.js import --envelope <file> --market <dir> [--out <file>] [--json]',
  compat: 'usage: node ccis-cli.js compat --envelope <file> --market <dir> --pathway <id> [--range <range>] [--json]',
  run: 'usage: node ccis-cli.js run --market <dir> --pathway <id> --envelope <file> --out <file> --at <ISO time with offset> [--params <file>] [--run-needs-data] [--range <range>]',
  show: 'usage: node ccis-cli.js show <record> [--json]',
};

class Usage extends Error {}
const usage = (m) => { throw new Usage(m); };

// ---- arguments -------------------------------------------------------------------------------------
const SPEC = {
  import: { values: ['--envelope', '--market', '--out'], flags: ['--json'], positional: 0, required: ['--envelope', '--market'] },
  compat: { values: ['--envelope', '--market', '--pathway', '--range'], flags: ['--json'], positional: 0, required: ['--envelope', '--market', '--pathway'] },
  run: { values: ['--market', '--pathway', '--envelope', '--out', '--at', '--params', '--range'], flags: ['--run-needs-data'], positional: 0, required: ['--market', '--pathway', '--envelope', '--out', '--at'] },
  show: { values: [], flags: ['--json'], positional: 1, required: [] },
};

function parse(cmd, args) {
  const spec = SPEC[cmd];
  const o = { positional: [], flags: new Set() };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (spec.flags.includes(a)) o.flags.add(a);
    else if (spec.values.includes(a)) {
      const v = args[i + 1];
      if (v === undefined || v.startsWith('--')) usage(`${a} needs a value`);
      if (Object.hasOwn(o, a)) usage(`${a} is given twice`);
      o[a] = v;
      i += 1;
    } else if (a.startsWith('--')) usage(`unknown argument ${a}`);
    else o.positional.push(a);
  }
  if (o.positional.length !== spec.positional) usage(spec.positional === 0 ? 'unexpected argument' : 'exactly one record file is required');
  for (const r of spec.required) if (o[r] === undefined) usage(`${r} is required`);
  if (cmd === 'run') {
    if (!AT.test(o['--at'])) usage('--at must be an ISO date-time with a Z or +hh:mm offset');
  }
  return o;
}

// ---- disk ------------------------------------------------------------------------------------------
function readJson(path, what) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { usage(`cannot read ${what}`); }
  try { return JSON.parse(text); } catch { usage(`${what} is not JSON`); }
}

function walk(dir, base = '') {
  const out = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { usage('cannot read the market folder'); }
  for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = base === '' ? e.name : `${base}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(`${dir}/${e.name}`, rel));
    else if (e.name !== '.gitattributes') out.push(rel);
  }
  return out;
}

// Reads the folder as plain text. Nothing in it is trusted until `loadMarket` accepts it.
function readMarketDir(dir) {
  if (!existsSync(`${dir}/index.json`)) usage('the market folder has no index.json');
  const files = {};
  for (const rel of walk(dir)) {
    if (rel === 'index.json') continue;
    try { files[rel] = readFileSync(`${dir}/${rel}`, 'utf8'); } catch { usage(`cannot read ${rel} in the market folder`); }
  }
  return { indexText: readFileSync(`${dir}/index.json`, 'utf8'), files };
}

// Run records and contexts are immutable: the same bytes again are fine; a different file is never written over.
function writeOnce(path, bytes, what) {
  if (existsSync(path)) {
    let have;
    try { have = readFileSync(path, 'utf8'); } catch { usage(`cannot read ${what}`); }
    if (have !== bytes) usage(`the ${what} already holds different bytes`);
    return;
  }
  try { writeFileSync(path, bytes); } catch { usage(`cannot write the ${what}`); }
}

// ---- output ----------------------------------------------------------------------------------------
const canon = (x) => { const c = canonicalize(x); if (!c.ok) throw new Error('defect: a value cannot be put in canonical form'); return c.text; };
// Scalars (a choice value, a number) are printed as JSON; objects and arrays in canonical form.
const compact = (v) => (v !== null && typeof v === 'object' ? canon(v) : JSON.stringify(v));

class Refused extends Error {
  constructor(id, text, detail) { super(id); this.refusal = { id, text, detail }; }
}
function printRefusal(io, r) {
  io.err(`refused ${r.id}: ${r.text}`);
  if (r.detail !== undefined && r.detail !== null) io.err(`  detail: ${compact(r.detail)}`);
}
const fromMarket = (r) => new Refused(r.refusal.id, r.refusal.reason, r.refusal.detail);
const fromRun = (r) => new Refused(r.refusal.id, r.refusal.meaning);

function loadChecked(dir) {
  const m = loadMarket(readMarketDir(dir));
  if (!m.ok) throw fromMarket(m);
  return m.market;
}

// Every non-blocked entry, as the artefacts the importer and the compatibility check may use.
const heldAll = (market) => market.index.entries
  .filter((e) => !BLOCKED.includes(e.status))
  .map((e) => JSON.parse(market.files[e.path]));

function importFrom(envelope, market) {
  return importEnvelope(envelope, { held: heldAll(market) });
}

function reportLines(report) {
  const lines = [`import ${report.outcome === 'read' ? 'accepted' : 'refused'}`];
  if (report.refusalReason) lines.push(`  reason: ${report.refusalReason}`);
  const c = report.counts;
  lines.push(`  records: ${c.total} (accepted ${c.accepted}, rejected ${c.rejected}, unmapped ${c.unmapped}, ambiguous ${c.ambiguous})`);
  const byCode = new Map();
  for (const r of report.records) {
    if (r.category === 'accepted') continue;
    for (const x of r.reasons ?? [{ code: 'none' }]) {
      const k = `${r.category}: ${x.code}`;
      byCode.set(k, [...(byCode.get(k) ?? []), r.ref]);
    }
  }
  for (const [k, refs] of [...byCode].sort(([a], [b]) => (a < b ? -1 : 1))) lines.push(`  ${k} (${refs.length}): ${refs.sort().join(', ')}`);
  if (report.ignored.length > 0) lines.push(`  ignored extensions: ${report.ignored.length}`);
  return lines;
}

// ---- import ----------------------------------------------------------------------------------------
function importCmd(o, io) {
  const market = loadChecked(o['--market']);
  const envelope = readJson(o['--envelope'], 'the envelope file');
  const imp = importFrom(envelope, market);
  if (o.flags.has('--json')) io.out(compact({ outcome: imp.report.outcome, refusalReason: imp.report.refusalReason ?? null, counts: imp.report.counts, records: imp.report.records, ignored: imp.report.ignored }));
  else for (const l of reportLines(imp.report)) io.out(l);
  if (!imp.ok) return 1;
  if (o['--out'] !== undefined) {
    writeOnce(o['--out'], `${canon(imp.context)}\n`, 'context file');
    io.out(`context written: ${o['--out']} (${imp.contextChecksum})`);
  }
  return 0;
}

// ---- compat ----------------------------------------------------------------------------------------
const reasonsOf = (entry) => [...new Set((entry.checks ?? []).flatMap((c) => (c.findings ?? []).map((f) => f.reason)))].sort();
const label = (o) => OUTCOMES[o] ?? o;

function resolvePathway(market, o) {
  const r = resolve({ market, ref: { id: o['--pathway'], type: 'pathway', range: o['--range'] ?? DEFAULT_RANGE } });
  if (!r.ok) throw fromMarket(r);
  return r;
}

function compatCmd(o, io) {
  const market = loadChecked(o['--market']);
  const envelope = readJson(o['--envelope'], 'the envelope file');
  const { artefact: pathway } = resolvePathway(market, o);
  const imp = importFrom(envelope, market);
  if (!imp.ok) throw new Refused('import', imp.report.refusalReason);
  const res = resolveCompatibility({ pathway, held: heldAll(market), context: imp.context, runtime: CLI_RUNTIME, request: { mode: 'preview' } });
  const entries = [res.pathway, ...res.packages].map((e) => ({ kind: e.ref.type, id: e.ref.id, version: e.ref.version, outcome: e.outcome, reasons: reasonsOf(e) }));
  const banners = [...new Set(res.pathway.policy.banners.map((b) => b.text))];
  if (o.flags.has('--json')) io.out(compact({ entries, banners }));
  else {
    for (const e of entries) {
      const first = e.reasons.slice(0, 3).join(', ');
      io.out(`${e.kind} ${e.id} ${e.version}: ${label(e.outcome)}${first ? ` (${first}${e.reasons.length > 3 ? `, +${e.reasons.length - 3} more` : ''})` : ''}`);
    }
    for (const b of banners) io.out(b);
  }
  return 0;
}

// ---- run (market mode) -----------------------------------------------------------------------------
// The pathway and every analytics package it lists are resolved, pinned and checked by `verifyPin`.
// The checksums handed to the planner are the pinned ones, never recalculated from a file read here.
function pinned(market, ref) {
  const r = resolve({ market, ref });
  if (!r.ok) throw fromMarket(r);
  const p = pin({ market, ref });
  if (!p.ok) throw fromMarket(p);
  const v = verifyPin({ market, pin: p.pin });
  if (!v.ok) throw fromMarket(v);
  return { artefact: v.artefact, checksum: p.pin.checksum };
}

function runCmd(o, io) {
  const market = loadChecked(o['--market']);
  const envelope = readJson(o['--envelope'], 'the envelope file');
  const supplied = o['--params'] === undefined ? {} : readJson(o['--params'], 'the parameters file');
  if (supplied === null || typeof supplied !== 'object' || Array.isArray(supplied)) usage('the parameters file must hold an object');
  const { artefact: pathway } = pinned(market, { id: o['--pathway'], type: 'pathway', range: o['--range'] ?? DEFAULT_RANGE });
  const analytics = (Array.isArray(pathway.analytics) ? pathway.analytics : []).map((a) => {
    const p = pinned(market, a.ref);
    return { analytic: p.artefact, checksum: p.checksum };
  });
  const held = heldAll(market);
  const importResult = importEnvelope(envelope, { held });
  const planned = planRun({ pathway, analytics, held, importResult, runtime: CLI_RUNTIME, request: { mode: 'preview', runNeedsData: o.flags.has('--run-needs-data') } });
  if (!planned.ok) throw fromRun(planned);
  const done = executeRun({ plan: planned.plan, supplied, evaluationTime: o['--at'] });
  if (!done.ok) throw fromRun(done);
  const rec = done.record;
  writeOnce(o['--out'], `${canon(rec)}\n`, 'output file');
  io.out(`record written: ${o['--out']} (${rec.status}, ${rec.id})`);
  for (const i of rec['x-plan'].items) {
    const why = i.reasons.length > 0 ? ` (${i.reasons.join(', ')})` : '';
    io.out(`  ${i.action}: ${i.kind} ${i.id} ${i.version}${i.outcome ? ` [${label(i.outcome)}]` : ''}${i.action === 'run' ? '' : why}`);
  }
  if (rec.status === 'failed') io.out(`  failed: ${rec.failure.rule}: ${rec.failure.message}`);
  return 0;
}

// ---- show ------------------------------------------------------------------------------------------
// Verifies first. Never prints the snapshot (the observations and events).
function summary(rec) {
  const route = rec.results.filter((r) => r['x-node']).map((r) => ({ node: r['x-node'], outcome: r['x-outcome'] }));
  const results = rec.results.map((r) => ({
    output: r.outputId,
    from: r['x-node'] ?? r['x-analytic'] ?? null,
    ...(r.state !== undefined ? { state: r.state } : {}),
    ...(r.value !== undefined ? { value: r.value } : {}),
    ...(r.dependsOnParameters !== undefined ? { dependsOnParameters: r.dependsOnParameters } : {}),
  }));
  return {
    id: rec.id,
    status: rec.status,
    ...(rec.status === 'failed' ? { failure: rec.failure } : {}),
    evaluationTime: rec.evaluationTime.value,
    pathway: { ...rec.package, checksum: rec['x-pathwayChecksum'] },
    analytics: rec['x-analytics'],
    route,
    results,
    parameters: rec.parameters.map((p) => ({ id: p.id, enabled: p.enabled, ...(p.enabled ? { value: p.units !== undefined ? { amount: p.value, unit: p.units } : p.value } : {}) })),
    items: rec['x-plan'].items,
    warnings: rec.warnings,
    testOnly: rec['x-testOnly'] === true,
    limitations: rec.limitations,
  };
}

function showCmd(o, io) {
  const rec = readJson(o.positional[0], 'the record file');
  const v = verifyRecord(rec);
  if (!v.ok) {
    io.err(`record FAILS verification (${v.problems.join(', ')}): it has been altered or is not a run record`);
    return 1;
  }
  const s = summary(rec);
  if (o.flags.has('--json')) { io.out(compact(s)); return 0; }
  io.out(`record ${s.id}`);
  io.out('verified: yes (id and results checksum match)');
  io.out(`status: ${s.status}${s.failure ? ` (${s.failure.rule}: ${s.failure.message})` : ''}`);
  io.out(`evaluation time: ${s.evaluationTime}`);
  io.out(`pathway: ${s.pathway.id} ${s.pathway.version} ${s.pathway.checksum}`);
  for (const a of s.analytics) io.out(`analytics: ${a.id} ${a.version} ${a.checksum}`);
  for (const r of s.route) io.out(`route: ${r.node} -> ${r.outcome}`);
  for (const r of s.results) io.out(`result: ${r.output} (${r.from}): ${r.state !== undefined ? r.state : compact(r.value)}${r.dependsOnParameters ? ` [needs ${r.dependsOnParameters.join(', ')}]` : ''}`);
  for (const p of s.parameters) io.out(`parameter: ${p.id}: ${p.enabled ? `enabled ${compact(p.value)}` : 'disabled'}`);
  for (const i of s.items) if (i.action !== 'run') io.out(`${i.action}: ${i.kind} ${i.id} ${i.version}${i.reasons.length ? ` (${i.reasons.join(', ')})` : ''}`);
  for (const w of s.warnings) io.out(`warning: ${w}`);
  if (s.testOnly) io.out('note: this record used test-only placeholder values, not clinical values');
  for (const l of s.limitations) io.out(`limitation: ${l}`);
  return 0;
}

// ---- entry -----------------------------------------------------------------------------------------
const COMMANDS = { import: importCmd, compat: compatCmd, run: runCmd, show: showCmd };
export const FLOW_COMMANDS = Object.freeze(Object.keys(COMMANDS));
export const KNOWN_REFUSALS = M_REFUSALS.map((r) => r.id);

// Returns the exit code. `io` lets tests capture output.
export function flowMain(argv, io) {
  const [cmd, ...rest] = argv;
  if (!Object.hasOwn(COMMANDS, cmd)) { io.err(`error: unknown command\n${Object.values(USAGES).join('\n')}`); return 2; }
  try {
    return COMMANDS[cmd](parse(cmd, rest), io);
  } catch (err) {
    if (err instanceof Usage) { io.err(`error: ${err.message}\n${USAGES[cmd]}`); return 2; }
    if (err instanceof Refused) { printRefusal(io, err.refusal); return 1; }
    throw err;
  }
}

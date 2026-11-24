// DEMO RUNNER (interface kept by rows 3.x): the only demo file that touches the file system.
// Prototype. Synthetic data only. Not for clinical use.
//
//   node ccis-cli.js run --envelope <file> --out <file> --at <ISO time with offset> [--demo-parameters]
//   node ccis-cli.js validate <file>... [--known <dir>] [--fixtures <dir>] [--record <dir>] [--json]      (rows 2.1 to 2.3a)
//   node ccis-cli.js compile <file> --out <dir> [--known <dir>] [--fixtures <dir>]                        (row 2.4)
//   node ccis-cli.js import | compat | show, and run with --market <dir>      (row 3.7, see ccis-cli-flow.js)
//
// Reads the envelope and the demo package (ccis/examples/snake), calls the pure demo modules and writes one
// run record. No network, no clock: the evaluation time is the `--at` value and is required.
//
// Exit codes of `run`: 0 a record was written (a `failed` record counts); 2 usage error (bad arguments, an unreadable
// or non-JSON file, a missing `--at`, an output path that cannot be written or already holds a different record).
// Exit codes of `validate`: 0 no error diagnostics, 1 at least one error diagnostic, 2 usage error or an unreadable file.
// Exit codes of `compile`: 0 compiled, 1 refused (nothing written), 2 usage error, an unreadable file, or a different file already there.
//
// Parameters stay disabled unless `--demo-parameters` is given. Then the test-only placeholders below are
// enabled, and the record says "demo placeholders, not clinical values". They are not clinical values.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadDemo } from './ccis-demo-loader.js';
import { evaluatePathway } from './ccis-demo-pathway.js';
import { evaluateAnalytic } from './ccis-demo-exec.js';
import { buildRunRecord, runIdInput, canonicalJson } from './ccis-demo-record.js';
import { validateArtefact, renderText } from './ccis-validator.js';
import { buildValidationRecord, recordText } from './ccis-validation-record.js';
import { compileArtefact } from './ccis-compile.js';
import { flowMain, FLOW_COMMANDS } from './ccis-cli-flow.js';

const NOTE = 'test-only placeholder, not a clinical value';
// Same values as the fixture normal-01 (a test keeps them equal). Whole minutes for easy arithmetic.
export const DEMO_PARAMETERS = {
  targetIntervalDuration: { value: { amount: 120, unit: 'min' }, testOnly: true, note: NOTE },
  acceptedCertainty: { value: 'accept', testOnly: true, note: NOTE },
  edgeRule: { value: 'inside', testOnly: true, note: NOTE },
  expectedItems: { value: ['clottingTestStatus', 'clottingTestStartTime', 'clottingResultReadTime', 'clottingResult'], testOnly: true, note: NOTE },
  readTimeWindow: { value: { amount: 30, unit: 'min' }, testOnly: true, note: NOTE },
};

const EXAMPLES = new URL('./ccis/examples/snake/', import.meta.url);
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const USAGE = 'usage: node ccis-cli.js run --envelope <file> --out <file> --at <ISO time with offset, e.g. 2026-11-20T12:00:00Z> [--demo-parameters]';

class Usage extends Error {}
const usage = (m) => { throw new Usage(m); };

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (cmd !== 'run') usage('the only commands are "run" and "validate"');
  const o = { demo: false };
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--demo-parameters') o.demo = true;
    else if (a === '--envelope' || a === '--out' || a === '--at') {
      const v = rest[i + 1];
      if (v === undefined || v.startsWith('--')) usage(`${a} needs a value`);
      o[a.slice(2)] = v;
      i += 1;
    } else usage(`unknown argument ${a}`);
  }
  if (!o.envelope) usage('--envelope is required');
  if (!o.out) usage('--out is required');
  if (!o.at) usage('--at is required (the demo never reads the clock)');
  if (!AT.test(o.at)) usage('--at must be an ISO date-time with a Z or +hh:mm offset');
  return o;
}

function readJson(path, what) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { usage(`cannot read ${what}`); }
  try { return JSON.parse(text); } catch { usage(`${what} is not JSON`); }
}

const loadArtefacts = () => {
  const f = (name) => JSON.parse(readFileSync(new URL(name, EXAMPLES), 'utf8'));
  return {
    element: f('snake-envenomation.element.json'),
    binding: f('snake-demo-terminology.binding.json'),
    pathway: f('snake-documentation.pathway.json'),
    nodes: [f('snake-node-clotting.node.json'), f('snake-node-antivenom.node.json')],
    analytics: [f('snake-interval.analytics.0.1.1.json'), f('snake-completeness.analytics.0.1.1.json')],
  };
};

const sha = (s) => `run-${createHash('sha256').update(s).digest('hex')}`;

export function runDemo({ envelope, parameters, evaluationTime, artefacts }) {
  const loaded = loadDemo(artefacts, envelope);
  if (!loaded.ok) {
    const base = { package: artefacts, envelope: null, parameters: 'none', evaluationTime };
    return buildRunRecord({ ...base, id: sha(runIdInput(base)), envelope, importReport: loaded.importReport });
  }
  const base = { package: loaded.package, envelope, parameters, evaluationTime };
  const id = sha(runIdInput(base));
  const fail = (rule, message) => buildRunRecord({ ...base, id, importReport: loaded.importReport, failure: { rule, message } });
  const route = evaluatePathway(loaded.package.pathway, loaded.envelope);
  if (!route.ok) return fail('dependency', route.refusal);
  const results = [...route.results];
  for (const a of loaded.package.analytics) {
    const r = evaluateAnalytic(a, loaded.envelope, parameters, evaluationTime);
    if (!r.ok) return fail('other', r.refusal);
    results.push(...r.results);
  }
  return buildRunRecord({ ...base, id, importReport: loaded.importReport, results });
}

// ---- validate (row 2.1) -------------------------------------------------------------------------
// Layers 1 to 3 over each file. The files given are known to each other; `--known <dir>` adds every
// `.json` file in that folder (not its subfolders). References resolve only against these artefacts.
function readKnown(knownDir) {
  const known = [];
  if (knownDir === null) return known;
  let names;
  try { names = readdirSync(knownDir).filter((n) => n.endsWith('.json')).sort(); } catch { usage('cannot read the known folder'); }
  for (const n of names) {
    let text;
    try { text = readFileSync(`${knownDir}/${n}`, 'utf8'); } catch { usage(`cannot read ${n} in the known folder`); }
    try { known.push(JSON.parse(text)); } catch { usage(`${n} in the known folder is not JSON`); }
  }
  return known;
}

function readFixtureNames(fixturesDir) {
  if (fixturesDir === null) return undefined;
  let index;
  try { index = JSON.parse(readFileSync(`${fixturesDir}/index.json`, 'utf8')); } catch { usage('cannot read index.json in the fixtures folder'); }
  if (!Array.isArray(index.cases) || !index.cases.every((c) => c && typeof c.case === 'string')) usage('index.json in the fixtures folder has no list of cases');
  return index.cases.map((c) => c.case);
}

const VALIDATE_USAGE = 'usage: node ccis-cli.js validate <file>... [--known <dir>] [--fixtures <dir>] [--record <dir>] [--json]';

function validateMain(args, io) {
  try {
    const files = [];
    let knownDir = null;
    let fixturesDir = null;
    let recordDir = null;
    let json = false;
    for (let i = 0; i < args.length; i += 1) {
      const a = args[i];
      if (a === '--json') json = true;
      else if (a === '--known') {
        const v = args[i + 1];
        if (v === undefined || v.startsWith('--')) usage('--known needs a value');
        knownDir = v;
        i += 1;
      } else if (a === '--record') {
        const v = args[i + 1];
        if (v === undefined || v.startsWith('--')) usage('--record needs a value');
        recordDir = v;
        i += 1;
      } else if (a === '--fixtures') {
        const v = args[i + 1];
        if (v === undefined || v.startsWith('--')) usage('--fixtures needs a value');
        fixturesDir = v;
        i += 1;
      } else if (a.startsWith('--')) usage(`unknown argument ${a}`);
      else files.push(a);
    }
    if (files.length === 0) usage('at least one file is required');

    const texts = files.map((f) => {
      try { return readFileSync(f, 'utf8'); } catch { return usage(`cannot read ${f}`); }
    });
    const known = readKnown(knownDir);
    // Fixture case names for layer 7: the `case` of every entry in <dir>/index.json. Names only.
    const fixtures = readFixtureNames(fixturesDir);
    for (const t of texts) {
      try { known.push(JSON.parse(t)); } catch { /* reported as a layer 1 diagnostic below */ }
    }

    const results = files.map((f, i) => ({ file: f, result: validateArtefact(texts[i], { known, fixtures }) }));
    if (json) io.out(JSON.stringify(results.map((r) => ({ file: r.file, ...r.result })), null, 2));
    else for (const r of results) io.out(renderText(r.result, r.file));
    // Validation records (row 2.3a). A file that cannot give a record says why on the error stream. A record is never
    // written over a different one (as for run records); every target is checked before any file is written.
    if (recordDir !== null) {
      const planned = [];
      results.forEach((r, i) => {
        let doc = null;
        try { doc = JSON.parse(texts[i]); } catch { /* a layer 1 failure: no record */ }
        const built = buildValidationRecord(doc, r.result);
        if (!built.ok) { io.err(`${r.file}: ${built.reason}`); return; }
        const base = r.file.split(/[\\/]/).pop().replace(/\.json$/, '');
        const target = `${recordDir}/${base}.validation-record.json`;
        const bytes = recordText(built.record);
        if (existsSync(target) && readFileSync(target, 'utf8') !== bytes) usage(`${target} already holds a different record`);
        planned.push([target, bytes]);
      });
      for (const [target, bytes] of planned) {
        try { writeFileSync(target, bytes); } catch { usage(`cannot write ${target}`); }
      }
    }
    return results.some((r) => r.result.outcome === 'failed') ? 1 : 0;
  } catch (err) {
    if (err instanceof Usage) { io.err(`error: ${err.message}\n${VALIDATE_USAGE}`); return 2; }
    throw err;
  }
}

// ---- compile (row 2.4) ---------------------------------------------------------------------------
// One artefact in; `<name>.canonical.json` (the exact checked bytes, no trailing newline, so `sha256sum` of the file
// equals the checksum) and `<name>.compiled.json` (the metadata) out. A refusal writes nothing.
const COMPILE_USAGE = 'usage: node ccis-cli.js compile <file> --out <dir> [--known <dir>] [--fixtures <dir>]';

function compileMain(args, io) {
  try {
    const files = [];
    let outDir = null;
    let knownDir = null;
    let fixturesDir = null;
    for (let i = 0; i < args.length; i += 1) {
      const a = args[i];
      if (a === '--out' || a === '--known' || a === '--fixtures') {
        const v = args[i + 1];
        if (v === undefined || v.startsWith('--')) usage(`${a} needs a value`);
        if (a === '--out') outDir = v; else if (a === '--known') knownDir = v; else fixturesDir = v;
        i += 1;
      } else if (a.startsWith('--')) usage(`unknown argument ${a}`);
      else files.push(a);
    }
    if (files.length !== 1) usage('exactly one file is required');
    if (outDir === null) usage('--out is required');
    const file = files[0];
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { usage(`cannot read ${file}`); }
    const known = readKnown(knownDir);
    const fixtures = readFixtureNames(fixturesDir);
    try { known.push(JSON.parse(text)); } catch { /* refused below with a reason */ }

    const built = compileArtefact(text, { known, fixtures });
    if (!built.ok) {
      io.err(`${file}: refused ${built.code}: ${built.reason}`);
      for (const d of built.diagnostics) io.err(`  ${d.severity} ${d.ruleId} at ${typeof d.path === 'string' ? (d.path || 'the top level') : `line ${d.path.line}, column ${d.path.column}`}: ${d.message}`);
      return 1;
    }
    const c = built.compiled;
    const { canonical, ...meta } = c;
    const base = file.split(/[\\/]/).pop().replace(/\.json$/, '');
    const targets = [[`${outDir}/${base}.canonical.json`, canonical], [`${outDir}/${base}.compiled.json`, `${canonicalJson(meta)}\n`]];
    for (const [target, bytes] of targets) {
      if (existsSync(target) && readFileSync(target, 'utf8') !== bytes) usage(`${target} already holds different bytes`);
    }
    for (const [target, bytes] of targets) {
      try { writeFileSync(target, bytes); } catch { usage(`cannot write ${target}`); }
    }
    io.out(`compiled: ${c.subject.id} ${c.subject.version} ${c.checksum}${c.warnings.length ? ` (${c.warnings.length} warning${c.warnings.length === 1 ? '' : 's'})` : ''}`);
    return 0;
  } catch (err) {
    if (err instanceof Usage) { io.err(`error: ${err.message}\n${COMPILE_USAGE}`); return 2; }
    throw err;
  }
}

// Returns the exit code. `io` lets tests capture output.
export function main(argv, io = { out: (s) => process.stdout.write(`${s}\n`), err: (s) => process.stderr.write(`${s}\n`) }) {
  if (argv[0] === 'validate') return validateMain(argv.slice(1), io);
  if (argv[0] === 'compile') return compileMain(argv.slice(1), io);
  if (FLOW_COMMANDS.includes(argv[0]) && (argv[0] !== 'run' || argv.includes('--market'))) return flowMain(argv, io);
  try {
    const o = parseArgs(argv);
    const envelope = readJson(o.envelope, 'the envelope file');
    const record = runDemo({ envelope, parameters: o.demo ? DEMO_PARAMETERS : 'none', evaluationTime: o.at, artefacts: loadArtefacts() });
    const bytes = `${canonicalJson(record)}\n`;
    // Run records are immutable: the same bytes again are fine, a different record is not written over one.
    if (existsSync(o.out) && readFileSync(o.out, 'utf8') !== bytes) usage('the output file already holds a different record');
    try { writeFileSync(o.out, bytes); } catch { usage('cannot write the output file'); }
    io.out(`record written: ${o.out} (${record.status}, ${record.id})`);
    return 0;
  } catch (err) {
    if (err instanceof Usage) { io.err(`error: ${err.message}\n${USAGE}`); return 2; }
    throw err;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}

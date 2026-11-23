// DEMO RUNNER (interface kept by rows 3.x): the only demo file that touches the file system.
// Prototype. Synthetic data only. Not for clinical use.
//
//   node ccis-cli.js run --envelope <file> --out <file> --at <ISO time with offset> [--demo-parameters]
//
// Reads the envelope and the demo package (ccis/examples/snake), calls the pure demo modules and writes one
// run record. No network, no clock: the evaluation time is the `--at` value and is required.
//
// Exit codes: 0 a record was written (a `failed` record counts); 2 usage error (bad arguments, an unreadable
// or non-JSON file, a missing `--at`, an output path that cannot be written or already holds a different record).
//
// Parameters stay disabled unless `--demo-parameters` is given. Then the test-only placeholders below are
// enabled, and the record says "demo placeholders, not clinical values". They are not clinical values.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadDemo } from './ccis-demo-loader.js';
import { evaluatePathway } from './ccis-demo-pathway.js';
import { evaluateAnalytic } from './ccis-demo-exec.js';
import { buildRunRecord, runIdInput, canonicalJson } from './ccis-demo-record.js';

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
  if (cmd !== 'run') usage('the only command is "run"');
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

// Returns the exit code. `io` lets tests capture output.
export function main(argv, io = { out: (s) => process.stdout.write(`${s}\n`), err: (s) => process.stderr.write(`${s}\n`) }) {
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

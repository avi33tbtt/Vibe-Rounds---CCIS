// Row 3.7: the command line over the market (ccis-cli-flow.js). Synthetic data only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, cpSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importEnvelope } from '../ccis-import.js';
import { canonicalize, checksumOf } from '../ccis-compile.js';
import { planRun, executeRun } from '../ccis-run.js';
import { walkPathway } from '../ccis-walk.js';
import { flowMain, CLI_RUNTIME } from '../ccis-cli-flow.js';
import { main, runDemo, DEMO_PARAMETERS } from '../ccis-cli.js';
import { canonicalJson } from '../ccis-demo-record.js';

const root = new URL('../', import.meta.url);
const ex = new URL('ccis/examples/snake/', root);
const fx = new URL('ccis/fixtures/snake/', root);
const MARKET = new URL('market', root).pathname;
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const exa = (f) => read(new URL(f, ex));
const clone = (x) => JSON.parse(JSON.stringify(x));

const tmp = mkdtempSync(join(tmpdir(), 'ccis-flow-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const fresh = (name) => join(tmp, `${(n += 1)}-${name}`);
const put = (name, value) => { const p = fresh(name); writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value)); return p; };

// Runs the real entry point and captures what it prints.
function cli(args) {
  const out = [];
  const err = [];
  const code = main(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n'), all: [...out, ...err].join('\n') };
}

const index = read(new URL('index.json', fx));
const caseFile = (c, kind) => read(new URL(`${c.class}/${c.case}.${kind}.json`, fx));
const allCases = () => [
  ...index.cases.map((c) => ({ name: c.case, envPath: new URL(`${c.class}/${c.case}.envelope.json`, fx).pathname, env: caseFile(c, 'envelope'), want: caseFile(c, 'expected') })),
  { name: 'emr-export', envPath: new URL('emr-export/emr-demo-case.envelope.json', fx).pathname, env: read(new URL('emr-export/emr-demo-case.envelope.json', fx)), want: read(new URL('emr-export/emr-demo-case.expected.json', fx)) },
];
const NORMAL = () => allCases().find((c) => c.name === 'normal-01-all-enabled');
const PARAMS = { targetIntervalDuration: { value: { amount: 120, unit: 'min' } }, acceptedCertainty: { value: 'accept' }, edgeRule: { value: 'inside' }, expectedItems: { value: ['clottingTestStatus', 'clottingTestStartTime', 'clottingResultReadTime', 'clottingResult'] }, readTimeWindow: { value: { amount: 30, unit: 'min' } } };
const T = '2026-11-20T12:00:00Z';
const PATHWAY = 'snake.documentation-path';
const runArgs = (envPath, out, extra = []) => ['run', '--market', MARKET, '--pathway', PATHWAY, '--envelope', envPath, '--out', out, '--at', T, ...extra];

// What the CLI should write, built directly from the pure modules (market mode uses the highest version in range).
function direct(c, supplied) {
  const el = exa('snake-envenomation.element.json');
  const pa = exa('snake-documentation.pathway.json');
  const an = ['snake-interval.analytics.0.1.1.json', 'snake-completeness.analytics.0.1.1.json'].map(exa);
  const held = [el, pa, ...an];
  const importResult = importEnvelope(c.env, { held });
  const analytics = an.map((a) => ({ analytic: a, checksum: checksumOf(canonicalize(a).text) }));
  const planned = planRun({ pathway: pa, analytics, held, importResult, runtime: CLI_RUNTIME, request: { mode: 'preview', runNeedsData: false } });
  assert.equal(planned.ok, true, c.name);
  const done = executeRun({ plan: planned.plan, supplied, evaluationTime: T });
  assert.equal(done.ok, true, c.name);
  return { record: done.record, pathway: pa, context: importResult.context };
}

// =============================================================================================
// (a) The oracle: 32 cases plus the EMR export
// =============================================================================================

test('(a) oracle: market mode over all 33 envelopes gives the record the pure modules give, with the expected route', () => {
  const cases = allCases();
  assert.equal(cases.length, 33);
  for (const c of cases) {
    const supplied = c.want.parameters === 'none' ? {} : c.want.parameters;
    const paramArgs = c.want.parameters === 'none' ? [] : ['--params', put('p.json', supplied)];
    const out = fresh('rec.json');
    const r = cli(runArgs(c.envPath, out, paramArgs));
    assert.equal(r.code, 0, `${c.name}: ${r.all}`);
    const want = direct(c, supplied);
    assert.equal(readFileSync(out, 'utf8'), `${canonicalize(want.record).text}\n`, c.name);
    // the same route as the walker gives, through `show`
    const shown = cli(['show', out, '--json']);
    assert.equal(shown.code, 0, c.name);
    const route = JSON.parse(shown.out).route.map((x) => x.node);
    const nodesOf = (steps) => steps.filter((x) => x.node !== undefined).map((x) => x.node);
    assert.deepEqual(route, nodesOf(walkPathway({ pathway: want.pathway, context: want.context }).route), c.name);
    assert.deepEqual(route, nodesOf(c.want.pathwayRoute), c.name);
  }
});

// =============================================================================================
// (b) The demo is untouched
// =============================================================================================

test('(b) run without --market is the demo: same record as runDemo, with and without demo placeholders', () => {
  const c = NORMAL();
  const artefacts = {
    element: exa('snake-envenomation.element.json'),
    binding: exa('snake-demo-terminology.binding.json'),
    pathway: exa('snake-documentation.pathway.json'),
    nodes: [exa('snake-node-clotting.node.json'), exa('snake-node-antivenom.node.json')],
    analytics: [exa('snake-interval.analytics.0.1.1.json'), exa('snake-completeness.analytics.0.1.1.json')],
  };
  for (const demo of [false, true]) {
    const out = fresh('demo.json');
    const r = cli(['run', '--envelope', c.envPath, '--out', out, '--at', T, ...(demo ? ['--demo-parameters'] : [])]);
    assert.equal(r.code, 0, r.all);
    assert.match(r.out, /^record written: /);
    const want = runDemo({ envelope: c.env, parameters: demo ? DEMO_PARAMETERS : 'none', evaluationTime: T, artefacts });
    assert.equal(readFileSync(out, 'utf8'), `${canonicalJson(want)}\n`);
  }
  // the demo still insists on its own flags
  assert.equal(cli(['run', '--envelope', c.envPath, '--at', T]).code, 2);
});

// =============================================================================================
// (c) The commands
// =============================================================================================

test('(c) import: a clean envelope, one with an entered-in-error record, and a refused one', () => {
  const c = NORMAL();
  const clean = cli(['import', '--envelope', c.envPath, '--market', MARKET]);
  assert.equal(clean.code, 0);
  assert.match(clean.out, /import accepted/);
  assert.match(clean.out, /accepted 11, rejected 0, unmapped 0, ambiguous 0/);

  const bad = clone(c.env);
  bad.observations[0].status = 'entered-in-error';
  const rej = cli(['import', '--envelope', put('bad.json', bad), '--market', MARKET, '--json']);
  assert.equal(rej.code, 0);
  const report = JSON.parse(rej.out);
  assert.equal(report.counts.rejected, 1);
  assert.deepEqual(report.records.find((r) => r.category === 'rejected').reasons[0].code, 'excluded-by-policy');

  const refused = cli(['import', '--envelope', put('refused.json', { envelope: { version: '9.0.0' } }), '--market', MARKET]);
  assert.equal(refused.code, 1);
  assert.match(refused.out, /import refused/);
  assert.match(refused.out, /major version not supported/);
});

test('(c) import --out writes the context only to the named path, and never prints observation values', () => {
  const c = NORMAL();
  const out = fresh('context.json');
  const r = cli(['import', '--envelope', c.envPath, '--market', MARKET, '--out', out]);
  assert.equal(r.code, 0);
  const ctx = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(ctx.observations.length, 9);
  assert.equal(cli(['import', '--envelope', c.envPath, '--market', MARKET, '--out', out]).code, 0, 'the same bytes again are fine');
  writeFileSync(out, 'something else');
  const again = cli(['import', '--envelope', c.envPath, '--market', MARKET, '--out', out]);
  assert.equal(again.code, 2);
  assert.equal(readFileSync(out, 'utf8'), 'something else');
});

test('(c) compat lists the outcome kinds the cases reach, one line per package, with the preview banner', () => {
  const seen = new Set();
  for (const c of allCases()) {
    const r = cli(['compat', '--envelope', c.envPath, '--market', MARKET, '--pathway', PATHWAY]);
    assert.equal(r.code, 0, c.name);
    assert.equal(r.out.split('\n').length, 4, 'three packages and the banner');
    assert.match(r.out, /Preview\. Prototype, synthetic data only/);
    for (const m of r.out.matchAll(/: (Compatible with limitations|Needs data|Incompatible|Compatible)\b/g)) seen.add(m[1]);
  }
  // D-112: no package with parameters can reach plain Compatible, so the reachable kinds are these.
  assert.deepEqual([...seen].sort(), ['Compatible with limitations', 'Needs data']);
  const json = JSON.parse(cli(['compat', '--envelope', NORMAL().envPath, '--market', MARKET, '--pathway', PATHWAY, '--json']).out);
  assert.equal(json.entries.length, 3);
  assert.equal(json.entries[0].kind, 'pathway');
  // a refused import is an exit 1, not a result
  assert.equal(cli(['compat', '--envelope', put('x.json', {}), '--market', MARKET, '--pathway', PATHWAY]).code, 1);
});

test('(c) show round-trips a record and flags one altered byte; it never prints the snapshot', () => {
  const c = NORMAL();
  const out = fresh('rec.json');
  assert.equal(cli(runArgs(c.envPath, out, ['--params', put('p.json', PARAMS)])).code, 0);
  const r = cli(['show', out]);
  assert.equal(r.code, 0);
  assert.match(r.out, /verified: yes/);
  assert.match(r.out, /route: clotting-test-documented -> result-documented/);
  assert.match(r.out, /limitation: Prototype\. Synthetic data only\. Not for clinical use\./);
  // the snapshot holds the observations: none of their ids or times appears in the output
  const rec = JSON.parse(readFileSync(out, 'utf8'));
  for (const o of rec.snapshot.observations) assert.equal(r.all.includes(`"${o.id}"`), false);
  assert.equal(r.all.includes('2026-11-20T08:00:00Z'), false, 'no observation time');
  assert.equal(r.all.includes('synthetic-source'), false, 'no snapshot member');
  // one altered byte in the results
  const altered = clone(rec);
  altered.results[2].value.amount += 1;
  const bad = cli(['show', put('alt.json', canonicalize(altered).text)]);
  assert.equal(bad.code, 1);
  assert.match(bad.err, /FAILS verification/);
  assert.equal(cli(['show', put('junk.json', 'not json')]).code, 2);
  assert.equal(cli(['show']).code, 2);
});

test('(c) run prints what ran and what was skipped, and --run-needs-data is the only way to run Needs data items', () => {
  const missing = allCases().find((c) => c.want.parameters !== 'none' && cli(['compat', '--envelope', c.envPath, '--market', MARKET, '--pathway', PATHWAY]).out.includes('Needs data'));
  assert.ok(missing, 'a case with a Needs data package exists');
  const a = cli(runArgs(missing.envPath, fresh('a.json'), ['--params', put('p.json', missing.want.parameters)]));
  assert.equal(a.code, 0, a.all);
  assert.match(a.out, /skip: analytic .*\[Needs data\] \(CMP-/);
  assert.match(a.out, /run: pathway/);
  const b = cli(runArgs(missing.envPath, fresh('b.json'), ['--params', put('p.json', missing.want.parameters), '--run-needs-data']));
  assert.equal(b.code, 0, b.all);
  assert.equal(/skip: /.test(b.out), false, 'nothing skipped with the opt-in');
  assert.notEqual(a.out.split('\n')[0].split('(').pop(), b.out.split('\n')[0].split('(').pop(), 'a different record id');
});

// =============================================================================================
// (d) Refusals: an exit code and no file
// =============================================================================================

function marketCopy() {
  const dir = fresh('market');
  cpSync(MARKET, dir, { recursive: true });
  return dir;
}

test('(d) an altered market is refused with M-010 and nothing is written', () => {
  const dir = marketCopy();
  const file = `${dir}/artefacts/${PATHWAY}/0.1.0.json`;
  writeFileSync(file, readFileSync(file, 'utf8').replace('snake', 'snakx'));
  const out = fresh('rec.json');
  const r = cli(runArgs(NORMAL().envPath, out).map((a) => (a === MARKET ? dir : a)));
  assert.equal(r.code, 1);
  assert.match(r.err, /refused M-010/);
  assert.equal(existsSync(out), false);
  for (const cmd of [['import'], ['compat', '--pathway', PATHWAY]]) {
    assert.equal(cli([...cmd, '--envelope', NORMAL().envPath, '--market', dir]).code, 1);
  }
});

test('(d) an unreadable market, an unknown pathway, a bad time and a missing flag each give their exit code', () => {
  const c = NORMAL();
  const out = fresh('rec.json');
  assert.equal(cli(runArgs(c.envPath, out).map((a) => (a === MARKET ? fresh('no-such-folder') : a))).code, 2);
  const unknown = cli(runArgs(c.envPath, out).map((a) => (a === PATHWAY ? 'snake.no-such-path' : a)));
  assert.equal(unknown.code, 1);
  assert.match(unknown.err, /refused M-007/);
  const badTime = cli(runArgs(c.envPath, out).map((a) => (a === T ? 'tomorrow' : a)));
  assert.equal(badTime.code, 2);
  assert.match(badTime.err, /--at must be/);
  assert.equal(cli(['run', '--market', MARKET, '--pathway', PATHWAY, '--envelope', c.envPath, '--out', out]).code, 2, '--at is required');
  assert.equal(cli(['run', '--market', MARKET, '--envelope', c.envPath, '--out', out, '--at', T]).code, 2, '--pathway is required');
  assert.equal(cli(['import', '--market', MARKET]).code, 2);
  assert.equal(cli(['compat', '--envelope', c.envPath, '--market', MARKET]).code, 2);
  assert.equal(cli(['import', '--envelope', c.envPath, '--market', MARKET, '--bogus']).code, 2);
  assert.equal(existsSync(out), false);
  assert.equal(flowMain(['nope'], { out() {}, err() {} }), 2);
});

test('(d) a different record is never written over an existing file; the same bytes again are fine', () => {
  const c = NORMAL();
  const out = fresh('rec.json');
  assert.equal(cli(runArgs(c.envPath, out)).code, 0);
  const first = readFileSync(out, 'utf8');
  assert.equal(cli(runArgs(c.envPath, out)).code, 0, 'same inputs, same bytes');
  assert.equal(cli(runArgs(c.envPath, out, ['--params', put('p.json', PARAMS)])).code, 2, 'different inputs, a different record');
  assert.equal(readFileSync(out, 'utf8'), first);
});

test('(d) parameters naming an undeclared id are refused R-005 with no file; a bad parameters file is a usage error', () => {
  const c = NORMAL();
  const out = fresh('rec.json');
  const r = cli(runArgs(c.envPath, out, ['--params', put('p.json', { ...PARAMS, notDeclared: { value: 1 } })]));
  assert.equal(r.code, 1);
  assert.match(r.err, /refused R-005/);
  assert.equal(existsSync(out), false);
  assert.equal(cli(runArgs(c.envPath, out, ['--params', put('p.json', [1, 2])])).code, 2);
  assert.equal(cli(runArgs(c.envPath, out, ['--params', put('p.json', 'nope')])).code, 2);
  assert.equal(cli(runArgs(c.envPath, out, ['--params', fresh('missing.json')])).code, 2);
  assert.equal(existsSync(out), false);
});

test('(d) a refused envelope gives a failed record (exit 0) with no values in any output', () => {
  const SENTINEL = 'SENTINEL-VALUE-QQ-7731';
  const c = NORMAL();
  const hostile = clone(c.env);
  hostile.unrecognisedCriticalField = SENTINEL;
  const out = fresh('rec.json');
  const r = cli(runArgs(put('h.json', hostile), out));
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /\(failed, run-/);
  const shown = cli(['show', out]);
  assert.equal(shown.code, 0);
  assert.match(shown.out, /status: failed/);
  for (const text of [r.all, shown.all, readFileSync(out, 'utf8'), cli(['import', '--envelope', put('h.json', hostile), '--market', MARKET]).all, cli(['compat', '--envelope', put('h.json', hostile), '--market', MARKET, '--pathway', PATHWAY]).all]) {
    assert.equal(text.includes(SENTINEL), false);
  }
});

test('(d) no command prints an observation value (sentinel in a code value)', () => {
  const SENTINEL = 'SENTINEL-CODE-QQ-4410';
  const c = NORMAL();
  const env = clone(c.env);
  env.observations.find((o) => o.kind === 'code').value.code = SENTINEL;
  const envPath = put('s.json', env);
  const out = fresh('rec.json');
  const outputs = [
    cli(['import', '--envelope', envPath, '--market', MARKET]).all,
    cli(['compat', '--envelope', envPath, '--market', MARKET, '--pathway', PATHWAY]).all,
    cli(runArgs(envPath, out)).all,
  ];
  assert.ok(existsSync(out), 'the run still wrote a record');
  outputs.push(cli(['show', out]).all, cli(['show', out, '--json']).all);
  for (const text of outputs) assert.equal(text.includes(SENTINEL), false);
});

// =============================================================================================
// (e) Parameters
// =============================================================================================

test('(e) without --params every parameter is disabled and no placeholder appears; with the values the 3.5 oracle results come out', () => {
  const c = NORMAL();
  const none = fresh('none.json');
  assert.equal(cli(runArgs(c.envPath, none)).code, 0);
  const rec = JSON.parse(readFileSync(none, 'utf8'));
  assert.ok(rec.parameters.length > 0);
  assert.equal(rec.parameters.every((p) => p.enabled === false), true);
  assert.equal(rec['x-testOnly'], undefined);
  assert.equal(rec.results.some((r) => r.state === 'parameter-not-enabled'), true);
  const shownNone = cli(['show', none]);
  assert.equal(/^parameter: \S+: enabled/m.test(shownNone.out), false);
  assert.equal(/note: this record used test-only/.test(shownNone.out), false);
  assert.equal(shownNone.out.split('\n').filter((l) => l.startsWith('parameter:')).every((l) => l.endsWith('disabled')), true);

  const withParams = fresh('with.json');
  assert.equal(cli(runArgs(c.envPath, withParams, ['--params', put('p.json', PARAMS)])).code, 0);
  const got = JSON.parse(readFileSync(withParams, 'utf8'));
  const wantRecord = direct(c, PARAMS).record;
  assert.deepEqual(got.results, wantRecord.results);
  assert.equal(got.results.some((r) => r.state === 'parameter-not-enabled'), false);
  // the expected file of the fixture agrees on the analytic results it lists
  for (const w of c.want.results ?? []) {
    const hit = got.results.find((r) => r.outputId === w.outputId);
    if (hit && w.value !== undefined) assert.deepEqual(hit.value, w.value, w.outputId);
  }
  assert.notEqual(got.id, rec.id);
});

// =============================================================================================
// (f) Purity and scope
// =============================================================================================

test('(f) the flow module has no network, clock, randomness or eval; only the two CLI files import node:fs', () => {
  const src = readFileSync(new URL('ccis-cli-flow.js', root), 'utf8').replace(/\/\/.*$/gm, '');
  for (const re of [/\bfetch\(/, /XMLHttpRequest/, /node:(http|https|net|dgram|child_process)/, /Date\.now|new Date\b/, /Math\.random|randomUUID|node:crypto/, /\beval\(/, /new Function\b/, /\bimport\(/]) {
    assert.equal(re.test(src), false, String(re));
  }
  const importers = readdirSync(root).filter((f) => /^ccis-.*\.js$/.test(f) && /from 'node:fs'/.test(readFileSync(new URL(f, root), 'utf8'))).sort();
  assert.deepEqual(importers, ['ccis-cli-flow.js', 'ccis-cli.js']);
  assert.equal(src.split('\n').length < 400, true, 'size guard: split show into 3.7a past about 400 lines');
});

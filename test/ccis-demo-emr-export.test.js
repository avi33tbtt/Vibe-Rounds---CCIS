// Row DS7: the EMR's own export of its seeded demo case, through the real CLI, to a valid run record that equals
// the hand-calculated expected result. Prototype. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contextEnvelope, runRecord } from '../ccis/validators/ccis-validators.js';

const CLI = fileURLToPath(new URL('../ccis-cli.js', import.meta.url));
const fx = new URL('../ccis/fixtures/snake/emr-export/', import.meta.url);
const ENVELOPE = fileURLToPath(new URL('emr-demo-case.envelope.json', fx));
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const envelope = read(ENVELOPE);
const expected = read(fileURLToPath(new URL('emr-demo-case.expected.json', fx)));
const dir = mkdtempSync(join(tmpdir(), 'ccis-emr-export-'));
const cli = (out, ...extra) => spawnSync(process.execPath, [CLI, 'run', '--envelope', ENVELOPE, '--out', out, '--at', expected.evaluationTime, ...extra], { encoding: 'utf8' });
const keyOf = (r) => `${r['x-analytic']}/${r.outputId}`;
test.after(() => rmSync(dir, { recursive: true, force: true }));

test('the exported envelope is valid, from the EMR, and carries no identity, narrative or entered-in-error data', () => {
  assert.equal(contextEnvelope(envelope), true, JSON.stringify(contextEnvelope.errors));
  assert.equal(envelope.envelope.producer.system, 'emr-enhancer');
  assert.deepEqual(envelope.inclusions, { identity: false, narrative: false, enteredInError: false });
  assert.match(envelope.case.ref, /^cx_[0-9a-f]{32}$/);
  assert.equal(envelope.observations.length, 8, 'eight values: antivenom start time is never recorded');
  assert.equal(envelope.observations.some((o) => o.concept.id.endsWith('antivenom-start-time')), false);
  const result = envelope.observations.find((o) => o.concept.id.endsWith('.clotting-result'));
  assert.equal(result.state, 'unknown');
  assert.equal('value' in result, false);
});

test('full path: envelope -> CLI -> run record, valid, and every analytic result equals the hand-calculated one', () => {
  const out = join(dir, 'record.json');
  const r = cli(out, '--demo-parameters');
  assert.equal(r.status, 0, r.stderr);
  const rec = read(out);
  assert.equal(runRecord(rec), true, JSON.stringify(runRecord.errors));
  assert.equal(rec.status, 'completed');
  assert.equal(rec.evaluationTime.value, expected.evaluationTime);
  assert.deepEqual(rec.warnings, ['demo placeholders, not clinical values']);
  const analytic = rec.results.filter((x) => x['x-analytic']);
  assert.equal(analytic.length, expected.results.length);
  for (const want of expected.results) {
    assert.deepEqual(analytic.find((x) => keyOf(x) === keyOf(want)), want, keyOf(want));
  }
  for (const id of expected.noValueOutputs) assert.equal('value' in analytic.find((x) => x.outputId === id), false, `${id} carries no value`);
});

test('the pathway takes the hand-calculated route: an explicit unknown result is indeterminate and goes to the gap report', () => {
  const out = join(dir, 'route.json');
  assert.equal(cli(out, '--demo-parameters').status, 0);
  const nodes = read(out).results.filter((x) => x['x-node']);
  const want = expected.pathwayRoute.filter((s) => s.node);
  assert.deepEqual(nodes.map((x) => ({ node: x['x-node'], outcome: x['x-outcome'] })), want.map((s) => ({ node: s.node, outcome: s.outcome })));
  assert.equal(nodes[0].state, 'indeterminate');
  assert.equal('value' in nodes[0], false);
  assert.equal(expected.pathwayRoute.at(-1).stage, 'gap-report');
});

test('without --demo-parameters nothing is enabled and no placeholder appears', () => {
  const out = join(dir, 'none.json');
  assert.equal(cli(out).status, 0);
  const rec = read(out);
  assert.equal(runRecord(rec), true, JSON.stringify(runRecord.errors));
  assert.equal(rec.parameters.every((p) => p.enabled === false), true);
  assert.deepEqual(rec.warnings, []);
  assert.equal(readFileSync(out, 'utf8').includes('testOnly'), false);
  const state = (id) => rec.results.find((x) => x.outputId === id).state;
  assert.equal(state('overallStatus'), 'parameter-not-enabled');
  assert.equal(state('expectedDocumentedCount'), 'parameter-not-enabled');
});

test('same envelope, same time and parameters give byte-identical records', () => {
  const a = join(dir, 'a.json');
  const b = join(dir, 'b.json');
  assert.equal(cli(a, '--demo-parameters').status, 0);
  assert.equal(cli(b, '--demo-parameters').status, 0);
  assert.equal(readFileSync(a, 'utf8'), readFileSync(b, 'utf8'));
});

test('the fixture is labelled synthetic and the expected file names its source', () => {
  assert.match(expected.tests, /EMR Enhancer demo case/);
  assert.match(expected['x-provenance'], /Synthetic/);
  assert.equal(expected.class, 'emr-export');
});

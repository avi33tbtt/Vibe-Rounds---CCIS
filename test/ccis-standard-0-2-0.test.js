// Row ECO-B19: standard version 0.2.0 is accepted by the validator, the compatibility check and the importer. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { SUPPORTED_STANDARD_MAJORS } from '../ccis-validator-semantic.js';
import { resolveCompatibility } from '../ccis-compat.js';
import { importEnvelope, STANDARD_VERSION } from '../ccis-import.js';

const cdir = new URL('../ccis/fixtures/contract/', import.meta.url);
const sdir = new URL('../ccis/examples/snake/', import.meta.url);
const fdir = new URL('../ccis/fixtures/snake/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const cf = (f) => read(new URL(f, cdir));
const at = (doc, v) => { const d = structuredClone(doc); d.manifest.standard.version = v; return d; };
const diags = (r) => Object.values(r.layers).flatMap((l) => l.diagnostics);
const errs = (r) => diags(r).filter((x) => x.severity === 'error').map((x) => x.ruleId);
const verdict = (r) => Object.entries(r.layers).map(([k, v]) => [k, v.outcome, v.diagnostics.map((d) => `${d.severity}:${d.ruleId}`)]);

const core = cf('core-vitals.element.json');
const htn = cf('htn-core.element.json');
const group = cf('contract.group.json');
const path = cf('contract.pathway.json');
const pack = cf('contract.rule-pack.json');
const CONTRACT = [[core, []], [htn, [core]], [group, [core, htn]], [path, [core, htn]], [pack, [path, htn, core]]];
const snake = readdirSync(sdir).filter((f) => f.endsWith('.json')).map((f) => read(new URL(f, sdir))).filter((d) => d.manifest);

test('B19: the contract fixtures give the same verdict at 0.2.0 as at 0.1.0', () => {
  for (const [d, known] of CONTRACT) {
    const k2 = known.map((x) => at(x, '0.2.0'));
    const a = validateArtefact(d, { known }), b = validateArtefact(at(d, '0.2.0'), { known: k2 });
    assert.equal(b.outcome, 'no-errors-so-far', d.manifest.id);
    assert.deepEqual(verdict(b), verdict(a), d.manifest.id);
  }
});

test('B19: strict concept checks switch on at 0.2.0: a repeating field with no concept is a warning at 0.1.0 and an error at 0.2.0 (CCIS-V5-024)', () => {
  const rep = (v) => { const d = at(core, v); delete d.fields[0].concept; d.fields[0].cardinality = { min: 0, max: 'unbounded' }; return validateArtefact(d); };
  const sev = (r) => diags(r).filter((x) => x.ruleId === 'CCIS-V5-024').map((x) => x.severity);
  assert.deepEqual(sev(rep('0.1.0')), ['warning']);
  assert.deepEqual(sev(rep('0.2.0')), ['error']);
});

test('B19: the validator supports major 0 only; 1.0.0 is CCIS-V5-008', () => {
  assert.deepEqual(SUPPORTED_STANDARD_MAJORS, [0]);
  assert.deepEqual(errs(validateArtefact(at(core, '1.0.0'))), ['CCIS-V5-008']);
  assert.deepEqual(errs(validateArtefact(at(core, '0.2.0'))), []);
});

test('B19: every snake example has the same error rows at 0.2.0 as at 0.1.0 and none beyond the 0.1.0 ones', () => {
  assert.ok(snake.length >= 4);
  const known = snake;
  const known2 = snake.map((d) => at(d, '0.2.0'));
  for (const d of snake) assert.deepEqual(errs(validateArtefact(at(d, '0.2.0'), { known: known2 })), errs(validateArtefact(d, { known })), d.manifest.id);
});

const RUNTIME = { standardMajors: [0], engine: { version: '0.1.0' }, operatorSet: { name: 'ccis-core-ops', majors: [0] }, limits: { maxSteps: 1000, maxDepth: 24, maxOutputBytes: 65536 }, understoodExtensions: [] };
const compat = (v) => {
  const held = snake.map((d) => at(d, v));
  const pw = held.find((d) => d.manifest.type === 'pathway');
  const r = resolveCompatibility({ pathway: pw, held, context: null, runtime: structuredClone(RUNTIME) });
  return JSON.stringify(r).includes('CMP-3-05');
};

test('B19: compatibility raises no CMP-3-05 for 0.2.0 and raises it for 1.0.0', () => {
  assert.equal(compat('0.1.0'), false);
  assert.equal(compat('0.2.0'), false);
  assert.equal(compat('1.0.0'), true);
});

test('B19: the importer still reads a 0.1.0 envelope, stamps 0.1.0 and builds the same context twice', () => {
  const index = read(new URL('index.json', fdir));
  const c = index.cases.find((x) => x.case === 'normal-01-all-enabled');
  const env = read(new URL(`${c.class}/${c.case}.envelope.json`, fdir));
  const held = snake.filter((d) => ['contextual-element', 'pathway'].includes(d.manifest.type));
  const a = importEnvelope(structuredClone(env), { held }), b = importEnvelope(structuredClone(env), { held });
  assert.equal(a.ok, true);
  assert.equal(STANDARD_VERSION, '0.1.0');
  assert.equal(a.report.standard.version, '0.1.0');
  assert.deepEqual(a.context, b.context);
});

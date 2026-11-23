// STAGED COHORT (demo): runs the real demo runner over every synthetic fixture case and counts the results.
// Prototype. Synthetic data only. Not for clinical use. This is NOT the cohort engine (rows 5.x).
//
//   node scripts/demo-batch.js            writes ccis/demo/cohort-demo.json
//
// Each case is run with its own test-only placeholder parameters and evaluation time (the fixture's expected
// file), through the same `runDemo` the CLI uses. No clock, no network, no patient identifiers (synthetic data).
// The output holds counts only: no case names, no record contents.

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { runDemo } from '../ccis-cli.js';
import { canonicalJson } from '../ccis-demo-record.js';

export const COHORT_LABEL = 'Staged: aggregate of the demo runner over synthetic fixtures; not the cohort engine (rows 5.x)';
const FIX = new URL('../ccis/fixtures/snake/', import.meta.url);
const EX = new URL('../ccis/examples/snake/', import.meta.url);
export const OUT = new URL('../ccis/demo/cohort-demo.json', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

// How one result is named in the counts: its state, else its label, else its kind of value.
export const stateKey = (r) => {
  if (typeof r.state === 'string') return r.state;
  if (r.value && typeof r.value.label === 'string') return r.value.label;
  return r.kind === 'table' ? 'table' : 'value';
};

function artefacts() {
  const f = (n) => read(new URL(n, EX));
  return {
    element: f('snake-envenomation.element.json'),
    binding: f('snake-demo-terminology.binding.json'),
    pathway: f('snake-documentation.pathway.json'),
    nodes: [f('snake-node-clotting.node.json'), f('snake-node-antivenom.node.json')],
    analytics: [f('snake-interval.analytics.0.1.1.json'), f('snake-completeness.analytics.0.1.1.json')],
  };
}

export function buildCohort() {
  const index = read(new URL('index.json', FIX));
  const art = artefacts();
  const classes = {};
  const total = {};
  const byStatus = {};
  for (const c of index.cases) {
    const envelope = read(new URL(`${c.class}/${c.case}.envelope.json`, FIX));
    const expected = read(new URL(`${c.class}/${c.case}.expected.json`, FIX));
    const rec = runDemo({ envelope, parameters: expected.parameters, evaluationTime: expected.evaluationTime, artefacts: art });
    const cl = (classes[c.class] ??= { cases: 0, byStatus: {}, outputs: {} });
    cl.cases += 1;
    bump(cl.byStatus, rec.status);
    bump(byStatus, rec.status);
    for (const r of rec.results) {
      bump((cl.outputs[r.outputId] ??= {}), stateKey(r));
      bump((total[r.outputId] ??= {}), stateKey(r));
    }
  }
  return {
    label: COHORT_LABEL,
    source: 'ccis/fixtures/snake/index.json',
    caseCount: index.cases.length,
    byStatus,
    total,
    classes,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(OUT, `${canonicalJson(buildCohort())}\n`);
  process.stdout.write(`written: ccis/demo/cohort-demo.json\n`);
}

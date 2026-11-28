// Row ECO-C14: composes the pathway dm-ckd from dm and ckd with ccis-compose. Synthetic data only. Not for clinical use.
//   node scripts/build-ecosystem-dm-ckd.js
// Layout and references only. No clock, no network. Author text is fixed here, never generated.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { conflictReport } from '../ccis-compose.js';
import { composeGroup } from '../ccis-compose-group.js';
import { composePathway } from '../ccis-compose-pathway.js';
import { ELEMENT_IDS } from './build-ecosystem-dm-pathway.js';
import { ELEMENT_IDS as CKD_IDS } from './build-ecosystem-ckd-pathway.js';
import { OUT } from './build-ecosystem-terms.js';

export const IDS = [...new Set([...ELEMENT_IDS, ...CKD_IDS])];
const read = (n) => JSON.parse(readFileSync(new URL(n, OUT), 'utf8'));
const publisher = { name: 'Synthetic test publisher' };

export function build(elements = IDS.map((id) => read(`${id}.element.json`))) {
  const dm = read('dm.pathway.json');
  const ckd = read('ckd.pathway.json');
  const report = conflictReport([dm, ckd], elements);
  const g = composeGroup({
    manifest: { id: 'dm-ckd.group', name: 'Diabetes and kidney disease elements', version: '0.1.0', publisher, standardVersion: '0.2.0' },
    intent: { purpose: 'Demo composition of two pathways.', setting: 'Any demo setting.', population: 'Synthetic people only.', exclusions: ['No treatment choice.'], rationale: 'Demonstration only.' },
    provenance: { origin: 'Synthetic demonstration.', basis: 'None. No clinical source.' },
    pathways: [dm, ckd], elements, choices: {},
  });
  if (!g.ok) return { report, group: g, pathway: null };
  const p = composePathway({
    manifest: { id: 'dm-ckd', name: 'Diabetes and kidney disease documentation', version: '0.1.0', publisher, standardVersion: '0.2.0' },
    scope: 'Documentation of the information recorded for a person with diabetes and chronic kidney disease in the synthetic demo. Describes information needed only.',
    intendedUse: dm.intendedUse,
    exclusions: dm.exclusions,
    stages: dm.stages,
    group: g.group, pathways: [dm, ckd], elements,
  });
  return { report, group: g, pathway: p };
}

if (process.argv[1]?.endsWith('build-ecosystem-dm-ckd.js')) {
  const r = build();
  if (!r.group.ok || !r.pathway?.ok) { console.error('compose failed', JSON.stringify(r.group.blockers ?? r.pathway?.blockers)); process.exit(1); }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(new URL('dm-ckd.group.json', OUT), r.group.bytes + '\n');
  writeFileSync(new URL('dm-ckd.pathway.json', OUT), r.pathway.bytes + '\n');
}

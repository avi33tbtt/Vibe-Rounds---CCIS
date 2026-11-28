// Row ECO-C13: writes the pathway package ckd through the SDK. Synthetic data only. Not for clinical use.
//   node scripts/build-ecosystem-ckd-pathway.js
// Layout only: no number, rule, band or threshold. No clock, no network.
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathway } from '../ccis-sdk-pathway.js';
import { SPEC as BASE, ELEMENT_IDS as CORE_IDS } from './build-ecosystem-basic-emr.js';
import { OUT, text } from './build-ecosystem-terms.js';

export const CKD_IDS = ['ckd.core', 'ckd.kidney-function'];
export const ELEMENT_IDS = [...CORE_IDS, ...CKD_IDS];
const el = (id) => ({ kind: 'element', element: id });

export const SPEC = {
  manifest: {
    id: 'ckd', name: 'Chronic kidney disease documentation', type: 'pathway', version: '0.1.0', publisher: { name: 'Synthetic test publisher' },
    standard: { version: '0.2.0' }, status: 'draft',
    references: ELEMENT_IDS.map((id) => ({ id, type: 'contextual-element', version: '0.1.0' })),
  },
  scope: 'Documentation of the information recorded for a person with chronic kidney disease in the synthetic demo. Describes information needed only.',
  intendedUse: 'Descriptive entry form. It does not authorise, direct or recommend any treatment, order or action.',
  exclusions: ['Diagnosis, severity grading and treatment choice.', 'Any product, quantity or amount of anything given.', 'Any rule, prompt or limit on a value.'],
  elements: ELEMENT_IDS.map((id) => ({ id, type: 'contextual-element', range: '0.1.0' })),
  stages: BASE.stages,
  entryForm: { sections: [...BASE.entryForm.sections, { id: 'ckd', label: 'Chronic kidney disease', items: CKD_IDS.map(el) }] },
  contexts: [{ id: 'ckd', label: 'Chronic kidney disease', elements: CKD_IDS }],
};

export const build = () => pathway(SPEC);

if (process.argv[1]?.endsWith('build-ecosystem-ckd-pathway.js')) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(new URL('ckd.pathway.json', OUT), text(build()));
}

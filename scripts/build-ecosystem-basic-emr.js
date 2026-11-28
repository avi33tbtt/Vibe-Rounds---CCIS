// Row ECO-C11: writes the pathway package basic-emr through the SDK. Synthetic data only. Not for clinical use.
//   node scripts/build-ecosystem-basic-emr.js
// Layout only: no number, rule, band or threshold. No clock, no network.
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathway } from '../ccis-sdk-pathway.js';
import { OUT, text } from './build-ecosystem-terms.js';

export const ELEMENT_IDS = ['core.presentation', 'core.examination', 'core.assessment-plan', 'core.vitals', 'core.fluid-balance', 'core.event-times'];
const el = (id) => ({ kind: 'element', element: id });
const sec = (id) => ({ kind: 'section', section: id });

export const SPEC = {
  manifest: {
    id: 'basic-emr', name: 'Basic EMR documentation', type: 'pathway', version: '0.1.0', publisher: { name: 'Synthetic test publisher' },
    standard: { version: '0.2.0' }, status: 'draft',
    references: ELEMENT_IDS.map((id) => ({ id, type: 'contextual-element', version: '0.1.0' })),
  },
  scope: 'Documentation of the basic information recorded for a case in the synthetic demo. Describes information needed only.',
  intendedUse: 'Descriptive entry form. It does not authorise, direct or recommend any treatment, order or action.',
  exclusions: ['Diagnosis, severity grading and treatment choice.', 'Any rule, prompt or limit on a value.'],
  elements: ELEMENT_IDS.map((id) => ({ id, type: 'contextual-element', range: '0.1.0' })),
  stages: [{ id: 'documentation', label: 'Documentation', kind: 'report', entry: ['A case is open.'], exit: ['The information is recorded.'] }],
  entryForm: { sections: [
    { id: 'history', label: 'History', items: [el('core.presentation'), el('core.event-times'), sec('core.problems'), sec('core.allergies'), sec('core.medications')] },
    { id: 'examination', label: 'Examination', items: [el('core.examination'), { ...el('core.vitals'), rowGroups: [['hr', 'bpSys', 'bpDia', 'rr', 'temp', 'spo2']] }, el('core.fluid-balance')] },
    { id: 'assessment', label: 'Assessment', items: [el('core.assessment-plan'), sec('core.investigations')] },
  ] },
};

export const build = () => pathway(SPEC);

if (process.argv[1]?.endsWith('build-ecosystem-basic-emr.js')) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(new URL('basic-emr.pathway.json', OUT), text(build()));
}

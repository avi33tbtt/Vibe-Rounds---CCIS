// Row ECO-C5: writes the three core text elements through the SDK. Synthetic data only. Not for clinical use.
//   node scripts/build-ecosystem-core-text.js     writes ccis/examples/ecosystem/core.*.element.json
// No network, no clock. Same file form as C4 (sorted keys, 2-space indent, LF).
import { writeFileSync, mkdirSync } from 'node:fs';
import { element } from '../ccis-sdk-element.js';
import { OUT, text } from './build-ecosystem-terms.js';

const E_A = ['absent', 'unknown', 'not-collected', 'not-applicable', 'entered-in-error'];
const E_N = [...E_A, 'explicitly-negative'];
const f = (key, label, epistemic) => ({
  key, label, type: 'string', cardinality: { min: 0, max: 1 }, epistemic, sourceClasses: ['clinician-entered'], 'x-emrFieldId': key,
});

// id, name, purpose, fields
export const ELEMENTS = [
  ['core.presentation', 'Presentation', 'Records the presenting complaint, its history and the past medical history as free text written by a clinician.',
    [f('cc', 'Chief complaint', E_A), f('hpi', 'History of present illness', E_A), f('pmh', 'Past medical history', E_N)]],
  ['core.examination', 'Examination', 'Records the examination findings as free text written by a clinician.',
    [f('exam', 'Examination', E_N)]],
  ['core.assessment-plan', 'Assessment and plan', 'Records the assessment and the plan as free text written by a clinician. The plan holds what a clinician wrote; the element never suggests, orders or automates anything.',
    [f('assessment', 'Assessment', E_A), f('plan', 'Plan', E_A)]],
];

export function build([id, name, purpose, fields]) {
  return element({
    manifest: { id, name, type: 'contextual-element', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft' },
    intent: { purpose, setting: 'Any clinical setting in the synthetic demo.', population: 'Synthetic demo cases only.', exclusions: [], rationale: 'Free text carried over from the EMR basic_emr set; no value, band or threshold.' },
    fields,
    provenance: { origin: 'Synthetic demo content for the ecosystem prototype.', basis: 'docs/ELEMENT-LIST-V0.md, source set basic_emr; clinician review pending (ED-2).' },
  });
}

if (process.argv[1]?.endsWith('build-ecosystem-core-text.js')) {
  mkdirSync(OUT, { recursive: true });
  for (const e of ELEMENTS) writeFileSync(new URL(`${e[0]}.element.json`, OUT), text(build(e)));
}

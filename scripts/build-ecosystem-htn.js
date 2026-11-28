// Row ECO-C9: writes htn.core through the SDK. Synthetic data only. Not for clinical use.
//   node scripts/build-ecosystem-htn.js
// Concept display text comes from the C4 table, never retyped. No network, no clock.
import { writeFileSync, mkdirSync } from 'node:fs';
import { element } from '../ccis-sdk-element.js';
import { MEASURES, OUT, text } from './build-ecosystem-terms.js';

const E_A = ['absent', 'unknown', 'not-collected', 'not-applicable', 'entered-in-error'];
const E_M = ['absent', 'unknown', 'not-collected', 'entered-in-error'];
const SYSTEM = { id: 'local', version: '0.1.0' };
const display = (key) => MEASURES.find((m) => m[0] === key)[1];
const concept = (code) => ({ codeSystem: SYSTEM, code, display: display(code), mapping: { status: 'mapped' } });
const SC_M = ['clinician-entered', 'device', 'imported'];
const SC_C = ['clinician-entered'];
const one = { min: 0, max: 1 };
const many = { min: 0, max: 'unbounded' };

// key, label, type, unit, cardinality, epistemic, sources, concept key, EMR id
const f = (key, label, type, unit, cardinality, epistemic, sourceClasses, code, emr) => ({
  key, label, type, cardinality, epistemic, sourceClasses,
  ...(unit ? { units: [unit] } : {}), ...(code ? { concept: concept(code) } : {}), ...(emr ? { 'x-emrFieldId': emr } : {}),
});

const user = (key, label, code, owner, emr) => ({ ...f(key, label, 'integer', 'mm[Hg]', many, E_M, SC_M, code, emr), ownedBy: { element: 'core.vitals', key: owner } });

export const ELEMENTS = [
  { id: 'htn.core', name: 'Hypertension core', purpose: 'Records the hypertension type as entered and blood pressure readings that reuse the shared vital sign concepts. It stores no reference values.', fields: [
    { ...f('htnType', 'Type of hypertension', 'code', null, one, E_A, SC_C, null, 'htn_type'),
      binding: { codeSystem: SYSTEM, valueSet: { id: 'ecosystem.htn-type', version: '0.1.0' }, code: 'htn-type', display: 'Hypertension type', mapping: { status: 'mapped', note: 'Local code, unverified.' } } },
    user('sbp', 'Systolic blood pressure (hypertension record)', 'systolic-pressure', 'bpSys', 'sbp'),
    user('dbp', 'Diastolic blood pressure (hypertension record)', 'diastolic-pressure', 'bpDia', 'dbp')] },
];

export function build(e) {
  return element({
    manifest: { id: e.id, name: e.name, type: 'contextual-element', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft' },
    intent: { purpose: e.purpose, setting: 'Any clinical setting in the synthetic demo.', population: 'Synthetic demo cases only.', exclusions: [], rationale: 'Carried over from the EMR sets as recorded values only.' },
    fields: e.fields,
    provenance: { origin: 'Synthetic demo content for the ecosystem prototype.', basis: 'docs/ELEMENT-LIST-V0.md; clinician review pending (ED-2).' },
  });
}

if (process.argv[1]?.endsWith('build-ecosystem-htn.js')) {
  mkdirSync(OUT, { recursive: true });
  for (const e of ELEMENTS) writeFileSync(new URL(`${e.id}.element.json`, OUT), text(build(e)));
}

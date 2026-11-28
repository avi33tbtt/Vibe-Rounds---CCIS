// Row ECO-C8: writes ckd.core and ckd.kidney-function through the SDK. Synthetic data only. Not for clinical use.
//   node scripts/build-ecosystem-ckd.js
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

export const ELEMENTS = [
  { id: 'ckd.core', name: 'Chronic kidney disease core', purpose: 'Records the kidney disease stage as entered and the recorded cause. Nothing here derives a stage from a measurement.', fields: [
    { ...f('ckdStage', 'Stage of kidney disease', 'code', null, one, E_A, SC_C, null, 'ckd_stage'),
      binding: { codeSystem: SYSTEM, valueSet: { id: 'ecosystem.ckd-stage', version: '0.1.0' }, code: 'ckd-stage', display: 'CKD stage', mapping: { status: 'mapped', note: 'Local code, unverified.' } } },
    f('ckdCause', 'Recorded cause of kidney disease', 'string', null, one, E_A, SC_C, null, 'ckd_cause')] },
  { id: 'ckd.kidney-function', name: 'Kidney function measurements', purpose: 'Records repeated eGFR, creatinine and albumin-creatinine ratio values as entered or taken from a device. A missing value is never zero.', fields: [
    f('egfr', 'eGFR reading', 'quantity', 'mL/min/{1.73_m2}', many, E_M, SC_M, 'egfr', 'egfr'),
    f('creat', 'Creatinine reading', 'quantity', 'mg/dL', many, E_M, SC_M, 'creatinine', 'creat'),
    f('uacr', 'Albumin-creatinine ratio reading', 'quantity', 'mg/g', many, E_M, SC_M, 'albumin-creatinine-ratio', 'uacr')] },
];

export function build(e) {
  return element({
    manifest: { id: e.id, name: e.name, type: 'contextual-element', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft' },
    intent: { purpose: e.purpose, setting: 'Any clinical setting in the synthetic demo.', population: 'Synthetic demo cases only.', exclusions: [], rationale: 'Carried over from the EMR sets as recorded values only.' },
    fields: e.fields,
    provenance: { origin: 'Synthetic demo content for the ecosystem prototype.', basis: 'docs/ELEMENT-LIST-V0.md; clinician review pending (ED-2).' },
  });
}

if (process.argv[1]?.endsWith('build-ecosystem-ckd.js')) {
  mkdirSync(OUT, { recursive: true });
  for (const e of ELEMENTS) writeFileSync(new URL(`${e.id}.element.json`, OUT), text(build(e)));
}

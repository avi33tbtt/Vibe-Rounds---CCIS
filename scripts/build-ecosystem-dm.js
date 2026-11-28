// Row ECO-C7: writes dm.core and dm.glycaemic-monitoring through the SDK. Synthetic data only. Not for clinical use.
//   node scripts/build-ecosystem-dm.js
// Concept display text comes from the C4 table, never retyped. No network, no clock.
import { writeFileSync, mkdirSync } from 'node:fs';
import { element } from '../ccis-sdk-element.js';
import { MEASURES, OUT, text } from './build-ecosystem-terms.js';

const E_A = ['absent', 'unknown', 'not-collected', 'not-applicable', 'entered-in-error'];
const E_M = ['absent', 'unknown', 'not-collected', 'entered-in-error'];
const E_N = ['absent', 'unknown', 'not-collected', 'entered-in-error'];
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
  { id: 'dm.core', name: 'Diabetes core', purpose: 'Records the diabetes type, duration as entered, medicines taken and reported complications. It suggests no regimen.', fields: [
    { ...f('dmType', 'Type of diabetes', 'code', null, one, E_A, SC_C, null, 'dm_type'),
      binding: { codeSystem: SYSTEM, valueSet: { id: 'ecosystem.dm-type', version: '0.1.0' }, code: 'dm-type', display: 'Diabetes type', mapping: { status: 'mapped', note: 'Local code, unverified.' } } },
    f('dmDuration', 'Duration of diabetes as entered', 'quantity', 'a', one, E_M, SC_C, null, 'dm_duration'),
    f('dmMeds', 'Diabetes medicines taken', 'string', null, one, E_N, SC_C, null, 'dm_meds'),
    f('dmComp', 'Reported complications', 'string', null, one, E_N, SC_C, null, 'dm_comp'),
    f('dmHypo', 'Hypoglycaemia episode reported', 'boolean', null, one, E_A, SC_C, null, 'dm_hypo')] },
  { id: 'dm.glycaemic-monitoring', name: 'Glycaemic monitoring', purpose: 'Records repeated glucose and HbA1c readings as entered or taken from a device. A missing reading is never zero.', fields: [
    f('glu', 'Glucose reading', 'quantity', 'mg/dL', many, E_M, SC_M, 'glucose', 'glu'),
    f('hba1c', 'HbA1c reading', 'quantity', '%', many, E_M, SC_M, 'hba1c', 'hba1c')] },
];

export function build(e) {
  return element({
    manifest: { id: e.id, name: e.name, type: 'contextual-element', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft' },
    intent: { purpose: e.purpose, setting: 'Any clinical setting in the synthetic demo.', population: 'Synthetic demo cases only.', exclusions: [], rationale: 'Carried over from the EMR sets as recorded values only.' },
    fields: e.fields,
    provenance: { origin: 'Synthetic demo content for the ecosystem prototype.', basis: 'docs/ELEMENT-LIST-V0.md; clinician review pending (ED-2).' },
  });
}

if (process.argv[1]?.endsWith('build-ecosystem-dm.js')) {
  mkdirSync(OUT, { recursive: true });
  for (const e of ELEMENTS) writeFileSync(new URL(`${e.id}.element.json`, OUT), text(build(e)));
}

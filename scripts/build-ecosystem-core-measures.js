// Row ECO-C6: writes core.vitals, core.fluid-balance and core.event-times through the SDK. Synthetic data only. Not for clinical use.
//   node scripts/build-ecosystem-core-measures.js
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
const when = (key, label, sourceClasses) => ({ key, label, type: 'datetime', timeSemantics: 'event-time', cardinality: one, epistemic: E_A, sourceClasses });
const SRC3 = ['clinician-entered', 'patient-reported', 'informant-reported'];

export const ELEMENTS = [
  { id: 'core.vitals', name: 'Vital signs', purpose: 'Records repeated vital sign readings as entered or taken from a device.', fields: [
    f('hr', 'Pulse rate', 'integer', '/min', many, E_M, SC_M, 'pulse-rate', 'hr'),
    f('bpSys', 'Systolic blood pressure', 'integer', 'mm[Hg]', many, E_M, SC_M, 'systolic-pressure', 'bp_sys'),
    f('bpDia', 'Diastolic blood pressure', 'integer', 'mm[Hg]', many, E_M, SC_M, 'diastolic-pressure', 'bp_dia'),
    f('rr', 'Respiratory rate', 'integer', '/min', many, E_M, SC_M, 'respiratory-rate', 'rr'),
    f('temp', 'Body temperature', 'quantity', 'Cel', many, E_M, SC_M, 'temperature', 'temp'),
    f('spo2', 'Oxygen saturation', 'integer', '%', many, E_M, SC_M, 'oxygen-saturation', 'spo2')] },
  { id: 'core.fluid-balance', name: 'Fluid balance', purpose: 'Records fluid intake and urine output totals over 24 hours. A missing total is never read as zero.', fields: [
    f('intake', 'Total fluid intake over 24 hours', 'integer', 'mL', one, E_M, SC_C, 'fluid-intake-24h', 'intake'),
    f('output', 'Total urine output over 24 hours', 'integer', 'mL', one, E_M, SC_C, 'urine-output-24h', 'output'),
    f('balance', 'Fluid balance over 24 hours', 'integer', 'mL', one, E_M, ['derived'], null, 'balance'),
    f('catheter', 'Urinary catheter in place', 'boolean', null, one, E_A, SC_C, null, 'catheter'),
    f('ioNotes', 'Intake and output notes', 'string', null, one, E_A, SC_C, null, 'io_notes')],
  relationships: [{ kind: 'derived-from', from: 'balance', to: 'intake' }, { kind: 'derived-from', from: 'balance', to: 'output' }] },
  { id: 'core.event-times', name: 'Event times', purpose: 'Records when an event began and arrived, with how certain the start time is. An unknown time is never replaced by a default.', fields: [
    when('onsetTime', 'Time of onset', SRC3),
    { key: 'onsetTimeCertainty', label: 'How certain the onset time is', type: 'code', cardinality: one, epistemic: E_A, sourceClasses: SRC3,
      binding: { codeSystem: SYSTEM, valueSet: { id: 'ecosystem.onset-certainty', version: '0.1.0' }, code: 'onset-certainty', display: 'Onset time certainty', mapping: { status: 'mapped', note: 'Local code, unverified.' } } },
    when('arrivalTime', 'Time of arrival', ['clinician-entered', 'imported'])],
  relationships: [{ kind: 'refines', from: 'onsetTimeCertainty', to: 'onsetTime' }] },
];

export function build(e) {
  return element({
    manifest: { id: e.id, name: e.name, type: 'contextual-element', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft' },
    intent: { purpose: e.purpose, setting: 'Any clinical setting in the synthetic demo.', population: 'Synthetic demo cases only.', exclusions: [], rationale: 'Carried over from the EMR sets as recorded values only.' },
    fields: e.fields,
    ...(e.relationships ? { relationships: e.relationships } : {}),
    provenance: { origin: 'Synthetic demo content for the ecosystem prototype.', basis: 'docs/ELEMENT-LIST-V0.md; clinician review pending (ED-2).' },
  });
}

if (process.argv[1]?.endsWith('build-ecosystem-core-measures.js')) {
  mkdirSync(OUT, { recursive: true });
  for (const e of ELEMENTS) writeFileSync(new URL(`${e.id}.element.json`, OUT), text(build(e)));
}

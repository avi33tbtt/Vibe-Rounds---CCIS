// Row ECO-C4: writes the local terminology package and the owner map from a plain table. Synthetic data only. Not for clinical use.
//   node scripts/build-ecosystem-terms.js          writes ccis/examples/ecosystem/
// No network, no clock. Output: sorted keys, 2-space indent, LF, one final newline.
import { writeFileSync, mkdirSync } from 'node:fs';

export const OUT = new URL('../ccis/examples/ecosystem/', import.meta.url);

// key, display, definition (only to separate two concepts), owner element, owner field, users [element, field]
export const MEASURES = [
  ['pulse-rate', 'Pulse rate', null, 'core.vitals', 'hr', []],
  ['systolic-pressure', 'Systolic blood pressure', null, 'core.vitals', 'bpSys', [['htn.core', 'sbp']]],
  ['diastolic-pressure', 'Diastolic blood pressure', null, 'core.vitals', 'bpDia', [['htn.core', 'dbp']]],
  ['respiratory-rate', 'Respiratory rate', null, 'core.vitals', 'rr', []],
  ['temperature', 'Body temperature', null, 'core.vitals', 'temp', []],
  ['oxygen-saturation', 'Oxygen saturation', null, 'core.vitals', 'spo2', []],
  ['fluid-intake-24h', 'Fluid intake over 24 hours', null, 'core.fluid-balance', 'intake', []],
  ['urine-output-24h', 'Urine output over 24 hours', null, 'core.fluid-balance', 'output', []],
  ['glucose', 'Glucose', 'A glucose measurement as recorded; not the same concept as glycated haemoglobin.', 'dm.glycaemic-monitoring', 'glu', []],
  ['hba1c', 'HbA1c', 'A glycated haemoglobin measurement as recorded; not the same concept as glucose.', 'dm.glycaemic-monitoring', 'hba1c', []],
  ['egfr', 'Estimated glomerular filtration rate', null, 'ckd.kidney-function', 'egfr', []],
  ['creatinine', 'Creatinine', null, 'ckd.kidney-function', 'creat', []],
  ['albumin-creatinine-ratio', 'Albumin-creatinine ratio', null, 'ckd.kidney-function', 'uacr', []],
];

export const VALUE_SETS = [
  ['dm-type', 'Diabetes type', [['t1dm', 'T1DM'], ['t2dm', 'T2DM'], ['other', 'Other']]],
  ['htn-type', 'Hypertension type', [['essential', 'Essential'], ['secondary', 'Secondary'], ['other', 'Other']]],
  ['ckd-stage', 'CKD stage', [['1', 'Stage 1'], ['2', 'Stage 2'], ['3a', 'Stage 3a'], ['3b', 'Stage 3b'], ['4', 'Stage 4'], ['5', 'Stage 5']]],
  ['onset-certainty', 'Onset time certainty', [['exact', 'Exact'], ['approximate', 'Approximate'], ['unknown', 'Unknown']]],
];

export function buildPackage() {
  const concepts = MEASURES.map(([key, display, definition]) => {
    const c = { key, display, category: /^(glucose|hba1c|egfr|creatinine|albumin)/.test(key) ? 'test' : 'observation' };
    if (definition) c.definition = definition;
    return c;
  });
  for (const [set, , members] of VALUE_SETS) for (const [m, display] of members) concepts.push({ key: `${set}.${m}`, display, category: 'finding' });
  return {
    manifest: { id: 'ecosystem.local-terms', name: 'Ecosystem local terms', type: 'terminology-package', version: '0.1.0', publisher: { name: 'Synthetic test publisher' }, standard: { version: '0.2.0' }, status: 'draft' },
    codeSystem: { id: 'local', version: '0.1.0' },
    concepts,
    valueSets: VALUE_SETS.map(([id, display, members]) => ({ id: `ecosystem.${id}`, version: '0.1.0', display, members: members.map(([m]) => ({ key: `${id}.${m}` })) })),
    provenance: { origin: 'Synthetic demo content for the ecosystem prototype.', basis: 'docs/ELEMENT-LIST-V0.md; clinician review pending (ED-2).' },
  };
}

export function buildOwners() {
  return { note: 'Synthetic demo. One owner element per concept (ED-12). Clinician review pending (ED-2).', owners: MEASURES.map(([concept, , , element, field, users]) => ({ concept, owner: { element, key: field }, users: users.map(([e, k]) => ({ element: e, key: k })) })) };
}

const sorted = (v) => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v;
export const text = (v) => JSON.stringify(sorted(v), null, 2) + '\n';

if (import.meta.url === new URL(process.argv[1], 'file:').href || process.argv[1]?.endsWith('build-ecosystem-terms.js')) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(new URL('ecosystem.local-terms.terminology-package.json', OUT), text(buildPackage()));
  writeFileSync(new URL('concept-owners.json', OUT), text(buildOwners()));
}

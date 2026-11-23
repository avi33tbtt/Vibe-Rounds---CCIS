import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { contextEnvelope, runResult } from '../ccis/validators/ccis-validators.js';

const fx = new URL('../ccis/fixtures/snake/', import.meta.url);
const ex = new URL('../ccis/examples/snake/', import.meta.url);
const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
const exa = (f) => read(new URL(f, ex));

const index = read(new URL('index.json', fx));
const readme = readFileSync(new URL('README.md', fx), 'utf8');
const element = exa('snake-envenomation.element.json');
const pathway = exa('snake-documentation.pathway.json');
const A = exa('snake-interval.analytics.json');
const B = exa('snake-completeness.analytics.json');
// Row 1.5b: new cases apply to analytics 0.1.1 and say so in `x-analyticVersion`. Cases without it apply to 0.1.0.
const A1 = exa('snake-interval.analytics.0.1.1.json');
const B1 = exa('snake-completeness.analytics.0.1.1.json');
const pkgs = { '0.1.0': { A, B }, '0.1.1': { A: A1, B: B1 } };
const verOf = (c) => c.expected['x-analyticVersion'] ?? '0.1.0';
const pk = (c) => pkgs[verOf(c)];
const UNIT_MIN = { min: 1, h: 60 }; // plain arithmetic for the independent recomputation; not read from the artefacts
const EL = element.manifest.id;

const classDirs = readdirSync(fx).filter((d) => statSync(new URL(d, fx)).isDirectory()).sort();
const cases = index.cases.map((c) => ({
  ...c,
  envelope: read(new URL(`${c.class}/${c.case}.envelope.json`, fx)),
  expected: read(new URL(`${c.class}/${c.case}.expected.json`, fx)),
}));

const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const keys = element.fields.map((f) => f.key);
const FULL_ROUTE = JSON.stringify([
  { stage: 'presentation' },
  { stage: 'clotting-documentation', node: 'clotting-test-documented', outcome: 'result-documented' },
  { stage: 'antivenom-documentation', node: 'antivenom-documented', outcome: 'given-time-documented' },
  { end: true },
]);

// ---- plain-arithmetic helpers (independent of the expression trees) ----
const obsOf = (env, key) => env.observations.filter((o) => o.concept.id === `${EL}.${kebab(key)}`);
const instant = (o) => (o && o.value && o.value.value ? Date.parse(o.value.value) : null);
const minutes = (a, b) => (b - a) / 60000;
const stateOf = (env, key) => {
  const o = obsOf(env, key);
  if (o.length === 0) return 'absent';
  if (o.length > 1) return 'conflicting';
  return o[0].state ? o[0].state : 'present';
};
const codeOf = (env, key) => { const o = obsOf(env, key)[0]; return o && o.value ? o.value.code : null; };
const pv = (exp, id) => (exp.parameters === 'none' || !exp.parameters[id] ? undefined : exp.parameters[id].value);
const byOut = (exp, an) => Object.fromEntries(exp.results.filter((r) => r['x-analytic'] === an).map((r) => [r.outputId, r]));
const same = (r, want) => {
  if (want.state) { assert.equal(r.state, want.state); assert.equal('value' in r, false); }
  else assert.deepEqual(r.value, want.value);
};

test('index: every case has both files and every file is in the index', () => {
  const listed = new Set(index.cases.map((c) => `${c.class}/${c.case}`));
  assert.equal(listed.size, index.cases.length, 'no duplicate case');
  const onDisk = [];
  for (const d of classDirs) for (const f of readdirSync(new URL(d + '/', fx))) {
    const m = f.match(/^(.*)\.(envelope|expected)\.json$/);
    assert.ok(m, `unexpected file ${d}/${f}`);
    if (m[2] === 'envelope') onDisk.push(`${d}/${m[1]}`);
  }
  assert.deepEqual(onDisk.sort(), [...listed].sort());
  for (const c of index.cases) assert.ok(c.tests && c.tests.length > 10, c.case);
  assert.ok(index.deferred.length >= 2 && index.deferred.every((d) => d.reason), 'deferred cases carry a reason');
  // row 1.5b built the two cases deferred in 1.5a; F-4 and F-5 cases stay deferred
  const names = index.deferred.map((d) => d.case);
  for (const built of ['unit-conversion-hours-parameter', 'estimated-target-enabled']) assert.equal(names.includes(built), false, `${built} is built now`);
  assert.ok(names.includes('antivenom-not-given-target-disabled') && names.includes('clotting-not-performed-expected-items-enabled'));
  for (const d of index.deferred) assert.equal(cases.some((c) => c.case === d.case), false, `${d.case} is deferred and also built`);
});

test('index: all six classes are present', () => {
  for (const k of ['normal', 'boundary', 'missing', 'conflicting', 'out-of-scope', 'unit-conversion']) {
    assert.ok(cases.some((c) => c.class === k), k);
    assert.ok(readme.includes(k), `README names ${k}`);
  }
  assert.ok(cases.length >= 20);
});

test('envelopes: each validates; no identity or narrative; versions match the reference artefacts', () => {
  for (const c of cases) {
    assert.equal(contextEnvelope(c.envelope), true, `${c.case} ${JSON.stringify(contextEnvelope.errors)}`);
    assert.deepEqual(c.envelope.inclusions, { identity: false, narrative: false, enteredInError: false });
    assert.match(c.envelope.case.ref, /^case-snake-/);
    assert.deepEqual(c.envelope.applied.elements, [{ id: EL, type: element.manifest.type, version: element.manifest.version }], c.case);
    assert.deepEqual(c.envelope.applied.pathways, [{ id: pathway.manifest.id, type: pathway.manifest.type, version: pathway.manifest.version }], c.case);
    for (const o of c.envelope.observations) {
      assert.notEqual(o.recorded.value, o.effective.value, `${c.case} ${o.id}: recorded must not copy effective`);
      assert.equal(o.effective.zone, 'stated');
    }
  }
});

test('concept ids: one-to-one with the ten field keys, written in the README, codes match the bindings', () => {
  assert.equal(keys.length, 10);
  const ids = keys.map((k) => `${EL}.${kebab(k)}`);
  assert.equal(new Set(ids).size, 10);
  for (const [i, k] of keys.entries()) assert.ok(readme.includes(`\`${k}\``) && readme.includes(`\`${ids[i]}\``), `README row for ${k}`);
  const used = new Set();
  for (const c of cases) for (const o of c.envelope.observations) {
    const k = keys.find((x) => `${EL}.${kebab(x)}` === o.concept.id);
    assert.ok(k, `${c.case}: unknown concept ${o.concept.id}`);
    used.add(k);
    const f = element.fields.find((x) => x.key === k);
    assert.equal(o.kind, f.type, `${c.case} ${k}`);
    assert.ok(f.sourceClasses.includes(o.sourceClass), `${c.case} ${k} source class`);
    if (f.type === 'code') assert.deepEqual(o.concept.codes, [{ system: f.binding.codeSystem.id, systemVersion: f.binding.codeSystem.version, code: f.binding.code, verification: 'unverified' }]);
    else assert.deepEqual(o.concept.codes, []);
  }
  for (const k of keys.filter((x) => x !== 'antivenomNotGivenReason')) assert.ok(used.has(k), `no case uses ${k}`);
});

test('expected files: shape, results validate against the run-result schema, outputs match the analytics', () => {
  for (const c of cases) {
    const e = c.expected;
    assert.equal(e.case, c.case); assert.equal(e.class, c.class);
    assert.match(e.evaluationTime, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/);
    assert.ok(Array.isArray(e.workings) && e.workings.length > 0 && e.workings.every((w) => w.length > 20), c.case);
    assert.ok(Array.isArray(e.noValueOutputs) && Array.isArray(e.notSpecified));
    const ver = verOf(c); const { A: AA, B: BB } = pk(c);
    assert.ok(pkgs[ver], `${c.case}: unknown analytic version ${ver}`);
    assert.equal(AA.manifest.version, ver); assert.equal(BB.manifest.version, ver);
    const analytics = { [AA.manifest.id]: AA, [BB.manifest.id]: BB };
    const seen = new Set();
    for (const r of e.results) {
      assert.equal(runResult(r), true, `${c.case} ${r.outputId} ${JSON.stringify(runResult.errors)}`);
      const pkg = analytics[r['x-analytic']];
      assert.ok(pkg, `${c.case} unknown analytic`);
      const out = pkg.outputs.find((o) => o.id === r.outputId);
      assert.ok(out, `${c.case} unknown output ${r.outputId}`);
      assert.equal(r.kind, out.kind);
      assert.deepEqual(r.limitations, [pkg.limitations.statement], `${c.case} limitations text`);
      const keyId = `${r['x-analytic']}/${r.outputId}`;
      assert.equal(seen.has(keyId), false, `${c.case} duplicate ${keyId}`); seen.add(keyId);
      if (r.state) { assert.ok(out.states.includes(r.state), `${c.case} ${r.outputId} state ${r.state} not declared`); }
      else if (out.kind === 'classification') assert.ok(out.labels.includes(r.value.label), `${c.case} label ${r.value.label}`);
      else if (out.kind === 'value') assert.equal(r.value.unit, out.unit);
      else assert.deepEqual(r.value.columns, out.columns.map((x) => x.key));
      for (const p of r.dependsOnParameters || []) assert.ok(pkg.parameters.some((x) => x.id === p), `${c.case} parameter ${p}`);
      if (r.state === 'parameter-not-enabled') {
        // the result names the parameters it needed, and every one of them is disabled in this case
        assert.ok(r.dependsOnParameters && r.dependsOnParameters.length > 0, `${c.case} ${r.outputId}: names what is not enabled`);
        for (const p of r.dependsOnParameters) assert.equal(e.parameters !== 'none' && p in e.parameters, false, `${c.case} ${r.outputId}: ${p} is enabled`);
      }
    }
    const unspecified = e.notSpecifiedOutputs ?? [];
    if (ver === '0.1.0') assert.equal('notSpecifiedOutputs' in e, false, `${c.case}: 0.1.0 cases are as built in 1.5a`);
    else {
      assert.equal(unspecified.length > 0, e.notSpecified.length > 0, `${c.case}: notSpecified and notSpecifiedOutputs go together`);
      for (const id of unspecified) { assert.ok(BB.outputs.some((o) => o.id === id), `${c.case} ${id}`); assert.equal(e.results.some((r) => r.outputId === id), false, `${c.case}: no value written for ${id}`); }
    }
    const want = ver === '0.1.0'
      ? (e.notSpecified.length ? AA.outputs.length : AA.outputs.length + BB.outputs.length)
      : AA.outputs.length + BB.outputs.length - unspecified.length;
    assert.equal(e.results.length, want, `${c.case}: one result per output`);
    for (const id of e.noValueOutputs) {
      const r = e.results.find((x) => x.outputId === id);
      assert.ok(r && r.state && !('value' in r), `${c.case}: ${id} must carry a state and no value`);
    }
  }
});

test('placeholders: only in expected files, every one marked test-only, valid for the declared parameter', () => {
  for (const c of cases) {
    const p = c.expected.parameters;
    if (p === 'none') continue;
    for (const [id, v] of Object.entries(p)) {
      assert.equal(v.testOnly, true, `${c.case} ${id}`);
      assert.equal(v.note, 'test-only placeholder, not a clinical value');
      const owner = [pk(c).A, pk(c).B].find((x) => x.parameters.some((y) => y.id === id));
      assert.ok(owner, `${c.case} undeclared parameter ${id}`);
      const decl = owner.parameters.find((y) => y.id === id);
      if (decl.kind === 'duration') {
        assert.ok(decl.units.includes(v.value.unit), `${c.case} ${id}: unit ${v.value.unit} not declared`);
        // the allowed range is in minutes; a value in another unit is converted through the package's own declared conversion
        const k = v.value.unit === 'min' ? { factor: 1 } : (owner.conversions ?? []).find((x) => x.from === v.value.unit && x.to === 'min');
        assert.ok(k, `${c.case} ${id}: no declared conversion from ${v.value.unit} to min`);
        const inMin = v.value.amount * k.factor;
        assert.ok(inMin >= decl.allowedRange.min && inMin <= decl.allowedRange.max, `${c.case} ${id} range`);
      }
      if (decl.kind === 'choice') assert.ok(decl.allowedChoices.includes(v.value));
      if (decl.kind === 'set') assert.ok(v.value.every((m) => decl.allowedMembers.includes(m)));
    }
    for (const r of c.expected.results) assert.equal(JSON.stringify(r).includes('testOnly'), false);
  }
});

test('placeholders never appear in the reference artefacts', () => {
  const files = readdirSync(ex).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 7);
  for (const f of files) {
    const text = readFileSync(new URL(f, ex), 'utf8');
    assert.equal(text.includes('testOnly'), false, f);
    assert.equal(text.includes('test-only placeholder'), false, f);
  }
  for (const pkg of [A, B]) for (const p of pkg.parameters) {
    assert.equal(p.enabledByDefault, false);
    for (const k of ['value', 'default', 'suggested']) assert.equal(k in p, false, `${pkg.manifest.id} ${p.id} has ${k}`);
  }
});

test('independent recomputation: intervals, windows, comparisons from the envelope times', () => {
  for (const c of cases) {
    const env = c.envelope; const exp = c.expected; const a = byOut(exp, A.manifest.id); const b = byOut(exp, B.manifest.id);
    const bite = instant(obsOf(env, 'biteTime')[0]); const start = instant(obsOf(env, 'antivenomStartTime')[0]);
    const f7 = stateOf(env, 'antivenomStatus'); const cert = codeOf(env, 'biteTimeCertainty');
    const edge = pv(exp, 'edgeRule'); const target = pv(exp, 'targetIntervalDuration'); const accepted = pv(exp, 'acceptedCertainty');
    // interval (dossier 4.1)
    let want;
    if (f7 === 'explicitly-negative') want = { state: 'not-applicable' };
    else if (f7 !== 'present') want = { state: 'indeterminate' };
    else if (bite === null || start === null || !cert) want = { state: 'needs-data' };
    else if (start < bite) want = { state: 'conflict' };
    else if (cert === 'estimated' && accepted === undefined) want = { state: 'parameter-not-enabled' };
    else if (cert === 'estimated' && accepted === 'needs-data') want = { state: 'needs-data' };
    else want = { value: { amount: minutes(bite, start), unit: 'min' } };
    same(a.interval, want);
    // comparison (dossier 4.1 and 5)
    if (verOf(c) === '0.1.0') {
      if (target === undefined || edge === undefined) want = { state: 'parameter-not-enabled' };
      else if (f7 === 'explicitly-negative') want = { state: 'not-applicable' };
      else if (bite === null || start === null) want = { state: 'needs-data' };
      else if (start < bite) want = { state: 'conflict' };
      else { const d = minutes(bite, start); const within = edge === 'inside' ? d <= target.amount : d < target.amount; want = { value: { label: within ? 'within-target' : 'outside-target' } }; }
    } else {
      // 0.1.1 (finding F-1): the comparison needs F1 with its certainty, F7 and F8, exactly as the interval does (dossier 4.1 and 5, P2)
      const tmin = target === undefined ? undefined : target.amount * UNIT_MIN[target.unit];
      if (target === undefined || edge === undefined) want = { state: 'parameter-not-enabled' };
      else if (f7 === 'explicitly-negative') want = { state: 'not-applicable' };
      else if (f7 !== 'present') want = { state: 'indeterminate' };
      else if (bite === null || start === null || !cert) want = { state: 'needs-data' };
      else if (start < bite) want = { state: 'conflict' };
      else if (cert === 'estimated' && accepted === undefined) want = { state: 'parameter-not-enabled' };
      else if (cert === 'estimated' && accepted === 'needs-data') want = { state: 'needs-data' };
      else { const d = minutes(bite, start); const within = edge === 'inside' ? d <= tmin : d < tmin; want = { value: { label: within ? 'within-target' : 'outside-target' } }; }
    }
    same(a.comparison, want);
    if (Object.keys(b).length === 0) continue;
    // read-time window (dossier 5, P4 and P5)
    const f3 = stateOf(env, 'clottingTestStatus'); const t0 = instant(obsOf(env, 'clottingTestStartTime')[0]); const t1 = instant(obsOf(env, 'clottingResultReadTime')[0]);
    const win = pv(exp, 'readTimeWindow');
    if (!b.readTimeInWindow) { assert.ok((exp.notSpecifiedOutputs ?? []).includes('readTimeInWindow'), `${c.case}: no window result and not listed as unspecified`); continue; }
    if (verOf(c) === '0.1.0') {
      if (f3 === 'explicitly-negative') want = { state: 'not-applicable' };
      else if (win === undefined || edge === undefined) want = { state: 'parameter-not-enabled' };
      else if (t0 === null || t1 === null) want = { state: 'needs-data' };
      else if (t1 < t0) want = { state: 'conflict' };
      else { const d = minutes(t0, t1); const inn = edge === 'inside' ? d <= win.amount : d < win.amount; want = { value: { label: inn ? 'in-time' : 'not-in-time' } }; }
    } else {
      // 0.1.1 (finding F-2): F4 is only meaningful when F3 says performed (dossier 2, F4), so F3 must be documented as present
      const wmin = win === undefined ? undefined : win.amount * UNIT_MIN[win.unit];
      if (f3 === 'explicitly-negative') want = { state: 'not-applicable' };
      else if (win === undefined || edge === undefined) want = { state: 'parameter-not-enabled' };
      else if (f3 !== 'present') want = { state: 'needs-data' };
      else if (t0 === null || t1 === null) want = { state: 'needs-data' };
      else if (t1 < t0) want = { state: 'conflict' };
      else { const d = minutes(t0, t1); const inn = edge === 'inside' ? d <= wmin : d < wmin; want = { value: { label: inn ? 'in-time' : 'not-in-time' } }; }
    }
    same(b.readTimeInWindow, want);
  }
});

test('independent recomputation: item states, count and overall status from what the envelope records', () => {
  const items = ['clottingTestStatus', 'clottingTestStartTime', 'clottingResultReadTime', 'clottingResult'];
  for (const c of cases) {
    const env = c.envelope; const exp = c.expected; const b = byOut(exp, B.manifest.id);
    if (!b.itemStates) { assert.ok(exp.notSpecified.length, `${c.case}: no item states and not listed as unspecified`); continue; }
    if (items.some((k) => stateOf(env, k) === 'conflicting')) {
      // finding F-3 (0.1.1): a conflicting item gives the declared conflict state and no table
      assert.equal(verOf(c), '0.1.1', `${c.case}: a conflict result needs the 0.1.1 analytic`);
      same(b.itemStates, { state: 'conflict' });
      continue;
    }
    if (exp.notSpecified.length) continue;
    const per = items.map((k) => { const s = stateOf(env, k); return s === 'present' ? 'documented' : s === 'absent' ? 'not-documented' : s; });
    assert.deepEqual(b.itemStates.value.rows, [per], c.case);
    const set = pv(exp, 'expectedItems');
    if (set === undefined) { same(b.expectedDocumentedCount, { state: 'parameter-not-enabled' }); same(b.overallStatus, { state: 'parameter-not-enabled' }); continue; }
    const mine = items.filter((k) => set.includes(k));
    assert.equal(mine.includes('clottingTestStatus') && per[0] === 'explicitly-negative', false, `${c.case}: that combination is not covered (README finding F-5)`);
    same(b.expectedDocumentedCount, { value: { amount: mine.filter((k) => per[items.indexOf(k)] === 'documented').length, unit: '1' } });
    const st = mine.map((k) => per[items.indexOf(k)]);
    const lab = st.includes('not-documented') ? 'incomplete' : st.includes('unknown') ? 'indeterminate' : 'complete';
    same(b.overallStatus, { value: { label: lab } });
  }
});

test('pathway routes: valid against the pathway and equal to the route worked out from the records', () => {
  const stages = new Map(pathway.stages.map((s) => [s.id, s]));
  const nodes = new Map(pathway.nodes.map((n) => [n.id, n]));
  const node1 = (env) => {
    const s = stateOf(env, 'clottingTestStatus');
    if (s === 'conflicting') return 'records-conflict';
    if (s === 'absent') return 'nothing-recorded';
    if (s === 'unknown') return 'status-unknown';
    if (s === 'explicitly-negative') return 'documented-not-performed';
    const t = stateOf(env, 'clottingResultReadTime') === 'present'; const r = stateOf(env, 'clottingResult') === 'present';
    return t && r ? 'result-documented' : r ? 'result-without-read-time' : t ? 'read-time-without-result' : 'no-result-no-read-time';
  };
  const node2 = (env) => {
    const s = stateOf(env, 'antivenomStatus');
    if (s === 'conflicting') return 'records-conflict';
    if (s === 'absent') return 'nothing-recorded';
    if (s === 'unknown') return 'status-unknown';
    if (s === 'explicitly-negative') return 'documented-not-given';
    return stateOf(env, 'antivenomStartTime') === 'present' ? 'given-time-documented' : 'given-time-not-documented';
  };
  for (const c of cases) {
    const r = c.expected.pathwayRoute;
    assert.deepEqual(r[0], { stage: 'presentation' });
    for (let i = 1; i < r.length; i++) {
      const step = r[i]; const prev = r[i - 1];
      if (step.end) { assert.ok(prev.node, `${c.case}: end follows a node`); const oc = nodes.get(prev.node).outcomes.find((o) => o.id === prev.outcome); assert.equal(oc.next.end, true); continue; }
      assert.ok(stages.has(step.stage), `${c.case} stage ${step.stage}`);
      if (prev.node) { const oc = nodes.get(prev.node).outcomes.find((o) => o.id === prev.outcome); assert.ok(oc, `${c.case} outcome ${prev.outcome}`); assert.equal(oc.next.stage, step.stage, `${c.case} next stage`); }
      if (step.node) { assert.ok(nodes.has(step.node)); assert.ok(nodes.get(step.node).outcomes.some((o) => o.id === step.outcome), `${c.case} ${step.outcome}`); }
    }
    const last = r[r.length - 1];
    assert.ok(last.end || last.stage === 'gap-report', `${c.case} route ends at the end or the gap report`);
    const n1 = r.find((s) => s.node === 'clotting-test-documented'); const n2 = r.find((s) => s.node === 'antivenom-documented');
    assert.equal(n1.outcome, node1(c.envelope), c.case);
    if (n2) assert.equal(n2.outcome, node2(c.envelope), c.case);
    else assert.ok(['nothing-recorded', 'status-unknown', 'records-conflict'].includes(n1.outcome), `${c.case}: route stops at the gap report`);
  }
});

test('behaviour rules: unknown never becomes false or normal; missing, conflicting and not-applicable give no value; estimates stay visible', () => {
  for (const c of cases.filter((x) => ['missing', 'conflicting', 'out-of-scope'].includes(x.class))) {
    const e = c.expected; const b = byOut(e, B.manifest.id);
    const changed = e.noValueOutputs.length > 0 || JSON.stringify(e.pathwayRoute) !== FULL_ROUTE || (b.itemStates && b.itemStates.value && b.itemStates.value.rows[0].includes('not-documented'));
    assert.ok(changed, `${c.case} must differ from a normal result`);
    for (const r of e.results) if (['needs-data', 'indeterminate', 'conflict', 'not-applicable'].includes(r.state)) assert.equal('value' in r, false);
  }
  for (const c of cases.filter((x) => verOf(x) === '0.1.1' && x.class === 'conflicting')) {
    assert.equal(byOut(c.expected, B1.manifest.id).itemStates.state, 'conflict', `${c.case}: the per-item table reports a conflict`);
  }
  for (const c of cases.filter((x) => x.class === 'missing')) {
    for (const r of c.expected.results) if (r.state === 'needs-data' || r.state === 'indeterminate') assert.ok(r.missingDataNotes.length > 0, `${c.case} ${r.outputId} says what is missing`);
  }
  const unk = cases.find((x) => x.case === 'missing-08-clotting-status-unknown');
  assert.equal(byOut(unk.expected, B.manifest.id).itemStates.value.rows[0][0], 'unknown');
  assert.notEqual(byOut(unk.expected, B.manifest.id).overallStatus.value.label, 'complete');
  for (const c of cases.filter((x) => codeOf(x.envelope, 'biteTimeCertainty') === 'estimated')) {
    const r = byOut(c.expected, A.manifest.id).interval;
    assert.ok(r.warnings.some((w) => /estimated/i.test(w)), `${c.case}: the estimate stays visible`);
  }
  assert.equal(cases.filter((x) => codeOf(x.envelope, 'biteTimeCertainty') === 'estimated' && verOf(x) === '0.1.0').length, 3);
  assert.equal(cases.filter((x) => codeOf(x.envelope, 'biteTimeCertainty') === 'estimated' && verOf(x) === '0.1.1').length, 3);
  const edgeIn = byOut(cases.find((x) => x.case === 'boundary-01-edge-inside').expected, A.manifest.id).comparison;
  const edgeOut = byOut(cases.find((x) => x.case === 'boundary-02-edge-outside').expected, A.manifest.id).comparison;
  assert.notDeepEqual(edgeIn.value, edgeOut.value, 'the edge rule changes the boundary result');
  const n1 = byOut(cases.find((x) => x.case === 'normal-01-all-enabled').expected, A.manifest.id);
  const u1 = byOut(cases.find((x) => x.case === 'unit-conversion-01-mixed-offsets').expected, A.manifest.id);
  assert.deepEqual(u1.interval.value, n1.interval.value, 'different offsets, same instants, same interval');
});

// ---- row 1.5b: the cases built for analytics 0.1.1 ----
const byName = (n) => cases.find((x) => x.case === n);
const out = (n, an, id) => byOut(byName(n).expected, an)[id];

test('versions: the 23 cases of row 1.5a still apply to 0.1.0 and are untouched; the nine new cases apply to 0.1.1', () => {
  const old = cases.filter((c) => verOf(c) === '0.1.0'); const added = cases.filter((c) => verOf(c) === '0.1.1');
  assert.equal(old.length, 23); assert.equal(added.length, 9);
  for (const c of old) assert.equal('x-analyticVersion' in c.expected, false, c.case);
  assert.deepEqual(added.map((c) => c.case).sort(), [
    'conflicting-04-two-status-records-conflict', 'estimated-04-target-accept', 'estimated-05-target-needs-data',
    'estimated-06-target-choice-not-enabled', 'missing-09-no-antivenom-status-target-enabled', 'missing-10-antivenom-status-unknown',
    'missing-11-no-clotting-status-window-enabled', 'unit-conversion-03-target-in-hours', 'unit-conversion-04-window-in-hours',
  ]);
  for (const c of added) assert.equal(c.expected['x-analyticVersion'], '0.1.1');
});

test('0.1.1 hours cases: the hours value is compared only after the declared conversion, and the answer differs from the unconverted one', () => {
  const t = byName('unit-conversion-03-target-in-hours').expected; const w = byName('unit-conversion-04-window-in-hours').expected;
  assert.deepEqual(t.parameters.targetIntervalDuration.value, { amount: 2, unit: 'h' });
  assert.deepEqual(w.parameters.readTimeWindow.value, { amount: 1, unit: 'h' });
  assert.equal(A1.conversions[0].factor * 2, 120); assert.equal(B1.conversions[0].factor * 1, 60);
  const normal = byName('normal-01-all-enabled');
  // same record as normal-01; interval 90 and read time 20 min after start
  assert.deepEqual(byName('unit-conversion-03-target-in-hours').envelope.observations, normal.envelope.observations);
  assert.deepEqual(byName('unit-conversion-04-window-in-hours').envelope.observations, normal.envelope.observations);
  same(out('unit-conversion-03-target-in-hours', A.manifest.id, 'comparison'), { value: { label: 'within-target' } }); // 90 <= 120
  same(out('unit-conversion-04-window-in-hours', B.manifest.id, 'readTimeInWindow'), { value: { label: 'in-time' } }); // 20 <= 60
  // had the bare numbers been compared (2 against 90, 1 against 20) both answers would flip
  assert.ok(minutes(0, 90 * 60000) > 2 && minutes(0, 20 * 60000) > 1);
});

test('0.1.1 estimated cases: with the target enabled the comparison honours the certainty choice (finding F-1)', () => {
  const A_ = A.manifest.id;
  same(out('estimated-04-target-accept', A_, 'comparison'), { value: { label: 'within-target' } });
  same(out('estimated-05-target-needs-data', A_, 'comparison'), { state: 'needs-data' });
  same(out('estimated-06-target-choice-not-enabled', A_, 'comparison'), { state: 'parameter-not-enabled' });
  assert.deepEqual(out('estimated-06-target-choice-not-enabled', A_, 'comparison').dependsOnParameters, ['acceptedCertainty']);
  assert.deepEqual(out('estimated-06-target-choice-not-enabled', A_, 'interval').dependsOnParameters, ['acceptedCertainty']);
  for (const n of ['estimated-04-target-accept', 'estimated-05-target-needs-data', 'estimated-06-target-choice-not-enabled']) {
    const cmp = out(n, A_, 'comparison'); assert.ok(cmp.warnings.some((x) => /estimated/i.test(x)), `${n}: the estimate stays visible on the comparison`);
  }
  // all three certainty choices are now exercised: accept (01, 04), flag-only (02), needs-data (05), not enabled (03, 06)
  const est = cases.filter((c) => codeOf(c.envelope, 'biteTimeCertainty') === 'estimated');
  const choices = new Set(est.map((c) => pv(c.expected, 'acceptedCertainty')));
  for (const k of ['accept', 'flag-only', 'needs-data', undefined]) assert.ok(choices.has(k), `certainty choice ${k === undefined ? 'not enabled' : k} is exercised`);
});

test('0.1.1 missing cases: F7 absent or unknown with the target enabled is indeterminate for both outputs; F3 absent with the window enabled is needs-data (findings F-1, F-2)', () => {
  const A_ = A.manifest.id; const B_ = B.manifest.id;
  for (const n of ['missing-09-no-antivenom-status-target-enabled', 'missing-10-antivenom-status-unknown']) {
    assert.ok(byName(n).expected.parameters.targetIntervalDuration && byName(n).expected.parameters.edgeRule, `${n}: target and edge rule are enabled`);
    same(out(n, A_, 'interval'), { state: 'indeterminate' }); same(out(n, A_, 'comparison'), { state: 'indeterminate' });
  }
  assert.equal(stateOf(byName('missing-09-no-antivenom-status-target-enabled').envelope, 'antivenomStatus'), 'absent');
  assert.equal(stateOf(byName('missing-10-antivenom-status-unknown').envelope, 'antivenomStatus'), 'unknown');
  const m11 = 'missing-11-no-clotting-status-window-enabled';
  assert.equal(stateOf(byName(m11).envelope, 'clottingTestStatus'), 'absent');
  assert.ok(byName(m11).expected.parameters.readTimeWindow && byName(m11).expected.parameters.edgeRule, 'window and edge rule are enabled');
  assert.equal(stateOf(byName(m11).envelope, 'clottingTestStartTime'), 'present'); assert.equal(stateOf(byName(m11).envelope, 'clottingResultReadTime'), 'present');
  same(out(m11, B_, 'readTimeInWindow'), { state: 'needs-data' });
});

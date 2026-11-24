// CCIS decision-node walker (row 3.4b). Prototype. Synthetic data only. Not for clinical use.
//
// Pure: takes parsed JSON, never reads files, the clock, randomness or the network. No eval, no dynamic import.
//
//   walkPathway({ pathway, context }) -> { ok: true, route, results, trace } | { ok: false, refusal }
//
// - Walks the pathway's stages from the first one. A stage whose transition names a decision node (`via`) evaluates
//   that node against the 3.1 context; the route entry is { stage, node, outcome }. A terminal stage ends the route
//   with { stage }; an outcome that ends the pathway adds { end: true }.
// - A node tests the record only (D-018): each condition names an input and one of the epistemic states. Present
//   means a record exists and says nothing about the value. A field's records are found by concept, never by
//   position. No record is `absent`; more than one is `conflicting`, even if they agree (D-048). Entered-in-error
//   records are ignored.
// - No outcome matches: state `indeterminate`, outcome null, and the route stops at the report stage (D-053). Two
//   outcomes match: the whole pathway is refused. Unknown never routes as false or normal.
// - Results are classification run results (D-054): camelCase outputId from the node id, extensions `x-node`,
//   `x-outcome`, `x-pathway`. Wording comes from the tables below because the schema has no node kind.
// - `trace` (new) is the rule trace, one entry per node visited: the states found, record counts and ids (never
//   values), every outcome considered in package order with each test and whether it passed, and the outcome taken.
//   It is a separate member; the run-result schema is unchanged. Row 3.5 puts it in the run record.
// - A node outcome is descriptive, never a recommendation. Refusals use fixed sentences and never echo input.
// - Same input gives byte-identical output; nothing passed in is changed.

import { pathway as vPathway, runResult as vResult } from './ccis/validators/ccis-validators.js';

export const WALKER_VERSION = '0.1.0';
const CONTEXT_FORM = 'ccis-context/1';

export const WALK_REFUSALS = Object.freeze([
  ['W-001', 'The pathway does not conform to its schema.'],
  ['W-002', 'The context is not a ccis-context/1 object.'],
  ['W-003', 'Two stages or two nodes of the pathway share an id.'],
  ['W-004', 'A transition, outcome or node input names a stage, node, element or input the pathway does not declare.'],
  ['W-005', 'A stage mixes plain and node transitions, or uses more than one node.'],
  ['W-006', 'The stages of the pathway loop back.'],
  ['W-007', 'More than one outcome of a node matches the same record.'],
  ['W-008', 'An outcome leads to a stage that no transition allows.'],
].map(([id, meaning]) => Object.freeze({ id, meaning })));
const MEANING = new Map(WALK_REFUSALS.map((r) => [r.id, r.meaning]));

class Refusal extends Error {
  constructor(id) { super(id); this.refusalId = id; }
}
const fail = (id) => { throw new Refusal(id); };

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const camel = (id) => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const words = (field) => field.replace(/[A-Z]/g, (c) => ' ' + c.toLowerCase());
const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const OUT_OF_SCOPE = new Set(['explicitly-negative', 'not-applicable']);

function check(pathway) {
  const stages = new Set(pathway.stages.map((s) => s.id));
  if (stages.size !== pathway.stages.length) fail('W-003');
  const nodes = new Map();
  for (const n of pathway.nodes ?? []) { if (nodes.has(n.id)) fail('W-003'); nodes.set(n.id, n); }
  const elements = new Set(pathway.elements.map((e) => e.id));
  const transitions = pathway.transitions ?? [];
  for (const t of transitions) {
    if (!stages.has(t.from) || !stages.has(t.to)) fail('W-004');
    if (t.via !== undefined && !nodes.has(t.via)) fail('W-004');
  }
  for (const n of nodes.values()) {
    const keys = new Set(n.inputs.map((i) => i.key));
    if (n.inputs.some((i) => !elements.has(i.element))) fail('W-004');
    for (const o of n.outcomes) {
      if (o.when.some((c) => !keys.has(c.input))) fail('W-004');
      if ('stage' in o.next && !stages.has(o.next.stage)) fail('W-004');
    }
  }
  return { nodes, transitions };
}

// The state of one field in the record, found by concept. Records are counted, never read for their value.
function readField(context, element, field) {
  const concept = `${element}.${kebab(field)}`;
  const found = context.observations.filter((o) => isObj(o) && isObj(o.concept) && o.concept.id === concept && o.status !== 'entered-in-error');
  const recordIds = found.map((o) => o.id).filter((id) => typeof id === 'string').sort(byId);
  if (found.length === 0) return { concept, state: 'absent', records: 0, recordIds };
  if (found.length > 1) return { concept, state: 'conflicting', records: found.length, recordIds };
  return { concept, state: found[0].state ?? 'present', records: 1, recordIds };
}

function nodeResult(pathway, node, outcome, reads) {
  const warnings = [];
  const missing = [];
  let state;
  let value;
  if (outcome === null) {
    state = 'indeterminate';
    missing.push('No outcome of this node covers the recorded states, so no branch was taken.');
  } else if (outcome.kind === 'answer') {
    if (outcome.when.some((c) => OUT_OF_SCOPE.has(c.is))) {
      state = 'not-applicable';
      warnings.push('The record explicitly says this step did not happen or does not apply, so it is out of scope here. This is not a missing value.');
    } else value = { label: outcome.id };
  } else if (outcome.kind === 'missing-data') {
    state = 'needs-data';
    missing.push(outcome.note ?? 'Data this node needs is not documented.');
  } else {
    state = outcome.kind === 'conflicting' ? 'conflict' : 'indeterminate';
    for (const c of outcome.when) {
      if (c.is === 'present') continue;
      const field = node.inputs.find((i) => i.key === c.input).field;
      if (outcome.kind === 'conflicting') warnings.push(`Two records disagree about ${words(field)}.`);
      else missing.push(`The record for ${words(field)} is ${reads.get(c.input).state}.`);
    }
  }
  const res = {
    outputId: camel(node.id), kind: 'classification', warnings,
    limitations: node.preconditions?.length ? [...node.preconditions] : ['This describes the record only.'],
    missingDataNotes: missing, 'x-node': node.id, 'x-outcome': outcome === null ? null : outcome.id, 'x-pathway': pathway.manifest.id,
  };
  if (state) res.state = state; else res.value = value;
  if (vResult(res) !== true) throw new Error('defect: the walker built a result that fails its schema');
  return res;
}

function traceEntry(node, reads, tested, outcome) {
  return {
    node: node.id,
    inputs: node.inputs.map((i) => { const r = reads.get(i.key); return { key: i.key, concept: r.concept, state: r.state, records: r.records, recordIds: [...r.recordIds] }; }),
    outcomes: tested,
    taken: outcome === null ? null : outcome.id,
  };
}

export function walkPathway({ pathway, context } = {}) {
  try {
    if (!isObj(pathway) || vPathway(pathway) !== true) fail('W-001');
    if (!isObj(context) || context.contextForm !== CONTEXT_FORM || !Array.isArray(context.observations)) fail('W-002');
    const { nodes, transitions } = check(pathway);
    const route = [];
    const results = [];
    const trace = [];
    const seen = new Set();
    let stage = pathway.stages[0].id;
    for (;;) {
      if (seen.has(stage)) fail('W-006');
      seen.add(stage);
      const out = transitions.filter((t) => t.from === stage);
      if (out.length === 0) { route.push({ stage }); break; }
      const via = new Set(out.map((t) => t.via));
      if (via.has(undefined)) {
        if (out.length !== 1) fail('W-005');
        route.push({ stage }); stage = out[0].to; continue;
      }
      if (via.size !== 1) fail('W-005');
      const node = nodes.get(out[0].via);
      const reads = new Map(node.inputs.map((i) => [i.key, readField(context, i.element, i.field)]));
      const tested = node.outcomes.map((o) => {
        const tests = o.when.map((c) => ({ input: c.input, is: c.is, found: reads.get(c.input).state, passed: reads.get(c.input).state === c.is }));
        return { id: o.id, matched: tests.every((t) => t.passed), tests };
      });
      const hit = node.outcomes.filter((o, i) => tested[i].matched);
      if (hit.length > 1) fail('W-007');
      const outcome = hit[0] ?? null;
      route.push({ stage, node: node.id, outcome: outcome === null ? null : outcome.id });
      results.push(nodeResult(pathway, node, outcome, reads));
      trace.push(traceEntry(node, reads, tested, outcome));
      if (outcome === null) { const gap = pathway.stages.find((s) => s.kind === 'report'); if (gap) route.push({ stage: gap.id }); break; }
      if ('end' in outcome.next) { route.push({ end: true }); break; }
      if (!out.some((t) => t.to === outcome.next.stage)) fail('W-008');
      stage = outcome.next.stage;
    }
    return { ok: true, route, results, trace };
  } catch (e) {
    if (e instanceof Refusal) return { ok: false, refusal: { id: e.refusalId, meaning: MEANING.get(e.refusalId) } };
    throw e;
  }
}

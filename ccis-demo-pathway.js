// DEMO RUNNER: replaced by rows 2.x and 3.x.
// Prototype. Synthetic data only. Not for clinical use.
//
// Demo pathway evaluator (row DS2b). Pure: no clock read, randomness, network, file access, eval or dynamic import.
//
//   evaluatePathway(pathway, envelope) -> { ok: true, route: [...], results: [run results] } | { ok: false, refusal }
//
// - Walks the pathway's stages from the first one, using its transitions. A stage whose transition names a decision
//   node (`via`) evaluates that node against the envelope; the route entry is { stage, node, outcome }. A terminal
//   stage ends the route with { stage }; an outcome that ends the pathway adds { end: true }.
// - A node tests the record only (D-018): each condition names an input and one of the epistemic states. Present
//   means a record exists, it says nothing about the value. More than one record for a field is `conflicting`
//   (D-048). Entered-in-error records are ignored.
// - Outcome kinds map to run results (classification kind, camelCase outputId from the node id):
//     answer        -> value { label: outcome id }, or state `not-applicable` when the record explicitly says the step
//                      did not happen or is not applicable (out of scope, not a missing value)
//     missing-data  -> state `needs-data`, with the outcome's own note
//     conflicting   -> state `conflict`, with a warning
//     indeterminate -> state `indeterminate`, with a note
// - No outcome matches: state `indeterminate`, outcome null, and the route stops at the report stage. Never a
//   continuation as if documented (D-053). Two outcomes match: the whole pathway is refused.
// - A node outcome is descriptive, never a recommendation. Unknown never routes as false or normal.
// - Refusals use fixed sentences and never echo input content.

import { pathway as vPathway, contextEnvelope as vEnvelope, runResult as vResult } from './ccis/validators/ccis-validators.js';

class Refusal extends Error {}
const refuse = (sentence) => { throw new Refusal(sentence); };
const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const camel = (id) => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const words = (field) => field.replace(/[A-Z]/g, (c) => ' ' + c.toLowerCase());
const OUT_OF_SCOPE = new Set(['explicitly-negative', 'not-applicable']);

function check(pathway) {
  const stages = new Set(pathway.stages.map((s) => s.id));
  const nodes = new Map();
  for (const n of pathway.nodes ?? []) { if (nodes.has(n.id)) refuse('pathway refused: two nodes share an id'); nodes.set(n.id, n); }
  const elements = new Set(pathway.elements.map((e) => e.id));
  if (stages.size !== pathway.stages.length) refuse('pathway refused: two stages share an id');
  const transitions = pathway.transitions ?? [];
  for (const t of transitions) {
    if (!stages.has(t.from) || !stages.has(t.to)) refuse('pathway refused: a transition names a stage the pathway does not declare');
    if (t.via !== undefined && !nodes.has(t.via)) refuse('pathway refused: a transition names a node the pathway does not declare');
  }
  for (const n of nodes.values()) {
    const keys = new Set(n.inputs.map((i) => i.key));
    if (n.inputs.some((i) => !elements.has(i.element))) refuse('pathway refused: a node reads an element the pathway does not list');
    for (const o of n.outcomes) {
      if (o.when.some((c) => !keys.has(c.input))) refuse('pathway refused: an outcome tests an input the node does not declare');
      if ('stage' in o.next && !stages.has(o.next.stage)) refuse('pathway refused: an outcome leads to a stage the pathway does not declare');
    }
  }
  return { nodes, transitions };
}

function stateOf(envelope, element, field) {
  const concept = `${element}.${kebab(field)}`;
  const obs = envelope.observations.filter((o) => o.status !== 'entered-in-error' && o.concept.id === concept);
  if (obs.length === 0) return 'absent';
  if (obs.length > 1) return 'conflicting';
  return obs[0].state ?? 'present';
}

function nodeResult(pathway, node, outcome, states) {
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
      else missing.push(`The record for ${words(field)} is ${states.get(c.input)}.`);
    }
  }
  const res = {
    outputId: camel(node.id), kind: 'classification', warnings,
    limitations: node.preconditions?.length ? [...node.preconditions] : ['This describes the record only.'],
    missingDataNotes: missing, 'x-node': node.id, 'x-outcome': outcome === null ? null : outcome.id, 'x-pathway': pathway.manifest.id,
  };
  if (state) res.state = state; else res.value = value;
  if (vResult(res) !== true) throw new Error('defect: the pathway evaluator built a result that fails its schema');
  return res;
}

export function evaluatePathway(pathway, envelope) {
  try {
    if (typeof pathway !== 'object' || pathway === null || vPathway(pathway) !== true) refuse('pathway refused: does not conform to its schema');
    if (typeof envelope !== 'object' || envelope === null || vEnvelope(envelope) !== true) refuse('envelope refused: does not conform to the context envelope schema');
    const { nodes, transitions } = check(pathway);
    const route = [];
    const results = [];
    const seen = new Set();
    let stage = pathway.stages[0].id;
    for (;;) {
      if (seen.has(stage)) refuse('pathway refused: the stages loop back');
      seen.add(stage);
      const out = transitions.filter((t) => t.from === stage);
      if (out.length === 0) { route.push({ stage }); break; }
      const via = new Set(out.map((t) => t.via));
      if (via.has(undefined)) {
        if (out.length !== 1) refuse('pathway refused: a stage mixes plain and node transitions');
        route.push({ stage }); stage = out[0].to; continue;
      }
      if (via.size !== 1) refuse('pathway refused: a stage uses more than one node');
      const node = nodes.get(out[0].via);
      const states = new Map(node.inputs.map((i) => [i.key, stateOf(envelope, i.element, i.field)]));
      const hit = node.outcomes.filter((o) => o.when.every((c) => states.get(c.input) === c.is));
      if (hit.length > 1) refuse('pathway refused: more than one outcome of a node matches the same record');
      const outcome = hit[0] ?? null;
      route.push({ stage, node: node.id, outcome: outcome === null ? null : outcome.id });
      results.push(nodeResult(pathway, node, outcome, states));
      if (outcome === null) { const gap = pathway.stages.find((s) => s.kind === 'report'); if (gap) route.push({ stage: gap.id }); break; }
      if ('end' in outcome.next) { route.push({ end: true }); break; }
      if (!out.some((t) => t.to === outcome.next.stage)) refuse('pathway refused: an outcome leads to a stage no transition allows');
      stage = outcome.next.stage;
    }
    return { ok: true, route, results };
  } catch (err) {
    if (err instanceof Refusal) return { ok: false, refusal: err.message };
    throw err;
  }
}

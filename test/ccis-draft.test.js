// Row 4.3: the AI drafting gate. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as draft from '../ccis-draft.js';

const { draftRequest, acceptDraft, DraftError } = draft;
const SRC = { id: 'src-1', kind: 'guideline', citation: 'Synthetic guideline', passage: 'A synthetic passage.' };
const REQ = { enabled: true, artefactType: 'analytics-package', standardVersion: '0.1.0', instruction: 'Draft it.', sources: [SRC], terminology: [] };
const doc = () => JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-interval.analytics.json', import.meta.url), 'utf8'));
const reply = (artefact = doc(), extra = {}) => ({
  artefact, trace: Object.keys(artefact).filter((k) => k !== 'manifest').map((member) => ({ member, source: 'src-1' })), assumptions: [], ...extra,
});
const ctx = { artefactType: 'analytics-package', sources: [SRC] };
const refused = (fn, code, path) => {
  try { fn(); } catch (e) { assert.ok(e instanceof DraftError); assert.equal(e.code, code); if (path !== undefined) assert.equal(e.path, path); return e; }
  assert.fail('not refused');
};

test('4.3: off by default; only a true switch builds, frozen', () => {
  const { enabled, ...off } = REQ;
  for (const v of [undefined, false, 'true', 1, null]) refused(() => draftRequest({ ...off, enabled: v }), 'AI-001');
  refused(() => draftRequest(off), 'AI-001');
  const p = draftRequest(REQ);
  assert.ok(Object.isFrozen(p) && !('enabled' in p) && draft.AI_ENABLED_DEFAULT === false);
});

test('4.3: whitelist: no context, run record, patient or x- member; unknown type refused', () => {
  for (const k of ['context', 'runRecord', 'patient', 'x-note']) refused(() => draftRequest({ ...REQ, [k]: {} }), 'AI-002', k);
  for (const bad of ['pathways', 'toString', 5]) refused(() => draftRequest({ ...REQ, artefactType: bad }), 'AI-003', 'artefactType');
});

test('4.3: bounds on sources, passage and instruction', () => {
  refused(() => draftRequest({ ...REQ, sources: [] }), 'AI-003', 'sources');
  refused(() => draftRequest({ ...REQ, sources: Array(21).fill(SRC) }), 'AI-003', 'sources');
  refused(() => draftRequest({ ...REQ, sources: [{ ...SRC, passage: 'x'.repeat(2001) }] }), 'AI-003', 'sources.0.passage');
  refused(() => draftRequest({ ...REQ, instruction: 'x'.repeat(2001) }), 'AI-003', 'instruction');
});

test('4.3: a valid analytics draft is accepted with the label, draft status and AI-proposed class', () => {
  const a = acceptDraft(reply(), ctx);
  assert.equal(a.status, 'draft');
  assert.equal(a.sourceClass, 'AI-proposed');
  assert.equal(a.label, draft.DRAFT_LABEL);
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.artefact) && Object.isFrozen(a.assumptions));
});

test('4.3: a draft cannot be validated or carry a validation record', () => {
  const v = doc(); v.manifest.status = 'validated';
  refused(() => acceptDraft(reply(v), ctx), 'AI-004');
  const w = doc(); w.manifest.validation = { version: '0.1.0', population: 'p', setting: 's', intendedUse: 'u' };
  refused(() => acceptDraft(reply(w), ctx), 'AI-004');
});

test('4.3: every member needs a supplied source or a named assumption', () => {
  const r = reply(); r.trace = r.trace.filter((t) => t.member !== 'question');
  refused(() => acceptDraft(r, ctx), 'AI-005', 'question');
  const ok = acceptDraft({ ...r, assumptions: [{ member: 'question', note: 'Not sourced.' }] }, ctx);
  assert.deepEqual(ok.assumptions, [{ member: 'question', note: 'Not sourced.' }]);
  const bad = reply(); bad.trace[0].source = 'src-9';
  refused(() => acceptDraft(bad, ctx), 'AI-005', 'trace.0.source');
});

test('4.3: SDK refusals pass through with their code and path', () => {
  const d = doc(); d.computation[0].expr = { literal: 30 };
  const e = refused(() => acceptDraft(reply(d), ctx), 'AI-006', 'artefact.computation.0.expr.literal');
  assert.equal(e.sdkCode, 'S-003');
});

test('4.3: hostile text never in a message; module is pure and cannot publish, validate or approve', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const d = doc(); d.question = evil; d.outputs[0].kind = evil;
  assert.ok(!String(refused(() => acceptDraft(reply(d), ctx), 'AI-006').message).includes(evil));
  assert.ok(!String(refused(() => draftRequest({ ...REQ, [evil]: 1 }), 'AI-002').message).includes(evil));
  for (const k of Object.keys(draft)) assert.ok(!/publish|validate|approve/i.test(k), k);
  const src = readFileSync(new URL('../ccis-draft.js', import.meta.url), 'utf8');
  assert.ok(!/\b(eval|Function|Date\.now|Math\.random|fetch|readFile|import\()/.test(src.replace(/^import .*$/gm, '')));
});

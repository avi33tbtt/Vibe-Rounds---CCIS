// Row ECO-B18: contract fixtures part 1 (elements, group, second owner, compose report). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArtefact } from '../ccis-validator.js';
import { conceptOwners } from '../ccis-concept-owners.js';
import { conflictReport } from '../ccis-compose.js';
import { canonicalize, compareRoutes } from '../ccis-compile.js';
import { elementGroup } from '../ccis-sdk-group.js';
import { emptyMarket, publishArtefact, M_REFUSALS } from '../ccis-market.js';

const dir = new URL('../ccis/fixtures/contract/', import.meta.url);
const text = (f) => readFileSync(new URL(f, dir), 'utf8');
const doc = (f) => JSON.parse(text(f));
const core = doc('core-vitals.element.json');
const htn = doc('htn-core.element.json');
const dup = doc('second-owner.element.json');
const group = doc('contract.group.json');
const expected = doc('expected.json');
const rows = (r) => Object.values(r.layers).flatMap((l) => l.diagnostics);

test('B18: the three good artefacts pass every layer with no error row', () => {
  for (const [d, known] of [[core, []], [htn, [core]], [group, [core, htn]]]) {
    const r = validateArtefact(d, { known });
    assert.equal(r.outcome, 'no-errors-so-far', d.manifest.id);
    assert.equal(rows(r).filter((x) => x.severity === 'error').length, 0);
  }
});

test('B18: the group file is identical to the builder output', () => {
  const r = compareRoutes([{ name: 'json', input: text('contract.group.json') }, { name: 'code', input: elementGroup(group) }]);
  assert.equal(r.identical, true);
  assert.equal(group.sharedConcepts[0].owner.element, 'core.vitals');
});

test('B18: the owner map equals the hand-calculated one: one owner, one user', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(conceptOwners([core, htn]))), expected.ownerMap);
});

test('B18: the conflict report equals the hand-calculated one, byte for byte', () => {
  const p1 = { elements: [{ id: 'core.vitals' }] };
  const p2 = { elements: [{ id: 'core.vitals' }, { id: 'htn.core' }] };
  const report = conflictReport([p1, p2], [core, htn]);
  const a = canonicalize(report), b = canonicalize(expected.conflictReport);
  assert.equal(a.ok && b.ok, true);
  assert.equal(a.text, b.text);
});

test('B18: a second owner is V5-028, a warning, and an error under strict ownership', () => {
  const find = (r) => rows(r).filter((x) => x.ruleId === expected.secondOwner.ruleId);
  const loose = validateArtefact(dup, { known: [core, htn] });
  assert.equal(find(loose).length, 1);
  assert.equal(find(loose)[0].severity, expected.secondOwner.severity);
  assert.equal(loose.outcome, 'no-errors-so-far');
  const strict = validateArtefact(dup, { known: [core, htn], strictOwnership: true });
  assert.equal(find(strict)[0].severity, expected.secondOwner.severityStrict);
  assert.equal(strict.outcome, 'failed');
  assert.equal(conceptOwners([core, htn, dup]).find((c) => c.concept === 'systolic-pressure').status, expected.secondOwner.ownerStatus);
});

test('B18: the market refuses the second owner with M-014, ids and codes only; the market is unchanged', () => {
  const pub = (market, artefact) => publishArtefact({ market, artefact });
  const a = pub(emptyMarket(), core);
  assert.equal(a.ok, true, JSON.stringify(a.refusal));
  const b = pub(a.market, htn);
  assert.equal(b.ok, true, JSON.stringify(b.refusal));
  const before = JSON.stringify(b.market);
  const r = pub(b.market, dup);
  assert.equal(r.ok, false);
  assert.equal(r.refusal.id, expected.secondOwner.marketRefusal.code);
  assert.equal(r.refusal.reason, M_REFUSALS.find((x) => x.id === 'M-014').sentence);
  assert.deepEqual(r.refusal.detail, { concepts: expected.secondOwner.marketRefusal.concepts, elements: expected.secondOwner.marketRefusal.elements });
  assert.equal(JSON.stringify(b.market), before);
});

test('B18: every fixture is synthetic, LF-only, in sorted-key form; no identity or narrative member', () => {
  const sorted = (x) => (Array.isArray(x) ? x.map(sorted) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sorted(x[k])])) : x);
  for (const f of ['core-vitals.element.json', 'htn-core.element.json', 'second-owner.element.json', 'contract.group.json']) {
    const t = text(f);
    assert.equal(t.includes('\r'), false, f);
    assert.equal(t, JSON.stringify(sorted(JSON.parse(t)), null, 2) + '\n', f);
    assert.equal(JSON.parse(t).manifest.publisher.name, 'Synthetic test publisher');
    assert.equal(/"(patientName|dateOfBirth|dob|nhsNumber|narrative)"/i.test(t), false, f);
  }
});

// Row ECO-B5: pathway entryForm and contexts (schema only). Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathway } from '../ccis/validators/ccis-validators.js';

const snake = () => JSON.parse(readFileSync(new URL('../ccis/examples/snake/snake-documentation.pathway.json', import.meta.url), 'utf8'));
const base = () => {
  const p = snake();
  p.entryForm = { sections: [
    { id: 'history', label: 'History', items: [
      { kind: 'element', element: 'snake.envenomation-timing', fields: ['biteTime'], rowGroups: [['biteTime']], visibleByDefault: true },
      { kind: 'section', section: 'core.problems', visibleByDefault: true },
    ] },
  ] };
  p.contexts = [{ id: 'envenomation', label: 'Envenomation', elements: ['snake.envenomation-timing'] }];
  return p;
};
const ok = (p) => pathway(p) === true;
const mutate = (fn) => { const p = base(); fn(p); return p; };
const sec = (p) => p.entryForm.sections[0];
const el = (p) => sec(p).items[0];
const sc = (p) => sec(p).items[1];

test('1 a pathway with a valid entryForm and contexts passes', () => {
  assert.equal(ok(base()), true, JSON.stringify(pathway.errors));
});

test('2 the snake example pathway (no entryForm) still passes unchanged', () => {
  assert.equal(ok(snake()), true, JSON.stringify(pathway.errors));
});

test('3 an unknown property is refused on section, item and context; an x- property is accepted', () => {
  assert.equal(ok(mutate((p) => { sec(p).note = 'n'; })), false);
  assert.equal(ok(mutate((p) => { el(p).note = 'n'; })), false);
  assert.equal(ok(mutate((p) => { p.contexts[0].note = 'n'; })), false);
  assert.equal(ok(mutate((p) => { sec(p)['x-note'] = 'n'; el(p)['x-note'] = 'n'; p.contexts[0]['x-note'] = 'n'; })), true);
});

test('4 a wrong kind, or an element item without element, is refused', () => {
  assert.equal(ok(mutate((p) => { el(p).kind = 'group'; })), false);
  assert.equal(ok(mutate((p) => { delete el(p).element; })), false);
  assert.equal(ok(mutate((p) => { delete sc(p).section; })), false);
});

test('5 a section item carrying fields or rowGroups is refused', () => {
  assert.equal(ok(mutate((p) => { sc(p).fields = ['a']; })), false);
  assert.equal(ok(mutate((p) => { sc(p).rowGroups = [['a']]; })), false);
});

test('6 empty sections, items, fields, row groups, contexts or context elements are refused', () => {
  assert.equal(ok(mutate((p) => { p.entryForm.sections = []; })), false);
  assert.equal(ok(mutate((p) => { sec(p).items = []; })), false);
  assert.equal(ok(mutate((p) => { el(p).fields = []; })), false);
  assert.equal(ok(mutate((p) => { el(p).rowGroups = [[]]; })), false);
  assert.equal(ok(mutate((p) => { p.contexts = []; })), false);
  assert.equal(ok(mutate((p) => { p.contexts[0].elements = []; })), false);
});

test('7 bad ids, a bad section name and a non-text label are refused', () => {
  assert.equal(ok(mutate((p) => { sec(p).id = 'Bad Id'; })), false);
  assert.equal(ok(mutate((p) => { p.contexts[0].id = 'Diabetes'; })), false);
  assert.equal(ok(mutate((p) => { sc(p).section = 'Core Problems'; })), false);
  assert.equal(ok(mutate((p) => { sec(p).label = 7; })), false);
  assert.equal(ok(mutate((p) => { el(p).element = 'A One'; })), false);
});

test('8 generated validators equal a fresh build', () => {
  const r = spawnSync(process.execPath, ['scripts/build-validators.js', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Row 3.8: the pure SHA-256 equals node:crypto. Prototype. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash as nodeHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createHash } from '../ccis-sha256.js';

const mine = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const node = (s) => nodeHash('sha256').update(s, 'utf8').digest('hex');

test('equals node:crypto at the padding edges', () => {
  const lengths = [0, 1, 55, 56, 63, 64, 65, 119, 120, 121];
  for (const n of lengths) assert.equal(mine('a'.repeat(n)), node('a'.repeat(n)), `length ${n}`);
});

test('equals node:crypto on multi-byte UTF-8 including a surrogate pair and a lone surrogate', () => {
  for (const s of ['é', '日本語', 'x\u{1F40D}y', 'lone\uD800end']) assert.equal(mine(s), node(s));
});

test('equals node:crypto on a 1 MB string', () => {
  const s = 'snake-0123456789\n'.repeat(62000);
  assert.ok(s.length > 1000000);
  assert.equal(mine(s), node(s));
});

test('known vector', () => {
  assert.equal(mine('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('rejects other shapes rather than guessing', () => {
  assert.throws(() => createHash('md5'));
  assert.throws(() => createHash('sha256').update('x', 'latin1'));
  assert.throws(() => createHash('sha256').digest('base64'));
});

test('imports nothing from Node and touches no DOM', () => {
  const src = readFileSync(new URL('../ccis-sha256.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/\bimport\b|require\(|node:|process\.|Buffer|document\.|window\./.test(src));
});

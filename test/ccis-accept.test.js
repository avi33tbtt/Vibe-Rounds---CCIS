// Row 3.11: the one-command slice acceptance (scripts/accept.js, `npm run accept`). Prototype. Synthetic data only. Not for clinical use.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STEPS = ['app-page', 'import', 'compat', 'run-oracle', 'rerun', 'show'];
const tmp = mkdtempSync(join(tmpdir(), 'ccis-accept-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const accept = (...args) => spawnSync(process.execPath, ['scripts/accept.js', ...args], { encoding: 'utf8' });

test('the script passes: six steps, each named once, in order, ending with the PASS line', () => {
  const r = accept();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stderr, '');
  assert.deepEqual(r.stdout.trim().split('\n'), [...STEPS.map((s) => `ok  ${s}`), 'ACCEPTANCE: PASS (6/6)']);
});

test('two runs in two processes print the same thing', () => {
  const a = accept();
  const b = accept();
  assert.equal(a.status, 0);
  assert.equal(a.stdout, b.stdout);
});

test('a market with one changed byte fails the script: exit 1, a FAIL line and no PASS', () => {
  const copy = join(tmp, 'market');
  cpSync('market', copy, { recursive: true });
  const file = join(copy, 'artefacts/snake.envenomation-timing/0.1.0.json');
  writeFileSync(file, `${readFileSync(file, 'utf8')} `);
  const r = accept('--market', copy);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^FAIL import: exit \d+ \(M-010\)$/m);
  assert.match(r.stdout, /^ACCEPTANCE: FAIL \(1\/6\)$/m);
  assert.equal(/PASS/.test(r.stdout), false);
  assert.equal(r.stdout.includes(tmp), false, 'a temp path was printed');
});

test('the script source has no network, eval, clock or randomness', () => {
  const src = readFileSync('scripts/accept.js', 'utf8');
  for (const bad of [/\bfetch\b/, /\bhttps?\b/, /\beval\b/, /\bFunction\b/, /\bDate\b/, /Math\.random/, /\brequire\b/]) assert.equal(bad.test(src), false, `forbidden: ${bad}`);
});

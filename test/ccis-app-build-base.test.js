// Row 4.1a: the opt-in distribution build (--market-base with --out). Prototype. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp, main } from '../scripts/build-app.js';

const PAGE = new URL('../index.html', import.meta.url);
const BASE = 'https://example.test/market/';
const FIXED = 'market base is not acceptable';
const csp = (h) => /Content-Security-Policy" content="([^"]*)"/.exec(h)[1];
const directive = (c, n) => c.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${n} `)) ?? '';
const dir = mkdtempSync(join(tmpdir(), 'ccis-base-'));
const committed = readFileSync(PAGE, 'utf8');
const quiet = (fn) => { const l = console.log, e = console.error; console.log = () => {}; console.error = () => {}; try { return fn(); } finally { console.log = l; console.error = e; } };
test.after(() => rmSync(dir, { recursive: true, force: true }));

test('the default build equals the committed page and keeps connect-src none', () => {
  const d = buildApp();
  assert.equal(d, committed);
  assert.equal(directive(csp(d), 'connect-src'), "connect-src 'none'");
});

test('with a base, connect-src is exactly that base, once; every other directive equals the default', () => {
  const c = csp(buildApp({ marketBase: BASE }));
  assert.equal(directive(c, 'connect-src'), `connect-src ${BASE}`);
  assert.equal(c.split(BASE).length, 2);
  const strip = (x) => x.split(';').map((s) => s.trim()).filter((s) => !s.startsWith('connect-src ')).join(';');
  assert.equal(strip(c), strip(csp(buildApp())));
});

test('putting the one directive back to none makes the distribution build byte-identical to the default', () => {
  assert.equal(buildApp({ marketBase: BASE }).replace(`connect-src ${BASE}`, "connect-src 'none'"), buildApp());
});

test('unacceptable bases throw the fixed text and never quote the input', () => {
  for (const b of ['http://a.test/', 'https://u:p@a.test/', 'https://a.test/?q=1', 'https://a.test/#f', 'https://a.test/market', 'https://*', 'https://*.example.test/', 'https://a.test/; script-src *', 'https://a.test/a b/']) {
    assert.throws(() => buildApp({ marketBase: b }), (e) => e.message === FIXED, b);
  }
});

test('main: a base without --out returns 1 and writes nothing; with --out it writes the base', () => {
  const out = join(dir, 'dist.html');
  assert.equal(quiet(() => main(['--market-base', BASE])), 1);
  assert.equal(readFileSync(PAGE, 'utf8'), committed);
  assert.equal(quiet(() => main(['--market-base', BASE, '--out', out])), 0);
  assert.ok(readFileSync(out, 'utf8').includes(`connect-src ${BASE}`));
  assert.equal(quiet(() => main(['--market-base', 'http://a.test/', '--out', join(dir, 'bad.html')])), 1);
});

test('--check with both options passes, and fails after one byte changes', () => {
  const out = join(dir, 'check.html');
  quiet(() => main(['--market-base', BASE, '--out', out]));
  assert.equal(quiet(() => main(['--market-base', BASE, '--out', out, '--check'])), 0);
  writeFileSync(out, readFileSync(out, 'utf8').replace('<html', '<html '));
  assert.equal(quiet(() => main(['--market-base', BASE, '--out', out, '--check'])), 1);
});

test('the distribution CSP has no wildcard, unsafe, data or blob source and keeps default-src none', () => {
  const c = csp(buildApp({ marketBase: BASE }));
  assert.ok(!/\*|unsafe-|data:|blob:/.test(c));
  assert.equal(directive(c, 'default-src'), "default-src 'none'");
});

test('the committed page is never touched by these builds', () => {
  assert.equal(readFileSync(PAGE, 'utf8'), committed);
});

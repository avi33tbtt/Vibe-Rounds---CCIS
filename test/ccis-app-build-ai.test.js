// Row 4.3a.1: the opt-in distribution build for the model API origin (--ai-origin with --out). Prototype. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp, main } from '../scripts/build-app.js';
import { AI_ORIGIN } from '../ccis-app-ai.js';

const PAGE = new URL('../index.html', import.meta.url);
const BASE = 'https://example.test/market/';
const FIXED = 'ai origin is not acceptable';
const csp = (h) => /Content-Security-Policy" content="([^"]*)"/.exec(h)[1];
const directive = (c, n) => c.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${n} `)) ?? '';
const strip = (x) => x.split(';').map((s) => s.trim()).filter((s) => !s.startsWith('connect-src ')).join(';');
const dir = mkdtempSync(join(tmpdir(), 'ccis-ai-'));
const committed = readFileSync(PAGE, 'utf8');
const quiet = (fn) => { const l = console.log, e = console.error; console.log = () => {}; console.error = () => {}; try { return fn(); } finally { console.log = l; console.error = e; } };
test.after(() => rmSync(dir, { recursive: true, force: true }));

test('the default build equals the committed page and keeps connect-src none', () => {
  const d = buildApp();
  assert.equal(d, committed);
  assert.equal(directive(csp(d), 'connect-src'), "connect-src 'none'");
});

test('with the origin, connect-src is exactly it, once; the rest equals the default build', () => {
  const page = buildApp({ aiOrigin: AI_ORIGIN });
  const c = csp(page);
  assert.equal(directive(c, 'connect-src'), `connect-src ${AI_ORIGIN}`);
  assert.equal(c.split(AI_ORIGIN).length, 2);
  assert.equal(strip(c), strip(csp(buildApp())));
  assert.equal(page.replace(`connect-src ${AI_ORIGIN}`, "connect-src 'none'"), committed);
});

test('with both options the order is market base then origin; the base alone is the 4.1a result', () => {
  assert.equal(directive(csp(buildApp({ marketBase: BASE, aiOrigin: AI_ORIGIN })), 'connect-src'), `connect-src ${BASE} ${AI_ORIGIN}`);
  assert.equal(directive(csp(buildApp({ marketBase: BASE })), 'connect-src'), `connect-src ${BASE}`);
});

test('any other origin throws the fixed text', () => {
  const bad = ['http://api.anthropic.com', 'https://api.anthropic.com/', 'https://api.anthropic.com/v1/messages', 'https://api.anthropic.com.evil.test',
    'https://*.anthropic.com', '*', '', 'https://api.anthropic.com x', 'https://api.anthropic.com; script-src *', null, 5];
  for (const o of bad) assert.throws(() => buildApp({ aiOrigin: o }), (e) => e.message === FIXED, String(o));
});

test('main: the flag needs --out; a bad or missing origin writes nothing', () => {
  const out = join(dir, 'a.html');
  assert.equal(quiet(() => main(['--ai-origin', AI_ORIGIN])), 1);
  assert.equal(quiet(() => main(['--ai-origin', AI_ORIGIN, '--market-base', BASE])), 1);
  assert.equal(quiet(() => main(['--ai-origin', 'https://evil.test', '--out', out])), 1);
  assert.equal(quiet(() => main(['--out', out, '--ai-origin'])), 1);
  assert.equal(existsSync(out), false);
  assert.equal(quiet(() => main(['--ai-origin', AI_ORIGIN, '--out', out])), 0);
  assert.ok(readFileSync(out, 'utf8').includes(`connect-src ${AI_ORIGIN}`));
});

test('--check works with the options and fails after one byte changes', () => {
  const out = join(dir, 'b.html');
  const args = ['--ai-origin', AI_ORIGIN, '--market-base', BASE, '--out', out];
  assert.equal(quiet(() => main(args)), 0);
  assert.equal(quiet(() => main([...args, '--check'])), 0);
  writeFileSync(out, readFileSync(out, 'utf8').replace('<html', '<HTML'));
  assert.equal(quiet(() => main([...args, '--check'])), 1);
});

test('the distribution CSP stays strict and the script and style are unchanged', () => {
  const page = buildApp({ aiOrigin: AI_ORIGIN });
  const c = csp(page);
  assert.ok(!/\*|unsafe-|data:|blob:/.test(c));
  assert.ok(c.startsWith("default-src 'none'; script-src 'sha256-"));
  assert.equal(directive(c, 'object-src'), "object-src 'none'");
  const part = (h, tag) => new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`).exec(h)[0];
  for (const tag of ['script', 'style']) assert.equal(part(page, tag), part(committed, tag));
});

test('the committed page is never touched', () => {
  assert.equal(readFileSync(PAGE, 'utf8'), committed);
  assert.equal(committed, buildApp());
});

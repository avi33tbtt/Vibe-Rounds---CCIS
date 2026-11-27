// Row 4.3b.4: real-Chrome test of the AI draft view's network behaviour. Prototype. Synthetic data only. Not for clinical use.
// The model API is faked by request interception (no real network, no real key). Proves what jsdom cannot: the browser's own CSP
// and real requests. No Chrome: skipped locally (set CHROME_PATH); fails when CI is set.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { buildApp } from '../scripts/build-app.js';

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const CHROME = CANDIDATES.find((p) => p && existsSync(p));
const SKIP = !CHROME && !process.env.CI ? 'no Chrome found (set CHROME_PATH); this test is required in CI' : false;
const OPTS = { skip: SKIP, timeout: 40000 };
const API = 'https://api.anthropic.com/v1/messages';
const KEY = 'sk-test-KEY-123';
const MARKET_DIR = resolve('market');
const ENVELOPE = resolve('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json');
const MARKERS = ['case-snake-boundary-01-edge-inside', 'boundary-01'];
const artefact = JSON.parse(readFileSync('ccis/examples/snake/snake-interval.analytics.json', 'utf8'));
const REPLY = { artefact, trace: Object.keys(artefact).filter((k) => k !== 'manifest').map((member) => ({ member, source: 'src-1' })), assumptions: [] };
const dir = mkdtempSync(join(tmpdir(), 'ccis-draft-'));
writeFileSync(join(dir, 'index.html'), buildApp({ aiOrigin: 'https://api.anthropic.com' }));
const AIPAGE = pathToFileURL(join(dir, 'index.html')).href;
const COMMITTED = pathToFileURL(resolve('index.html')).href;

let browser;
before(async () => {
  if (!CHROME) {
    if (process.env.CI) throw new Error('Chrome was not found and CI is set: the real-browser test is required in CI');
    return;
  }
  const noSandbox = process.env.CI || process.getuid?.() === 0;
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: noSandbox ? ['--no-sandbox'] : [] });
});
after(async () => { await browser?.close(); });

// Every request is recorded. The fake model API answers a preflight and the POST; any other non-file request is a leak.
async function openPage(url) {
  const page = await browser.newPage();
  const seen = { file: [], api: [], preflight: [], leaks: [], errors: [] };
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith('file:')) { seen.file.push(u); return r.continue(); }
    if (u === API && r.method() === 'OPTIONS') {
      seen.preflight.push(r.headers());
      return r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } });
    }
    if (u === API) {
      seen.api.push({ method: r.method(), postData: r.postData(), headers: r.headers() });
      return r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(REPLY) }] }) });
    }
    seen.leaks.push(u);
    return r.respond({ status: 500, body: '' });
  });
  page.on('console', (m) => { if (m.type() === 'error') seen.errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', (e) => seen.errors.push(String(e.message).slice(0, 120)));
  await page.evaluateOnNewDocument(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective));
  });
  await page.goto(url);
  return { page, seen };
}
const api = (page, name) => page.evaluate((n) => window.ccisApp[n](), name);
async function pick(page, selector, paths, doneFn) {
  const input = await page.$(selector);
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 5000 }), input.click()]);
  await chooser.accept(paths);
  await page.waitForFunction(doneFn, { timeout: 5000 });
}
const setSwitch = (page, on) => page.evaluate((v) => {
  const sw = document.querySelector('#draft input[aria-label="Allow AI drafting"]');
  sw.checked = v; sw.dispatchEvent(new Event('change', { bubbles: true }));
}, on);
const fillAll = (page) => page.evaluate((key) => {
  const set = (sel, v) => { const n = document.querySelector(sel); n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); };
  const sw = document.querySelector('#draft input[aria-label="Allow AI drafting"]');
  sw.checked = true; sw.dispatchEvent(new Event('change', { bubbles: true }));
  set('#draft select[aria-label="Artefact type"]', 'analytics-package');
  set('#draft input[aria-label^="API key"]', key);
  set('#draft input[aria-label="Source citation"]', 'Synthetic guideline');
  set('#draft input[aria-label="Source passage"]', 'A synthetic passage.');
  set('#draft input[aria-label="Instruction"]', 'Draft the interval analytics.');
}, KEY);
async function clickDraft(page) {
  await page.evaluate(() => [...document.querySelectorAll('#draft button')].find((b) => b.textContent === 'Draft').click());
  await page.waitForFunction(() => { const s = window.ccisApp.draftState(); return s.drafted || s.refused; }, { timeout: 8000 });
}
async function importAndRun(page) {
  await pick(page, '#market input[type=file]', [MARKET_DIR], () => window.ccisApp.state().marketLoaded);
  await pick(page, '#import input[type=file]', [ENVELOPE], () => window.ccisApp.importState().imported);
  const [context, pathway] = await page.$$('#select select');
  await context.select('snake.envenomation-timing@0.1.0');
  await pathway.select('snake.documentation-path@0.1.0');
  await page.waitForFunction(() => window.ccisApp.runState().ready, { timeout: 5000 });
  const time = await page.$('#run input[type=text]');
  await time.click({ clickCount: 3 });
  await time.type('2026-01-01T00:00:00Z');
  await (await page.$$('#run button'))[0].click();
  await page.waitForFunction(() => window.ccisApp.runState().ran, { timeout: 5000 });
}
const nonFile = (seen) => seen.api.length + seen.preflight.length + seen.leaks.length;

test('committed page, draft used: no request, the AIC-002 sentence, a connect-src violation, key cleared', OPTS, async () => {
  const { page, seen } = await openPage(COMMITTED);
  await fillAll(page);
  await clickDraft(page);
  assert.equal(nonFile(seen), 0);
  assert.match(await page.$eval('#draft', (e) => e.textContent), /The model request failed\. Check the key/);
  assert.ok((await page.evaluate(() => window.__csp)).includes('connect-src'));
  assert.equal(await page.$eval('#draft input[aria-label^="API key"]', (i) => i.value), '');
  const st = await api(page, 'draftState');
  assert.deepEqual([st.refused, st.drafted], [true, false]);
  await page.close();
});

test('committed page, quiet: toggling the switch and Clear make no request and no error', OPTS, async () => {
  const { page, seen } = await openPage(COMMITTED);
  await setSwitch(page, true);
  await setSwitch(page, false);
  await page.evaluate(() => [...document.querySelectorAll('#draft button')].find((b) => b.textContent === 'Clear').click());
  assert.equal(nonFile(seen), 0);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test('--ai-origin page, quiet: nothing is requested until Draft is clicked', OPTS, async () => {
  const { page, seen } = await openPage(AIPAGE);
  await setSwitch(page, true);
  await setSwitch(page, false);
  assert.equal(nonFile(seen), 0);
  assert.deepEqual(seen.errors, []);
  assert.deepEqual(await page.evaluate(() => window.__csp), []);
  await page.close();
});

test('one request: a POST to the exact endpoint, the five payload members, no case marker', OPTS, async () => {
  const { page, seen } = await openPage(AIPAGE);
  await importAndRun(page);
  await fillAll(page);
  await clickDraft(page);
  assert.equal(seen.api.length, 1);
  assert.deepEqual(seen.leaks, []);
  const r = seen.api[0];
  assert.equal(r.method, 'POST');
  assert.equal(r.headers['x-api-key'], KEY);
  assert.deepEqual(Object.keys(r.headers).filter((h) => h === 'cookie' || h === 'authorization'), []);
  const payload = JSON.parse(JSON.parse(r.postData).messages[0].content);
  assert.equal(Object.keys(payload).length, 5);
  for (const m of MARKERS) assert.equal(r.postData.includes(m), false, m);
  assert.equal((await api(page, 'draftState')).drafted, true);
  await page.close();
});

test('other origins are refused by the CSP and never reach the network layer', OPTS, async () => {
  const { page, seen } = await openPage(AIPAGE);
  const out = await page.evaluate(async () => {
    const a = await fetch('https://other.example/').then(() => 'reached', () => 'refused');
    const b = await fetch('https://market.example/m/index.json').then(() => 'reached', () => 'refused');
    await new Promise((r) => setTimeout(r, 200));
    return [a, b];
  });
  assert.deepEqual(out, ['refused', 'refused']);
  assert.ok((await page.evaluate(() => window.__csp)).includes('connect-src'));
  assert.deepEqual([seen.leaks, seen.api, seen.preflight], [[], [], []]);
  await page.close();
});

test('key hygiene: gone from the input, page text, state and storage; in exactly one request', OPTS, async () => {
  const { page, seen } = await openPage(AIPAGE);
  await fillAll(page);
  await clickDraft(page);
  assert.equal(await page.$eval('#draft input[aria-label^="API key"]', (i) => i.value), '');
  assert.equal((await page.evaluate(() => document.body.textContent)).includes(KEY), false);
  assert.equal(JSON.stringify(await api(page, 'draftState')).includes(KEY), false);
  const stored = await page.evaluate(() => { try { return localStorage.length + sessionStorage.length; } catch { return 0; } });
  assert.equal(stored, 0);
  const all = [...seen.api, ...seen.preflight];
  assert.equal(all.filter((x) => JSON.stringify(x).includes(KEY)).length, 1);
  await page.close();
});

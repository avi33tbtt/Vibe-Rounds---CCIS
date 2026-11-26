// Row 4.1c.1: real-Chrome test of a distribution build. Prototype. Synthetic data only. Not for clinical use.
// The marketplace host is faked by request interception (no real network). Proves what jsdom cannot: the browser's own CSP and
// real requests: the page asks the market address for market files and for nothing else, and nothing from the envelope,
// the case, the run or the export ever leaves the page. No Chrome: skipped locally (set CHROME_PATH); fails when CI is set.
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
const OPTS = { skip: SKIP, timeout: 30000 };
const BASE = 'https://market.example/m/';
const MARKET_DIR = resolve('market');
const ENVELOPE = resolve('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json');
const MARKERS = ['case-snake-boundary-01-edge-inside', 'boundary-01'];
const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));
const served = Object.fromEntries([['index.json', readFileSync('market/index.json', 'utf8')], ...idx.entries.map((e) => [e.path, readFileSync(`market/${e.path}`, 'utf8')])]);
const dir = mkdtempSync(join(tmpdir(), 'ccis-dist-'));
writeFileSync(join(dir, 'index.html'), buildApp({ marketBase: BASE }));
const DIST = pathToFileURL(join(dir, 'index.html')).href;
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

// A page whose every request is recorded; the fake market host answers from market/ (optionally with one byte changed).
async function openPage(url, { tamper } = {}) {
  const page = await browser.newPage();
  const seen = { file: [], base: [], leaks: [], errors: [] };
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith('file:')) { seen.file.push(u); return r.continue(); }
    if (u.startsWith(BASE)) {
      seen.base.push({ url: u, method: r.method(), postData: r.postData(), headers: r.headers() });
      const rel = u.slice(BASE.length);
      let body = served[rel];
      if (body === undefined) return r.respond({ status: 404, body: '' });
      if (tamper && rel === tamper) body = body.replace(/./, (c) => (c === 'x' ? 'y' : 'x'));
      return r.respond({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body });
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
const loadRemote = async (page) => {
  const b = (await page.$$('#remote button'))[0];
  await b.click();
  await page.waitForFunction(() => document.querySelector('#remote table, #remote [role=alert]'), { timeout: 10000 });
};
async function pick(page, selector, paths, doneFn) {
  const input = await page.$(selector);
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 5000 }), input.click()]);
  await chooser.accept(paths);
  await page.waitForFunction(doneFn, { timeout: 5000 });
}

test('boot: no error, no CSP violation, only file and market-address requests; the Load button shows', OPTS, async () => {
  const { page, seen } = await openPage(DIST);
  assert.deepEqual(seen.errors, []);
  assert.deepEqual(await page.evaluate(() => window.__csp), []);
  assert.deepEqual(seen.leaks, []);
  assert.equal(seen.base.length, 0, 'nothing is requested until Load is clicked');
  assert.equal(await page.$$eval('#remote button', (b) => b.map((x) => x.textContent).includes('Load from marketplace')), true);
  await page.close();
});

test('Load: one plain GET per market file, no body, query, fragment, cookie or custom header', OPTS, async () => {
  const { page, seen } = await openPage(DIST);
  await loadRemote(page);
  assert.equal(await page.$$eval('#remote tbody tr', (r) => r.length), idx.entries.length);
  assert.deepEqual([(await api(page, 'state')).marketLoaded, (await api(page, 'remoteState')).source], [true, 'remote']);
  assert.equal(seen.base.length, idx.entries.length + 1);
  for (const r of seen.base) {
    assert.equal(r.method, 'GET'); assert.equal(r.postData, undefined); assert.ok(!/[?#]/.test(r.url), r.url);
    for (const h of Object.keys(r.headers)) assert.ok(h !== 'cookie' && h !== 'authorization' && !h.startsWith('x-'), h);
  }
  assert.deepEqual(seen.leaks, []);
  await page.close();
});

test('full flow: import, run and export make no new request and leak no case marker', OPTS, async () => {
  const { page, seen } = await openPage(DIST);
  await loadRemote(page);
  const before = seen.base.length;
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
  assert.equal((await api(page, 'exportState')).verified, true);
  assert.equal(seen.base.length, before, 'no request after the market was loaded');
  assert.deepEqual(seen.leaks, []);
  const everything = JSON.stringify([seen.base, seen.leaks]);
  for (const m of MARKERS) assert.equal(everything.includes(m), false, m);
  await page.close();
});

test('the CSP is the last gate: another host and another path of the same host are refused', OPTS, async () => {
  const { page, seen } = await openPage(DIST);
  const out = await page.evaluate(async () => {
    const a = await fetch('https://other.example/').then(() => 'reached', () => 'refused');
    const b = await fetch('https://market.example/other').then(() => 'reached', () => 'refused');
    await new Promise((r) => setTimeout(r, 200));
    return [a, b];
  });
  assert.deepEqual(out, ['refused', 'refused']);
  assert.ok((await page.evaluate(() => window.__csp)).includes('connect-src'));
  assert.deepEqual([seen.leaks, seen.base], [[], []], 'neither request reached the network layer');
  await page.close();
});

test('one served byte changed: the refusal shows, nothing is loaded, no address or path in the page', OPTS, async () => {
  const { page } = await openPage(DIST, { tamper: idx.entries[0].path });
  await loadRemote(page);
  assert.match(await page.$eval('#remote [role=alert]', (e) => e.textContent), /R-00\d/);
  assert.equal((await api(page, 'state')).marketLoaded, false);
  const alertText = await page.$eval('#remote [role=alert]', (e) => e.textContent);
  assert.equal(alertText.includes('market.example') || alertText.includes(idx.entries[0].path), false);
  await page.close();
});

test('committed page: no Load button and no request but the page file, even after clicking around', OPTS, async () => {
  const { page, seen } = await openPage(COMMITTED);
  assert.equal(await page.$$eval('#remote button', (b) => b.length), 0);
  await pick(page, '#market input[type=file]', [MARKET_DIR], () => window.ccisApp.state().marketLoaded);
  await (await page.$$('#market button'))[0].click();
  assert.deepEqual([seen.base, seen.leaks], [[], []]);
  assert.ok(seen.file.every((u) => u.startsWith('file:')));
  await page.close();
});

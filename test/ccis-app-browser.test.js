// Row 3.10a: one real-browser smoke test. Prototype. Synthetic data only. Not for clinical use.
// Loads the committed index.html over file:// in a real headless Chrome (no server, no network) and checks what jsdom cannot:
// the browser enforces the CSP, real File/crypto paths work, and the page makes no request except loading itself.
// No Chrome: every case is skipped locally (set CHROME_PATH to point at one) and fails when CI is set.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { importEnvelope } from '../ccis-import.js';
import { heldFromMarket, importReportView } from '../ccis-app-import-report.js';

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const CHROME = CANDIDATES.find((p) => p && existsSync(p));
const SKIP = !CHROME && !process.env.CI ? 'no Chrome found (set CHROME_PATH); this test is required in CI' : false;
const OPTS = { skip: SKIP, timeout: 20000 };
const PAGE = pathToFileURL(resolve('index.html')).href;
const MARKET_DIR = resolve('market');
const ENVELOPE = resolve('ccis/fixtures/snake/boundary/boundary-01-edge-inside.envelope.json');
const idx = JSON.parse(readFileSync('market/index.json', 'utf8'));

let browser;
before(async () => {
  if (!CHROME) {
    if (process.env.CI) throw new Error('Chrome was not found and CI is set: the real-browser test is required in CI');
    return;
  }
  // Chrome refuses its sandbox when run as root (CI containers, some dev boxes).
  const noSandbox = process.env.CI || process.getuid?.() === 0;
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: noSandbox ? ['--no-sandbox'] : [] });
});
after(async () => { await browser?.close(); });

// A fresh page that records requests, console errors and the browser's own CSP violation reports.
async function openPage() {
  const page = await browser.newPage();
  const seen = { requests: [], failed: [], errors: [] };
  page.on('request', (r) => seen.requests.push(r.url()));
  page.on('requestfailed', (r) => seen.failed.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('console', (m) => { if (m.type() === 'error') seen.errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', (e) => seen.errors.push(String(e.message).slice(0, 120)));
  await page.evaluateOnNewDocument(() => { // injected by the debugger, so the page's own CSP does not apply to it
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective));
  });
  await page.goto(PAGE);
  return { page, seen };
}
// Pick files through Chrome's real file chooser, then wait for the page to say it is done.
async function pick(page, selector, paths, doneFn) {
  const input = await page.$(selector);
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 5000 }), input.click()]);
  await chooser.accept(paths);
  await page.waitForFunction(doneFn, { timeout: 5000 });
}
const api = (page, name) => page.evaluate((n) => window.ccisApp[n](), name);
const onlyFileRequests = (seen) => seen.requests.every((u) => u.startsWith('file:'));

test('boots under the real CSP: no errors, no violations, only the page file requested', OPTS, async () => {
  const { page, seen } = await openPage();
  assert.notEqual(await page.$eval('#status', (e) => e.textContent), 'Loading.');
  assert.equal((await api(page, 'state')).marketLoaded, false);
  assert.deepEqual(seen.errors, []);
  assert.deepEqual(await page.evaluate(() => window.__csp), []);
  assert.ok(onlyFileRequests(seen), 'a request left the page file');
  await page.close();
});

test('the CSP holds: injected script, inline handler and fetch are all refused', OPTS, async () => {
  const { page, seen } = await openPage();
  const fetched = await page.evaluate(async () => {
    const s = document.createElement('script');
    s.textContent = 'window.__ran = 1';
    document.body.append(s);
    const img = document.createElement('img');
    img.setAttribute('onerror', 'window.__ran2 = 1');
    img.src = 'missing.png';
    document.body.append(img);
    const out = await fetch('http://127.0.0.1:9/').then(() => 'reached', () => 'refused');
    await new Promise((r) => setTimeout(r, 200));
    return out;
  });
  assert.equal(fetched, 'refused');
  assert.deepEqual(await page.evaluate(() => [typeof window.__ran, typeof window.__ran2]), ['undefined', 'undefined']);
  const violated = await page.evaluate(() => window.__csp);
  for (const d of ['script-src-elem', 'script-src-attr', 'connect-src']) assert.ok(violated.includes(d), `no ${d} violation reported`);
  assert.ok(seen.requests.filter((u) => !u.startsWith('file:')).every((u) => seen.failed.some((f) => f.startsWith(u))), 'a request left the browser');
  await page.close();
});

test('market through the real folder input: real File.text and SHA-256 accept every checksum', OPTS, async () => {
  const { page } = await openPage();
  await pick(page, '#market input[type=file]', [MARKET_DIR], () => window.ccisApp.state().marketLoaded);
  const s = await api(page, 'state');
  assert.deepEqual([s.marketLoaded, s.refused, s.entries], [true, false, idx.entries.length]);
  assert.equal(await page.$$eval('#market tbody tr', (r) => r.length), idx.entries.length);
  await page.close();
});

test('import and run through the real inputs agree with Node and the jsdom wire tests', OPTS, async () => {
  const market = { index: idx, files: Object.fromEntries(idx.entries.map((e) => [e.path, readFileSync(`market/${e.path}`, 'utf8')])) };
  const want = importReportView(importEnvelope(JSON.parse(readFileSync(ENVELOPE, 'utf8')), { held: heldFromMarket(market) })).counts;
  const { page, seen } = await openPage();
  await pick(page, '#market input[type=file]', [MARKET_DIR], () => window.ccisApp.state().marketLoaded);
  await pick(page, '#import input[type=file]', [ENVELOPE], () => window.ccisApp.importState().imported);
  const imp = await api(page, 'importState');
  assert.deepEqual([imp.accepted, imp.rejected, imp.unmapped, imp.ambiguous], [want.accepted, want.rejected, want.unmapped, want.ambiguous]);
  const [context, pathway] = await page.$$('#select select');
  await context.select('snake.envenomation-timing@0.1.0');
  await pathway.select('snake.documentation-path@0.1.0');
  await page.waitForFunction(() => window.ccisApp.runState().ready, { timeout: 5000 });
  const time = await page.$('#run input[type=text]');
  await time.click({ clickCount: 3 });
  await time.type('2026-01-01T00:00:00Z');
  await (await page.$$('#run button'))[0].click();
  await page.waitForFunction(() => window.ccisApp.runState().ran, { timeout: 5000 });
  const run = await api(page, 'runState');
  assert.deepEqual([run.failed, run.refused, run.results], [false, false, 8]);
  assert.equal((await api(page, 'resultsState')).state, 'completed');
  assert.equal((await api(page, 'exportState')).verified, true);
  assert.deepEqual(seen.errors, []);
  assert.ok(onlyFileRequests(seen), 'a request left the page file');
  await page.close();
});

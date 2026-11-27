// Row 4.4e: real-Chrome test of the form view in the committed page. Prototype. Synthetic data only. Not for clinical use.
// Every non-file request is recorded as a leak. Proves what jsdom cannot: real keyboard input, the browser's own CSP and the real
// SHA-256 in the bundle. No Chrome: skipped locally (set CHROME_PATH); fails when CI is set.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { buildApp } from '../scripts/build-app.js';
import { draftFromForm } from '../ccis-app-form.js';

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
const COMMITTED = pathToFileURL(resolve('index.html')).href;
const dir = mkdtempSync(join(tmpdir(), 'ccis-form-'));
writeFileSync(join(dir, 'index.html'), buildApp({ aiOrigin: 'https://api.anthropic.com' }));
const AIPAGE = pathToFileURL(join(dir, 'index.html')).href;
const FORM = { id: 'syn-el', name: 'Synthetic element', version: '0.1.0', publisher: 'Synthetic publisher', purpose: 'p', setting: 's', population: 'pop', rationale: 'r', origin: 'o', basis: 'b',
  exclusions: '', fields: [{ key: 'k1', label: 'Label', type: 'quantity', min: '0', max: '1', epistemic: 'absent', sourceClasses: 'clinician-entered', units: 'mg', timeSemantics: 'event-time', constraints: '' }] };

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

async function openPage(url) {
  const page = await browser.newPage();
  const seen = { file: [], api: [], preflight: [], leaks: [], errors: [], dialogs: [] };
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith('file:')) { seen.file.push(u); return r.continue(); }
    if (u === API && r.method() === 'OPTIONS') { seen.preflight.push(u); return r.respond({ status: 204 }); }
    if (u === API) { seen.api.push(u); return r.respond({ status: 500, body: '' }); }
    seen.leaks.push(u);
    return r.respond({ status: 500, body: '' });
  });
  page.on('console', (m) => { if (m.type() === 'error') seen.errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', (e) => seen.errors.push(String(e.message).slice(0, 120)));
  page.on('dialog', (d) => { seen.dialogs.push(d.type()); d.dismiss(); });
  await page.evaluateOnNewDocument(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective));
  });
  await page.goto(url);
  return { page, seen };
}
const formState = (page) => page.evaluate(() => window.ccisApp.formState());
const text = (page) => page.evaluate(() => document.querySelector('#form').textContent);
const typeInto = async (page, sel, v) => { await page.click(sel, { clickCount: 3 }); await page.type(sel, v); };
const click = (page, name) => page.evaluate((n) => [...document.querySelectorAll('#form button')].find((b) => b.textContent === n).click(), name);
async function typeForm(page, f = FORM) {
  for (const k of ['id', 'name', 'version', 'publisher', 'purpose', 'setting', 'population', 'rationale', 'origin', 'basis']) await typeInto(page, `#form [aria-label="${k}"]`, f[k]);
  const c = '#form .field-card';
  for (const k of ['key', 'label', 'min', 'max', 'epistemic', 'sourceClasses', 'units']) await typeInto(page, `${c} [aria-label="${k}"]`, f.fields[0][k]);
  await page.select(`${c} select[aria-label="timeSemantics"]`, f.fields[0].timeSemantics);
}
const quiet = (seen, extra = {}) => ({ leaks: seen.leaks, api: seen.api, preflight: seen.preflight, errors: seen.errors, ...extra });

test('typing a minimal valid form builds a draft', OPTS, async () => {
  const { page } = await openPage(COMMITTED);
  await typeForm(page);
  assert.equal((await formState(page)).built, true);
  assert.match(await text(page), /Built from the form\. Status: draft\./);
  await page.close();
});

test('the checksum in Chrome equals the one Node computes', OPTS, async () => {
  const { page } = await openPage(COMMITTED);
  await typeForm(page);
  const shown = /Checksum: (\S+)/.exec(await text(page))[1];
  assert.equal(shown, draftFromForm(FORM).checksum);
  await page.close();
});

test('Keep, rename, see the change; Forget clears; reload loses the kept version', OPTS, async () => {
  const { page } = await openPage(COMMITTED);
  await typeForm(page);
  await click(page, 'Keep this version for comparison');
  assert.equal((await formState(page)).kept, true);
  await typeInto(page, '#form [aria-label="name"]', 'Renamed element');
  assert.ok((await text(page)).includes('changed manifest.name: "Synthetic element" -> "Renamed element"'));
  await click(page, 'Forget kept version');
  assert.match(await text(page), /No previous version kept\./);
  await click(page, 'Keep this version for comparison');
  await page.reload();
  assert.equal((await formState(page)).kept, false);
  await page.close();
});

test('whole run: no leak, no request, no CSP violation, no console error, no storage keys', OPTS, async () => {
  const { page, seen } = await openPage(COMMITTED);
  await typeForm(page);
  await click(page, 'Keep this version for comparison');
  await click(page, 'Reset form');
  const csp = await page.evaluate(() => window.__csp);
  const store = await page.evaluate(() => { try { return [localStorage.length, sessionStorage.length]; } catch { return [0, 0]; } });
  assert.deepEqual(quiet(seen, { csp, store }), { leaks: [], api: [], preflight: [], errors: [], csp: [], store: [0, 0] });
  await page.close();
});

test('hostile strings typed into every input: no script ran, no dialog', OPTS, async () => {
  const { page, seen } = await openPage(COMMITTED);
  const hostile = ['<img src=x onerror="window.__pwned=1">', '</p><script>window.__pwned=1</script>', 'javascript:window.__pwned=1'];
  for (const h of hostile) {
    for (const el of await page.$$('#form input[type="text"], #form textarea')) { await el.click({ clickCount: 3 }); await el.type(h); }
  }
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(await page.evaluate(() => window.__pwned), undefined);
  assert.deepEqual(seen.dialogs, []);
  assert.deepEqual(seen.leaks, []);
  await page.close();
});

test('an --ai-origin build: using only the form sends no request at all', OPTS, async () => {
  const { page, seen } = await openPage(AIPAGE);
  await typeForm(page);
  await click(page, 'Keep this version for comparison');
  assert.deepEqual({ api: seen.api, preflight: seen.preflight, leaks: seen.leaks }, { api: [], preflight: [], leaks: [] });
  await page.close();
});

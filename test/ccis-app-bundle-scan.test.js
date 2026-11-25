// Row 3.10: the built page, scanned as built. Prototype. Synthetic data only. Not for clinical use.
// Failure messages name a pattern and a count, never a matching snippet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const ROOT = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', ROOT), 'utf8');
const doc = new JSDOM(html).window.document; // scripts are not run
const scriptText = doc.querySelector('script').textContent;

// FORBIDDEN: label -> [pattern, ...]. Adding a row needs no code change.
const FORBIDDEN = {
  'fetch(': /\bfetch\s*\(/g, XMLHttpRequest: /XMLHttpRequest/g, WebSocket: /WebSocket/g, EventSource: /EventSource/g,
  sendBeacon: /sendBeacon/g, importScripts: /importScripts/g, 'new Worker': /new\s+Worker\b/g, 'new SharedWorker': /new\s+SharedWorker\b/g,
  localStorage: /localStorage/g, sessionStorage: /sessionStorage/g, indexedDB: /indexedDB/g, 'document.cookie': /document\.cookie/g,
  'eval(': /\beval\s*\(/g, 'new Function': /new\s+Function\b/g, 'import(': /(^|[^\w.$])import\s*\(/g,
  '.innerHTML': /\.innerHTML/g, '.outerHTML': /\.outerHTML/g, insertAdjacentHTML: /insertAdjacentHTML/g, 'document.write': /document\.write/g,
  'Date.now(': /Date\.now\s*\(/g, 'new Date()': /new\s+Date\s*\(\s*\)/g, 'Math.random': /Math\.random/g,
  'crypto.getRandomValues': /crypto\.getRandomValues/g, 'window.open': /window\.open/g, 'location.assign': /location\.assign/g,
  'location.href =': /location\.href\s*=(?!=)/g,
};
// ALLOW: the local file save of savePage only (D-182). Exact counts.
const ALLOW = { createObjectURL: [/createObjectURL/g, 1], revokeObjectURL: [/revokeObjectURL/g, 1], 'new Blob': [/new\s+Blob\b/g, 1] };
const VIEW_FILES = ['export', 'import', 'market', 'run', 'selector'].map((n) => `ccis-app-${n}-view.js`);
const count = (text, re) => (text.match(re) ?? []).length;
const directive = (csp, name) => csp.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name} `)) ?? '';

test('the static page has one script, one style and no external or form elements', () => {
  assert.equal(doc.querySelectorAll('script').length, 1);
  assert.equal(doc.querySelectorAll('style').length, 1);
  assert.equal(doc.querySelectorAll('script[src]').length, 0);
  for (const sel of ['link', 'img', 'iframe', 'form', 'object', 'embed', 'base', 'a[href]']) {
    assert.equal(doc.querySelectorAll(sel).length, 0, sel);
  }
});

test('no on* attribute, no style attribute, no javascript: value', () => {
  let on = 0, style = 0, js = 0;
  for (const el of doc.querySelectorAll('*')) {
    for (const a of el.attributes) {
      if (/^on/i.test(a.name)) on++;
      if (a.name.toLowerCase() === 'style') style++;
      if (/javascript:/i.test(a.value)) js++;
    }
  }
  assert.deepEqual({ on, style, js }, { on: 0, style: 0, js: 0 });
});

test('the CSP is none everywhere except one hash each for script and style', () => {
  const csp = doc.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
  for (const n of ['default-src', 'img-src', 'connect-src', 'font-src', 'frame-src', 'object-src', 'base-uri', 'form-action',
    'worker-src', 'media-src', 'manifest-src', 'child-src', 'script-src-attr', 'style-src-attr']) {
    assert.equal(directive(csp, n), `${n} 'none'`, n);
  }
  assert.match(directive(csp, 'script-src'), /^script-src 'sha256-[A-Za-z0-9+/=]+'$/);
  assert.match(directive(csp, 'style-src'), /^style-src 'sha256-[A-Za-z0-9+/=]+'$/);
  assert.equal(count(csp, /unsafe-/g) + count(csp, /\*/g) + count(csp, /blob:/g) + count(csp, /data:/g), 0);
});

test('the inline script has no forbidden network, storage, clock, eval or HTML-injection API', () => {
  const hits = Object.entries(FORBIDDEN).map(([label, re]) => [label, count(scriptText, re)]).filter(([, n]) => n > 0);
  assert.deepEqual(hits, [], `forbidden pattern counts: ${JSON.stringify(hits)}`);
});

test('the allowed exceptions appear exactly as many times as declared', () => {
  const off = Object.entries(ALLOW).map(([label, [re, want]]) => [label, count(scriptText, re), want]).filter(([, got, want]) => got !== want);
  assert.deepEqual(off, [], `allow table [pattern, found, expected]: ${JSON.stringify(off)}`);
});

test('handlers are attached in view code, not inline', () => {
  for (const f of VIEW_FILES) {
    const n = count(readFileSync(new URL(f, ROOT), 'utf8'), /addEventListener\s*\(/g);
    assert.ok(n >= 1, `${f}: ${n} addEventListener calls`);
  }
  assert.ok(count(scriptText, /addEventListener\s*\(/g) >= VIEW_FILES.length);
});

test('the scan tables are data: every entry is a pattern', () => {
  for (const [label, re] of Object.entries(FORBIDDEN)) assert.ok(re instanceof RegExp && re.global, label);
  for (const [label, [re, n]] of Object.entries(ALLOW)) assert.ok(re instanceof RegExp && Number.isInteger(n), label);
});

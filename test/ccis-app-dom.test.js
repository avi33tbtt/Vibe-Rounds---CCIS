// Row 3.10.1: the shared DOM helper. Prototype. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { ALLOWED_TAGS, makeDom, refuseNames } from '../ccis-app-dom.js';

const document = new JSDOM('<div id="r"></div>').window.document;
const { el, text } = makeDom(document);
const HOSTILE = ['<img src=x onerror=1>', '</p><script>', '"><svg onload=1>', 'javascript:alert(1)'];

test('hostile strings stay one text node with no child elements', () => {
  for (const h of HOSTILE) {
    const p = el('p', h);
    assert.equal(p.children.length, 0);
    assert.equal(p.childNodes.length, 1);
    assert.equal(p.textContent, h);
    assert.ok(!p.innerHTML.includes('<img') && !p.innerHTML.includes('<script') && !p.innerHTML.includes('<svg'));
    assert.equal(text(h).nodeType, 3);
  }
  assert.ok(el('p', '<b>').innerHTML.includes('&lt;'));
});

test('content is stringified; undefined leaves the element empty', () => {
  assert.equal(el('p', 42).textContent, '42');
  assert.equal(el('p', null).textContent, 'null');
  assert.equal(el('p', { toString: () => 'shown' }).textContent, 'shown');
  assert.equal(el('p').childNodes.length, 0);
});

test('every allowed tag is created', () => {
  for (const t of ALLOWED_TAGS) assert.equal(el(t).tagName.toLowerCase(), t);
});

test('tags off the list are refused without naming the tag', () => {
  for (const t of ['script', 'style', 'iframe', 'img', 'form', 'object', 'embed', 'link', 'base', 'svg', 'math']) {
    assert.throws(() => el(t, 'x'), (e) => e.message === refuseNames.tag, t);
  }
});

test('hostile or malformed classes are refused', () => {
  for (const c of ['x onclick=1', 'A', 'a'.repeat(40), ' ', 'a b c d', 'a  b', '1a', 'a"b']) {
    assert.throws(() => el('p', 'x', c), (e) => e.message === refuseNames.cls, JSON.stringify(c));
  }
});

test('fixed class names pass and are set', () => {
  for (const c of ['muted', 'refusal', 'needs-data', 'a b', 'a b c']) assert.equal(el('p', 'x', c).className, c);
});

test('the only attribute ever set is class', () => {
  assert.deepEqual([...el('p', 'x').attributes], []);
  assert.deepEqual([...el('p', 'x', 'muted').attributes].map((a) => a.name), ['class']);
});

test('source scan: no markup-injection, attribute, eval, import or network API in the module', () => {
  const src = readFileSync(new URL('../ccis-app-dom.js', import.meta.url), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const P = { innerHTML: /innerHTML/g, outerHTML: /outerHTML/g, insertAdjacentHTML: /insertAdjacentHTML/g, setAttribute: /setAttribute/g,
    'eval(': /\beval\s*\(/g, 'new Function': /new\s+Function\b/g, 'import(': /(^|[^\w.$])import\s*\(/g, 'fetch(': /\bfetch\s*\(/g };
  const hits = Object.entries(P).map(([k, re]) => [k, (src.match(re) ?? []).length]).filter(([, n]) => n);
  assert.deepEqual(hits, [], `pattern counts: ${JSON.stringify(hits)}`);
});

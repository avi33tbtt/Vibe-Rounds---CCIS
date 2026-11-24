// Row 3.8: the app build, its CSP and the bundled checksum. Prototype. Synthetic data only. Not for clinical use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { checksumOf } from '../ccis-compile.js';
import { buildApp } from '../scripts/build-app.js';

const ROOT = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', ROOT), 'utf8');
const b64 = (t) => createHash('sha256').update(t, 'utf8').digest('base64');
const parts = () => {
  const dom = new JSDOM(html);
  const d = dom.window.document;
  return {
    csp: d.querySelector('meta[http-equiv="Content-Security-Policy"]').content,
    scripts: [...d.querySelectorAll('script')].map((s) => s.textContent),
    styles: [...d.querySelectorAll('style')].map((s) => s.textContent),
    d,
  };
};
const directive = (csp, name) => (csp.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name} `)) ?? '');

function marketFiles(dir = new URL('market/', ROOT), base = '') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...marketFiles(new URL(`${e.name}/`, dir), rel));
    else if (e.name !== '.gitattributes') out.push([rel, readFileSync(new URL(rel, new URL('market/', ROOT)), 'utf8')]);
  }
  return out;
}

test('the committed index.html equals a fresh build', () => {
  assert.equal(html, buildApp());
});

test('CSP hashes match the one inline script and the one style', () => {
  const { csp, scripts, styles } = parts();
  assert.equal(scripts.length, 1);
  assert.equal(styles.length, 1);
  assert.equal(directive(csp, 'script-src'), `script-src 'sha256-${b64(scripts[0])}'`);
  assert.equal(directive(csp, 'style-src'), `style-src 'sha256-${b64(styles[0])}'`);
});

test('CSP closes everything else and allows nothing unsafe', () => {
  const { csp } = parts();
  for (const n of ['default-src', 'img-src', 'connect-src', 'object-src', 'base-uri', 'form-action']) {
    assert.equal(directive(csp, n), `${n} 'none'`, n);
  }
  assert.ok(!/unsafe-inline|unsafe-eval|\*/.test(csp));
});

test('no inline handler attributes, no external resources', () => {
  const { d } = parts();
  for (const el of d.querySelectorAll('*')) for (const a of el.attributes) assert.ok(!/^on/i.test(a.name), `${el.tagName} ${a.name}`);
  assert.equal(d.querySelectorAll('script[src], link[href], img, iframe').length, 0);
});

test('the bundle has no node:crypto and the page shows the banners', () => {
  const { scripts, d } = parts();
  assert.ok(!scripts[0].includes('node:crypto'));
  assert.match(d.body.textContent, /Synthetic data, prototype, not for clinical use\./);
  assert.match(d.body.textContent, /no network requests/);
});

test('in jsdom the stub runs, state is counts only, and bundled checksumOf equals the Node one on every market file', () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously' });
  const w = dom.window;
  assert.match(w.document.getElementById('status').textContent, /^Ready\./);
  assert.equal(JSON.stringify(w.ccisApp.state()), JSON.stringify({ marketLoaded: false, entries: 0, runs: 0, refused: false }));
  const files = marketFiles();
  assert.ok(files.length >= 7);
  for (const [rel, text] of files) assert.equal(w.ccisApp.checksumOf(text), checksumOf(text), rel);
});

test('--check passes on the committed file and fails on a one-byte change', () => {
  const script = new URL('scripts/build-app.js', ROOT).pathname;
  assert.equal(spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' }).status, 0);
  const tmp = join(mkdtempSync(join(tmpdir(), 'ccis-app-')), 'index.html');
  writeFileSync(tmp, html.replace('Loading.', 'Loadinh.'));
  const r = spawnSync(process.execPath, [script, '--check', '--out', tmp], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /differs: index\.html/);
});

test('only scripts/build-app.js touches the disk; the demo viewer is unchanged', () => {
  for (const f of ['ccis-sha256.js', 'ccis-app.js']) {
    const src = readFileSync(new URL(f, ROOT), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/node:fs|readFileSync|writeFileSync|innerHTML|eval\(|new Function|fetch\(|XMLHttpRequest|localStorage/.test(src), f);
  }
  assert.ok(readFileSync(new URL('ccis-viewer.html', ROOT), 'utf8').includes('DEMO RUNNER'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { main } from '../ccis-cli.js';

const fx = new URL('../ccis/fixtures/snake/', import.meta.url);
const html = readFileSync(new URL('../ccis-viewer.html', import.meta.url), 'utf8');
const index = JSON.parse(readFileSync(new URL('index.json', fx), 'utf8'));
const dir = mkdtempSync(join(tmpdir(), 'ccis-viewer-'));
test.after(() => rmSync(dir, { recursive: true, force: true }));
const clone = (x) => JSON.parse(JSON.stringify(x));
const sha = (s) => createHash('sha256').update(s).digest('base64');

function recordFor(c, demo) {
  const out = join(dir, `${c.case}${demo ? '-d' : ''}.json`);
  const env = fileURLToPath(new URL(`${c.class}/${c.case}.envelope.json`, fx));
  const code = main(['run', '--envelope', env, '--out', out, '--at', '2026-11-20T12:00:00Z', ...(demo ? ['--demo-parameters'] : [])], { out() {}, err(s) { throw new Error(s); } });
  assert.equal(code, 0);
  return JSON.parse(readFileSync(out, 'utf8'));
}
const page = () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
  return { dom, doc: dom.window.document, view: dom.window.ccisViewer };
};
const all = (doc, sel) => [...doc.querySelectorAll(sel)];
const text = (doc) => doc.getElementById('out').textContent;
const banners = (doc) => all(doc, '.banner').map((b) => b.textContent);

test('page: strict CSP with matching hashes, one script, no inline handlers, no network or HTML-string APIs', () => {
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  const js = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const css = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
  assert.equal(html.match(/<script/g).length, 1);
  assert.ok(csp.includes(`script-src 'sha256-${sha(js)}'`), 'script hash matches the script');
  assert.ok(csp.includes(`style-src 'sha256-${sha(css)}'`), 'style hash matches the style');
  for (const must of ["default-src 'none'", "connect-src 'none'", "img-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) assert.ok(csp.includes(must), must);
  assert.equal(/unsafe-inline|unsafe-eval|\*/.test(csp), false);
  assert.equal(/\son[a-z]+\s*=/i.test(html.replace(js, '')), false, 'no inline handler attributes');
  assert.equal(/<(img|iframe|link|object|embed|form)\b|src\s*=|href\s*=/i.test(html.replace(js, '')), false, 'nothing is loaded from anywhere');
  const code = js.replace(/^\s*\/\/.*$/gm, '');
  for (const bad of [/innerHTML/, /outerHTML/, /insertAdjacentHTML/, /document\.write/, /\beval\b/, /new Function/, /\bfetch\b/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /localStorage/, /sessionStorage/, /\bimport\(/, /\.style\b/, /setAttribute/]) {
    assert.equal(bad.test(code), false, String(bad));
  }
});

test('banners: the prototype banner is always there; the demo banner only when x-demo is present', () => {
  const { doc, view } = page();
  assert.ok(banners(doc).includes('Synthetic data, prototype, not for clinical use.'));
  const c = index.cases[0];
  assert.equal(view.render(recordFor(c, true)), true);
  assert.deepEqual(banners(doc), ['Synthetic data, prototype, not for clinical use.', 'Demo placeholders, not clinical values.']);
  assert.equal(view.render(recordFor(c, false)), true);
  assert.deepEqual(banners(doc), ['Synthetic data, prototype, not for clinical use.'], 'banner cleared with the old record');
});

test('every fixture opens, and every run shows its identity, versions, parameters and counts', () => {
  const { doc, view } = page();
  for (const c of index.cases) {
    const rec = recordFor(c, true);
    assert.equal(view.render(rec), true, c.case);
    const t = text(doc);
    for (const must of [rec.id, 'snake.documentation-path 0.1.0', 'Standard', 'Engine', 'Operator set', '2026-11-20T12:00:00Z (zone: stated)', 'Input snapshot (counts only)', 'Import report', 'Run limitations', 'targetIntervalDuration', 'populationScope']) assert.ok(t.includes(must), `${c.case}: ${must}`);
    assert.equal(all(doc, '#out section').find((s) => s.querySelector('h2').textContent === 'Input snapshot (counts only)').querySelectorAll('dd')[0].textContent, String(rec.snapshot.observations.length));
    assert.equal(all(doc, 'h3').length, rec.results.length, c.case);
  }
});

test('every state is distinguishable: each declared state has its own wording and style, and values look different', () => {
  const { doc, view } = page();
  const seen = new Map();
  for (const c of index.cases) {
    for (const demo of [true, false]) {
      view.render(recordFor(c, demo));
      for (const b of all(doc, '.badge')) seen.set(b.textContent, b.className);
    }
  }
  const want = { 'Needs data (not computed)': 's-needs', 'Indeterminate (cannot say)': 's-indet', 'Not applicable': 's-na', 'Conflict (records disagree)': 's-conflict', 'Parameter not enabled': 's-off', Value: 's-value' };
  for (const [label, cls] of Object.entries(want)) {
    assert.ok([...seen].some(([t, c]) => t === label && c.includes(cls)), `${label} appears with ${cls}`);
  }
  assert.equal(new Set(Object.values(want)).size, Object.keys(want).length, 'one style each');
  assert.ok(seen.has('Enabled') && seen.has('Disabled'));
  assert.ok(seen.has('Test-only placeholder') === false, 'the placeholder note is a table cell, not a badge');
});

test('parameters: enabled show value, units and role; disabled show none; placeholders are flagged', () => {
  const { doc, view } = page();
  view.render(recordFor(index.cases.find((c) => c.case.startsWith('normal-01')), true));
  const rows = all(doc, 'tbody tr').filter((r) => r.children.length === 5);
  const row = (id) => [...rows].find((r) => r.children[0].textContent === id);
  assert.equal(row('targetIntervalDuration').children[2].textContent, '120 min');
  assert.equal(row('targetIntervalDuration').children[4].textContent, 'Test-only placeholder');
  assert.match(row('targetIntervalDuration').children[3].textContent, /\S/);
  assert.equal(row('populationScope').children[1].textContent, 'Disabled');
  assert.equal(row('populationScope').children[2].textContent, '\u2014');
  assert.equal(row('populationScope').children[4].textContent, '');
});

test('not enabled results name the parameters they need; missing-data notes show', () => {
  const { doc, view } = page();
  view.render(recordFor(index.cases.find((c) => c.case.startsWith('normal-02')), false));
  assert.ok(text(doc).includes('Needs parameters: '));
  view.render(recordFor(index.cases.find((c) => c.case.startsWith('missing-01')), true));
  assert.ok(text(doc).includes('Missing-data notes'));
  assert.ok(all(doc, '#out li').length > 0);
});

test('a failed record shows the failure banner, the failure and the refusal; no results', () => {
  const { doc, view } = page();
  const rec = recordFor(index.cases[0], false);
  const failed = { ...clone(rec), status: 'failed', failure: { rule: 'validation', message: 'envelope refused: unrecognised critical field (IMP-113)' }, results: [] };
  failed.importReport.outcome = 'refused';
  failed.importReport.refusalReason = 'envelope refused: unrecognised critical field (IMP-113)';
  view.render(failed);
  assert.ok(banners(doc).includes('This run failed. There are no results.'));
  assert.ok(text(doc).includes('Failure') && text(doc).includes('IMP-113') && text(doc).includes('No results.'));
});

test('hostile strings stay text: nothing is created, nothing runs, nothing is dropped', () => {
  const { dom, doc, view } = page();
  const evil = ['<img src=x onerror=alert(1)>', '<script>window.pwned=1</script>', '"><svg onload=alert(1)>', "' onmouseover='x", '</td></tr></table><b>x</b>', 'javascript:alert(1)'];
  const rec = recordFor(index.cases.find((c) => c.case.startsWith('normal-01')), true);
  rec.id = evil[0];
  rec.package.id = evil[1];
  rec.package.version = evil[2];
  rec.warnings = [evil[0], evil[3]];
  rec.limitations = [evil[4]];
  rec['x-demo'] = { placeholders: true };
  rec.importReport.refusalReason = evil[1];
  rec.results[0].outputId = evil[2];
  rec.results[0].warnings = [evil[0]];
  rec.results[0].limitations = [evil[1]];
  rec.results[0].missingDataNotes = [evil[5]];
  rec.results[1].state = evil[0];
  delete rec.results[1].value;
  rec.results[2] = { ...rec.results[2], value: { label: evil[2] } };
  rec.parameters[0].suppliedBy = evil[1];
  rec.parameters[1].id = evil[4];
  rec.snapshot.observations[0].status = evil[0];
  assert.equal(view.render(rec), true);
  const out = doc.getElementById('out');
  const t = out.textContent;
  for (const e of [evil[0], evil[1], evil[2], evil[3], evil[4], evil[5]]) assert.ok(t.includes(e), `shown as text: ${e}`);
  for (const bad of ['img', 'script', 'svg', 'iframe', 'b', 'a']) assert.equal(out.querySelectorAll(bad).length, 0, `no <${bad}> created`);
  assert.equal(doc.querySelectorAll('script').length, 1);
  for (const node of all(doc, '*')) for (const a of node.attributes) assert.equal(/^on/i.test(a.name), false, `${node.tagName} ${a.name}`);
  assert.equal(dom.window.pwned, undefined);
  assert.equal(all(out, '[class]').every((n) => /^[a-z0-9 -]+$/.test(n.className)), true, 'class names never come from data');
});

test('odd input: not a record, wrong shapes, huge text and unknown states do not break the page', () => {
  const { doc, view } = page();
  for (const junk of [null, 42, 'x', [], {}, { id: 'a' }, { ...recordFor(index.cases[0], false), results: 'no' }]) {
    assert.equal(view.render(junk), false);
    assert.equal(text(doc), 'This file is not a CCIS run record this viewer can read.');
  }
  const rec = recordFor(index.cases[0], false);
  rec.warnings = ['x'.repeat(50000)];
  rec.results[0].state = 'something-new';
  delete rec.results[0].value;
  assert.equal(view.render(rec), true);
  assert.ok(all(doc, '.s-unknown').some((b) => b.textContent === 'something-new'));
  assert.ok(text(doc).length < 40000, 'long text is cut');
});

test('opening a file: valid record renders, bad JSON and oversize files give a plain message', async () => {
  const { dom, doc } = page();
  const input = doc.getElementById('file');
  const open = (file) => new Promise((resolve) => {
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new dom.window.Event('change'));
    setTimeout(resolve, 60);
  });
  const rec = recordFor(index.cases[0], true);
  await open(new dom.window.File([JSON.stringify(rec)], 'r.json', { type: 'application/json' }));
  assert.ok(text(doc).includes(rec.id));
  await open(new dom.window.File(['{ not json <img src=x>'], 'b.json'));
  assert.equal(text(doc), 'The file is not valid JSON.');
  assert.equal(doc.querySelectorAll('img').length, 0);
  await open(new dom.window.File([JSON.stringify({ a: 1 })], 'c.json'));
  assert.equal(text(doc), 'This file is not a CCIS run record this viewer can read.');
  await open(new dom.window.File([new Uint8Array(5000001)], 'big.json'));
  assert.equal(text(doc), 'The file is too large for this viewer.');
});

// APP BUILD (row 3.8): the only file here that touches the disk. Prototype. Synthetic data only. Not for clinical use.
//
//   node scripts/build-app.js           writes index.html
//   node scripts/build-app.js --check   rebuilds in memory and fails if index.html differs (writes nothing)
//   --out <path> names another target file (used by the tests to check a tampered copy)
//
// One classic inline script (esbuild, not minified), `node:crypto` replaced by ccis-sha256.js in the bundle only,
// the SHA-256 of the script and of the style written into the CSP. No network, no clock.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';

const here = (p) => new URL(`../${p}`, import.meta.url);
export const OUT = here('index.html');

export const CSP_DIRECTIVES = ['default-src', 'img-src', 'connect-src', 'font-src', 'frame-src', 'object-src', 'base-uri', 'form-action'];
const b64 = (text) => createHash('sha256').update(text, 'utf8').digest('base64');

export function bundleScript() {
  const r = buildSync({
    entryPoints: [fileURLToPath(here('ccis-app.js'))],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: false,
    legalComments: 'none',
    alias: { 'node:crypto': fileURLToPath(here('ccis-sha256.js')) },
    logLevel: 'silent',
  });
  const text = r.outputFiles[0].text;
  if (text.toLowerCase().includes('</script')) throw new Error('The bundle contains "</script"; refusing to inline it.');
  return text;
}

export function buildApp() {
  const script = bundleScript();
  const style = readFileSync(here('ccis-app.css'), 'utf8');
  const csp = `default-src 'none'; script-src 'sha256-${b64(script)}'; style-src 'sha256-${b64(style)}'; ` +
    CSP_DIRECTIVES.slice(1).map((d) => `${d} 'none'`).join('; ');
  const template = readFileSync(here('ccis-app.template.html'), 'utf8');
  // Function replacers: the bundle holds "$&" and similar, which a string replacement would expand.
  return template.replace('{{CSP}}', () => csp).replace('{{STYLE}}', () => style).replace('{{SCRIPT}}', () => script);
}

export function main(argv = process.argv.slice(2)) {
  const want = buildApp();
  const i = argv.indexOf('--out');
  const out = i >= 0 ? pathToFileURL(argv[i + 1]) : OUT;
  if (argv.includes('--check')) {
    let have = null;
    try { have = readFileSync(out, 'utf8'); } catch { have = null; }
    if (have !== want) { console.error(have === null ? 'missing: index.html' : 'differs: index.html'); return 1; }
    console.log('index.html matches a fresh build.');
    return 0;
  }
  writeFileSync(out, want);
  console.log(`index.html written (${want.length} characters).`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main();

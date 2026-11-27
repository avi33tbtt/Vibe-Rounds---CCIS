// APP BUILD (row 3.8): the only file here that touches the disk. Prototype. Synthetic data only. Not for clinical use.
//
//   node scripts/build-app.js           writes index.html
//   node scripts/build-app.js --check   rebuilds in memory and fails if index.html differs (writes nothing)
//   --out <path> names another target file (used by the tests to check a tampered copy)
//   --market-base <url> (row 4.1a, only with --out): a distribution page whose CSP allows requests to that one address
//   --ai-origin <origin> (row 4.3a.1, only with --out): also allows requests to the model API origin and nothing else
//
// One classic inline script (esbuild, not minified), `node:crypto` replaced by ccis-sha256.js in the bundle only,
// the SHA-256 of the script and of the style written into the CSP. No network, no clock.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { goodBase } from '../ccis-remote.js';
import { AI_ORIGIN } from '../ccis-app-ai.js';

const here = (p) => new URL(`../${p}`, import.meta.url);
export const OUT = here('index.html');

export const CSP_DIRECTIVES = ['default-src', 'img-src', 'connect-src', 'font-src', 'frame-src', 'object-src', 'base-uri', 'form-action', 'worker-src', 'media-src', 'manifest-src', 'child-src'];
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

export function buildApp({ marketBase, aiOrigin } = {}) {
  // One acceptable address (goodBase), plain visible characters only: no wildcard, separator or space reaches the CSP.
  if (marketBase !== undefined && !(goodBase(marketBase) && /^[A-Za-z0-9:/._~-]+$/.test(marketBase))) throw new Error('market base is not acceptable');
  if (aiOrigin !== undefined && aiOrigin !== AI_ORIGIN) throw new Error('ai origin is not acceptable');
  const connect = [marketBase, aiOrigin].filter((x) => x !== undefined).join(' ') || "'none'";
  const script = bundleScript();
  const style = readFileSync(here('ccis-app.css'), 'utf8');
  const csp = `default-src 'none'; script-src 'sha256-${b64(script)}'; style-src 'sha256-${b64(style)}'; ` +
    CSP_DIRECTIVES.slice(1).map((d) => `${d} ${d === 'connect-src' ? connect : "'none'"}`).join('; ') + "; script-src-attr 'none'; style-src-attr 'none'";
  const template = readFileSync(here('ccis-app.template.html'), 'utf8');
  // Function replacers: the bundle holds "$&" and similar, which a string replacement would expand.
  return template.replace('{{CSP}}', () => csp).replace('{{STYLE}}', () => style).replace('{{SCRIPT}}', () => script);
}

export function main(argv = process.argv.slice(2)) {
  const i = argv.indexOf('--out');
  const b = argv.indexOf('--market-base');
  const a = argv.indexOf('--ai-origin');
  if ((b >= 0 || a >= 0) && i < 0) { console.error('a distribution build needs --out'); return 1; }
  let want;
  try { want = buildApp({ ...(b >= 0 && { marketBase: argv[b + 1] }), ...(a >= 0 && { aiOrigin: argv[a + 1] ?? '' }) }); } catch (e) { console.error(e.message); return 1; }
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

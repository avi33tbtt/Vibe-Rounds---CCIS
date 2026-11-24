// MARKET BUILD (row 3.6): the only file here that touches the disk. Prototype. Synthetic data only. Not for clinical use.
//
//   node scripts/market-build.js           publishes the snake element, both analytics versions and the pathway into market/
//   node scripts/market-build.js --check   rebuilds in memory and fails if market/ differs (writes nothing)
//
// No network. The core is `ccis-market.js`; this script reads the examples, calls it, and writes the result.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalize } from '../ccis-compile.js';
import { emptyMarket, publishArtefact, indexText } from '../ccis-market.js';

const EX = new URL('../ccis/examples/snake/', import.meta.url);
const FIX = new URL('../ccis/fixtures/snake/index.json', import.meta.url);
export const MARKET_DIR = new URL('../market/', import.meta.url);

// Dependency order: the element first, then the analytics, then the pathway that names them.
export const ORDER = [
  'snake-envenomation.element.json',
  'snake-interval.analytics.json',
  'snake-completeness.analytics.json',
  'snake-interval.analytics.0.1.1.json',
  'snake-completeness.analytics.0.1.1.json',
  'snake-documentation.pathway.json',
];

export function buildMarket() {
  const fixtures = JSON.parse(readFileSync(FIX, 'utf8')).cases.map((c) => c.case);
  let market = emptyMarket();
  for (const name of ORDER) {
    const text = readFileSync(new URL(name, EX), 'utf8');
    const c = canonicalize(text);
    if (!c.ok) throw new Error(`${name}: ${c.code}`);
    const r = publishArtefact({ market, artefact: JSON.parse(text), fixtures });
    if (!r.ok) throw new Error(`${name}: ${r.refusal.id} ${JSON.stringify(r.refusal.detail ?? {})}`);
    market = r.market;
  }
  return market;
}

export const marketFiles = (market) => ({ 'index.json': indexText(market), ...market.files });

function walk(dir, base = '') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = base === '' ? e.name : `${base}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(new URL(`${e.name}/`, dir), rel));
    else if (e.name !== '.gitattributes') out.push(rel);
  }
  return out;
}

export function main(argv = process.argv.slice(2)) {
  const want = marketFiles(buildMarket());
  if (argv.includes('--check')) {
    const have = existsSync(MARKET_DIR) ? walk(MARKET_DIR) : [];
    const problems = [];
    for (const [rel, text] of Object.entries(want)) {
      if (!have.includes(rel)) problems.push(`missing: ${rel}`);
      else if (readFileSync(new URL(rel, MARKET_DIR), 'utf8') !== text) problems.push(`differs: ${rel}`);
    }
    for (const rel of have) if (!(rel in want)) problems.push(`unlisted: ${rel}`);
    if (problems.length > 0) { console.error(problems.join('\n')); return 1; }
    console.log(`market/ matches a fresh build (${Object.keys(want).length} files).`);
    return 0;
  }
  if (existsSync(MARKET_DIR)) for (const rel of walk(MARKET_DIR)) rmSync(new URL(rel, MARKET_DIR));
  for (const [rel, text] of Object.entries(want)) {
    const target = new URL(rel, MARKET_DIR);
    mkdirSync(dirname(target.pathname), { recursive: true });
    writeFileSync(target, text);
  }
  console.log(`market/ written (${Object.keys(want).length} files).`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main();

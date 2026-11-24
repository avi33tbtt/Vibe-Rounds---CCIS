// BROWSER APP (rows 3.8, 3.8a, 3.8b.2). Prototype. Synthetic data only. Not for clinical use.
// Loads a market folder and imports one envelope against it; runs nothing yet. Later rows add one small module each.
// The seam exposes counts and booleans only. The loaded market stays in this closure (D-153).

import { checksumOf } from './ccis-compile.js';
import { mountMarketView } from './ccis-app-market-view.js';
import { mountImportView } from './ccis-app-import-view.js';

const app = { marketLoaded: false, entries: 0, runs: 0, refused: false };
const imp = { imported: false, refused: false, accepted: 0, rejected: 0, unmapped: 0, ambiguous: 0 };
let market = null;
const status = document.getElementById('status');
const setStatus = (t) => { if (status) status.textContent = t; };
setStatus('Ready. No market is loaded and nothing has been run.');

let importView = null;
const importRoot = document.getElementById('import');
if (importRoot) {
  importView = mountImportView({
    document,
    root: importRoot,
    getMarket: () => market,
    onState: (s) => {
      for (const k of Object.keys(imp)) imp[k] = s[k];
      setStatus(s.message);
    },
  });
}

const root = document.getElementById('market');
if (root) {
  mountMarketView({
    document,
    root,
    onState: (s) => {
      market = s.market ?? null;
      if (importView) importView.reset(); // a report never outlives the market it was checked against; the market message below wins
      app.marketLoaded = s.loaded;
      app.entries = s.entries;
      app.refused = s.refused;
      setStatus(s.message);
    },
  });
}

window.ccisApp = {
  state: () => ({ ...app }),
  importState: () => ({ ...imp }),
  checksumOf,
};

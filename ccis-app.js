// BROWSER APP (rows 3.8, 3.8a, 3.8b.2). Prototype. Synthetic data only. Not for clinical use.
// Loads a market folder, imports one envelope against it and chooses a context and pathway; runs nothing yet. Later rows add one small module each.
// The seam exposes counts and booleans only. The loaded market stays in this closure (D-153).

import { checksumOf } from './ccis-compile.js';
import { mountMarketView } from './ccis-app-market-view.js';
import { mountImportView } from './ccis-app-import-view.js';
import { mountSelectorView } from './ccis-app-selector-view.js';

const app = { marketLoaded: false, entries: 0, runs: 0, refused: false };
const imp = { imported: false, refused: false, accepted: 0, rejected: 0, unmapped: 0, ambiguous: 0 };
const sel = { contextChosen: false, pathwayChosen: false, mismatch: false, ready: false };
let market = null;
const status = document.getElementById('status');
const setStatus = (t) => { if (status) status.textContent = t; };
setStatus('Ready. No market is loaded and nothing has been run.');

// The selector is mounted first: the market and import callbacks below call it. Its state never sets the status line (D-159).
let selectorView = null;
const selectRoot = document.getElementById('select');
if (selectRoot) {
  selectorView = mountSelectorView({
    document,
    root: selectRoot,
    onState: (s) => { for (const k of Object.keys(sel)) sel[k] = s[k]; },
  });
}

let importView = null;
const importRoot = document.getElementById('import');
if (importRoot) {
  importView = mountImportView({
    document,
    root: importRoot,
    getMarket: () => market,
    onState: (s) => {
      for (const k of Object.keys(imp)) imp[k] = s[k];
      if (selectorView) selectorView.setImport(s.applied);
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
      if (selectorView) selectorView.setMarket(market); // the selection never outlives its market
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
  selectorState: () => ({ ...sel }),
  checksumOf,
};

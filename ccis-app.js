// BROWSER APP (rows 3.8, 3.8a, 3.8b.2, 3.8d.2). Prototype. Synthetic data only. Not for clinical use.
// Loads a market folder, imports one envelope against it and chooses a context and pathway; runs nothing yet. Later rows add one small module each.
// The seam exposes counts and booleans only. The loaded market stays in this closure (D-153).

import { checksumOf } from './ccis-compile.js';
import { mountMarketView } from './ccis-app-market-view.js';
import { mountImportView } from './ccis-app-import-view.js';
import { mountSelectorView } from './ccis-app-selector-view.js';
import { mountCatalogueView } from './ccis-app-catalogue-view.js';
import { compatibilityFor } from './ccis-app-catalogue.js';

const app = { marketLoaded: false, entries: 0, runs: 0, refused: false };
const imp = { imported: false, refused: false, accepted: 0, rejected: 0, unmapped: 0, ambiguous: 0 };
const sel = { contextChosen: false, pathwayChosen: false, mismatch: false, ready: false };
const cat = { shown: false, rows: 0, needsData: 0, incompatible: 0, other: 0 };
let market = null;
let catalogueView = null; // declared before any mount: the selector calls back at mount
let selectorView = null;
let importView = null;
const refreshCatalogue = () => {
  if (!catalogueView) return;
  const result = compatibilityFor({ market, pathwayKey: selectorView?.selectedPathwayKey() ?? null, context: importView?.getContext() ?? null });
  if (result.ok === true) catalogueView.showResult(result.result);
  else catalogueView.showSentence(result.sentence);
};
const status = document.getElementById('status');
const setStatus = (t) => { if (status) status.textContent = t; };
setStatus('Ready. No market is loaded and nothing has been run.');

// The catalogue is mounted before the selector and import views: they call refreshCatalogue back (no context or model goes on window).
const compatRoot = document.getElementById('compat');
if (compatRoot) {
  catalogueView = mountCatalogueView({
    document,
    root: compatRoot,
    onState: (s) => { for (const k of Object.keys(cat)) cat[k] = s[k]; },
  });
}

// The selector is mounted next: the market and import callbacks below call it. Its state never sets the status line (D-159).
const selectRoot = document.getElementById('select');
if (selectRoot) {
  selectorView = mountSelectorView({
    document,
    root: selectRoot,
    onState: (s) => {
      for (const k of Object.keys(sel)) sel[k] = s[k];
      refreshCatalogue();
    },
  });
}

const importRoot = document.getElementById('import');
if (importRoot) {
  importView = mountImportView({
    document,
    root: importRoot,
    getMarket: () => market,
    onState: (s) => {
      for (const k of Object.keys(imp)) imp[k] = s[k];
      if (selectorView) selectorView.setImport(s.applied);
      refreshCatalogue();
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
      refreshCatalogue();
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
  catalogueState: () => ({ ...cat }),
  checksumOf,
};

// BROWSER APP (rows 3.8, 3.8a, 3.8b.2, 3.8d.2). Prototype. Synthetic data only. Not for clinical use.
// Loads a market folder, imports one envelope against it and chooses a context and pathway; runs nothing yet. Later rows add one small module each.
// The seam exposes counts and booleans only. The loaded market stays in this closure (D-153).

import { checksumOf } from './ccis-compile.js';
import { mountMarketView } from './ccis-app-market-view.js';
import { mountImportView } from './ccis-app-import-view.js';
import { mountSelectorView } from './ccis-app-selector-view.js';
import { mountCatalogueView } from './ccis-app-catalogue-view.js';
import { mountRunView } from './ccis-app-run-view.js';
import { mountResultsView } from './ccis-app-results-view.js';
import { mountExportView } from './ccis-app-export-view.js';
import { runForPage } from './ccis-app-run.js';
import { compatibilityFor, catalogueModel } from './ccis-app-catalogue.js';

const app = { marketLoaded: false, entries: 0, runs: 0, refused: false };
const imp = { imported: false, refused: false, accepted: 0, rejected: 0, unmapped: 0, ambiguous: 0 };
const sel = { contextChosen: false, pathwayChosen: false, mismatch: false, ready: false };
const cat = { shown: false, rows: 0, needsData: 0, incompatible: 0, other: 0 };
const results = { shown: false, state: 'none', groups: 0, items: 0, trace: 0, missing: 0 };
const exported = { shown: false, verified: false, saved: false };
const run = { ready: false, selected: 0, ran: false, failed: false, results: 0, skipped: 0, refused: false };
let market = null;
let exportView = null;
let resultsView = null;
let runView = null; // declared before any mount: the other views call back at mount
let lastRecord = null; // in this closure only, for row 3.9a; never on window
let lastSkipped = [];
let catalogueView = null; // declared before any mount: the selector calls back at mount
let selectorView = null;
let importView = null;
// A changed market, import or choice never leaves a stale record.
const refreshRun = () => {
  if (!runView) return;
  lastRecord = null;
  lastSkipped = [];
  resultsView?.reset();
  exportView?.reset();
  const result = compatibilityFor({ market, pathwayKey: selectorView?.selectedPathwayKey() ?? null, context: importView?.getContext() ?? null });
  const rows = result.ok === true
    ? catalogueModel(result.result).rows.filter((r) => r.kind === 'analytics-package').map((r) => ({ id: r.id, version: r.version, label: r.label, mayRun: r.mayRun }))
    : [];
  runView.setChoices(rows);
  runView.setReady(rows.length > 0 && importView?.getResult() != null);
};
const refreshCatalogue = () => {
  if (!catalogueView) return;
  const result = compatibilityFor({ market, pathwayKey: selectorView?.selectedPathwayKey() ?? null, context: importView?.getContext() ?? null });
  if (result.ok === true) catalogueView.showResult(result.result);
  else catalogueView.showSentence(result.sentence);
  refreshRun();
};
// The one place in the bundle that uses Blob and URL (D-182): a local file save, no network.
const savePage = ({ filename, text }) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
  return true;
};
const status = document.getElementById('status');
const setStatus = (t) => { if (status) status.textContent = t; };
setStatus('Ready. No market is loaded and nothing has been run.');

// The run view is mounted first of all: every other view calls back at mount. Its state never sets the status line.
const runRoot = document.getElementById('run');
if (runRoot) {
  runView = mountRunView({
    document,
    root: runRoot,
    onState: (s) => { for (const k of Object.keys(run)) run[k] = s[k]; },
    run: (a) => runForPage({ market, pathwayKey: selectorView?.selectedPathwayKey() ?? null, importResult: importView?.getResult() ?? null, supplied: {}, evaluationTime: a.evaluationTime, runNeedsData: a.runNeedsData, only: a.only }),
    onRun: (record, skipped) => { lastRecord = record; lastSkipped = skipped; resultsView?.show({ ok: true, record, skipped }); exportView?.show(record); },
  });
}
const resultsRoot = document.getElementById('results');
if (resultsRoot) {
  resultsView = mountResultsView({
    document,
    root: resultsRoot,
    onState: (s) => { for (const k of Object.keys(results)) results[k] = s[k]; },
  });
}
const exportRoot = document.getElementById('export');
if (exportRoot) {
  exportView = mountExportView({
    document,
    root: exportRoot,
    onState: (s) => { for (const k of Object.keys(exported)) exported[k] = s[k]; },
    save: savePage,
  });
}

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
  runState: () => ({ ...run }),
  resultsState: () => ({ ...results }),
  exportState: () => ({ ...exported }),
  checksumOf,
};

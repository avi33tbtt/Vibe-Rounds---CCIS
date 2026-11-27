// BROWSER APP (rows 3.8, 3.8a, 3.8b.2, 3.8d.2). Prototype. Synthetic data only. Not for clinical use.
// Loads a market folder, imports one envelope against it and chooses a context and pathway; runs nothing yet. Later rows add one small module each.
// The seam exposes counts and booleans only. The loaded market stays in this closure (D-153).

import { checksumOf } from './ccis-compile.js';
import { mountMarketView } from './ccis-app-market-view.js';
import { mountRemoteView } from './ccis-app-remote-view.js';
import { goodBase } from './ccis-remote.js';
import { makeFetchText } from './ccis-app-fetch.js';
import { mountImportView } from './ccis-app-import-view.js';
import { mountSelectorView } from './ccis-app-selector-view.js';
import { mountCatalogueView } from './ccis-app-catalogue-view.js';
import { mountRunView } from './ccis-app-run-view.js';
import { mountResultsView } from './ccis-app-results-view.js';
import { mountExportView } from './ccis-app-export-view.js';
import { runForPage } from './ccis-app-run.js';
import { compatibilityFor, catalogueModel } from './ccis-app-catalogue.js';
import { mountDraftView } from './ccis-app-draft-view.js';
import { draftForPage } from './ccis-app-draft.js';
import { makeAiClient } from './ccis-app-ai.js';
import { DRAFT_TYPES } from './ccis-draft.js';
import { SOURCE_KINDS } from './ccis-sdk-analytics.js';

const app = { marketLoaded: false, entries: 0, runs: 0, refused: false };
const imp = { imported: false, refused: false, accepted: 0, rejected: 0, unmapped: 0, ambiguous: 0 };
const sel = { contextChosen: false, pathwayChosen: false, mismatch: false, ready: false };
const cat = { shown: false, rows: 0, needsData: 0, incompatible: 0, other: 0 };
const results = { shown: false, state: 'none', groups: 0, items: 0, trace: 0, missing: 0 };
const remote = { available: false, loaded: false, refused: false, source: 'none' };
const exported = { shown: false, verified: false, saved: false };
const drafted = { enabled: false, hasKey: false, ready: false, drafted: false, refused: false, rows: 0 };
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

// Row 4.1c: the marketplace address is read from this page's own CSP (D-220): `connect-src 'none'` means no address.
const marketBaseFromCsp = () => {
  const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  const hit = m && /(?:^|;)\s*connect-src\s+([^;\s]+)/.exec(m.getAttribute('content') || '');
  return hit && hit[1] !== "'none'" && goodBase(hit[1]) ? hit[1] : undefined;
};
let folderHandle = null;
let remoteHandle = null;
// One market is live at a time: whichever view loads, the other is cleared first (it makes no callback).
const onMarket = (s, from) => {
  if (s.loaded) (from === 'folder' ? remoteHandle : folderHandle)?.reset();
  remote.loaded = s.loaded && from === 'remote';
  remote.refused = s.refused && from === 'remote';
  remote.source = s.loaded ? from : 'none';
  market = s.market ?? null;
  if (importView) importView.reset(); // a report never outlives the market it was checked against; the market message below wins
  if (selectorView) selectorView.setMarket(market); // the selection never outlives its market
  refreshCatalogue();
  app.marketLoaded = s.loaded;
  app.entries = s.entries;
  app.refused = s.refused;
  setStatus(s.message);
};
const root = document.getElementById('market');
if (root) folderHandle = mountMarketView({ document, root, onState: (s) => onMarket(s, 'folder') });
const remoteRoot = document.getElementById('remote');
if (remoteRoot) {
  const base = marketBaseFromCsp();
  remote.available = base !== undefined && typeof window.fetch === 'function';
  remoteHandle = mountRemoteView({ document, root: remoteRoot, base, fetchText: remote.available ? makeFetchText(window.fetch.bind(window)) : undefined, onState: (s) => onMarket(s, 'remote') });
}

// Row 4.3b.2: the AI draft view. Off by default. The key passes through this closure only and is never kept; the page keeps no draft.
// In the committed page the CSP blocks the request (connect-src 'none'); only a build with --ai-origin can reach the model.
const draftRoot = document.getElementById('draft');
if (draftRoot) {
  const client = typeof window.fetch === 'function' ? makeAiClient(window.fetch.bind(window)) : undefined;
  mountDraftView({
    document,
    root: draftRoot,
    onState: (s) => { for (const k of Object.keys(drafted)) drafted[k] = s[k]; },
    types: DRAFT_TYPES,
    kinds: SOURCE_KINDS,
    draft: (a) => draftForPage({ ...a, client }),
  });
}

window.ccisApp = {
  state: () => ({ ...app }),
  importState: () => ({ ...imp }),
  remoteState: () => ({ ...remote }),
  selectorState: () => ({ ...sel }),
  catalogueState: () => ({ ...cat }),
  runState: () => ({ ...run }),
  resultsState: () => ({ ...results }),
  exportState: () => ({ ...exported }),
  draftState: () => ({ ...drafted }),
  checksumOf,
};

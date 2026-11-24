// BROWSER APP (rows 3.8, 3.8a). Prototype. Synthetic data only. Not for clinical use.
// Loads a market folder the person picks and shows it; imports and runs nothing yet. Later rows add one small module each.
// The seam exposes counts and booleans only.

import { checksumOf } from './ccis-compile.js';
import { mountMarketView } from './ccis-app-market-view.js';

const app = { marketLoaded: false, entries: 0, runs: 0, refused: false };
const status = document.getElementById('status');
const setStatus = (t) => { if (status) status.textContent = t; };
setStatus('Ready. No market is loaded and nothing has been run.');

const root = document.getElementById('market');
if (root) {
  mountMarketView({
    document,
    root,
    onState: (s) => {
      app.marketLoaded = s.loaded;
      app.entries = s.entries;
      app.refused = s.refused;
      setStatus(s.message);
    },
  });
}

window.ccisApp = {
  state: () => ({ ...app }),
  checksumOf,
};

// BROWSER APP, row 3.8 stub. Prototype. Synthetic data only. Not for clinical use.
// Loads nothing and runs nothing yet; rows 3.8a onward add one small module each. The seam exposes counts only.

import { checksumOf } from './ccis-compile.js';

const status = document.getElementById('status');
if (status) status.textContent = 'Ready. No market is loaded and nothing has been run.';

window.ccisApp = {
  state: () => ({ marketLoaded: false, entries: 0, runs: 0 }),
  checksumOf,
};

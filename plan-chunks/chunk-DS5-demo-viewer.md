# Chunk DS5-demo-viewer: Static result viewer

_Needs: DS4._ **Core rules:** attach `01-core.md`.
**Build:**
1. `ccis-viewer.html` (single file, no network, strict CSP, no inline handlers): open a run record file; show outputs with value or declared state, missing-data notes, warnings, limitations, parameters (enabled or disabled), package, engine and standard versions, run id, input snapshot summary (counts only, no identity).
2. Banners: "Synthetic data, prototype, not for clinical use"; and the demo-parameter banner when `x-demo` is present.
3. All text through one shared escaper; jsdom tests including hostile strings.
**Done when:** a run record opens and every state is distinguishable.
**Size guard:** 1 page, 1 test file.

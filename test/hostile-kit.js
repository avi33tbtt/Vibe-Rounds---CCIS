// Row 3.10.1c: shared support for the hostile-string sweeps (test support only; holds no test cases). Prototype. Synthetic data only. Not for clinical use.
// Moved verbatim from test/ccis-app-hostile-sweep.test.js: HOSTILE and inert. New: feedFiles.
import assert from 'node:assert/strict';

// HOSTILE: data. Adding a string needs no code change.
export const HOSTILE = [
  '<img src=x onerror=1>',
  '</p><script>alert(1)</script>',
  '"><svg onload=1>',
  'javascript:alert(1)',
  '<a href="javascript:1">x</a>',
  '<'.repeat(3000),
];

const BAD_TAGS = 'script,style,iframe,img,svg,math,form,object,embed,link,base,a';
// An option or input `value` is data, not a navigation target, so `javascript:` is checked in every other attribute (D-190).
export function inert(root, where) {
  const found = { badElements: root.querySelectorAll(BAD_TAGS).length, on: 0, style: 0, urlAttr: 0, jsValue: 0 };
  for (const el of root.querySelectorAll('*')) {
    for (const a of el.attributes) {
      const n = a.name.toLowerCase();
      if (n.startsWith('on')) found.on++;
      if (n === 'style') found.style++;
      if (n === 'href' || n === 'src') found.urlAttr++;
      if (n !== 'value' && /javascript:/i.test(a.value)) found.jsValue++;
    }
  }
  assert.deepEqual(found, { badElements: 0, on: 0, style: 0, urlAttr: 0, jsValue: 0 }, `${where}: ${JSON.stringify(found)}`);
}

// feedFiles: give a file input fake File objects and run the view's async change handler to the end.
// files: [{ name, path, text }]; `path` becomes webkitRelativePath (use '' for a single file picked by name).
export async function feedFiles(w, input, files) {
  const fake = files.map(({ name = '', path = '', text }) => ({ name, size: text.length, webkitRelativePath: path, text: async () => text }));
  Object.defineProperty(input, 'files', { value: fake, configurable: true });
  input.dispatchEvent(new w.Event('change'));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

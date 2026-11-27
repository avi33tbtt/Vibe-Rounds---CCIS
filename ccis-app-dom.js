// BROWSER APP, row 3.10.1: the shared DOM helper. Prototype. Synthetic data only. Not for clinical use.
//
// Text reaches the page only through textContent. A tag must be on the allowed list and a class must match a fixed
// pattern, so a string from a run record can never become markup, a tag or a class. Pure apart from the document it is given.

export const ALLOWED_TAGS = Object.freeze([
  'a', 'br', 'button', 'details', 'div', 'h2', 'h3', 'h4', 'input', 'label', 'li', 'option', 'p', 'select', 'span', 'strong',
  'summary', 'table', 'tbody', 'td', 'textarea', 'th', 'thead', 'tr', 'ul',
]);
export const refuseNames = Object.freeze({ tag: 'dom-tag-refused', cls: 'dom-class-refused' });

const WORD = /^[a-z][a-z0-9-]{0,30}$/;
const classOk = (cls) => {
  const words = String(cls).split(' ');
  return words.length <= 3 && words.every((w) => WORD.test(w));
};

export function makeDom(document) {
  const el = (tag, content, cls) => {
    if (!ALLOWED_TAGS.includes(tag)) throw new Error(refuseNames.tag);
    if (cls && !classOk(cls)) throw new Error(refuseNames.cls);
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = String(content);
    if (cls) node.className = cls;
    return node;
  };
  const text = (content) => document.createTextNode(String(content));
  return { el, text };
}

// CCIS APP FETCH ADAPTER (row 4.1b): turns an injected browser fetch function into the one-string `fetchText` that
// loadRemoteMarket takes. Pure: it never names the global, so the caller injects it. Prototype. Synthetic data only.
//
// Every request is a plain GET with fixed options: no body, no headers, no credentials, no cache, no redirects, no referrer.
// Patient data cannot ride along: the function takes one string and the options are constant. Every failure is one fixed
// sentence that never quotes the address, the status text or the underlying error. No timeout is set (a timer is not allowed
// in the page); nothing changes until the whole market verifies, so a hang is only a wait.

const OPTIONS = Object.freeze({ method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', mode: 'cors' });
const FAILED = 'request failed';

export function makeFetchText(fetchFn) {
  if (typeof fetchFn !== 'function') throw new Error('fetch function is not acceptable');
  return async function fetchText(url) {
    if (typeof url !== 'string') throw new Error('request is not acceptable');
    let res;
    try { res = await fetchFn(url, OPTIONS); } catch { throw new Error(FAILED); }
    const good = res !== null && typeof res === 'object' && res.ok === true && res.status === 200 && res.redirected !== true && (res.type === 'basic' || res.type === 'cors');
    if (!good) throw new Error(FAILED);
    let text;
    try { text = await res.text(); } catch { throw new Error(FAILED); }
    if (typeof text !== 'string') throw new Error(FAILED);
    return text;
  };
}

import { api } from '../api';

// Cache key prefix
const PFX = 'rc_';

/**
 * Fetch a reference endpoint (classes, subjects, terms) with a localStorage
 * fallback. Always tries the network first; on any failure returns the last
 * known-good cached value so the app stays usable offline.
 */
export async function getCached(path, key) {
  try {
    const data = await api.get(path);
    localStorage.setItem(`${PFX}${key}`, JSON.stringify({ data, ts: Date.now() }));
    return data;
  } catch (err) {
    const raw = localStorage.getItem(`${PFX}${key}`);
    if (raw) {
      try {
        return JSON.parse(raw).data;
      } catch {}
    }
    throw err;
  }
}

/** Pre-warm all three reference caches in parallel (call on login). */
export function warmRefCache() {
  getCached('/classes',  'classes').catch(() => {});
  getCached('/subjects', 'subjects').catch(() => {});
  getCached('/terms',    'terms').catch(() => {});
}

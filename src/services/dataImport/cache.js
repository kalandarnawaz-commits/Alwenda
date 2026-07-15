/**
 * localStorage-backed cache for import connector results. Public APIs
 * like Overpass and Wikidata are shared, rate-limited resources — this
 * cache is what stops "do not repeatedly hit public APIs on every page
 * load" from being just a comment. Every connector call in the app should
 * go through readCache/writeCache rather than fetching unconditionally.
 */

const NAMESPACE = "alwenda:import:";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h — open data doesn't change minute to minute

function keyFor(source, category, area) {
  return `${NAMESPACE}${source}:${category}:${area || "default"}`;
}

function hasStorage() {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function readCache(source, category, area, { ttlMs = DEFAULT_TTL_MS } = {}) {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(keyFor(source, category, area));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    const age = Date.now() - entry.cachedAt;
    if (age > ttlMs) return null;
    return entry;
  } catch {
    return null;
  }
}

export function writeCache(source, category, area, payload) {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(
      keyFor(source, category, area),
      JSON.stringify({ cachedAt: Date.now(), payload })
    );
  } catch {
    // Storage full/unavailable (private browsing, quota) — fail silently,
    // caching is an optimization, not a correctness requirement.
  }
}

/** Clears one cached entry, or every import cache entry when no args are given. */
export function clearCache(source, category, area) {
  if (!hasStorage()) return 0;
  if (!source) {
    let cleared = 0;
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(NAMESPACE)) {
        localStorage.removeItem(key);
        cleared += 1;
      }
    }
    return cleared;
  }
  localStorage.removeItem(keyFor(source, category, area));
  return 1;
}

export function listCacheEntries() {
  if (!hasStorage()) return [];
  const entries = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(NAMESPACE)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key));
      entries.push({ key: key.slice(NAMESPACE.length), cachedAt: entry.cachedAt });
    } catch {
      // skip malformed entries
    }
  }
  return entries;
}

type CacheEntry = { exp: number; data: unknown };

const getCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

export function apiCacheGet(key: string) {
  const hit = getCache.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) {
    getCache.delete(key);
    return null;
  }
  return hit.data;
}

export function apiCacheSet(key: string, data: unknown, ttlMs: number) {
  getCache.set(key, { data, exp: Date.now() + ttlMs });
}

export function apiCacheGetInflight(key: string) {
  return inFlight.get(key) || null;
}

export function apiCacheSetInflight(key: string, promise: Promise<unknown>) {
  inFlight.set(key, promise);
  promise.finally(() => inFlight.delete(key));
}

export function apiCacheInvalidatePrefix(segment: string) {
  if (!segment) return;
  for (const key of [...getCache.keys()]) {
    if (key.includes(`/${segment}`)) getCache.delete(key);
  }
}

export function clearApiGetCache() {
  getCache.clear();
  inFlight.clear();
}

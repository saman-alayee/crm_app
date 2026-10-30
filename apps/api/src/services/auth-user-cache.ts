type CachedUser = {
  id: string;
  username: string;
  isActive: boolean;
  tokenVersion: number;
  exp: number;
};

const userCache = new Map<string, CachedUser>();
const USER_TTL_MS = 12_000;
const USER_CACHE_MAX = 400;

export function getCachedAuthUser(id: string, tokenVersion: number): CachedUser | null {
  const hit = userCache.get(id);
  if (!hit) return null;
  if (hit.exp < Date.now() || hit.tokenVersion !== tokenVersion) {
    userCache.delete(id);
    return null;
  }
  return hit;
}

export function setCachedAuthUser(user: Omit<CachedUser, 'exp'>) {
  if (userCache.size >= USER_CACHE_MAX) {
    const first = userCache.keys().next().value;
    if (first) userCache.delete(first);
  }
  userCache.set(user.id, { ...user, exp: Date.now() + USER_TTL_MS });
}

export function invalidateAuthUserCache(userId?: string) {
  if (userId) userCache.delete(userId);
  else userCache.clear();
}

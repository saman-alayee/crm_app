import {
  apiCacheGet,
  apiCacheGetInflight,
  apiCacheInvalidatePrefix,
  apiCacheSet,
  apiCacheSetInflight,
  clearApiGetCache,
} from '~/utils/apiCache';

type ApiOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  cacheTtlMs?: number;
};

export { clearApiGetCache };

export function useApi() {
  const auth = useAuthStore();
  const apiBase = useApiBase();

  async function api<T>(path: string, options: ApiOptions = {}) {
    const { cacheTtlMs, query, ...rest } = options;
    const method = String(rest.method || 'GET').toUpperCase();

    let url = `${apiBase.value}${path.startsWith('/') ? path : `/${path}`}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === '') continue;
        params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }

    const cacheKey = `${method}:${url}`;

    if (method === 'GET' && cacheTtlMs && cacheTtlMs > 0) {
      const hit = apiCacheGet(cacheKey);
      if (hit !== null) return hit as T;

      const pending = apiCacheGetInflight(cacheKey);
      if (pending) return pending as Promise<T>;
    }

    const headers: Record<string, string> = {
      ...(rest.headers || {}),
      ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
    };

    const req = $fetch<T>(url, {
      method: method as 'GET',
      body: rest.body as BodyInit | Record<string, unknown> | null | undefined,
      headers,
    })
      .then((data) => {
        if (method === 'GET' && cacheTtlMs && cacheTtlMs > 0) {
          apiCacheSet(cacheKey, data, cacheTtlMs);
        } else if (method !== 'GET') {
          const basePath = path.split('?')[0];
          const seg = basePath.split('/').filter(Boolean)[0] || '';
          apiCacheInvalidatePrefix(seg);
        }
        return data;
      })
      .catch((err: unknown) => {
        const status =
          (err as { statusCode?: number; status?: number })?.statusCode ||
          (err as { status?: number })?.status;
        if (status === 401) clearApiGetCache();
        throw err;
      });

    if (method === 'GET' && cacheTtlMs && cacheTtlMs > 0) {
      apiCacheSetInflight(cacheKey, req as Promise<unknown>);
    }

    return req;
  }

  return { api, apiBase, clearApiCache: clearApiGetCache };
}

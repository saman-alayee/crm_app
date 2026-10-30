/**
 * Resolve API base so PWA on phone (LAN IP / HTTPS domain) hits the right host.
 * Env NUXT_PUBLIC_API_BASE always wins when set to a non-localhost absolute URL.
 */
export function resolveApiBase(configured?: string) {
  const fromEnv = (configured || '').trim().replace(/\/$/, '');
  if (import.meta.client) {
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    if (fromEnv && !isLocalHost) {
      // If page is opened via LAN/domain but env points to 127.0.0.1, rewrite host
      try {
        const u = new URL(fromEnv);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          u.hostname = host;
          // Keep http for LAN; if site is https, prefer same protocol only when not private IP rewrite of http API
          return u.toString().replace(/\/$/, '');
        }
      } catch {
        /* fall through */
      }
    }
    if (!fromEnv || isLocalHost) {
      if (fromEnv && isLocalHost) return fromEnv;
      return `${window.location.protocol}//${host}:4000/api/v1`;
    }
    return fromEnv;
  }
  return fromEnv || 'http://127.0.0.1:4000/api/v1';
}

export function useApiBase() {
  const config = useRuntimeConfig();
  return computed(() => resolveApiBase(String(config.public.apiBase || '')));
}

import { resolveApiBase } from '~/composables/useApiBase';

/** Socket.IO connects to API origin (without /api/v1). */
export function resolveSocketBase(configured?: string) {
  const apiBase = resolveApiBase(configured);
  try {
    const u = new URL(apiBase);
    // strip trailing /api/v1 or /api
    u.pathname = u.pathname.replace(/\/?api(?:\/v1)?\/?$/, '/');
    return u.origin;
  } catch {
    if (import.meta.client) {
      const host = window.location.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1';
      // Public deploy: socket.io is proxied by nginx on :80
      return isLocal ? `${window.location.protocol}//${host}:4000` : window.location.origin;
    }
    return 'http://127.0.0.1:4000';
  }
}

export function useSocketBase() {
  const config = useRuntimeConfig();
  return computed(() => resolveSocketBase(String(config.public.apiBase || '')));
}

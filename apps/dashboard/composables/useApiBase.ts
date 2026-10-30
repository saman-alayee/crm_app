/**
 * Resolve API base so the panel hits the right host.
 * Behind nginx (VPS IP / domain): always same-origin `/api/v1` — never public :4000
 * (API binds to 127.0.0.1 only).
 */
export function resolveApiBase(configured?: string) {
  const fromEnv = (configured || '').trim().replace(/\/$/, '');
  if (import.meta.client) {
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';

    // Local Nuxt dev: talk to API on :4000 unless env overrides
    if (isLocalHost) {
      return fromEnv || `${window.location.protocol}//${host}:4000/api/v1`;
    }

    // Production / LAN / public IP: use nginx reverse-proxy on same origin
    if (fromEnv) {
      try {
        const u = new URL(fromEnv);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname !== host) {
          return `${window.location.origin}/api/v1`;
        }
        // Same host but maybe wrong port (e.g. :4000) — force same-origin path
        if (u.port && u.port !== '' && u.port !== '80' && u.port !== '443' && u.port !== window.location.port) {
          return `${window.location.origin}/api/v1`;
        }
        return fromEnv;
      } catch {
        return `${window.location.origin}/api/v1`;
      }
    }
    return `${window.location.origin}/api/v1`;
  }
  return fromEnv || 'http://127.0.0.1:4000/api/v1';
}

export function useApiBase() {
  const config = useRuntimeConfig();
  return computed(() => resolveApiBase(String(config.public.apiBase || '')));
}

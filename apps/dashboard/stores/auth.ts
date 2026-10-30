import { defineStore } from 'pinia';
import { firstAllowedPath } from '~/utils/routePermissions';
import { clearApiGetCache } from '~/utils/apiCache';

export type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  isActive: boolean;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    department: string | null;
  } | null;
};

const FULL_ACCESS_SLUGS = new Set(['owner', 'admin']);
const AUTH_CACHE_KEY = 'hr-auth-snapshot';

type AuthSnapshot = {
  user: AuthUser;
  permissions: string[];
  roles: { id: string; name: string; slug: string }[];
  savedAt: number;
};

function readSnapshot(): AuthSnapshot | null {
  if (!import.meta.client) return null;
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSnapshot;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > 10 * 60 * 1000) return null;
    if (!parsed.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(data: Omit<AuthSnapshot, 'savedAt'>) {
  if (!import.meta.client) return;
  try {
    sessionStorage.setItem(
      AUTH_CACHE_KEY,
      JSON.stringify({ ...data, savedAt: Date.now() } satisfies AuthSnapshot)
    );
  } catch {
    /* ignore quota */
  }
}

function clearSnapshot() {
  if (!import.meta.client) return;
  sessionStorage.removeItem(AUTH_CACHE_KEY);
}

function isUnauthorized(err: unknown) {
  const e = err as { statusCode?: number; status?: number; data?: { code?: string } };
  return e?.statusCode === 401 || e?.status === 401 || e?.data?.code === 'TOKEN_REVOKED';
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = useCookie<string | null>('hr-access', { maxAge: 60 * 60 * 8, sameSite: 'lax' });
  const refreshToken = useCookie<string | null>('hr-refresh', { maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
  const user = ref<AuthUser | null>(null);
  const permissions = ref<string[]>([]);
  const permissionSet = ref<Set<string>>(new Set());
  const roles = ref<{ id: string; name: string; slug: string }[]>([]);
  const loading = ref(false);
  /** Bumps on login/logout so KeepAlive pages remount for the new session */
  const sessionEpoch = ref(0);
  let fetchMePromise: Promise<void> | null = null;
  let hydrated = false;

  const isLoggedIn = computed(() => !!accessToken.value);
  const displayName = computed(() => {
    if (user.value?.employee) {
      return `${user.value.employee.firstName} ${user.value.employee.lastName}`;
    }
    return user.value?.username || '';
  });

  const isOwner = computed(() => roles.value.some((r) => r.slug === 'owner'));
  const isAdmin = computed(() => roles.value.some((r) => r.slug === 'admin'));
  const hasFullAccess = computed(() => roles.value.some((r) => FULL_ACCESS_SLUGS.has(r.slug)));

  function setIdentity(data: {
    user: AuthUser;
    permissions: string[];
    roles: { id: string; name: string; slug: string }[];
  }) {
    user.value = data.user;
    permissions.value = data.permissions;
    permissionSet.value = new Set(data.permissions);
    roles.value = data.roles;
    writeSnapshot(data);
  }

  function hydrate() {
    if (hydrated || !accessToken.value) return;
    hydrated = true;
    const snap = readSnapshot();
    if (snap) {
      user.value = snap.user;
      permissions.value = snap.permissions;
      permissionSet.value = new Set(snap.permissions);
      roles.value = snap.roles;
    }
  }

  function applySession(data: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    permissions: string[];
    roles: { id: string; name: string; slug: string }[];
  }) {
    clearApiGetCache();
    accessToken.value = data.accessToken;
    refreshToken.value = data.refreshToken;
    setIdentity(data);
    hydrated = true;
    sessionEpoch.value += 1;
  }

  async function login(username: string, password: string) {
    loading.value = true;
    try {
      const config = useRuntimeConfig();
      const base = resolveApiBase(String(config.public.apiBase || ''));
      const res = await $fetch<{
        success: boolean;
        data: {
          accessToken: string;
          refreshToken: string;
          user: AuthUser;
          permissions: string[];
          roles: { id: string; name: string; slug: string }[];
        };
        message?: string;
      }>(`${base}/auth/login`, {
        method: 'POST',
        body: { username, password },
      });
      applySession(res.data);
    } finally {
      loading.value = false;
    }
  }

  async function fetchMe(force = false) {
    if (!accessToken.value) return;
    hydrate();

    const hasIdentity = !!(
      user.value &&
      (permissions.value.length || hasFullAccess.value || roles.value.length)
    );
    if (!force && hasIdentity && fetchMePromise) return;

    if (!force && hasIdentity) {
      void runFetchMe().catch(() => {
        /* handled inside */
      });
      return;
    }

    return runFetchMe();
  }

  function runFetchMe() {
    if (fetchMePromise) return fetchMePromise;
    fetchMePromise = (async () => {
      const config = useRuntimeConfig();
      const base = resolveApiBase(String(config.public.apiBase || ''));
      try {
        const res = await $fetch<{
          success: boolean;
          data: {
            user: AuthUser;
            permissions: string[];
            roles: { id: string; name: string; slug: string }[];
          };
        }>(`${base}/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken.value}` },
        });
        setIdentity(res.data);
      } catch (err) {
        if (isUnauthorized(err) || (err as { statusCode?: number })?.statusCode === 403) {
          await logoutLocal();
        }
        throw err;
      }
    })().finally(() => {
      fetchMePromise = null;
    });
    return fetchMePromise;
  }

  function logoutLocal() {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    permissions.value = [];
    permissionSet.value = new Set();
    roles.value = [];
    clearSnapshot();
    clearApiGetCache();
    hydrated = false;
    sessionEpoch.value += 1;
  }

  async function logout() {
    const config = useRuntimeConfig();
    const base = resolveApiBase(String(config.public.apiBase || ''));
    const rt = refreshToken.value;
    logoutLocal();
    if (rt) {
      try {
        await $fetch(`${base}/auth/logout`, {
          method: 'POST',
          body: { refreshToken: rt },
        });
      } catch {
        /* ignore */
      }
    }
  }

  function can(key: string) {
    if (hasFullAccess.value) return true;
    return permissionSet.value.has(key);
  }

  function canAny(...keys: string[]) {
    if (hasFullAccess.value) return true;
    return keys.some((k) => permissionSet.value.has(k));
  }

  function canAll(...keys: string[]) {
    if (hasFullAccess.value) return true;
    return keys.every((k) => permissionSet.value.has(k));
  }

  function homePath() {
    return firstAllowedPath((k) => can(k));
  }

  if (import.meta.client) hydrate();

  return {
    accessToken,
    refreshToken,
    user,
    permissions,
    roles,
    loading,
    sessionEpoch,
    isLoggedIn,
    displayName,
    isOwner,
    isAdmin,
    hasFullAccess,
    login,
    fetchMe,
    logout,
    can,
    canAny,
    canAll,
    homePath,
    hydrate,
  };
});

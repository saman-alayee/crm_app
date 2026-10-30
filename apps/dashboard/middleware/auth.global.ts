import { requiredPermissionForPath } from '~/utils/routePermissions';

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return;

  const auth = useAuthStore();
  auth.hydrate();

  if (!auth.isLoggedIn) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }

  if (to.path === '/forbidden') return;

  // Wait only when we have no identity yet; otherwise refresh in background
  if (!auth.user) {
    try {
      await auth.fetchMe(true);
    } catch {
      await auth.logout();
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
    }
  } else {
    void auth.fetchMe().catch(async (err: unknown) => {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 401 || status === 403) {
        await auth.logout();
        await navigateTo('/login');
      }
    });
  }

  const required = requiredPermissionForPath(to.path);
  if (required && !auth.can(required)) {
    const fallback = auth.homePath();
    if (fallback === to.path || fallback === '/login') {
      return navigateTo('/forbidden');
    }
    return navigateTo(fallback);
  }
});

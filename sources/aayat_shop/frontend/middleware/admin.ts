export default defineNuxtRouteMiddleware((to) => {
  // Admin login page must stay public
  if (to.path === '/admin/login') {
    return;
  }

  const authStore = useAuthStore();
  authStore.init();

  if (!authStore.isLoggedIn) {
    return navigateTo(`/admin/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }

  if (!authStore.isAdmin) {
    return navigateTo(
      `/admin/login?redirect=${encodeURIComponent(to.fullPath)}&error=not-admin`
    );
  }

  const { canAccessPath } = useAdminAccess();
  if (!canAccessPath(to.path)) {
    return navigateTo('/admin');
  }
});

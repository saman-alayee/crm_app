/**
 * Normalize broken paths from trailing-slash redirects / double slashes
 * e.g. //profile/password or /profile/password/ -> /profile/password
 */
export default defineNuxtRouteMiddleware((to) => {
  const raw = to.path || '/';
  let path = raw.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (path !== raw) {
    return navigateTo(
      { path, query: to.query, hash: to.hash },
      { replace: true, redirectCode: 301 },
    );
  }
});

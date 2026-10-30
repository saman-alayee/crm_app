/** فقط پنل ادمین و خود صفحه تعمیر از قفل خارج‌اند — /auth و بقیه فروشگاه برای کاربر عادی بسته است. */
const SKIP_PREFIXES = ['/admin', '/maintenance'];

export default defineNuxtRouteMiddleware(async (to) => {
  if (SKIP_PREFIXES.some((prefix) => to.path === prefix || to.path.startsWith(`${prefix}/`))) {
    return;
  }

  // پیش‌نمایش فقط از پنل با ?preview=1
  if (to.path === '/maintenance') return;

  const gate = useMaintenanceGate();
  if (gate.canBypassMaintenance()) return;

  const status = await gate.fetchStatus();
  if (status.enabled) {
    return navigateTo('/maintenance', { replace: true });
  }
});

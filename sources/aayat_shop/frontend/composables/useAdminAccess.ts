import type { PanelPermission, UserRole } from '~/types';
import { ROLE_LABELS, BUILTIN_ROLE_GUIDE } from '~/types';
import { getRoleFromToken } from '~/utils/jwt';

export const PANEL_ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR', 'STAFF'];

export { ROLE_LABELS, BUILTIN_ROLE_GUIDE };

const PATH_PERMISSIONS: Array<{ prefix: string; permission: PanelPermission }> = [
  { prefix: '/admin/users', permission: 'users' },
  { prefix: '/admin/settings', permission: 'settings' },
  { prefix: '/admin/backup', permission: 'settings' },
  { prefix: '/admin/sales', permission: 'sales' },
  { prefix: '/admin/customers', permission: 'customers' },
  { prefix: '/admin/coupons', permission: 'coupons' },
  { prefix: '/admin/content', permission: 'content' },
  { prefix: '/admin/categories', permission: 'categories' },
  { prefix: '/admin/tags', permission: 'tags' },
  { prefix: '/admin/sliders', permission: 'sliders' },
  { prefix: '/admin/home-picks', permission: 'products' },
  { prefix: '/admin/category-feed', permission: 'products' },
  { prefix: '/admin/reviews', permission: 'products' },
  { prefix: '/admin/products', permission: 'products' },
  { prefix: '/admin/orders', permission: 'orders' },
  { prefix: '/admin', permission: 'dashboard' },
].sort((a, b) => b.prefix.length - a.prefix.length);

const BUILTIN: Record<string, PanelPermission[]> = {
  ADMIN: BUILTIN_ROLE_GUIDE.find((g) => g.role === 'ADMIN')!.permissions,
  SUPERVISOR: BUILTIN_ROLE_GUIDE.find((g) => g.role === 'SUPERVISOR')!.permissions,
  STAFF: BUILTIN_ROLE_GUIDE.find((g) => g.role === 'STAFF')!.permissions,
};

export function useAdminAccess() {
  const authStore = useAuthStore();

  const role = computed<UserRole>(() => {
    const fromUser = authStore.user?.role;
    const fromToken = getRoleFromToken(authStore.token);
    const resolved = fromUser && PANEL_ROLES.includes(fromUser) ? fromUser : fromToken;
    if (resolved && PANEL_ROLES.includes(resolved)) return resolved;
    return 'CUSTOMER';
  });

  const permissions = computed<PanelPermission[]>(() => {
    const fromUser = authStore.user?.permissions;
    if (fromUser?.length) return fromUser;
    if (authStore.user?.accessRole?.permissions?.length) {
      return authStore.user.accessRole.permissions;
    }
    return BUILTIN[role.value] ?? [];
  });

  const isPanelUser = computed(() => PANEL_ROLES.includes(role.value));
  const isManager = computed(
    () => role.value === 'ADMIN' || role.value === 'SUPERVISOR' || permissions.value.includes('sales')
  );
  const isFullAdmin = computed(() => role.value === 'ADMIN');
  const roleLabel = computed(() => {
    if (authStore.user?.accessRole?.name) return authStore.user.accessRole.name;
    return ROLE_LABELS[role.value] || role.value;
  });

  function can(permission: PanelPermission): boolean {
    if (role.value === 'ADMIN') return true;
    return permissions.value.includes(permission);
  }

  function canAccessPath(path: string): boolean {
    if (!isPanelUser.value) return false;
    if (path === '/admin/backup' || path.startsWith('/admin/backup/')) {
      return role.value === 'ADMIN';
    }
    const match = PATH_PERMISSIONS.find(
      (item) => path === item.prefix || path.startsWith(`${item.prefix}/`)
    );
    if (!match) return isPanelUser.value;
    return can(match.permission);
  }

  function navVisible(to: string): boolean {
    return canAccessPath(to);
  }

  return {
    role,
    permissions,
    isPanelUser,
    isManager,
    isFullAdmin,
    roleLabel,
    can,
    canAccessPath,
    navVisible,
    ROLE_LABELS,
    BUILTIN_ROLE_GUIDE,
  };
}

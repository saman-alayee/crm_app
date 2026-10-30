export const PANEL_PERMISSIONS = [
  'dashboard',
  'orders',
  'products',
  'sales',
  'categories',
  'tags',
  'sliders',
  'customers',
  'coupons',
  'content',
  'settings',
  'users',
] as const;

export type PanelPermission = (typeof PANEL_PERMISSIONS)[number];

const PERMISSION_PATH_ENTRIES: Array<{ prefix: string; permission: PanelPermission }> = [
  { prefix: '/admin/users', permission: 'users' },
  { prefix: '/admin/settings', permission: 'settings' },
  { prefix: '/admin/sales', permission: 'sales' },
  { prefix: '/admin/customers', permission: 'customers' },
  { prefix: '/admin/coupons', permission: 'coupons' },
  { prefix: '/admin/content', permission: 'content' },
  { prefix: '/admin/categories', permission: 'categories' },
  { prefix: '/admin/tags', permission: 'tags' },
  { prefix: '/admin/sliders', permission: 'sliders' },
  { prefix: '/admin/reviews', permission: 'products' },
  { prefix: '/admin/products', permission: 'products' },
  { prefix: '/admin/orders', permission: 'orders' },
  { prefix: '/admin', permission: 'dashboard' },
];

export const PERMISSION_PATHS = PERMISSION_PATH_ENTRIES.sort(
  (a, b) => b.prefix.length - a.prefix.length
);

export const BUILTIN_ROLE_PERMISSIONS: Record<string, PanelPermission[]> = {
  ADMIN: [...PANEL_PERMISSIONS],
  SUPERVISOR: PANEL_PERMISSIONS.filter((key) => key !== 'users'),
  STAFF: ['dashboard', 'orders', 'products'],
};

export function parsePermissionList(raw: unknown): PanelPermission[] {
  const allowed = new Set<string>(PANEL_PERMISSIONS);
  const list = Array.isArray(raw) ? raw : [];
  return [...new Set(list.filter((item): item is string => typeof item === 'string' && allowed.has(item)))] as PanelPermission[];
}

export function permissionsForRole(
  role: string,
  customPermissions?: unknown
): PanelPermission[] {
  if (role === 'ADMIN') return [...PANEL_PERMISSIONS];
  if (customPermissions != null) {
    const custom = parsePermissionList(customPermissions);
    if (!custom.includes('dashboard')) custom.unshift('dashboard');
    return custom.filter((key) => key !== 'users');
  }
  return BUILTIN_ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(permissions: string[] | undefined, key: PanelPermission): boolean {
  return !!permissions?.includes(key);
}

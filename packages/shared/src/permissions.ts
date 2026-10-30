export const MODULES = [
  'dashboard',
  'employees',
  'leave',
  'salary',
  'bank',
  'tasks',
  'roles',
  'notifications',
  'reports',
  'audit',
  'settings',
] as const;

export const ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'reject',
  'export',
  'view_sensitive',
  'manage_permissions',
] as const;

export type Module = (typeof MODULES)[number];
export type Action = (typeof ACTIONS)[number];
export type PermissionKey = `${Module}.${Action}`;

/** Permissions that make sense per module (not every action for every module). */
export const PERMISSION_CATALOG: ReadonlyArray<{
  module: Module;
  action: Action;
  description: string;
}> = [
  { module: 'dashboard', action: 'view', description: 'مشاهده داشبورد' },

  { module: 'employees', action: 'view', description: 'مشاهده کارکنان' },
  { module: 'employees', action: 'create', description: 'ثبت کارمند' },
  { module: 'employees', action: 'edit', description: 'ویرایش کارمند' },
  { module: 'employees', action: 'delete', description: 'حذف/غیرفعال‌سازی کارمند' },
  { module: 'employees', action: 'view_sensitive', description: 'مشاهده اطلاعات حساس کارمند' },

  { module: 'leave', action: 'view', description: 'مشاهده درخواست‌های مرخصی' },
  { module: 'leave', action: 'create', description: 'ثبت درخواست مرخصی' },
  { module: 'leave', action: 'approve', description: 'تأیید مرخصی' },
  { module: 'leave', action: 'reject', description: 'رد مرخصی' },
  { module: 'leave', action: 'export', description: 'خروجی گزارش مرخصی' },

  { module: 'salary', action: 'view', description: 'مشاهده درخواست‌های مالی' },
  { module: 'salary', action: 'create', description: 'ثبت درخواست حقوق/مساعده' },
  { module: 'salary', action: 'approve', description: 'تأیید درخواست مالی' },
  { module: 'salary', action: 'reject', description: 'رد درخواست مالی' },
  { module: 'salary', action: 'view_sensitive', description: 'مشاهده مبالغ و جزئیات مالی' },
  { module: 'salary', action: 'export', description: 'خروجی گزارش مالی' },

  { module: 'bank', action: 'view', description: 'مشاهده اطلاعات بانکی (ماسک‌شده)' },
  { module: 'bank', action: 'create', description: 'ثبت اطلاعات بانکی' },
  { module: 'bank', action: 'edit', description: 'ویرایش اطلاعات بانکی' },
  { module: 'bank', action: 'view_sensitive', description: 'مشاهده کامل شبا/حساب' },

  { module: 'tasks', action: 'view', description: 'مشاهده وظایف' },
  { module: 'tasks', action: 'create', description: 'ایجاد وظیفه' },
  { module: 'tasks', action: 'edit', description: 'ویرایش/انتقال وظیفه' },
  { module: 'tasks', action: 'delete', description: 'حذف وظیفه' },

  { module: 'roles', action: 'view', description: 'مشاهده نقش‌ها' },
  { module: 'roles', action: 'create', description: 'ایجاد نقش' },
  { module: 'roles', action: 'edit', description: 'ویرایش نقش' },
  { module: 'roles', action: 'delete', description: 'حذف نقش' },
  { module: 'roles', action: 'manage_permissions', description: 'مدیریت مجوزها و انتساب نقش' },

  { module: 'notifications', action: 'view', description: 'مشاهده اعلان‌ها' },

  { module: 'reports', action: 'view', description: 'مشاهده گزارش‌ها' },
  { module: 'reports', action: 'export', description: 'خروجی Excel/CSV/PDF' },

  { module: 'audit', action: 'view', description: 'مشاهده تاریخچه عملیات' },

  { module: 'settings', action: 'view', description: 'مشاهده تنظیمات' },
  { module: 'settings', action: 'edit', description: 'ویرایش تنظیمات' },
];

export function permissionKey(module: Module, action: Action): PermissionKey {
  return `${module}.${action}`;
}

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_CATALOG.map(
  (p) => permissionKey(p.module, p.action)
);

export const SYSTEM_ROLES = {
  OWNER: { name: 'Owner', slug: 'owner', description: 'دسترسی کامل سیستم' },
  ADMIN: { name: 'Admin', slug: 'admin', description: 'مدیر سیستم' },
  HR_MANAGER: { name: 'HR Manager', slug: 'hr-manager', description: 'مدیر منابع انسانی' },
  MANAGER: { name: 'Manager', slug: 'manager', description: 'مدیر واحد' },
  ACCOUNTANT: { name: 'Accountant', slug: 'accountant', description: 'حسابدار' },
  EMPLOYEE: { name: 'Employee', slug: 'employee', description: 'کارمند' },
} as const;

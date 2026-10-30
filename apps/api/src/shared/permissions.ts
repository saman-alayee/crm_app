export const MODULES = [
  'dashboard',
  'employees',
  'leave',
  'salary',
  'bank',
  'tasks',
  'roles',
  'notifications',
  'announcements',
  'departments',
  'reports',
  'audit',
  'settings',
  'backup',
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
  { module: 'notifications', action: 'create', description: 'ارسال اعلان/پیام همگانی توسط مدیر' },
  { module: 'announcements', action: 'view', description: 'مشاهده اطلاعیه‌ها' },
  { module: 'announcements', action: 'create', description: 'ثبت اطلاعیه سازمانی' },
  { module: 'announcements', action: 'edit', description: 'ویرایش اطلاعیه' },
  { module: 'announcements', action: 'delete', description: 'حذف اطلاعیه' },
  { module: 'departments', action: 'view', description: 'مشاهده دپارتمان‌ها' },
  { module: 'departments', action: 'create', description: 'ایجاد دپارتمان' },
  { module: 'departments', action: 'edit', description: 'ویرایش دپارتمان' },
  { module: 'departments', action: 'delete', description: 'حذف دپارتمان' },
  { module: 'reports', action: 'view', description: 'مشاهده گزارش‌ها' },
  { module: 'reports', action: 'export', description: 'خروجی Excel/CSV/PDF' },
  { module: 'audit', action: 'view', description: 'مشاهده تاریخچه عملیات' },
  { module: 'settings', action: 'view', description: 'مشاهده تنظیمات' },
  { module: 'settings', action: 'edit', description: 'ویرایش تنظیمات و تم' },
  { module: 'backup', action: 'export', description: 'دانلود بکاپ دیتابیس' },
];

export function permissionKey(module: Module, action: Action): PermissionKey {
  return `${module}.${action}`;
}

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_CATALOG.map(
  (p) => permissionKey(p.module, p.action)
);

export const SYSTEM_ROLES = {
  OWNER: { name: 'مالک', slug: 'owner', description: 'دسترسی کامل سیستم — غیرقابل کاهش' },
  ADMIN: { name: 'ادمین', slug: 'admin', description: 'مدیر سیستم با دسترسی کامل' },
  HR_MANAGER: { name: 'مدیر منابع انسانی', slug: 'hr-manager', description: 'مدیریت پرسنل، مرخصی و وظایف' },
  MANAGER: { name: 'مدیر واحد', slug: 'manager', description: 'تأیید مرخصی و پیگیری وظایف تیم' },
  ACCOUNTANT: { name: 'حسابدار', slug: 'accountant', description: 'امور مالی، بانک و گزارش‌ها' },
  EMPLOYEE: { name: 'کارمند', slug: 'employee', description: 'دسترسی محدود به امور شخصی' },
} as const;

/** Roles that always resolve to the full permission catalog */
export const FULL_ACCESS_ROLE_SLUGS = new Set<string>([
  SYSTEM_ROLES.OWNER.slug,
  SYSTEM_ROLES.ADMIN.slug,
]);

export const ROLE_DEFAULT_PERMISSIONS: Record<string, readonly PermissionKey[]> = {
  [SYSTEM_ROLES.OWNER.slug]: ALL_PERMISSION_KEYS,
  [SYSTEM_ROLES.ADMIN.slug]: ALL_PERMISSION_KEYS,
  [SYSTEM_ROLES.HR_MANAGER.slug]: [
    'dashboard.view',
    'employees.view',
    'employees.create',
    'employees.edit',
    'employees.delete',
    'employees.view_sensitive',
    'leave.view',
    'leave.create',
    'leave.approve',
    'leave.reject',
    'leave.export',
    'salary.view',
    'tasks.view',
    'tasks.create',
    'tasks.edit',
    'tasks.delete',
    'notifications.view',
    'notifications.create',
    'announcements.view',
    'announcements.create',
    'announcements.edit',
    'announcements.delete',
    'departments.view',
    'departments.create',
    'departments.edit',
    'departments.delete',
    'reports.view',
    'audit.view',
  ],
  [SYSTEM_ROLES.MANAGER.slug]: [
    'dashboard.view',
    'employees.view',
    'leave.view',
    'leave.approve',
    'leave.reject',
    'tasks.view',
    'tasks.create',
    'tasks.edit',
    'notifications.view',
    'announcements.view',
    'departments.view',
  ],
  [SYSTEM_ROLES.ACCOUNTANT.slug]: [
    'dashboard.view',
    'employees.view',
    'salary.view',
    'salary.approve',
    'salary.reject',
    'salary.view_sensitive',
    'salary.export',
    'bank.view',
    'bank.view_sensitive',
    'bank.edit',
    'notifications.view',
    'reports.view',
    'reports.export',
  ],
  [SYSTEM_ROLES.EMPLOYEE.slug]: [
    'dashboard.view',
    'leave.view',
    'leave.create',
    'salary.view',
    'salary.create',
    'bank.view',
    'bank.create',
    'bank.edit',
    'tasks.view',
    'notifications.view',
    'announcements.view',
  ],
};

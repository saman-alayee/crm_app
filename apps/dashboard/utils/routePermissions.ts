/** Path prefix → required permission to open the page */
export const ROUTE_PERMISSIONS: { match: RegExp | string; permission: string }[] = [
  { match: '/', permission: 'dashboard.view' },
  { match: /^\/employees(\/|$)/, permission: 'employees.view' },
  { match: /^\/departments(\/|$)/, permission: 'departments.view' },
  { match: /^\/leave(\/|$)/, permission: 'leave.view' },
  { match: /^\/salary(\/|$)/, permission: 'salary.view' },
  { match: /^\/bank(\/|$)/, permission: 'bank.view' },
  { match: /^\/tasks(\/|$)/, permission: 'tasks.view' },
  { match: /^\/announcements(\/|$)/, permission: 'announcements.view' },
  { match: /^\/roles(\/|$)/, permission: 'roles.view' },
  { match: /^\/notifications(\/|$)/, permission: 'notifications.view' },
  { match: /^\/reports(\/|$)/, permission: 'reports.view' },
  { match: /^\/audit(\/|$)/, permission: 'audit.view' },
  { match: /^\/backup(\/|$)/, permission: 'settings.view' },
  { match: /^\/settings(\/|$)/, permission: 'settings.view' },
];

/** Preferred landing order when user lacks dashboard.view */
export const HOME_CANDIDATES: { path: string; permission: string }[] = [
  { path: '/', permission: 'dashboard.view' },
  { path: '/leave', permission: 'leave.view' },
  { path: '/tasks', permission: 'tasks.view' },
  { path: '/salary', permission: 'salary.view' },
  { path: '/notifications', permission: 'notifications.view' },
  { path: '/announcements', permission: 'announcements.view' },
  { path: '/employees', permission: 'employees.view' },
];

export function requiredPermissionForPath(path: string): string | null {
  const normalized = path.replace(/\/+$/, '') || '/';
  for (const rule of ROUTE_PERMISSIONS) {
    if (typeof rule.match === 'string') {
      if (normalized === rule.match) return rule.permission;
    } else if (rule.match.test(normalized)) {
      return rule.permission;
    }
  }
  return null;
}

export function firstAllowedPath(can: (key: string) => boolean): string {
  for (const c of HOME_CANDIDATES) {
    if (can(c.permission)) return c.path;
  }
  return '/login';
}

export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'داشبورد',
  employees: 'کارکنان',
  leave: 'مرخصی',
  salary: 'حقوق و مساعده',
  bank: 'حساب بانکی',
  tasks: 'وظایف',
  roles: 'نقش‌ها و دسترسی',
  notifications: 'اعلان‌ها',
  announcements: 'اطلاعیه‌ها',
  departments: 'دپارتمان‌ها',
  reports: 'گزارش‌ها',
  audit: 'تاریخچه',
  settings: 'تنظیمات',
  backup: 'بکاپ',
};

export const ACTION_LABELS: Record<string, string> = {
  view: 'مشاهده',
  create: 'ایجاد',
  edit: 'ویرایش',
  delete: 'حذف',
  approve: 'تأیید',
  reject: 'رد',
  export: 'خروجی',
  view_sensitive: 'اطلاعات حساس',
  manage_permissions: 'مدیریت دسترسی',
};

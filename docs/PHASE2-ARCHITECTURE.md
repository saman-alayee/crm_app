# فاز ۲ — معماری، ERD، RBAC، API، اعلان‌ها

## ۱. اصول
- یک PostgreSQL + یک API؛ بات و داشبورد بدون منطق تجاری مستقل
- RBAC واقعی در Backend؛ UI فقط مخفی‌سازی
- اعلان: Outbox → Queue → NotificationDelivery با idempotencyKey
- عملیات حساس در Transaction + AuditLog append-only
- کاربر `isActive=false` → رد JWT refresh، رد بات، revoke refresh tokens

## ۲. ERD منطقی

```
User 1──1 Employee
User *──* Role (UserRole)
Role *──* Permission (RolePermission)
User *──* Permission override (UserPermission: grant|deny)
Employee 1──* LeaveRequest | SalaryRequest | BankAccount | Task(assignee)
Task 1──* TaskAssignmentHistory
Notification 1──* NotificationDelivery
User 1──* RefreshToken | AuditLog | Notification
OutboxEvent (pending jobs)
SystemSetting
```

## ۳. کاتالوگ Permission (`module.action`)

ماژول‌ها: `employees`, `leave`, `salary`, `bank`, `tasks`, `roles`, `notifications`, `reports`, `audit`, `settings`, `dashboard`

اکشن‌ها: `view`, `create`, `edit`, `delete`, `approve`, `reject`, `export`, `view_sensitive`, `manage_permissions`

نمونه‌ها: `leave.approve`, `bank.view_sensitive`, `roles.manage_permissions`, `employees.edit`

Owner (سیستمی): همه مجوزها؛ غیرقابل حذف.

## ۴. API سطح بالا (REST `/api/v1`)

| گروه | مسیرها |
|------|--------|
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all` |
| Employees | CRUD، `PATCH /:id/activate`, `POST /:id/link-telegram` |
| Roles | CRUD نقش، assign permissions، assign users |
| Leave | CRUD خود/همه، `POST /:id/approve|reject` |
| Salary | مشابه leave + محدودیت مالی |
| Bank | self upsert، admin view (masked مگر view_sensitive) |
| Tasks | CRUD، assign، complete، delay-reminder، pause schedule |
| Notifications | list، mark-read، unread-count |
| Reports | dashboard summary، employee reports، export |
| Audit | list (read-only) |
| Settings | get/patch |
| Telegram | internal bot token auth برای sync (اختیاری) |

## ۵. اعلان‌ها
1. Service داخل TX: entity + OutboxEvent + Notification rows
2. Worker: claim outbox → enqueue delivery jobs
3. Delivery: DASHBOARD (socket) + TELEGRAM (Bot API)
4. `idempotencyKey = ${eventType}:${entityId}:${userId}:${channel}`
5. Retry با backoff؛ حداکثر N بار؛ وضعیت FAILED قابل مشاهده

## ۶. بات
- grammY + session (Redis یا memory در dev)
- هر action → API با service token یا user-bound token پس از link
- منو بر اساس permissions برگشتی از `/auth/me` معادل بات

## ۷. داشبورد
- اسکلت از الگوی ادمین فروشگاهی (برند فعلی: فروشگاه سامی)
- صفحات HR؛ بدون کاتالوگ فروشگاهی
- Middleware مسیر ↔ permission keys مشترک با `packages/shared`

# فاز ۱ — تحلیل سورس‌ها و تصمیم‌های استفاده مجدد

## ۱. سورس ربات: `simmBot_telegram` (SamiSIM)

### تکنولوژی‌ها
| مورد | مقدار |
|------|--------|
| Runtime | Node.js 24, ESM |
| Telegram | **بدون Telegraf/Grammy** — فراخوانی مستقیم `api.telegram.org` با `fetch` |
| Database | PostgreSQL (`pg` / `@neondatabase/serverless`) — SQL خام |
| Deploy | Vercel serverless webhook + cron |
| تست | `node:test` + اسکریپت‌های flow |
| دامنه کسب‌وکار | فروش سیم‌کارت ۰۹۱۲ (غیرمرتبط با HR) |

### ساختار
- `api/` — entrypoints Vercel (`telegram`, `cron`, `setup`)
- `src/bot/` — `router.js` (~۴۰۰۰ خط)، `data.js`, `jobs.js`, `commands.js`
- `src/domain/` — منطق فروش + `PERMISSIONS` دامنه سیم‌کارت
- `src/telegram/` — parse update، webhook secret، entities
- `src/database/` — schema مهاجرت‌مانند با `ALTER TABLE IF NOT EXISTS`
- Session جداول DB برای conversation flow (مثلاً `invoice_drafts`, `listing_edit_sessions`)

### قابلیت‌های قابل استفاده مجدد (الگو، نه دامنه)
- شناسایی با **Telegram User ID** (نه username)
- مدل permission JSON روی ادمین + `allow(uid, …)`
- Conversation / multi-step form در DB
- Inline keyboard + callback routing
- Cron jobs برای یادآوری و کارهای زمان‌بندی‌شده
- الگوی `logChange` (audit سبک)
- فرمت فارسی/ارقام/تاریخ جلالی (`domain/format.js`)
- Webhook secret validation
- Helperهای کم‌حجم Telegram text/update

### مشکلات / ناسازگاری با هدف HR
- منطق تجاری داخل بات + دسترسی مستقیم به DB → نقض «Backend مشترک»
- `router.js` مونولیتیک، بدون TypeScript
- Permissionها بخش‌محور دامنه فروش (نه `module.action`)
- بدون Queue/Outbox برای اعلان پایدار
- بدون JWT؛ هویت فقط تلگرام + جدول admins/partners
- دامنه فروش/فاکتور/کانال نباید وارد HR شود

### تصمیم
**الهام و استخراج الگو**؛ بازنویسی بات به‌صورت کلاینت نازک TypeScript روی API مشترک.  
کتابخانه پیشنهادی: **grammY** (TypeScript-first، conversation plugin) با نگه‌داشتن الگوهای session و permission-check از سورس.

---

## ۲. سورس پنل: پنل فروشگاهی مرجع (الگوی UI)

### تکنولوژی‌ها
| لایه | استک |
|------|------|
| Frontend | Nuxt 3.15، Vue 3، Pinia، Tailwind، `@nuxt/icon`، dayjs + jalaliday، RTL |
| Backend | Express، Prisma، Zod، JWT، bcrypt، helmet، rate-limit، ioredis |
| DB در سورس | README: MySQL؛ `schema.prisma`: **sqlite**؛ `index.ts` فقط `mysql://` یا `file:` را می‌پذیرد — ناسازگار |

### معماری بک‌اند
- `routes` + `services` + `middleware` (بدون لایه Controller جدا)
- `AppError` + `asyncHandler` + `validate(zod)` — قابل استفاده
- Auth: OTP موبایل + پسورد پنل؛ **یک JWT** (پیش‌فرض ۷ روز) — **بدون Refresh Token**
- RBAC: نقش‌های ثابت `ADMIN|SUPERVISOR|STAFF` + `AccessRole` با JSON بخش‌ها (`orders`, `products`, …)
- `syncRoleFromDb` روی هر درخواست ادمین — الگوی خوب برای اعمال فوری نقش/غیرفعال‌سازی
- Notification: فقط ذخیره در DB؛ بدون delivery/retry/Telegram/Queue
- Redis موجود است ولی Queue job برای اعلان پیاده نشده

### فرانت پنل ادمین — قابل استفاده مجدد
- `layouts/admin.vue` (sidebar RTL، nav با مجوز)
- `middleware/admin.ts` + `composables/useAdminAccess.ts`
- `stores/auth.ts` (cookie token)
- کامپوننت‌ها: `AppPagination`, `AppToast`, `AppDatePicker`, `AppSelect`, `AppSwitch`, `EmptyState`, `LoadingSpinner`, badge وضعیت
- صفحات الگوی لیست/فیلتر/جدول (orders, users, sales)
- `AppError` UX و toast

### بخش‌هایی که وارد HR نمی‌شوند
کاتالوگ، سبد، سفارش، پرداخت Zibal، کوپن، اسلایدر، نقشه، PWA فروشگاهی، SMS OTP مشتری (برای HR: ایمیل/یوزرنیم+پسورد + لینک تلگرام)

### مشکلات امنیتی / کیفیت
- JWT طولانی بدون refresh/revoke session
- Permission فقط سطح «بخش» نه عملیات (approve/reject/view_sensitive)
- DB provider ناسازگار sqlite/mysql
- بدون Audit Log عمومی
- بدون Soft-disable فوری نشست‌ها (فقط چک `isActive` در sync نقش)

### تصمیم
**استفاده از الگو و اسکلت Nuxt ادمین + استک Express/Prisma/Zod/helmet**؛ اسکیمای فروشگاهی و OTP مشتری کنار گذاشته می‌شود.  
RBAC به مدل `Role` / `Permission` / `UserRole` / `UserPermission` با اکشن‌های سند ارتقا می‌یابد.  
Auth با **Access + Refresh Token** و جدول نشست تکمیل می‌شود.

---

## ۳. جدول تصمیم یکپارچه

| بخش | وضعیت سورس | تصمیم |
|-----|------------|--------|
| Authentication | فروشگاه: موجود ناقص (بدون refresh) / بات: ناموجود | **توسعه** JWT+Refresh روی الگوی فروشگاه |
| User Management | فروشگاه: موجود ناقص / بات: admins دامنه فروش | **اصلاح+توسعه** مدل User+Employee |
| UI Components | فروشگاه: موجود قوی (ادمین) | **استفاده+اصلاح** برای HR RTL |
| Notification | فروشگاه: ناقص / بات: ارسال مستقیم | **توسعه** Outbox+Queue+Delivery |
| Telegram Bot | موجود دامنه فروش | **توسعه** کلاینت API؛ الگوهای UX از بات |
| Database | بات: PG خام / فروشگاه: Prisma sqlite/mysql | **توسعه** Prisma + **PostgreSQL** |
| Permissions | هر دو ناقص نسبت به سند | **توسعه** RBAC کامل `module.action` |
| Audit Log | بات: `logChange` محدود / فروشگاه: ناموجود | **توسعه** AuditLog عمومی |
| Jobs/Cron | بات: موجود / فروشگاه: ناموجود | **توسعه** BullMQ روی Redis |
| Validation | فروشگاه Zod موجود | **استفاده** |
| Error handling | فروشگاه موجود | **استفاده** |
| Rate limit / Helmet | فروشگاه موجود | **استفاده** |

---

## ۴. معماری هدف (خلاصه)

```
hr-system/
  apps/api          Express+TS+Prisma  (منبع حقیقت)
  apps/bot          grammY → HTTP API
  apps/dashboard    Nuxt 3 admin HR
  packages/shared   permissions, DTOs, enums
  prisma/           schema + migrations (PostgreSQL)
```

هر دو کلاینت فقط از API مشترک استفاده می‌کنند؛ منطق تجاری در Services؛ اعلان‌ها از طریق Transactional Outbox + Worker.

# اجرای پروژه (توسعه)

## پیش‌نیاز

- Node.js 20+
- برای توسعه: **SQLite** (`DATABASE_URL=file:./dev.db` در `backend/.env`) — بدون نصب MySQL
- برای production: MySQL/MariaDB
- (اختیاری) Redis — با `REDIS_DISABLED=true` غیرفعال می‌شود

## Backend

```powershell
cd backend
copy .env.example .env
# DATABASE_URL=file:./dev.db  (SQLite — پیش‌فرض توسعه)
# DATABASE_URL و JWT_SECRET را تنظیم کنید
npm install
npx prisma db push
npm run db:seed
# seed فقط ادمین/صفحات ثابت می‌سازد — کاتالوگ: npm run import:woocommerce
npm run dev
```

API: `http://localhost:3001/api`

## Frontend

```powershell
cd frontend
copy .env.example .env
# NUXT_PUBLIC_API_BASE=http://localhost:3001/api
# NUXT_PUBLIC_SITE_URL=http://localhost:3000
# NUXT_PUBLIC_FORCE_DEMO_CATALOG=false  # برای خاموش کردن محصولات/بنرهای نمایشی
npm install
npx nuxt prepare
npm run dev
```

### کاتالوگ نمایشی (بدون DB)

به‌صورت پیش‌فرض فروشگاه **۱۲ محصول** و **۳ بنر Hero** با تصاویر Unsplash نشان می‌دهد. برای اتصال به API واقعی: `NUXT_PUBLIC_FORCE_DEMO_CATALOG=false`

## Import از وردپرس / WooCommerce (فقط خواندن)

سایت قدیمی `aaytay.ir` تغییر نمی‌کند؛ اسکریپت فقط از API عمومی GET می‌گیرد.

```powershell
cd backend
npm run import:woocommerce
# اختیاری: حذف دسته/محصول دمو قبل از import
npm run import:woocommerce -- --remove-demo
```

به‌صورت پیش‌فرض **عکس‌ها دانلود** و در `backend/uploads/wc/` ذخیره می‌شوند (مسیر DB: `/uploads/wc/...` — از API سرو می‌شود). فقط URL وردپرس: `--keep-remote-urls`. اگر قبلاً import کرده‌اید: `npm run import:woocommerce:images`

سپس در `frontend/.env`: `NUXT_PUBLIC_FORCE_DEMO_CATALOG=false`

## Seed پوشاک در MySQL

```powershell
cd backend
npx prisma db push
npm run db:seed:clothing-demo
```

فروشگاه: `http://localhost:3000` — پنل: `/admin/login`

## مهاجرت پوشاک

پس از pull، یک بار `npx prisma db push` برای فیلد `clothingMeta` روی جدول products.

## متغیرهای محیطی (بدون مقادیر)

| محل | متغیر |
|-----|--------|
| Backend | `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `ADMIN_PHONE`, `ADMIN_PASSWORD`, `FARAZSMS_*` |
| Frontend | `NUXT_PUBLIC_API_BASE`, `NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_NESHAN_API_KEY` |

# Aayat Shop (عایت)

فروشگاه اینترنتی پوشاک — فرانت **Nuxt 3** و API **Express + Prisma (MySQL)**.

## ساختار مخزن

| مسیر | توضیح |
|------|--------|
| `frontend/` | Nuxt 3، Pinia، Tailwind، PWA |
| `backend/` | Express، JWT/OTP، پنل ادمین، Prisma |
| `docs/` | راه‌اندازی و مرجع طراحی |
| `deploy/` | اسکریپت‌ها و تنظیمات استقرار |

## شروع سریع

جزئیات در [docs/RUN.md](docs/RUN.md).

```powershell
# Backend
cd backend
copy .env.example .env
npm install
npx prisma db push
npm run dev

# Frontend (ترمینال جدا)
cd frontend
copy .env.example .env
npm install
npx nuxt prepare
npm run dev
```

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001/api` (یا پورت تنظیم‌شده در `.env`)

## متغیرهای مهم

- `NUXT_PUBLIC_API_BASE` — آدرس API برای فرانت
- `NUXT_PUBLIC_FORCE_DEMO_CATALOG` — کاتالوگ نمایشی بدون DB (پیش‌فرض روشن تا `false` شود)
- `DATABASE_URL` — MySQL در بک‌اند

## لایسنس

کد اختصاصی پروژه Aayat Shop — استفاده طبق توافق مالک مخزن.

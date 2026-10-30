# سیستم مدیریت منابع انسانی (HR) — بات تلگرام + داشبورد Nuxt

Monorepo یکپارچه با Backend مشترک (Express + Prisma + PostgreSQL).

## ساختار

| مسیر | نقش |
|------|-----|
| `apps/api` | Backend REST + Socket.IO + Workers |
| `apps/bot` | ربات تلگرام (کلاینت API) |
| `apps/dashboard` | داشبورد Nuxt 3 |
| `packages/shared` | Permission keys، enums مشترک |
| `prisma/` | اسکیمای PostgreSQL |
| `sources/` | آرشیو سورس‌های مرجع (بات سیم‌کارت + پنل فروشگاهی) |
| `docs/` | تحلیل فازها، معماری، API |

## شروع سریع (زیرساخت)

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate dev --name init --schema prisma/schema.prisma
npm run db:seed
npm run dev:api
```

جزئیات تحلیل سورس‌ها: [docs/PHASE1-SOURCE-ANALYSIS.md](docs/PHASE1-SOURCE-ANALYSIS.md)  
معماری: [docs/PHASE2-ARCHITECTURE.md](docs/PHASE2-ARCHITECTURE.md)

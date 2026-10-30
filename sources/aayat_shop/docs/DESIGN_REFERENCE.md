# گزارش طراحی — الهام از sarak-co.com (بازآفرینی مستقل)

> نام برند فروشگاه ما **آتلیه مد** است؛ از لوگو، تصاویر و هویت ثبت‌شده سارک استفاده نشده است.

## پالت رنگی (تقریبی)

| نقش | HEX | کاربرد |
|-----|-----|--------|
| Primary / Wine | `#652a3b` – `#7a3347` | نوار اعلان، دکمه CTA، حالت فعال |
| Primary dark | `#49202d` | پس‌زمینه بنر بالا |
| Text | `#111111` / `#000000` | عناوین و متن اصلی |
| Background | `#ffffff` | بدنه و کارت‌ها |
| Muted surface | `#f7f7f7` | فوتر، سکشن‌های متناوب |
| Accent gold | `#b8924a` | برچسب «جدید» (اختیاری) |

## تایپوگرافی

- مرجع: فونت **Modam** (لاتین) + فارسی خوانا.
- پیاده‌سازی: **IRANSansX** (موجود در پروژه)، وزن medium/bold برای عناوین، `text-sm` برای جزئیات محصول.

## چیدمان (ابعاد اندازه‌گیری‌شده — دسکتاپ 1920px)

| بخش | ابعاد تقریبی |
|-----|----------------|
| Hero | تمام viewport (`100dvh`، حداکثر ~1080px ارتفاع) |
| کاشی کالکشن | گرید 2×2، **`aspect-square`** (~50% عرض ≈ 956px) |
| کارت محصول (اسکرول افقی) | ~**161×201** موبایل، ~**341×511** دسکتاپ (نسبت تصویر **2:3**) |
| هدر روی Hero | ثابت، شفاف + متن/آیکون سفید؛ پس از اسکرول پس‌زمینه سفید |

پیاده‌سازی: `layouts/home.vue`, `HomeHeroSlider`, `CollectionTileGrid`, density `sarak` در `ProductCardList`.

- هدر شفاف روی Hero؛ منوی همبرگری، لوگو وسط، سبد/جستجو/ورود.
- Hero تمام‌عرض با تایپوگرافی سفید (NEW COLLECTION).
- فوتر چندستونه + خبرنامه.

## صفحات مرجع بررسی‌شده

- صفحه اصلی (Hero، کالکشن‌ها، جدیدترین، پیشنهاد ویژه، خبرنامه)
- ساختار منو (زنانه / مردانه / دخترانه / پسرانه)
- URL محصول مستقیم در مرورگر 404 (احتمال مسیریابی داخلی) — جزئیات از کارت‌های homepage

## اسکرین‌شات

- `docs/design-reference/sarak-home-desktop.png` (در صورت کپی از جلسه بررسی)

## Design System در کد

- `frontend/tailwind.config.ts` — رنگ‌های primary/accent
- `frontend/assets/css/main.css` — دکمه‌ها، input، کارت محصول
- `frontend/constants/site.ts` — نام برند، متن بنر، تماس

## پروژه ZIP (سوپرمارکت → پوشاک)

### Stack

- Frontend: **Nuxt 3.15**, Vue 3.5, Pinia, Tailwind, PWA
- Backend: **Express 4**, Prisma 6, **MySQL**, JWT + OTP

### قابلیت‌های حفظ‌شده

- احراز هویت، سبد، سفارش، کوpon، علاقه‌مندی، آدرس، پنل admin کامل
- محصولات، دسته، tag، اسلایدر، home feed، تخفیف، محتوای ثابت

### تغییرات لازم / انجام‌شده

| بخش | وضعیت |
|-----|--------|
| تم رنگی و هدر/فوتر | انجام شد |
| کارت و PDP پوشاک (+ `clothingMeta`) | انجام شد |
| SEO: SSR عمومی، sitemap، robots | انجام شد |
| variants رنگ/سایز در DB | فیلد JSON `clothingMeta` |
| پنل admin فرم meta پوشاک | جزئی — JSON از API |
| مقالات / مجله | از `content` موجود قابل توسعه |

### کامپوننت‌های قابل استفاده مجدد

| کامپوننت | استفاده |
|----------|---------|
| AppHeader / AppFooter | بازطراحی ظاهری |
| ProductCard / ProductCardList | تطبیق پوشاک |
| PromoSlider | Hero |
| CategoryCard | کالکشن |
| AppPagination, EmptyState, Modal patterns | بدون تغییر منطقی |
| layouts/admin + middleware | حفظ + تم |
| useApi, stores (auth, cart) | حفظ |

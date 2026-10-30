# دیپلوی روی VPS لینوکس (بدون SSL)

## ساختار روی سرور

```
/opt/crm/
  app/           # کد از GitHub
  data/          # SQLite + فایل‌های پایدار
  logs/          # لاگ PM2
  ecosystem.config.cjs
  CREDENTIALS.txt  # فقط root — رمز owner
```

سرویس‌ها فقط روی `127.0.0.1` گوش می‌دهند؛ Nginx روی پورت ۸۰ عمومی است.

## نصب یک‌خطی (از کنسول سرور / VNC)

به‌عنوان `root`:

```bash
curl -fsSL https://raw.githubusercontent.com/saman-alayee/crm_app/main/deploy/server-setup.sh -o /tmp/crm-setup.sh
bash /tmp/crm-setup.sh
```

یا بعد از clone:

```bash
git clone https://github.com/saman-alayee/crm_app.git /tmp/crm_app
bash /tmp/crm_app/deploy/server-setup.sh
```

آدرس پنل: `http://YOUR_IP/`  

ورود:
- `owner` + رمز داخل `/opt/crm/CREDENTIALS.txt`
- ادمین: `saman` / `Saman@Crm2026!` (فایل: `/opt/crm/ADMIN_SAMAN.txt`)

## امنیت اعمال‌شده

- یوزر سیستم `crm` (اجرای اپ با root نیست)
- API/Web فقط localhost؛ پورت‌های ۴۰۰۰/۳۰۰۰ به بیرون باز نیستند
- UFW: فقط SSH + HTTP
- fail2ban
- فایل `.env` با مجوز `600`
- هدرهای امنیتی Nginx
- rate-limit روی `/api/`

## پاک‌سازی + امنیت + بهینه‌سازی

بعد از نصب (یا هر وقت):

```bash
curl -fsSL https://raw.githubusercontent.com/saman-alayee/crm_app/main/deploy/harden-cleanup.sh -o /tmp/crm-harden.sh
bash /tmp/crm-harden.sh
```

این اسکریپت:
- پوشهٔ سنگین `sources/` و فایل‌های QA/موقت را حذف می‌کند
- مجوز `.env` و دیتابیس را قفل می‌کند (`600` / `640`)
- API و Nuxt را فقط روی `127.0.0.1` نگه می‌دارد
- UFW (فقط SSH+HTTP)، fail2ban، هدرهای Nginx و rate-limit را اعمال می‌کند
- لاگ‌ها را rotate و کش npm/apt را پاک می‌کند

## بدون SSL

طبق درخواست، فقط HTTP روی IP بالا می‌آید. بعداً برای دامنه می‌توان Certbot اضافه کرد.

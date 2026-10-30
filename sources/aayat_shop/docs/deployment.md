# راهنمای استقرار Production

## پیش‌نیازها (Ubuntu 22.04+)

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Redis
sudo apt install -y redis-server

# Nginx
sudo apt install -y nginx

# PM2
sudo npm install -g pm2
```

## دیتابیس

```bash
sudo -u postgres psql
CREATE USER hypermarket WITH PASSWORD 'your_password';
CREATE DATABASE hypermarket OWNER hypermarket;
\q
```

## استقرار پروژه

```bash
# Clone
git clone <repo-url> /var/www/hypermarket
cd /var/www/hypermarket

# Backend
cd backend
cp .env.example .env
# Edit .env with production values
npm install
npx prisma migrate deploy
npx prisma db seed
npm run build

# Frontend
cd ../frontend
cp .env.example .env
# Set NUXT_PUBLIC_API_BASE=https://yourdomain.com/api
npm install
npm run build

# Start with PM2
cd ..
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Nginx Configuration

```nginx
# /etc/nginx/sites-available/hypermarket
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend (Nuxt SSR)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads
    location /uploads {
        proxy_pass http://127.0.0.1:3001;
    }

    # PWA assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        proxy_pass http://127.0.0.1:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hypermarket /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Environment Variables (Production)

### Backend (.env)
```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://hypermarket:password@localhost:5432/hypermarket
REDIS_URL=redis://localhost:6379
JWT_SECRET=<strong-random-secret>
OTP_DEV_MODE=false
CORS_ORIGIN=https://yourdomain.com
ADMIN_PHONE=09120000000
```

### Frontend (.env)
```
NUXT_PUBLIC_API_BASE=https://yourdomain.com/api
```

## Monitoring

```bash
pm2 status
pm2 logs
pm2 monit
```

## Backup Database

```bash
pg_dump -U hypermarket hypermarket > backup_$(date +%Y%m%d).sql
```

## Important Notes

- **No online payment** is implemented. Orders use cash-on-delivery.
- Payment gateway can be added in the future without breaking existing order flow.
- Redis is optional but recommended for caching.
- Set `OTP_DEV_MODE=false` in production and integrate SMS provider.

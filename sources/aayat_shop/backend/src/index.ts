import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { config } from './config';
import { configureDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { errorHandler, notFound } from './utils/errors';
import { generalLimiter } from './middleware/rateLimit';

import authRoutes from './routes/auth.routes';
import categoryRoutes from './routes/category.routes';
import productRoutes from './routes/product.routes';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import addressRoutes from './routes/address.routes';
import adminRoutes from './routes/admin.routes';
import settingsRoutes from './routes/settings.routes';
import couponRoutes from './routes/coupon.routes';
import contentRoutes from './routes/content.routes';
import notificationRoutes from './routes/notification.routes';
import sliderRoutes from './routes/slider.routes';
import tagRoutes from './routes/tag.routes';
import favoriteRoutes from './routes/favorite.routes';
import paymentRoutes from './routes/payment.routes';

const app = express();

// Needed when behind nginx / reverse proxy (avoids rate-limit false positives)
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (config.corsOrigins.includes(origin)) return true;
  // Nuxt dev/preview may use ports 3000–3010, 8049, etc.
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedCorsOrigin(origin));
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(generalLimiter);

// Passenger strips /api prefix — normalize back for route handlers.
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  next();
});

const uploadStatic = express.static(path.join(process.cwd(), config.upload.dir));
app.use('/uploads', uploadStatic);
app.use('/api/uploads', uploadStatic);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Aayat Shop API is running', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sliders', sliderRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);

app.use(notFound);
app.use(errorHandler);

function assertProductionSecurity() {
  if (config.nodeEnv !== 'production') return;

  const secret = config.jwt.secret || '';
  if (!secret || secret === 'dev-secret' || secret.length < 32) {
    console.error('JWT_SECRET must be a strong random value (32+ chars) in production');
    process.exit(1);
  }
  if (config.otp.devMode) {
    console.error('OTP_DEV_MODE must be false in production');
    process.exit(1);
  }
}

async function start() {
  const dbUrl = config.databaseUrl ?? '';
  if (!dbUrl.startsWith('mysql://') && !dbUrl.startsWith('file:')) {
    console.error('DATABASE_URL must be mysql://... or file:... (see backend/.env.example)');
    process.exit(1);
  }

  assertProductionSecurity();
  await configureDatabase();
  await connectRedis();

  const passenger = (global as { PhusionPassenger?: { configure: (opts: object) => void } }).PhusionPassenger;
  if (passenger) {
    passenger.configure({ autoInstall: false });
    app.listen('passenger' as unknown as number, () => {
      console.log('Aayat Shop API running on Passenger');
      console.log(`Environment: ${config.nodeEnv}`);
    });
    return;
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Aayat Shop API running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });
}

start().catch(console.error);

export default app;

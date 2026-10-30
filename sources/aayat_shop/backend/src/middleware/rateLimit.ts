import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10_000 : 500,
  message: { success: false, message: 'تعداد درخواست‌ها بیش از حد مجاز است' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  validate: { xForwardedForHeader: false },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 20,
  message: { success: false, message: 'تعداد تلاش‌های ورود بیش از حد مجاز است' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  validate: { xForwardedForHeader: false },
});

export const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 3,
  message: { success: false, message: 'لطفاً یک دقیقه صبر کنید' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  validate: { xForwardedForHeader: false },
});

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function normalizeAdminPhone(phone: string): string {
  let normalized = phone
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\D/g, '');
  if (normalized.startsWith('98')) normalized = `0${normalized.slice(2)}`;
  if (!normalized.startsWith('0') && normalized.length === 10) normalized = `0${normalized}`;
  return normalized;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  otp: {
    expiresMinutes: parseInt(process.env.OTP_EXPIRES_MINUTES || '5', 10),
    devMode: process.env.OTP_DEV_MODE === 'true',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://127.0.0.1:3000',
  apiPublicUrl: process.env.API_PUBLIC_URL || `http://127.0.0.1:${parseInt(process.env.PORT || '3001', 10)}`,
  zibal: {
    merchant: process.env.ZIBAL_MERCHANT || '',
    callbackUrl: process.env.ZIBAL_CALLBACK_URL || '',
  },
  sms: {
    provider: (process.env.SMS_PROVIDER || 'farazsms') as 'farazsms' | 'melipayamak',
    melipayamak: {
      username: process.env.MELIPAYAMAK_USERNAME || '',
      password: process.env.MELIPAYAMAK_PASSWORD || '',
      apiKey: process.env.MELIPAYAMAK_API_KEY || '',
      sender: process.env.MELIPAYAMAK_SENDER || '',
      customerBodyId: process.env.MELIPAYAMAK_CUSTOMER_BODY_ID || '',
      adminBodyId: process.env.MELIPAYAMAK_ADMIN_BODY_ID || '',
      otpBodyId: process.env.MELIPAYAMAK_OTP_BODY_ID || '',
      adminPhones: (process.env.MELIPAYAMAK_ADMIN_PHONES || '')
        .split(',')
        .map((phone) => phone.trim())
        .filter(Boolean),
    },
    farazsms: {
      apiKey: process.env.FARAZSMS_API_KEY || '',
      patternCode: process.env.FARAZSMS_PATTERN_CODE || '',
      lineNumber: process.env.FARAZSMS_LINE_NUMBER || '',
      numberFormat: (process.env.FARAZSMS_NUMBER_FORMAT || 'english') as 'english' | 'persian',
      /** Must match the variable name defined in your FarazSMS pattern (e.g. code, var1). */
      otpAttribute: process.env.FARAZSMS_OTP_ATTRIBUTE || 'code',
      shippedPatternCode: process.env.FARAZSMS_SHIPPED_PATTERN_CODE || '',
      packedPatternCode: process.env.FARAZSMS_PACKED_PATTERN_CODE || '',
      orderAttribute: process.env.FARAZSMS_ORDER_ATTRIBUTE || 'orderNumber',
    },
  },
  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  },
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  adminPhone: normalizeAdminPhone(process.env.ADMIN_PHONE || '09120000000'),
  adminPhones: Array.from(
    new Set(
      [
        process.env.ADMIN_PHONE || '09120000000',
        ...(process.env.ADMIN_PHONES || '')
          .split(',')
          .map((phone) => phone.trim())
          .filter(Boolean),
      ].map(normalizeAdminPhone)
    )
  ),
  adminPassword: process.env.ADMIN_PASSWORD || 'admin1234',
  neshanApiKey: process.env.NESHAN_API_KEY || '',
};

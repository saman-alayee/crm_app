import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config();
// Prisma SQLite relative URLs are resolved from the schema directory (prisma/)
if (process.env.DATABASE_URL?.startsWith('file:./')) {
  const rel = process.env.DATABASE_URL.replace(/^file:\.?\/?/, '');
  process.env.DATABASE_URL = `file:${path.resolve(root, 'prisma', rel)}`;
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value == null || value === '') {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me-32chars',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me-32chars',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  bankEncryptionKey: process.env.BANK_DATA_ENCRYPTION_KEY || '',
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  },
  botInternalApiKey: process.env.BOT_INTERNAL_API_KEY || 'dev-bot-internal-key',
  seed: {
    ownerUsername: process.env.SEED_OWNER_USERNAME || 'owner',
    ownerPassword: process.env.SEED_OWNER_PASSWORD || 'ChangeMeOwner123!',
    ownerEmail: process.env.SEED_OWNER_EMAIL || 'owner@example.com',
  },
  /** Keep audit logs for N days (default 90). Set 0 to disable age-based purge. */
  auditRetentionDays: Math.max(0, Number(process.env.AUDIT_RETENTION_DAYS || 90)),
  /** Hard cap on audit_logs rows (default 100000). Set 0 to disable. */
  auditMaxRows: Math.max(0, Number(process.env.AUDIT_MAX_ROWS || 100_000)),
  /** How often the purge job runs (hours). Default 24. */
  auditPurgeIntervalHours: Math.max(1, Number(process.env.AUDIT_PURGE_INTERVAL_HOURS || 24)),
};

export function assertProductionSecurity() {
  if (!config.isProd) return;
  if (config.jwt.accessSecret.length < 32 || config.jwt.refreshSecret.length < 32) {
    throw new Error('JWT secrets must be at least 32 characters in production');
  }
  if (config.botInternalApiKey === 'dev-bot-internal-key') {
    throw new Error('BOT_INTERNAL_API_KEY must be set in production');
  }
  required('DATABASE_URL');
}

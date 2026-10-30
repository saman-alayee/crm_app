import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** SQLite production pragmas: WAL for concurrency, FK enforcement, busy wait. */
export async function configureDatabase() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.startsWith('file:')) return;

  await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON');
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
  await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
  await prisma.$queryRawUnsafe('PRAGMA temp_store = MEMORY');
  await prisma.$queryRawUnsafe('PRAGMA cache_size = -8000');
}

export default prisma;

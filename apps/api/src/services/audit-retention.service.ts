import { prisma } from '../db/prisma.js';
import { config } from '../config/index.js';

const BATCH = 2_000;

export type AuditPurgeResult = {
  deletedByAge: number;
  deletedByCap: number;
  remaining: number;
  retentionDays: number;
  maxRows: number;
};

/**
 * Deletes audit logs older than retention window, then trims to max row cap.
 * Runs in batches to avoid locking SQLite / blowing memory.
 */
export async function purgeOldAuditLogs(): Promise<AuditPurgeResult> {
  const retentionDays = config.auditRetentionDays;
  const maxRows = config.auditMaxRows;
  let deletedByAge = 0;
  let deletedByCap = 0;

  if (retentionDays > 0) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    // Batch by fetching oldest IDs under cutoff
    for (;;) {
      const old = await prisma.auditLog.findMany({
        where: { createdAt: { lt: cutoff } },
        orderBy: { createdAt: 'asc' },
        take: BATCH,
        select: { id: true },
      });
      if (!old.length) break;
      const res = await prisma.auditLog.deleteMany({
        where: { id: { in: old.map((r) => r.id) } },
      });
      deletedByAge += res.count;
      if (old.length < BATCH) break;
    }
  }

  if (maxRows > 0) {
    for (;;) {
      const total = await prisma.auditLog.count();
      if (total <= maxRows) break;
      const overflow = Math.min(BATCH, total - maxRows);
      const oldest = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'asc' },
        take: overflow,
        select: { id: true },
      });
      if (!oldest.length) break;
      const res = await prisma.auditLog.deleteMany({
        where: { id: { in: oldest.map((r) => r.id) } },
      });
      deletedByCap += res.count;
      if (res.count === 0) break;
    }
  }

  const remaining = await prisma.auditLog.count();
  return { deletedByAge, deletedByCap, remaining, retentionDays, maxRows };
}

let purgeTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runPurgeSafe() {
  if (running) return;
  if (config.auditRetentionDays <= 0 && config.auditMaxRows <= 0) return;
  running = true;
  try {
    const result = await purgeOldAuditLogs();
    if (result.deletedByAge || result.deletedByCap) {
      console.info(
        `[audit-retention] purged age=${result.deletedByAge} cap=${result.deletedByCap}; remaining=${result.remaining} (keep ${result.retentionDays}d / max ${result.maxRows})`
      );
    }
  } catch (err) {
    console.error('[audit-retention] purge failed', err);
  } finally {
    running = false;
  }
}

/** Start periodic cleanup (once shortly after boot, then on interval). */
export function startAuditRetentionJob() {
  if (purgeTimer) return;
  const hours = config.auditPurgeIntervalHours;
  const ms = hours * 60 * 60 * 1000;

  // First run after short delay so boot is not blocked
  setTimeout(() => {
    void runPurgeSafe();
  }, 15_000);

  purgeTimer = setInterval(() => {
    void runPurgeSafe();
  }, ms);

  if (typeof purgeTimer.unref === 'function') purgeTimer.unref();

  console.info(
    `[audit-retention] job started — every ${hours}h, keep ${config.auditRetentionDays}d / max ${config.auditMaxRows} rows`
  );
}

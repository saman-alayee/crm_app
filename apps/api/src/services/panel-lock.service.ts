import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/errors.js';
import { writeAudit } from './audit.service.js';
import { invalidateAuthUserCache } from './auth-user-cache.js';
import { invalidateAllPermissions, userHasFullAccess, userIsOwner } from './rbac.service.js';

export type PanelLockStatus = {
  locked: boolean;
  lockedBy: string | null;
  lockedByUsername: string | null;
  lockedAt: string | null;
  message: string | null;
};

const LOCK_KEYS = ['panelLocked', 'panelLockedBy', 'panelLockedAt', 'panelLockMessage'] as const;

let statusCache: { value: PanelLockStatus; exp: number } | null = null;
const STATUS_TTL_MS = 8_000;

function invalidatePanelLockCache() {
  statusCache = null;
}

async function setSetting(key: string, value: unknown, updatedBy?: string) {
  if (value === null || value === undefined) {
    await prisma.systemSetting.deleteMany({ where: { key } });
    return;
  }
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: value as object, updatedBy },
    update: { value: value as object, updatedBy },
  });
}

export async function getPanelLockStatus(): Promise<PanelLockStatus> {
  if (statusCache && statusCache.exp > Date.now()) {
    return statusCache.value;
  }

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...LOCK_KEYS] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const locked = map.panelLocked === true;
  const lockedBy = (map.panelLockedBy as string | null) || null;
  const lockedAt = (map.panelLockedAt as string | null) || null;
  const message = (map.panelLockMessage as string | null) || null;

  let lockedByUsername: string | null = null;
  if (locked && lockedBy) {
    const user = await prisma.user.findUnique({
      where: { id: lockedBy },
      select: { username: true },
    });
    lockedByUsername = user?.username || null;
  }

  const value: PanelLockStatus = {
    locked,
    lockedBy: locked ? lockedBy : null,
    lockedByUsername: locked ? lockedByUsername : null,
    lockedAt: locked ? lockedAt : null,
    message: locked ? message || 'پنل توسط مدیر قفل شده است' : null,
  };

  statusCache = { value, exp: Date.now() + STATUS_TTL_MS };
  return value;
}

/** Throws if user is not allowed while panel is locked */
export async function assertPanelAccess(userId: string) {
  const status = await getPanelLockStatus();
  if (!status.locked) return status;
  if (status.lockedBy === userId) return status;
  throw new AppError(403, status.message || 'پنل قفل است؛ فقط قفل‌کننده می‌تواند وارد شود', 'PANEL_LOCKED');
}

export async function lockPanel(actorId: string, message?: string) {
  if (!(await userHasFullAccess(actorId))) {
    throw new AppError(403, 'فقط مالک یا ادمین می‌تواند پنل را قفل کند');
  }

  const status = await getPanelLockStatus();
  if (status.locked && status.lockedBy !== actorId) {
    throw new AppError(400, `پنل هم‌اکنون توسط @${status.lockedByUsername || 'مدیر'} قفل است`);
  }

  const lockedAt = new Date().toISOString();
  const lockMessage =
    (message || '').trim() || 'پنل موقتاً قفل است و فقط مدیر قفل‌کننده دسترسی دارد';

  await setSetting('panelLocked', true, actorId);
  await setSetting('panelLockedBy', actorId, actorId);
  await setSetting('panelLockedAt', lockedAt, actorId);
  await setSetting('panelLockMessage', lockMessage, actorId);
  invalidatePanelLockCache();

  // Kick everyone else: bump tokenVersion + revoke refresh tokens
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: { not: actorId } },
      data: { tokenVersion: { increment: 1 } },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: { not: actorId }, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  invalidateAllPermissions();
  invalidateAuthUserCache();

  await writeAudit({
    actorId,
    action: 'panel_lock',
    module: 'settings',
    entityType: 'PanelLock',
    after: { lockedAt, message: lockMessage },
  });

  return getPanelLockStatus();
}

export async function unlockPanel(actorId: string) {
  const status = await getPanelLockStatus();
  if (!status.locked) {
    return status;
  }

  const isLocker = status.lockedBy === actorId;
  const isOwner = await userIsOwner(actorId);
  if (!isLocker && !isOwner) {
    throw new AppError(403, 'فقط قفل‌کننده یا مالک می‌تواند پنل را باز کند');
  }

  await setSetting('panelLocked', false, actorId);
  await setSetting('panelLockedBy', null, actorId);
  await setSetting('panelLockedAt', null, actorId);
  await setSetting('panelLockMessage', null, actorId);
  invalidatePanelLockCache();

  await writeAudit({
    actorId,
    action: 'panel_unlock',
    module: 'settings',
    entityType: 'PanelLock',
    before: status,
  });

  return getPanelLockStatus();
}

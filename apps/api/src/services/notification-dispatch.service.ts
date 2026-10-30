import { prisma } from '../db/prisma.js';
import { resolveUserPermissions } from './rbac.service.js';
import type { PermissionKey } from '../shared/index.js';
import { isTelegramConfigured, sendTelegramMessage } from './telegram.service.js';
import { emitNotificationNew } from './realtime.service.js';

export async function notifyUsers(input: {
  userIds: string[];
  title: string;
  body: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  metadata?: object;
}) {
  const unique = [...new Set(input.userIds.filter(Boolean))];
  for (const userId of unique) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        employee: { select: { telegramUserId: true } },
      },
    });
    if (!user?.isActive) continue;

    const dashKey = `${input.eventType}:${input.entityId || 'none'}:${userId}:DASHBOARD`;
    const existingDash = await prisma.notificationDelivery.findUnique({
      where: { idempotencyKey: dashKey },
    });

    let notificationId: string | null = null;
    let createdFresh = false;
    let createdNotification:
      | {
          id: string;
          title: string;
          body: string;
          eventType: string;
          entityType: string | null;
          entityId: string | null;
          isRead: boolean;
          createdAt: Date;
        }
      | null = null;

    if (!existingDash) {
      const notification = await prisma.notification.create({
        data: {
          userId,
          title: input.title,
          body: input.body,
          eventType: input.eventType,
          entityType: input.entityType,
          entityId: input.entityId,
          metadata: (input.metadata || undefined) as object | undefined,
        },
      });
      notificationId = notification.id;
      createdFresh = true;
      createdNotification = notification;
      await prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          channel: 'DASHBOARD',
          status: 'SENT',
          idempotencyKey: dashKey,
          attempts: 1,
          sentAt: new Date(),
        },
      });
    } else {
      notificationId = existingDash.notificationId;
    }

    if (createdFresh && createdNotification) {
      void emitNotificationNew(userId, createdNotification);
    }

    // Per-user Telegram push when account is linked
    const tgId = user.employee?.telegramUserId;
    if (!tgId || !isTelegramConfigured() || !notificationId) continue;

    const tgKey = `${input.eventType}:${input.entityId || 'none'}:${userId}:TELEGRAM`;
    const existingTg = await prisma.notificationDelivery.findUnique({
      where: { idempotencyKey: tgKey },
    });
    if (existingTg?.status === 'SENT') continue;

    const delivery =
      existingTg ||
      (await prisma.notificationDelivery.create({
        data: {
          notificationId,
          channel: 'TELEGRAM',
          status: 'PENDING',
          idempotencyKey: tgKey,
          attempts: 0,
        },
      }));

    const text = `<b>${escapeHtml(input.title)}</b>\n${escapeHtml(input.body)}\n\n<i>فروشگاه سامی</i>`;
    const result = await sendTelegramMessage({ chatId: tgId, text });

    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        attempts: { increment: 1 },
        status: result.ok ? 'SENT' : result.skipped ? 'SKIPPED' : 'FAILED',
        lastError: result.ok ? null : result.error,
        sentAt: result.ok ? new Date() : undefined,
      },
    });
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function usersWithPermission(permission: PermissionKey): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  const ids: string[] = [];
  for (const u of users) {
    const perms = await resolveUserPermissions(u.id);
    if (perms.includes(permission)) ids.push(u.id);
  }
  return ids;
}

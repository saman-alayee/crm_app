import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, AppError } from '../../utils/errors.js';
import { prisma } from '../../db/prisma.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';
import { emitUnreadSync } from '../../services/realtime.service.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate, requirePermission('notifications.view'));

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const where = { userId: req.user!.id };
    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, isRead: false } }),
    ]);
    successResponse(res, {
      items,
      unreadCount,
      pagination: paginationMeta(page, limit, total),
    });
  })
);

notificationsRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.id, isRead: false },
    });
    successResponse(res, { unreadCount });
  })
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const row = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!row) throw new AppError(404, 'اعلان یافت نشد');
    const updated = await prisma.notification.update({
      where: { id: row.id },
      data: { isRead: true, readAt: new Date() },
    });
    void emitUnreadSync(req.user!.id, { readId: updated.id });
    successResponse(res, updated);
  })
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    void emitUnreadSync(req.user!.id, { readAll: true });
    successResponse(res, { ok: true });
  })
);

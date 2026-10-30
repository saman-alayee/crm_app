import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody } from '../../utils/errors.js';
import { announcementsService } from './announcements.service.js';
import { prisma } from '../../db/prisma.js';
import { notifyUsers } from '../../services/notification-dispatch.service.js';
import { writeAudit } from '../../services/audit.service.js';
import { AppError } from '../../utils/errors.js';

export const announcementsRouter = Router();
announcementsRouter.use(authenticate);

announcementsRouter.get(
  '/',
  requirePermission('announcements.view'),
  asyncHandler(async (req, res) => {
    const canManage = req.user!.permissions.includes('announcements.create');
    successResponse(res, canManage ? await announcementsService.listAll() : await announcementsService.listActive());
  })
);

announcementsRouter.post(
  '/',
  requirePermission('announcements.create'),
  validateBody(
    z.object({
      title: z.string().min(2),
      body: z.string().min(2),
      audience: z.enum(['ALL', 'ROLE', 'ACTIVE_EMPLOYEES']).optional(),
      roleId: z.string().optional(),
      isPinned: z.boolean().optional(),
      expiresAt: z.string().nullable().optional(),
      sendNotification: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    successResponse(res, await announcementsService.create(req.body, req.user!.id), 'اطلاعیه ثبت شد', 201);
  })
);

announcementsRouter.delete(
  '/:id',
  requirePermission('announcements.delete'),
  asyncHandler(async (req, res) => {
    await announcementsService.remove(req.params.id, req.user!.id);
    successResponse(res, { ok: true }, 'حذف شد');
  })
);

/** Admin broadcast notification without announcement board entry */
announcementsRouter.post(
  '/broadcast',
  requirePermission('notifications.create'),
  validateBody(
    z.object({
      title: z.string().min(2),
      body: z.string().min(2),
      audience: z.enum(['ALL', 'ROLE', 'ACTIVE_EMPLOYEES']).default('ACTIVE_EMPLOYEES'),
      roleId: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    let userIds: string[] = [];
    if (req.body.audience === 'ROLE' && req.body.roleId) {
      const links = await prisma.userRole.findMany({
        where: { roleId: req.body.roleId, user: { isActive: true } },
        select: { userId: true },
      });
      userIds = links.map((l) => l.userId);
    } else {
      const users = await prisma.user.findMany({
        where: { isActive: true, employee: { isNot: null } },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }
    if (!userIds.length) throw new AppError(400, 'گیرنده‌ای یافت نشد');

    await notifyUsers({
      userIds,
      title: req.body.title,
      body: req.body.body,
      eventType: 'admin.broadcast',
      entityType: 'Broadcast',
      entityId: `broadcast-${Date.now()}`,
    });

    await writeAudit({
      actorId: req.user!.id,
      action: 'broadcast',
      module: 'notifications',
      after: { title: req.body.title, recipients: userIds.length },
    });

    successResponse(res, { recipients: userIds.length }, 'اعلان ارسال شد');
  })
);

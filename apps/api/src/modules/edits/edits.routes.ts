import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, AppError } from '../../utils/errors.js';
import { routeParam } from '../../utils/params.js';
import { prisma } from '../../db/prisma.js';

export const editsRouter = Router();
editsRouter.use(authenticate);

editsRouter.get(
  '/',
  requirePermission('trades.view'),
  asyncHandler(async (req, res) => {
    const entityType = String(req.query.entityType || '');
    const entityId = String(req.query.entityId || '');
    const onlyUnacked = String(req.query.unacked || '') === '1';
    const items = await prisma.requestEditHistory.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
        ...(onlyUnacked ? { sensitive: true, ackedAt: null } : {}),
      },
      include: {
        editedBy: {
          select: { id: true, username: true, employee: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    successResponse(res, items);
  })
);

editsRouter.post(
  '/:id/ack',
  requirePermission('trades.approve'),
  asyncHandler(async (req, res) => {
    const row = await prisma.requestEditHistory.findUnique({ where: { id: routeParam(req.params.id) } });
    if (!row) throw new AppError(404, 'یافت نشد');
    if (!row.sensitive) throw new AppError(400, 'این تغییر نیاز به تأیید ندارد');
    const updated = await prisma.requestEditHistory.update({
      where: { id: row.id },
      data: { ackedAt: new Date(), ackedById: req.user!.id },
    });
    successResponse(res, updated, 'تأیید شد');
  })
);

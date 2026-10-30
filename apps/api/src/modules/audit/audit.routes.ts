import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse } from '../../utils/errors.js';
import { prisma } from '../../db/prisma.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';

export const auditRouter = Router();
auditRouter.use(authenticate, requirePermission('audit.view'));

auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const where = {
      ...(req.query.module ? { module: String(req.query.module) } : {}),
      ...(req.query.entityId ? { entityId: String(req.query.entityId) } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              employee: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);
    successResponse(res, { items, pagination: paginationMeta(page, limit, total) });
  })
);

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody, AppError } from '../../utils/errors.js';
import { routeParam } from '../../utils/params.js';
import { prisma } from '../../db/prisma.js';

export const sourcesRouter = Router();
sourcesRouter.use(authenticate);

sourcesRouter.get(
  '/',
  requirePermission('sources.view'),
  asyncHandler(async (_req, res) => {
    const items = await prisma.acquisitionSource.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    successResponse(res, items);
  })
);

sourcesRouter.post(
  '/',
  requirePermission('sources.create'),
  validateBody(z.object({ name: z.string().min(2), sortOrder: z.number().int().optional() })),
  asyncHandler(async (req, res) => {
    const item = await prisma.acquisitionSource.create({
      data: { name: req.body.name.trim(), sortOrder: req.body.sortOrder ?? 0 },
    });
    successResponse(res, item, 'منبع ثبت شد', 201);
  })
);

sourcesRouter.put(
  '/:id',
  requirePermission('sources.edit'),
  validateBody(
    z.object({
      name: z.string().min(2).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    try {
      const item = await prisma.acquisitionSource.update({
        where: { id: routeParam(req.params.id) },
        data: {
          ...(req.body.name ? { name: req.body.name.trim() } : {}),
          ...(req.body.isActive !== undefined ? { isActive: req.body.isActive } : {}),
          ...(req.body.sortOrder !== undefined ? { sortOrder: req.body.sortOrder } : {}),
        },
      });
      successResponse(res, item, 'به‌روزرسانی شد');
    } catch {
      throw new AppError(404, 'منبع یافت نشد');
    }
  })
);

sourcesRouter.get(
  '/report/unique-customers',
  requirePermission('reports.view'),
  asyncHandler(async (_req, res) => {
    const sources = await prisma.acquisitionSource.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    const rows = await Promise.all(
      sources.map(async (s) => {
        const unique = await prisma.contact.count({ where: { acquisitionSourceId: s.id } });
        return { id: s.id, name: s.name, uniqueCustomers: unique };
      })
    );
    const unassigned = await prisma.contact.count({ where: { acquisitionSourceId: null } });
    successResponse(res, { items: rows, unassigned });
  })
);

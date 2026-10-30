import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody, AppError } from '../../utils/errors.js';
import { routeParam } from '../../utils/params.js';
import { prisma } from '../../db/prisma.js';

export const optionsRouter = Router();
optionsRouter.use(authenticate);

optionsRouter.get(
  '/',
  requirePermission('options.view'),
  asyncHandler(async (req, res) => {
    const kind = String(req.query.kind || '');
    const items = await prisma.productOption.findMany({
      where: {
        ...(kind === 'PHONE' || kind === 'SIM' ? { kind: kind as 'PHONE' | 'SIM' } : {}),
        ...(String(req.query.active || '') === '1' ? { isActive: true } : {}),
      },
      orderBy: [{ kind: 'asc' }, { category: 'asc' }, { sortOrder: 'asc' }, { value: 'asc' }],
    });
    successResponse(res, items);
  })
);

optionsRouter.post(
  '/',
  requirePermission('options.edit'),
  validateBody(
    z.object({
      kind: z.enum(['PHONE', 'SIM']),
      category: z.string().min(1),
      value: z.string().min(1),
      sortOrder: z.number().int().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const item = await prisma.productOption.create({
      data: {
        kind: req.body.kind,
        category: req.body.category.trim(),
        value: req.body.value.trim(),
        sortOrder: req.body.sortOrder ?? 0,
      },
    });
    successResponse(res, item, 'گزینه ثبت شد', 201);
  })
);

optionsRouter.put(
  '/:id',
  requirePermission('options.edit'),
  validateBody(
    z.object({
      value: z.string().min(1).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    try {
      const item = await prisma.productOption.update({
        where: { id: routeParam(req.params.id) },
        data: {
          ...(req.body.value ? { value: req.body.value.trim() } : {}),
          ...(req.body.isActive !== undefined ? { isActive: req.body.isActive } : {}),
          ...(req.body.sortOrder !== undefined ? { sortOrder: req.body.sortOrder } : {}),
        },
      });
      successResponse(res, item, 'به‌روزرسانی شد');
    } catch {
      throw new AppError(404, 'گزینه یافت نشد');
    }
  })
);

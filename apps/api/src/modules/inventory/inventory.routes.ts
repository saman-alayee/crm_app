import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody, AppError } from '../../utils/errors.js';
import { routeParam } from '../../utils/params.js';
import { prisma } from '../../db/prisma.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';
import { runInventoryMatching } from '../../services/match.service.js';
import { recordEditHistory } from '../../services/edit-history.service.js';
import { writeAudit } from '../../services/audit.service.js';

export const inventoryRouter = Router();
inventoryRouter.use(authenticate);

function mapItem(item: any, canCost: boolean) {
  return {
    ...item,
    costPrice: canCost ? item.costPrice : undefined,
  };
}

inventoryRouter.get(
  '/',
  requirePermission('inventory.view'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const productKind = String(req.query.productKind || '');
    const onlyInStock = String(req.query.inStock || '') === '1';
    const where = {
      isActive: true,
      ...(productKind === 'PHONE' || productKind === 'SIM'
        ? { productKind: productKind as 'PHONE' | 'SIM' }
        : {}),
      ...(onlyInStock ? { quantity: { gt: 0 } } : {}),
    };
    const canCost = req.user!.permissions.includes('inventory.view_sensitive');
    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inventoryItem.count({ where }),
    ]);
    successResponse(res, {
      items: items.map((i) => mapItem(i, canCost)),
      meta: paginationMeta(page, limit, total),
    });
  })
);

inventoryRouter.post(
  '/',
  requirePermission('inventory.create'),
  validateBody(
    z.object({
      productKind: z.enum(['PHONE', 'SIM']),
      specs: z.record(z.any()),
      quantity: z.number().int().nonnegative(),
      costPrice: z.union([z.number(), z.string()]).optional().nullable(),
      sellPrice: z.union([z.number(), z.string()]).optional().nullable(),
      note: z.string().optional().nullable(),
    })
  ),
  asyncHandler(async (req, res) => {
    const canCost = req.user!.permissions.includes('inventory.view_sensitive');
    const item = await prisma.inventoryItem.create({
      data: {
        productKind: req.body.productKind,
        specs: req.body.specs || {},
        quantity: req.body.quantity,
        costPrice:
          canCost && req.body.costPrice != null && req.body.costPrice !== ''
            ? String(req.body.costPrice)
            : null,
        sellPrice:
          req.body.sellPrice != null && req.body.sellPrice !== '' ? String(req.body.sellPrice) : null,
        note: req.body.note || null,
        createdById: req.user!.id,
      },
    });
    await writeAudit({
      actorId: req.user!.id,
      action: 'create',
      module: 'inventory',
      entityType: 'InventoryItem',
      entityId: item.id,
      after: { productKind: item.productKind, quantity: item.quantity },
    });
    void runInventoryMatching(item.id);
    successResponse(res, mapItem(item, canCost), 'موجودی ثبت شد', 201);
  })
);

inventoryRouter.put(
  '/:id',
  requirePermission('inventory.edit'),
  validateBody(
    z.object({
      specs: z.record(z.any()).optional(),
      quantity: z.number().int().nonnegative().optional(),
      costPrice: z.union([z.number(), z.string()]).optional().nullable(),
      sellPrice: z.union([z.number(), z.string()]).optional().nullable(),
      note: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const existing = await prisma.inventoryItem.findUnique({ where: { id: routeParam(req.params.id) } });
    if (!existing) throw new AppError(404, 'آیتم یافت نشد');
    const canCost = req.user!.permissions.includes('inventory.view_sensitive');
    const updated = await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: {
        ...(req.body.specs ? { specs: req.body.specs } : {}),
        ...(req.body.quantity !== undefined ? { quantity: req.body.quantity } : {}),
        ...(canCost && req.body.costPrice !== undefined
          ? {
              costPrice:
                req.body.costPrice != null && req.body.costPrice !== ''
                  ? String(req.body.costPrice)
                  : null,
            }
          : {}),
        ...(req.body.sellPrice !== undefined
          ? {
              sellPrice:
                req.body.sellPrice != null && req.body.sellPrice !== ''
                  ? String(req.body.sellPrice)
                  : null,
            }
          : {}),
        ...(req.body.note !== undefined ? { note: req.body.note } : {}),
        ...(req.body.isActive !== undefined ? { isActive: req.body.isActive } : {}),
      },
    });
    await recordEditHistory({
      entityType: 'InventoryItem',
      entityId: existing.id,
      editedById: req.user!.id,
      before: {
        quantity: existing.quantity,
        sellPrice: existing.sellPrice != null ? String(existing.sellPrice) : null,
        specs: existing.specs,
        isActive: existing.isActive,
      },
      after: {
        quantity: updated.quantity,
        sellPrice: updated.sellPrice != null ? String(updated.sellPrice) : null,
        specs: updated.specs,
        isActive: updated.isActive,
      },
      labels: {
        quantity: 'تعداد',
        sellPrice: 'قیمت فروش',
        specs: 'مشخصات',
        isActive: 'فعال',
      },
      sensitive: canCost,
      title: 'ویرایش موجودی',
    });
    if (updated.isActive && updated.quantity > 0) void runInventoryMatching(updated.id);
    successResponse(res, mapItem(updated, canCost), 'به‌روزرسانی شد');
  })
);

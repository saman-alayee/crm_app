import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody, AppError } from '../../utils/errors.js';
import { routeParam } from '../../utils/params.js';
import { prisma } from '../../db/prisma.js';
import { publicInventoryView } from '../../shared/shop.js';

export const sharesRouter = Router();
sharesRouter.use(authenticate);

function token() {
  return randomBytes(12).toString('base64url');
}

sharesRouter.get(
  '/',
  requirePermission('shares.view'),
  asyncHandler(async (_req, res) => {
    const items = await prisma.shareLink.findMany({
      include: {
        items: { include: { inventoryItem: true } },
        _count: { select: { events: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    successResponse(
      res,
      items.map((s) => ({
        ...s,
        items: s.items.map((i) => ({
          id: i.id,
          inventoryItem: publicInventoryView(i.inventoryItem),
        })),
      }))
    );
  })
);

sharesRouter.post(
  '/',
  requirePermission('shares.create'),
  validateBody(
    z.object({
      title: z.string().optional().nullable(),
      inventoryItemIds: z.array(z.string()).min(1),
      expiresAt: z.string().optional().nullable(),
    })
  ),
  asyncHandler(async (req, res) => {
    const ids = [...new Set(req.body.inventoryItemIds as string[])];
    const found = await prisma.inventoryItem.findMany({
      where: { id: { in: ids }, isActive: true, quantity: { gt: 0 } },
    });
    if (!found.length) throw new AppError(400, 'هیچ کالای معتبری انتخاب نشده');
    const link = await prisma.shareLink.create({
      data: {
        token: token(),
        title: req.body.title || null,
        createdById: req.user!.id,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
        items: { create: found.map((f) => ({ inventoryItemId: f.id })) },
      },
      include: { items: { include: { inventoryItem: true } } },
    });
    successResponse(
      res,
      {
        ...link,
        items: link.items.map((i) => ({
          id: i.id,
          inventoryItem: publicInventoryView(i.inventoryItem),
        })),
      },
      'لینک ساخته شد',
      201
    );
  })
);

sharesRouter.post(
  '/:id/deactivate',
  requirePermission('shares.edit'),
  asyncHandler(async (req, res) => {
    const link = await prisma.shareLink.update({
      where: { id: routeParam(req.params.id) },
      data: { isActive: false },
    });
    successResponse(res, link, 'لینک غیرفعال شد');
  })
);

export const publicShareRouter = Router();

publicShareRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const link = await prisma.shareLink.findUnique({
      where: { token: routeParam(req.params.token) },
      include: {
        items: {
          include: { inventoryItem: true },
        },
      },
    });
    if (!link || !link.isActive) throw new AppError(404, 'لینک معتبر نیست');
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      throw new AppError(410, 'لینک منقضی شده');
    }
    await prisma.shareLinkEvent.create({
      data: { shareLinkId: link.id, eventType: 'view' },
    });
    const items = (link as typeof link & { items: Array<{ inventoryItem: any }> }).items;
    successResponse(res, {
      title: link.title || 'لیست محصولات',
      items: items
        .filter((i) => i.inventoryItem.isActive && i.inventoryItem.quantity > 0)
        .map((i) => publicInventoryView(i.inventoryItem)),
    });
  })
);

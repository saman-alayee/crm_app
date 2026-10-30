import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody, AppError } from '../../utils/errors.js';
import { routeParam } from '../../utils/params.js';
import { prisma } from '../../db/prisma.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';
import { isValidIranMobile, normalizeMobile, specsRecord } from '../../shared/shop.js';
import { runTradeMatching } from '../../services/match.service.js';
import { recordEditHistory } from '../../services/edit-history.service.js';
import { writeAudit } from '../../services/audit.service.js';

export const tradesRouter = Router();
tradesRouter.use(authenticate);

const tradeBody = z.object({
  side: z.enum(['BUY', 'SELL']),
  productKind: z.enum(['PHONE', 'SIM']),
  contactId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerMobile: z.string().optional().nullable(),
  acquisitionSourceId: z.string().optional().nullable(),
  specs: z.record(z.any()),
  quantity: z.number().int().positive().optional(),
  price: z.union([z.number(), z.string()]).optional().nullable(),
  note: z.string().optional().nullable(),
  status: z.enum(['OPEN', 'MATCHED', 'CLOSED', 'CANCELLED']).optional(),
});

async function resolveContact(body: z.infer<typeof tradeBody>, userId: string) {
  if (body.contactId) {
    const c = await prisma.contact.findUnique({ where: { id: body.contactId } });
    if (!c) throw new AppError(400, 'مشتری یافت نشد');
    return c;
  }
  const name = (body.customerName || '').trim();
  const mobileRaw = (body.customerMobile || '').trim();
  if (!name && !mobileRaw) return null;
  if (!name || !mobileRaw) throw new AppError(400, 'نام و موبایل مشتری هر دو لازم است');
  const mobile = normalizeMobile(mobileRaw);
  if (!isValidIranMobile(mobile)) throw new AppError(400, 'موبایل مشتری معتبر نیست');

  const existing = await prisma.contact.findUnique({ where: { mobile } });
  if (existing) {
    return prisma.contact.update({
      where: { id: existing.id },
      data: {
        fullName: name,
        acquisitionSourceId: body.acquisitionSourceId || existing.acquisitionSourceId,
      },
    });
  }
  return prisma.contact.create({
    data: {
      fullName: name,
      mobile,
      acquisitionSourceId: body.acquisitionSourceId || null,
      createdById: userId,
    },
  });
}

tradesRouter.get(
  '/',
  requirePermission('trades.view'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const side = String(req.query.side || '');
    const status = String(req.query.status || '');
    const productKind = String(req.query.productKind || '');
    const where = {
      ...(side === 'BUY' || side === 'SELL' ? { side: side as 'BUY' | 'SELL' } : {}),
      ...(status ? { status: status as never } : {}),
      ...(productKind === 'PHONE' || productKind === 'SIM'
        ? { productKind: productKind as 'PHONE' | 'SIM' }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.tradeRequest.findMany({
        where,
        include: {
          contact: true,
          acquisitionSource: true,
          createdBy: { select: { id: true, username: true, employee: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.tradeRequest.count({ where }),
    ]);
    successResponse(res, { items, meta: paginationMeta(page, limit, total) });
  })
);

tradesRouter.get(
  '/matches',
  requirePermission('trades.view'),
  asyncHandler(async (req, res) => {
    const items = await prisma.matchSuggestion.findMany({
      where: { dismissedAt: null },
      include: {
        buyRequest: { include: { contact: true } },
        sellRequest: { include: { contact: true } },
        inventoryItem: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const canCost = req.user!.permissions.includes('inventory.view_sensitive');
    successResponse(
      res,
      items.map((m) => ({
        ...m,
        inventoryItem: m.inventoryItem
          ? {
              ...m.inventoryItem,
              costPrice: canCost ? m.inventoryItem.costPrice : undefined,
            }
          : null,
      }))
    );
  })
);

tradesRouter.post(
  '/',
  requirePermission('trades.create'),
  validateBody(tradeBody),
  asyncHandler(async (req, res) => {
    const contact = await resolveContact(req.body, req.user!.id);
    const trade = await prisma.tradeRequest.create({
      data: {
        side: req.body.side,
        productKind: req.body.productKind,
        contactId: contact?.id || null,
        customerName: contact?.fullName || req.body.customerName || null,
        customerMobile: contact?.mobile || (req.body.customerMobile ? normalizeMobile(req.body.customerMobile) : null),
        acquisitionSourceId: req.body.acquisitionSourceId || contact?.acquisitionSourceId || null,
        specs: req.body.specs || {},
        quantity: req.body.quantity || 1,
        price: req.body.price != null && req.body.price !== '' ? String(req.body.price) : null,
        note: req.body.note || null,
        createdById: req.user!.id,
      },
      include: { contact: true, acquisitionSource: true },
    });
    await writeAudit({
      actorId: req.user!.id,
      action: 'create',
      module: 'trades',
      entityType: 'TradeRequest',
      entityId: trade.id,
      after: { side: trade.side, productKind: trade.productKind, status: trade.status },
    });
    void runTradeMatching(trade.id);
    successResponse(res, trade, 'درخواست ثبت شد', 201);
  })
);

tradesRouter.put(
  '/:id',
  requirePermission('trades.edit'),
  validateBody(tradeBody.partial().extend({ specs: z.record(z.any()).optional() })),
  asyncHandler(async (req, res) => {
    const existing = await prisma.tradeRequest.findUnique({ where: { id: routeParam(req.params.id) } });
    if (!existing) throw new AppError(404, 'درخواست یافت نشد');

    const contact =
      req.body.customerName || req.body.customerMobile || req.body.contactId
        ? await resolveContact(
            {
              side: existing.side,
              productKind: existing.productKind,
              specs: specsRecord(existing.specs),
              ...req.body,
            } as never,
            req.user!.id
          )
        : null;

    const updated = await prisma.tradeRequest.update({
      where: { id: existing.id },
      data: {
        ...(req.body.side ? { side: req.body.side } : {}),
        ...(req.body.productKind ? { productKind: req.body.productKind } : {}),
        ...(req.body.specs ? { specs: req.body.specs } : {}),
        ...(req.body.quantity ? { quantity: req.body.quantity } : {}),
        ...(req.body.price !== undefined
          ? { price: req.body.price != null && req.body.price !== '' ? String(req.body.price) : null }
          : {}),
        ...(req.body.note !== undefined ? { note: req.body.note } : {}),
        ...(req.body.status
          ? {
              status: req.body.status,
              closedAt: req.body.status === 'CLOSED' || req.body.status === 'CANCELLED' ? new Date() : null,
            }
          : {}),
        ...(req.body.acquisitionSourceId !== undefined
          ? { acquisitionSourceId: req.body.acquisitionSourceId }
          : {}),
        ...(contact
          ? {
              contactId: contact.id,
              customerName: contact.fullName,
              customerMobile: contact.mobile,
            }
          : {}),
      },
      include: { contact: true, acquisitionSource: true },
    });

    await recordEditHistory({
      entityType: 'TradeRequest',
      entityId: existing.id,
      editedById: req.user!.id,
      before: {
        side: existing.side,
        status: existing.status,
        specs: existing.specs,
        price: existing.price != null ? String(existing.price) : null,
        customerName: existing.customerName,
        customerMobile: existing.customerMobile,
      },
      after: {
        side: updated.side,
        status: updated.status,
        specs: updated.specs,
        price: updated.price != null ? String(updated.price) : null,
        customerName: updated.customerName,
        customerMobile: updated.customerMobile,
      },
      labels: {
        side: 'نوع',
        status: 'وضعیت',
        specs: 'مشخصات',
        price: 'قیمت',
        customerName: 'نام مشتری',
        customerMobile: 'موبایل مشتری',
      },
      sensitive: true,
      title: 'ویرایش درخواست خرید/فروش',
    });

    if (updated.status === 'OPEN' || updated.status === 'MATCHED') {
      void runTradeMatching(updated.id);
    }
    successResponse(res, updated, 'به‌روزرسانی شد');
  })
);

tradesRouter.post(
  '/matches/:id/dismiss',
  requirePermission('trades.edit'),
  asyncHandler(async (req, res) => {
    const row = await prisma.matchSuggestion.update({
      where: { id: routeParam(req.params.id) },
      data: { dismissedAt: new Date() },
    });
    successResponse(res, row, 'نادیده گرفته شد');
  })
);

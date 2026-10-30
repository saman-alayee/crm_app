import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody, AppError } from '../../utils/errors.js';
import { routeParam } from '../../utils/params.js';
import { prisma } from '../../db/prisma.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';
import { isValidIranMobile, normalizeMobile } from '../../shared/shop.js';
import { writeAudit } from '../../services/audit.service.js';

export const contactsRouter = Router();
contactsRouter.use(authenticate);

contactsRouter.get(
  '/',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const q = String(req.query.q || '').trim();
    const where = q
      ? {
          OR: [
            { fullName: { contains: q } },
            { mobile: { contains: normalizeMobile(q) || q } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: { acquisitionSource: true },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);
    successResponse(res, { items, meta: paginationMeta(page, limit, total) });
  })
);

contactsRouter.post(
  '/',
  requirePermission('contacts.create'),
  validateBody(
    z.object({
      fullName: z.string().min(2),
      mobile: z.string().min(10),
      acquisitionSourceId: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
  ),
  asyncHandler(async (req, res) => {
    const mobile = normalizeMobile(req.body.mobile);
    if (!isValidIranMobile(mobile)) throw new AppError(400, 'شماره موبایل معتبر نیست (09xxxxxxxxx)');
    const existing = await prisma.contact.findUnique({ where: { mobile } });
    if (existing) throw new AppError(409, 'این موبایل قبلاً ثبت شده است', 'DUPLICATE_MOBILE');
    const contact = await prisma.contact.create({
      data: {
        fullName: req.body.fullName.trim(),
        mobile,
        acquisitionSourceId: req.body.acquisitionSourceId || null,
        notes: req.body.notes || null,
        createdById: req.user!.id,
      },
      include: { acquisitionSource: true },
    });
    await writeAudit({
      actorId: req.user!.id,
      action: 'create',
      module: 'contacts',
      entityType: 'Contact',
      entityId: contact.id,
      after: { fullName: contact.fullName, mobile: contact.mobile },
    });
    successResponse(res, contact, 'مشتری ثبت شد', 201);
  })
);

contactsRouter.put(
  '/:id',
  requirePermission('contacts.edit'),
  validateBody(
    z.object({
      fullName: z.string().min(2),
      mobile: z.string().min(10),
      acquisitionSourceId: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
  ),
  asyncHandler(async (req, res) => {
    const mobile = normalizeMobile(req.body.mobile);
    if (!isValidIranMobile(mobile)) throw new AppError(400, 'شماره موبایل معتبر نیست');
    const dup = await prisma.contact.findFirst({
      where: { mobile, id: { not: routeParam(req.params.id) } },
    });
    if (dup) throw new AppError(409, 'این موبایل قبلاً ثبت شده است', 'DUPLICATE_MOBILE');
    const contact = await prisma.contact.update({
      where: { id: routeParam(req.params.id) },
      data: {
        fullName: req.body.fullName.trim(),
        mobile,
        acquisitionSourceId: req.body.acquisitionSourceId || null,
        notes: req.body.notes || null,
      },
      include: { acquisitionSource: true },
    });
    successResponse(res, contact, 'به‌روزرسانی شد');
  })
);

contactsRouter.get(
  '/lookup',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const mobile = normalizeMobile(String(req.query.mobile || ''));
    if (!mobile) {
      successResponse(res, null);
      return;
    }
    const contact = await prisma.contact.findUnique({
      where: { mobile },
      include: { acquisitionSource: true },
    });
    successResponse(res, contact);
  })
);

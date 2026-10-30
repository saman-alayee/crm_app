import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody, AppError } from '../../utils/errors.js';
import { routeParam } from '../../utils/params.js';
import { prisma } from '../../db/prisma.js';
import { tehranDayKey } from '../../shared/shop.js';
import { writeAudit } from '../../services/audit.service.js';
import { notifyUsers, usersWithPermission } from '../../services/notification-dispatch.service.js';
export const opsbankRouter = Router();
opsbankRouter.use(authenticate);

const BALANCE_FRESH_MS = 24 * 60 * 60 * 1000;

function maskIban(iban?: string | null) {
  if (!iban) return null;
  if (iban.length < 8) return '****';
  return `${iban.slice(0, 4)}****${iban.slice(-4)}`;
}

function mapAccount(a: any, sensitive: boolean) {
  const balanceAge = a.balanceUpdatedAt ? Date.now() - new Date(a.balanceUpdatedAt).getTime() : null;
  const balanceFresh = balanceAge != null && balanceAge <= BALANCE_FRESH_MS;
  return {
    ...a,
    iban: sensitive ? a.iban : maskIban(a.iban),
    accountNumber: sensitive ? a.accountNumber : a.accountNumber ? '****' : null,
    manualBalance:
      sensitive && a.manualBalance != null
        ? {
            value: String(a.manualBalance),
            updatedAt: a.balanceUpdatedAt,
            fresh: balanceFresh,
            definitive: balanceFresh,
          }
        : a.manualBalance != null
          ? { fresh: balanceFresh, definitive: false, masked: true }
          : null,
  };
}

async function sumReserved(
  tx: Prisma.TransactionClient,
  opts: { opsBankAccountId: string; paymentMethodId?: string | null; dayKey: string }
) {
  const where: Prisma.MoneyReservationWhereInput = {
    opsBankAccountId: opts.opsBankAccountId,
    dayKey: opts.dayKey,
    status: 'RESERVED',
    ...(opts.paymentMethodId ? { paymentMethodId: opts.paymentMethodId } : {}),
  };
  const rows = await tx.moneyReservation.findMany({ where, select: { amount: true } });
  return rows.reduce((s, r) => s + Number(r.amount), 0);
}

opsbankRouter.get(
  '/',
  requirePermission('opsbank.view'),
  asyncHandler(async (req, res) => {
    const sensitive = req.user!.permissions.includes('opsbank.view_sensitive');
    const items = await prisma.opsBankAccount.findMany({
      include: { methods: { orderBy: { name: 'asc' } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    successResponse(res, items.map((a) => mapAccount(a, sensitive)));
  })
);

opsbankRouter.post(
  '/',
  requirePermission('opsbank.create'),
  validateBody(
    z.object({
      name: z.string().min(2),
      bankName: z.string().optional().nullable(),
      accountNumber: z.string().optional().nullable(),
      iban: z.string().optional().nullable(),
      dailyCapTotal: z.union([z.number(), z.string()]).optional().nullable(),
    })
  ),
  asyncHandler(async (req, res) => {
    const item = await prisma.opsBankAccount.create({
      data: {
        name: req.body.name.trim(),
        bankName: req.body.bankName || null,
        accountNumber: req.body.accountNumber || null,
        iban: req.body.iban || null,
        dailyCapTotal:
          req.body.dailyCapTotal != null && req.body.dailyCapTotal !== ''
            ? String(req.body.dailyCapTotal)
            : null,
      },
      include: { methods: true },
    });
    successResponse(res, item, 'حساب عملیاتی ثبت شد', 201);
  })
);

opsbankRouter.put(
  '/:id',
  requirePermission('opsbank.edit'),
  validateBody(
    z.object({
      name: z.string().min(2).optional(),
      bankName: z.string().optional().nullable(),
      accountNumber: z.string().optional().nullable(),
      iban: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
      dailyCapTotal: z.union([z.number(), z.string()]).optional().nullable(),
      manualBalance: z.union([z.number(), z.string()]).optional().nullable(),
      clearBalance: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const existing = await prisma.opsBankAccount.findUnique({ where: { id: routeParam(req.params.id) } });
    if (!existing) throw new AppError(404, 'حساب یافت نشد');

    const data: Prisma.OpsBankAccountUpdateInput = {
      ...(req.body.name ? { name: req.body.name.trim() } : {}),
      ...(req.body.bankName !== undefined ? { bankName: req.body.bankName } : {}),
      ...(req.body.accountNumber !== undefined ? { accountNumber: req.body.accountNumber } : {}),
      ...(req.body.iban !== undefined ? { iban: req.body.iban } : {}),
      ...(req.body.isActive !== undefined ? { isActive: req.body.isActive } : {}),
      ...(req.body.dailyCapTotal !== undefined
        ? {
            dailyCapTotal:
              req.body.dailyCapTotal != null && req.body.dailyCapTotal !== ''
                ? String(req.body.dailyCapTotal)
                : null,
          }
        : {}),
    };

    if (req.body.clearBalance) {
      data.manualBalance = null;
      data.balanceUpdatedAt = null;
    } else if (req.body.manualBalance !== undefined) {
      data.manualBalance =
        req.body.manualBalance != null && req.body.manualBalance !== ''
          ? String(req.body.manualBalance)
          : null;
      data.balanceUpdatedAt = new Date();
    }

    const updated = await prisma.opsBankAccount.update({
      where: { id: existing.id },
      data,
      include: { methods: true },
    });

    if (
      req.body.dailyCapTotal !== undefined ||
      req.body.manualBalance !== undefined ||
      req.body.clearBalance
    ) {
      await prisma.opsLimitChangeLog.create({
        data: {
          opsBankAccountId: existing.id,
          changedById: req.user!.id,
          before: {
            dailyCapTotal: existing.dailyCapTotal != null ? String(existing.dailyCapTotal) : null,
            manualBalance: existing.manualBalance != null ? String(existing.manualBalance) : null,
          },
          after: {
            dailyCapTotal: updated.dailyCapTotal != null ? String(updated.dailyCapTotal) : null,
            manualBalance: updated.manualBalance != null ? String(updated.manualBalance) : null,
          },
        },
      });
    }

    const sensitive = req.user!.permissions.includes('opsbank.view_sensitive');
    successResponse(res, mapAccount(updated, sensitive), 'ذخیره شد');
  })
);

opsbankRouter.post(
  '/:id/methods',
  requirePermission('opsbank.create'),
  validateBody(
    z.object({
      name: z.string().min(2),
      dailyCap: z.union([z.number(), z.string()]).optional().nullable(),
    })
  ),
  asyncHandler(async (req, res) => {
    const method = await prisma.opsPaymentMethod.create({
      data: {
        opsBankAccountId: routeParam(req.params.id),
        name: req.body.name.trim(),
        dailyCap:
          req.body.dailyCap != null && req.body.dailyCap !== '' ? String(req.body.dailyCap) : null,
      },
    });
    successResponse(res, method, 'روش پرداخت ثبت شد', 201);
  })
);

opsbankRouter.put(
  '/methods/:methodId',
  requirePermission('opsbank.edit'),
  validateBody(
    z.object({
      name: z.string().min(2).optional(),
      dailyCap: z.union([z.number(), z.string()]).optional().nullable(),
      isActive: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const method = await prisma.opsPaymentMethod.update({
      where: { id: routeParam(req.params.methodId) },
      data: {
        ...(req.body.name ? { name: req.body.name.trim() } : {}),
        ...(req.body.dailyCap !== undefined
          ? {
              dailyCap:
                req.body.dailyCap != null && req.body.dailyCap !== ''
                  ? String(req.body.dailyCap)
                  : null,
            }
          : {}),
        ...(req.body.isActive !== undefined ? { isActive: req.body.isActive } : {}),
      },
    });
    successResponse(res, method, 'به‌روزرسانی شد');
  })
);

opsbankRouter.get(
  '/money-requests',
  requirePermission('opsbank.view'),
  asyncHandler(async (_req, res) => {
    const items = await prisma.moneyRequest.findMany({
      include: {
        opsBankAccount: true,
        paymentMethod: true,
        requestedBy: { select: { id: true, username: true, employee: true } },
        reservation: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    successResponse(res, items);
  })
);

opsbankRouter.post(
  '/money-requests',
  requirePermission('opsbank.create'),
  validateBody(
    z.object({
      opsBankAccountId: z.string(),
      paymentMethodId: z.string().optional().nullable(),
      amount: z.union([z.number(), z.string()]),
      purpose: z.string().optional().nullable(),
    })
  ),
  asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError(400, 'مبلغ نامعتبر است');
    const account = await prisma.opsBankAccount.findUnique({
      where: { id: req.body.opsBankAccountId },
      include: { methods: true },
    });
    if (!account?.isActive) throw new AppError(400, 'حساب عملیاتی فعال نیست');
    if (req.body.paymentMethodId) {
      const m = account.methods.find((x) => x.id === req.body.paymentMethodId && x.isActive);
      if (!m) throw new AppError(400, 'روش پرداخت معتبر نیست');
    }
    const row = await prisma.moneyRequest.create({
      data: {
        opsBankAccountId: account.id,
        paymentMethodId: req.body.paymentMethodId || null,
        amount: String(amount),
        purpose: req.body.purpose || null,
        requestedById: req.user!.id,
      },
    });
    const approvers = await usersWithPermission('opsbank.approve');
    await notifyUsers({
      userIds: approvers,
      title: 'درخواست وجه عملیاتی',
      body: `${amount.toLocaleString('fa-IR')} تومان — ${account.name}`,
      eventType: 'opsbank.money_request',
      entityType: 'MoneyRequest',
      entityId: row.id,
    });
    successResponse(res, row, 'درخواست ثبت شد', 201);
  })
);

opsbankRouter.post(
  '/money-requests/:id/approve',
  requirePermission('opsbank.approve'),
  asyncHandler(async (req, res) => {
    const dayKey = tehranDayKey();
    const result = await prisma.$transaction(async (tx) => {
      const mr = (await tx.moneyRequest.findUnique({
        where: { id: routeParam(req.params.id) },
        include: { opsBankAccount: true, paymentMethod: true, reservation: true },
      })) as any;
      if (!mr) throw new AppError(404, 'درخواست یافت نشد');
      if (mr.status !== 'PENDING') throw new AppError(400, 'این درخواست قابل تأیید نیست');
      if (mr.reservation) throw new AppError(400, 'رزرو قبلاً انجام شده');

      const amount = Number(mr.amount);
      const accountCap =
        mr.opsBankAccount.dailyCapTotal != null ? Number(mr.opsBankAccount.dailyCapTotal) : null;
      const methodCap = mr.paymentMethod?.dailyCap != null ? Number(mr.paymentMethod.dailyCap) : null;

      if (accountCap != null) {
        const used = await sumReserved(tx, { opsBankAccountId: mr.opsBankAccountId, dayKey });
        if (used + amount > accountCap + 1e-9) {
          throw new AppError(400, 'سقف روزانه حساب کافی نیست');
        }
      }
      if (methodCap != null && mr.paymentMethodId) {
        const used = await sumReserved(tx, {
          opsBankAccountId: mr.opsBankAccountId,
          paymentMethodId: mr.paymentMethodId,
          dayKey,
        });
        if (used + amount > methodCap + 1e-9) {
          throw new AppError(400, 'سقف روزانه روش پرداخت کافی نیست');
        }
      }

      const reservation = await tx.moneyReservation.create({
        data: {
          moneyRequestId: mr.id,
          opsBankAccountId: mr.opsBankAccountId,
          paymentMethodId: mr.paymentMethodId,
          amount: mr.amount,
          dayKey,
          status: 'RESERVED',
        },
      });
      const updated = await tx.moneyRequest.update({
        where: { id: mr.id },
        data: {
          status: 'APPROVED',
          reviewedById: req.user!.id,
          reviewedAt: new Date(),
        },
        include: { reservation: true, opsBankAccount: true, paymentMethod: true },
      });
      return { updated, reservation };
    });

    await writeAudit({
      actorId: req.user!.id,
      action: 'approve',
      module: 'opsbank',
      entityType: 'MoneyRequest',
      entityId: result.updated.id,
      after: { status: 'APPROVED', reservationId: result.reservation.id },
    });
    successResponse(res, result.updated, 'تأیید و رزرو شد');
  })
);

opsbankRouter.post(
  '/money-requests/:id/reject',
  requirePermission('opsbank.reject'),
  validateBody(z.object({ reason: z.string().min(2) })),
  asyncHandler(async (req, res) => {
    const mr = await prisma.moneyRequest.findUnique({ where: { id: routeParam(req.params.id) } });
    if (!mr || mr.status !== 'PENDING') throw new AppError(400, 'قابل رد نیست');
    const updated = await prisma.moneyRequest.update({
      where: { id: mr.id },
      data: {
        status: 'REJECTED',
        rejectionReason: req.body.reason,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
    });
    successResponse(res, updated, 'رد شد');
  })
);

opsbankRouter.post(
  '/money-requests/:id/consume',
  requirePermission('opsbank.approve'),
  asyncHandler(async (req, res) => {
    const mr = (await prisma.moneyRequest.findUnique({
      where: { id: routeParam(req.params.id) },
      include: { reservation: true },
    })) as any;
    if (!mr?.reservation || mr.reservation.status !== 'RESERVED') {
      throw new AppError(400, 'رزرو فعالی نیست');
    }
    await prisma.moneyReservation.update({
      where: { id: mr.reservation.id },
      data: { status: 'CONSUMED', consumedAt: new Date() },
    });
    successResponse(res, { ok: true }, 'مصرف شد');
  })
);

opsbankRouter.post(
  '/money-requests/:id/release',
  requirePermission('opsbank.approve'),
  asyncHandler(async (req, res) => {
    const mr = (await prisma.moneyRequest.findUnique({
      where: { id: routeParam(req.params.id) },
      include: { reservation: true },
    })) as any;
    if (!mr?.reservation || mr.reservation.status !== 'RESERVED') {
      throw new AppError(400, 'رزرو فعالی نیست');
    }
    await prisma.moneyReservation.update({
      where: { id: mr.reservation.id },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
    successResponse(res, { ok: true }, 'آزاد شد');
  })
);

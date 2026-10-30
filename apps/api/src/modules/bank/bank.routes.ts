import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody, AppError } from '../../utils/errors.js';
import { prisma } from '../../db/prisma.js';
import { writeAudit } from '../../services/audit.service.js';

export const bankRouter = Router();
bankRouter.use(authenticate);

function maskIban(iban: string) {
  if (iban.length < 8) return '****';
  return `${iban.slice(0, 4)}****${iban.slice(-4)}`;
}

bankRouter.get(
  '/me',
  requirePermission('bank.view'),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user!.id } });
    if (!employee) throw new AppError(400, 'پروفایل کارمند یافت نشد');
    const account = await prisma.bankAccount.findFirst({
      where: { employeeId: employee.id, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    successResponse(res, account);
  })
);

bankRouter.put(
  '/me',
  requirePermission('bank.edit'),
  validateBody(
    z.object({
      accountHolder: z.string().min(2),
      accountNumber: z.string().optional(),
      iban: z.string().min(10),
      bankName: z.string().min(2),
    })
  ),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user!.id } });
    if (!employee) throw new AppError(400, 'پروفایل کارمند یافت نشد');

    const existing = await prisma.bankAccount.findFirst({
      where: { employeeId: employee.id, isActive: true },
    });

    let account;
    if (existing) {
      account = await prisma.bankAccount.update({
        where: { id: existing.id },
        data: {
          accountHolder: req.body.accountHolder,
          accountNumber: req.body.accountNumber || null,
          iban: req.body.iban,
          bankName: req.body.bankName,
        },
      });
      await prisma.bankAccountHistory.create({
        data: {
          bankAccountId: existing.id,
          changedById: req.user!.id,
          previousValue: {
            accountHolder: existing.accountHolder,
            iban: maskIban(existing.iban),
            bankName: existing.bankName,
          },
          newValue: {
            accountHolder: account.accountHolder,
            iban: maskIban(account.iban),
            bankName: account.bankName,
          },
        },
      });
    } else {
      account = await prisma.bankAccount.create({
        data: {
          employeeId: employee.id,
          accountHolder: req.body.accountHolder,
          accountNumber: req.body.accountNumber || null,
          iban: req.body.iban,
          bankName: req.body.bankName,
        },
      });
    }

    await writeAudit({
      actorId: req.user!.id,
      action: existing ? 'update' : 'create',
      module: 'bank',
      entityType: 'BankAccount',
      entityId: account.id,
      after: { bankName: account.bankName, iban: maskIban(account.iban) },
    });

    successResponse(res, account, 'اطلاعات بانکی ذخیره شد');
  })
);

bankRouter.get(
  '/',
  requirePermission('bank.view'),
  asyncHandler(async (req, res) => {
    const canSensitive = req.user!.permissions.includes('bank.view_sensitive');
    const rows = await prisma.bankAccount.findMany({
      where: { isActive: true },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    successResponse(
      res,
      rows.map((r) => ({
        ...r,
        iban: canSensitive ? r.iban : maskIban(r.iban),
        accountNumber: canSensitive ? r.accountNumber : r.accountNumber ? '****' : null,
      }))
    );
  })
);

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody, AppError } from '../../utils/errors.js';
import { prisma } from '../../db/prisma.js';
import { writeAudit } from '../../services/audit.service.js';

export const departmentsRouter = Router();
departmentsRouter.use(authenticate);

departmentsRouter.get(
  '/',
  requirePermission('departments.view'),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.department.findMany({ orderBy: { name: 'asc' } });
    const withCounts = await Promise.all(
      rows.map(async (d) => ({
        ...d,
        employeeCount: await prisma.employee.count({ where: { department: d.name } }),
      }))
    );
    successResponse(res, withCounts);
  })
);

departmentsRouter.post(
  '/',
  requirePermission('departments.create'),
  validateBody(z.object({ name: z.string().min(2), description: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const exists = await prisma.department.findUnique({ where: { name: req.body.name.trim() } });
    if (exists) throw new AppError(400, 'دپارتمان تکراری است');
    const row = await prisma.department.create({
      data: { name: req.body.name.trim(), description: req.body.description || null },
    });
    await writeAudit({
      actorId: req.user!.id,
      action: 'create',
      module: 'departments',
      entityType: 'Department',
      entityId: row.id,
      after: row,
    });
    successResponse(res, row, 'ایجاد شد', 201);
  })
);

departmentsRouter.patch(
  '/:id',
  requirePermission('departments.edit'),
  validateBody(z.object({ name: z.string().min(2).optional(), description: z.string().nullable().optional() })),
  asyncHandler(async (req, res) => {
    const existing = await prisma.department.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'دپارتمان یافت نشد');
    const row = await prisma.department.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name?.trim(),
        description: req.body.description === undefined ? undefined : req.body.description,
      },
    });
    if (req.body.name && req.body.name.trim() !== existing.name) {
      await prisma.employee.updateMany({
        where: { department: existing.name },
        data: { department: req.body.name.trim() },
      });
    }
    successResponse(res, row, 'به‌روزرسانی شد');
  })
);

departmentsRouter.delete(
  '/:id',
  requirePermission('departments.delete'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.department.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'دپارتمان یافت نشد');
    const count = await prisma.employee.count({ where: { department: existing.name } });
    if (count > 0) throw new AppError(400, 'ابتدا کارکنان این دپارتمان را منتقل کنید');
    await prisma.department.delete({ where: { id: req.params.id } });
    successResponse(res, { ok: true }, 'حذف شد');
  })
);

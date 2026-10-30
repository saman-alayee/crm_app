import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody, AppError } from '../../utils/errors.js';
import { employeesService } from './employees.service.js';
import { prisma } from '../../db/prisma.js';
import { writeAudit } from '../../services/audit.service.js';

export const employeesRouter = Router();
employeesRouter.use(authenticate);

const createSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  email: z.string().email().optional().or(z.literal('')),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  employeeCode: z.string().optional(),
  telegramUserId: z.string().optional(),
  roleIds: z.array(z.string()).optional(),
});

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  employeeCode: z.string().nullable().optional(),
  telegramUserId: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
});

employeesRouter.get(
  '/',
  requirePermission('employees.view'),
  asyncHandler(async (req, res) => {
    successResponse(res, await employeesService.list(req.query as Record<string, unknown>));
  })
);

employeesRouter.get(
  '/:id',
  requirePermission('employees.view'),
  asyncHandler(async (req, res) => {
    successResponse(res, await employeesService.get(req.params.id));
  })
);

employeesRouter.post(
  '/',
  requirePermission('employees.create'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = { ...req.body, email: req.body.email || undefined };
    successResponse(res, await employeesService.create(body, req.user!.id), 'کارمند ایجاد شد', 201);
  })
);

employeesRouter.patch(
  '/:id',
  requirePermission('employees.edit'),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const body = {
      ...req.body,
      email: req.body.email === '' ? null : req.body.email,
    };
    successResponse(res, await employeesService.update(req.params.id, body, req.user!.id), 'به‌روزرسانی شد');
  })
);

employeesRouter.post(
  '/:id/deactivate',
  requirePermission('employees.delete'),
  asyncHandler(async (req, res) => {
    successResponse(res, await employeesService.setActive(req.params.id, false, req.user!.id), 'حساب غیرفعال شد');
  })
);

employeesRouter.post(
  '/:id/activate',
  requirePermission('employees.edit'),
  asyncHandler(async (req, res) => {
    successResponse(res, await employeesService.setActive(req.params.id, true, req.user!.id), 'حساب فعال شد');
  })
);

employeesRouter.get(
  '/:id/notes',
  requirePermission('employees.view'),
  asyncHandler(async (req, res) => {
    const notes = await prisma.employeeNote.findMany({
      where: { employeeId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            username: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    successResponse(res, notes);
  })
);

employeesRouter.post(
  '/:id/notes',
  requirePermission('employees.edit'),
  validateBody(z.object({ body: z.string().min(2) })),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) throw new AppError(404, 'کارمند یافت نشد');
    const note = await prisma.employeeNote.create({
      data: {
        employeeId: req.params.id,
        authorId: req.user!.id,
        body: req.body.body.trim(),
      },
    });
    await writeAudit({
      actorId: req.user!.id,
      action: 'note_create',
      module: 'employees',
      entityType: 'EmployeeNote',
      entityId: note.id,
      after: { employeeId: req.params.id },
    });
    successResponse(res, note, 'یادداشت ثبت شد', 201);
  })
);

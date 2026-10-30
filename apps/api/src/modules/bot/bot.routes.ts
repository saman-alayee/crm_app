import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requireBotKey } from '../../middleware/botAuth.js';
import { asyncHandler, successResponse, validateBody, AppError } from '../../utils/errors.js';
import { prisma } from '../../db/prisma.js';
import { resolveUserPermissions } from '../../services/rbac.service.js';
import { assertPanelAccess } from '../../services/panel-lock.service.js';
import { leaveService } from '../leave/leave.service.js';
import { salaryService } from '../salary/salary.service.js';
import { tasksService } from '../tasks/tasks.service.js';
import { writeAudit } from '../../services/audit.service.js';
import type { PermissionKey } from '../../shared/index.js';

export const botRouter = Router();
botRouter.use(requireBotKey);

async function resolveActor(telegramUserId: string) {
  const employee = await prisma.employee.findUnique({
    where: { telegramUserId: String(telegramUserId) },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          isActive: true,
          tokenVersion: true,
        },
      },
    },
  });
  if (!employee?.user?.isActive) {
    throw new AppError(401, 'حساب تلگرام متصل نیست. با /start وارد شوید.', 'NOT_LINKED');
  }
  await assertPanelAccess(employee.user.id);
  const permissions = await resolveUserPermissions(employee.user.id, employee.user.tokenVersion);
  return {
    userId: employee.user.id,
    username: employee.user.username,
    employeeId: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    permissions,
  };
}

function can(perms: string[], key: PermissionKey) {
  return perms.includes(key);
}

botRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    successResponse(res, {
      ok: true,
      telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    });
  })
);

/** Link Telegram account with panel username/password */
botRouter.post(
  '/auth/link',
  validateBody(
    z.object({
      username: z.string().min(2),
      password: z.string().min(1),
      telegramUserId: z.string().min(3),
      telegramUsername: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const username = String(req.body.username).trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { username },
      include: { employee: true },
    });
    if (!user?.isActive || !user.employee) {
      throw new AppError(401, 'نام کاربری یافت نشد یا حساب غیرفعال است', 'USER_NOT_FOUND');
    }
    const ok = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!ok) throw new AppError(401, 'رمز عبور نادرست است', 'INVALID_PASSWORD');

    await assertPanelAccess(user.id);

    // Free telegram id if used by another employee
    await prisma.employee.updateMany({
      where: {
        telegramUserId: String(req.body.telegramUserId),
        NOT: { id: user.employee.id },
      },
      data: { telegramUserId: null, telegramUsername: null },
    });

    await prisma.employee.update({
      where: { id: user.employee.id },
      data: {
        telegramUserId: String(req.body.telegramUserId),
        telegramUsername: req.body.telegramUsername || null,
      },
    });

    await writeAudit({
      actorId: user.id,
      action: 'telegram_link',
      module: 'settings',
      entityType: 'Employee',
      entityId: user.employee.id,
      after: { telegramUserId: String(req.body.telegramUserId) },
    });

    const permissions = await resolveUserPermissions(user.id, user.tokenVersion);
    successResponse(
      res,
      {
        userId: user.id,
        username: user.username,
        employeeId: user.employee.id,
        displayName: `${user.employee.firstName} ${user.employee.lastName}`,
        permissions,
      },
      'اتصال تلگرام موفق بود'
    );
  })
);

botRouter.post(
  '/auth/unlink',
  validateBody(z.object({ telegramUserId: z.string().min(3) })),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findUnique({
      where: { telegramUserId: String(req.body.telegramUserId) },
    });
    if (!employee) {
      successResponse(res, { ok: true }, 'قبلاً قطع شده');
      return;
    }
    await prisma.employee.update({
      where: { id: employee.id },
      data: { telegramUserId: null, telegramUsername: null },
    });
    await writeAudit({
      actorId: employee.userId,
      action: 'telegram_unlink',
      module: 'settings',
      entityType: 'Employee',
      entityId: employee.id,
    });
    successResponse(res, { ok: true }, 'اتصال تلگرام قطع شد');
  })
);

botRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const tg = String(req.query.telegramUserId || '');
    if (!tg) throw new AppError(400, 'telegramUserId الزامی است');
    const actor = await resolveActor(tg);
    successResponse(res, actor);
  })
);

botRouter.get(
  '/menu',
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(String(req.query.telegramUserId || ''));
    const items = [
      { id: 'dashboard', label: '📊 داشبورد', permission: 'dashboard.view' },
      { id: 'leave', label: '🏖️ مرخصی', permission: 'leave.view' },
      { id: 'salary', label: '💰 مالی', permission: 'salary.view' },
      { id: 'tasks', label: '✅ وظایف', permission: 'tasks.view' },
      { id: 'notifications', label: '🔔 اعلان‌ها', permission: 'notifications.view' },
      { id: 'announcements', label: '📢 اطلاعیه‌ها', permission: 'announcements.view' },
      { id: 'bank', label: '🏦 حساب بانکی', permission: 'bank.view' },
      { id: 'employees', label: '👥 کارکنان', permission: 'employees.view' },
      { id: 'departments', label: '🏢 دپارتمان‌ها', permission: 'departments.view' },
      { id: 'reports', label: '📈 گزارش‌ها', permission: 'reports.view' },
      { id: 'profile', label: '👤 پروفایل', permission: null },
    ].filter((i) => !i.permission || can(actor.permissions, i.permission as PermissionKey));

    successResponse(res, {
      displayName: `${actor.firstName} ${actor.lastName}`,
      username: actor.username,
      items,
      permissions: actor.permissions,
    });
  })
);

botRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(String(req.query.telegramUserId || ''));
    if (!can(actor.permissions, 'dashboard.view')) throw new AppError(403, 'دسترسی ندارید');

    const now = new Date();
    const [leavePending, salaryPending, tasksOpen, tasksMine, unread] = await Promise.all([
      can(actor.permissions, 'leave.approve')
        ? prisma.leaveRequest.count({ where: { status: 'PENDING' } })
        : prisma.leaveRequest.count({
            where: { status: 'PENDING', employeeId: actor.employeeId },
          }),
      can(actor.permissions, 'salary.approve')
        ? prisma.salaryRequest.count({ where: { status: 'PENDING' } })
        : prisma.salaryRequest.count({
            where: { status: 'PENDING', employeeId: actor.employeeId },
          }),
      prisma.task.count({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          ...(can(actor.permissions, 'tasks.create') ? {} : { assigneeId: actor.employeeId }),
        },
      }),
      prisma.task.count({
        where: {
          assigneeId: actor.employeeId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      }),
      prisma.notification.count({ where: { userId: actor.userId, isRead: false } }),
    ]);

    successResponse(res, {
      leavePending,
      salaryPending,
      tasksOpen,
      tasksMine,
      unread,
      asOf: now.toISOString(),
    });
  })
);

botRouter.get(
  '/leave',
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(String(req.query.telegramUserId || ''));
    if (!can(actor.permissions, 'leave.view')) throw new AppError(403, 'دسترسی ندارید');
    const data = await leaveService.list(
      { status: req.query.status, limit: 10 },
      { id: actor.userId, permissions: actor.permissions }
    );
    successResponse(res, data);
  })
);

botRouter.post(
  '/leave',
  validateBody(
    z.object({
      telegramUserId: z.string(),
      type: z.enum(['DAILY', 'HOURLY']),
      leaveDate: z.string(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      reason: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(req.body.telegramUserId);
    if (!can(actor.permissions, 'leave.create')) throw new AppError(403, 'دسترسی ندارید');
    const created = await leaveService.create(req.body, actor.userId);
    successResponse(res, created, 'درخواست مرخصی ثبت شد');
  })
);

botRouter.post(
  '/leave/:id/decide',
  validateBody(
    z.object({
      telegramUserId: z.string(),
      approve: z.boolean(),
      reason: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(req.body.telegramUserId);
    const need = req.body.approve ? 'leave.approve' : 'leave.reject';
    if (!can(actor.permissions, need as PermissionKey)) throw new AppError(403, 'دسترسی ندارید');
    const updated = await leaveService.decide(
      String(req.params.id),
      !!req.body.approve,
      actor.userId,
      req.body.reason
    );
    successResponse(res, updated);
  })
);

botRouter.get(
  '/salary',
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(String(req.query.telegramUserId || ''));
    if (!can(actor.permissions, 'salary.view')) throw new AppError(403, 'دسترسی ندارید');
    const data = await salaryService.list(
      { status: req.query.status, limit: 10 },
      { id: actor.userId, permissions: actor.permissions }
    );
    successResponse(res, data);
  })
);

botRouter.post(
  '/salary',
  validateBody(
    z.object({
      telegramUserId: z.string(),
      type: z.enum(['SALARY', 'ADVANCE']),
      amount: z.number().positive(),
      description: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(req.body.telegramUserId);
    if (!can(actor.permissions, 'salary.create')) throw new AppError(403, 'دسترسی ندارید');
    const created = await salaryService.create(
      {
        type: req.body.type,
        amount: req.body.amount,
        description: req.body.description,
      },
      actor.userId
    );
    successResponse(res, created, 'درخواست مالی ثبت شد');
  })
);

botRouter.post(
  '/salary/:id/decide',
  validateBody(
    z.object({
      telegramUserId: z.string(),
      approve: z.boolean(),
      reason: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(req.body.telegramUserId);
    const need = req.body.approve ? 'salary.approve' : 'salary.reject';
    if (!can(actor.permissions, need as PermissionKey)) throw new AppError(403, 'دسترسی ندارید');
    const updated = await salaryService.decide(
      String(req.params.id),
      !!req.body.approve,
      actor.userId,
      req.body.reason
    );
    successResponse(res, updated);
  })
);

botRouter.get(
  '/tasks',
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(String(req.query.telegramUserId || ''));
    if (!can(actor.permissions, 'tasks.view')) throw new AppError(403, 'دسترسی ندارید');
    const data = await tasksService.list(
      { limit: 10, status: req.query.status },
      { id: actor.userId, permissions: actor.permissions }
    );
    successResponse(res, data);
  })
);

botRouter.post(
  '/tasks/:id/complete',
  validateBody(z.object({ telegramUserId: z.string() })),
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(req.body.telegramUserId);
    if (!can(actor.permissions, 'tasks.edit') && !can(actor.permissions, 'tasks.view')) {
      throw new AppError(403, 'دسترسی ندارید');
    }
    const updated = await tasksService.complete(String(req.params.id), actor.userId);
    successResponse(res, updated, 'وظیفه تکمیل شد');
  })
);

botRouter.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(String(req.query.telegramUserId || ''));
    if (!can(actor.permissions, 'notifications.view')) throw new AppError(403, 'دسترسی ندارید');
    const items = await prisma.notification.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: actor.userId, isRead: false },
    });
    successResponse(res, { items, unreadCount });
  })
);

botRouter.post(
  '/notifications/read-all',
  validateBody(z.object({ telegramUserId: z.string() })),
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(req.body.telegramUserId);
    await prisma.notification.updateMany({
      where: { userId: actor.userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    successResponse(res, { ok: true });
  })
);

botRouter.get(
  '/announcements',
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(String(req.query.telegramUserId || ''));
    if (!can(actor.permissions, 'announcements.view')) throw new AppError(403, 'دسترسی ندارید');
    const now = new Date();
    const items = await prisma.announcement.findMany({
      where: {
        publishAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ isPinned: 'desc' }, { publishAt: 'desc' }],
      take: 10,
    });
    successResponse(res, { items });
  })
);

botRouter.get(
  '/employees',
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(String(req.query.telegramUserId || ''));
    if (!can(actor.permissions, 'employees.view')) throw new AppError(403, 'دسترسی ندارید');
    const items = await prisma.employee.findMany({
      take: 20,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        department: true,
        telegramUserId: true,
        user: { select: { username: true, isActive: true } },
      },
    });
    successResponse(res, { items });
  })
);

botRouter.get(
  '/departments',
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(String(req.query.telegramUserId || ''));
    if (!can(actor.permissions, 'departments.view')) throw new AppError(403, 'دسترسی ندارید');
    const items = await prisma.department.findMany({ orderBy: { name: 'asc' } });
    successResponse(res, { items });
  })
);

botRouter.get(
  '/bank/me',
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(String(req.query.telegramUserId || ''));
    if (!can(actor.permissions, 'bank.view')) throw new AppError(403, 'دسترسی ندارید');
    const account = await prisma.bankAccount.findFirst({
      where: { employeeId: actor.employeeId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    successResponse(res, account);
  })
);

botRouter.get(
  '/reports/summary',
  asyncHandler(async (req, res) => {
    const actor = await resolveActor(String(req.query.telegramUserId || ''));
    if (!can(actor.permissions, 'reports.view')) throw new AppError(403, 'دسترسی ندارید');
    const [employees, leaveApproved, tasksDone] = await Promise.all([
      prisma.employee.count(),
      prisma.leaveRequest.count({ where: { status: 'APPROVED' } }),
      prisma.task.count({ where: { status: 'COMPLETED' } }),
    ]);
    successResponse(res, { employees, leaveApproved, tasksDone });
  })
);

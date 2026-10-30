import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse } from '../../utils/errors.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate, requirePermission('dashboard.view'));

async function hireAnniversariesThisMonth(limit = 8) {
  const month = new Date().getMonth();
  const monthStr = String(month + 1).padStart(2, '0');

  try {
    const rows = await prisma.$queryRaw<
      { id: string; firstName: string; lastName: string; hireDate: string }[]
    >`
      SELECT id, firstName, lastName, hireDate
      FROM employees
      WHERE hireDate IS NOT NULL
        AND strftime('%m', hireDate) = ${monthStr}
      ORDER BY strftime('%d', hireDate) ASC
      LIMIT ${limit}
    `;
    return rows.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      hireDate: e.hireDate,
    }));
  } catch {
    // Fallback if SQLite strftime / storage format differs
    const hireRows = await prisma.employee.findMany({
      where: { hireDate: { not: null } },
      select: { id: true, firstName: true, lastName: true, hireDate: true },
      take: 200,
    });
    return hireRows
      .filter((e) => e.hireDate && new Date(e.hireDate).getMonth() === month)
      .slice(0, limit)
      .map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        hireDate: e.hireDate,
      }));
  }
}

dashboardRouter.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const now = new Date();

    const [
      employeesTotal,
      employeesActive,
      leavePending,
      salaryPending,
      tasksOpen,
      tasksOverdue,
      recentNotifications,
      announcements,
      departmentsTotal,
      hireAnniversaries,
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.user.count({ where: { isActive: true, employee: { isNot: null } } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.salaryRequest.count({ where: { status: 'PENDING' } }),
      prisma.task.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      prisma.task.count({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueAt: { lt: now },
        },
      }),
      prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, body: true, isRead: true, createdAt: true },
      }),
      prisma.announcement.findMany({
        where: {
          publishAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: [{ isPinned: 'desc' }, { publishAt: 'desc' }],
        take: 5,
        select: {
          id: true,
          title: true,
          body: true,
          isPinned: true,
          publishAt: true,
        },
      }),
      prisma.department.count(),
      hireAnniversariesThisMonth(8),
    ]);

    successResponse(res, {
      employeesTotal,
      employeesActive,
      employeesInactive: Math.max(0, employeesTotal - employeesActive),
      leavePending,
      salaryPending,
      tasksOpen,
      tasksOverdue,
      departmentsTotal,
      recentNotifications,
      announcements,
      hireAnniversaries,
    });
  })
);

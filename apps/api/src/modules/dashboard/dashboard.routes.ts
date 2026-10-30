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
  asyncHandler(async (req, res) => {
    const now = new Date();
    const perms = req.user!.permissions;
    const userId = req.user!.id;
    const canSeeEmployees = perms.includes('employees.view');
    const canSeeDepartments = perms.includes('departments.view');
    const canApproveLeave = perms.includes('leave.approve') || perms.includes('leave.reject');
    const canApproveSalary = perms.includes('salary.approve') || perms.includes('salary.reject');
    const canManageTasks = perms.includes('tasks.create') || perms.includes('tasks.edit');

    const employee = await prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });

    const leaveWhere = canApproveLeave
      ? { status: 'PENDING' as const }
      : employee
        ? { status: 'PENDING' as const, employeeId: employee.id }
        : { status: 'PENDING' as const, employeeId: '__none__' };

    const salaryWhere = canApproveSalary
      ? { status: 'PENDING' as const }
      : employee
        ? { status: 'PENDING' as const, employeeId: employee.id }
        : { status: 'PENDING' as const, employeeId: '__none__' };

    const taskBase = {
      status: { in: ['PENDING' as const, 'IN_PROGRESS' as const] },
      ...(!canManageTasks && employee ? { assigneeId: employee.id } : {}),
    };

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
      canSeeEmployees ? prisma.employee.count() : Promise.resolve(0),
      canSeeEmployees
        ? prisma.user.count({ where: { isActive: true, employee: { isNot: null } } })
        : Promise.resolve(0),
      prisma.leaveRequest.count({ where: leaveWhere }),
      prisma.salaryRequest.count({ where: salaryWhere }),
      prisma.task.count({ where: taskBase }),
      prisma.task.count({
        where: {
          ...taskBase,
          dueAt: { lt: now },
        },
      }),
      prisma.notification.findMany({
        where: { userId },
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
      canSeeDepartments ? prisma.department.count() : Promise.resolve(0),
      canSeeEmployees ? hireAnniversariesThisMonth(8) : Promise.resolve([]),
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
      scope: {
        employees: canSeeEmployees,
        departments: canSeeDepartments,
        leaveQueue: canApproveLeave,
        salaryQueue: canApproveSalary,
        tasksManage: canManageTasks,
      },
    });
  })
);

import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse } from '../../utils/errors.js';
import { prisma } from '../../db/prisma.js';

export const reportsRouter = Router();
reportsRouter.use(authenticate, requirePermission('reports.view'));

reportsRouter.get(
  '/employees',
  asyncHandler(async (req, res) => {
    const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;
    const employees = await prisma.employee.findMany({
      where: employeeId ? { id: employeeId } : undefined,
      include: {
        user: { select: { isActive: true, username: true } },
        _count: {
          select: {
            leaveRequests: true,
            salaryRequests: true,
            assignedTasks: true,
          },
        },
      },
      orderBy: { lastName: 'asc' },
    });

    const detailed = await Promise.all(
      employees.map(async (e) => {
        const [leaveApproved, leaveRejected, tasksCompleted, tasksOverdue] = await Promise.all([
          prisma.leaveRequest.count({ where: { employeeId: e.id, status: 'APPROVED' } }),
          prisma.leaveRequest.count({ where: { employeeId: e.id, status: 'REJECTED' } }),
          prisma.task.count({ where: { assigneeId: e.id, status: 'COMPLETED' } }),
          prisma.task.count({
            where: {
              assigneeId: e.id,
              status: { in: ['PENDING', 'IN_PROGRESS'] },
              dueAt: { lt: new Date() },
            },
          }),
        ]);
        return {
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
          username: e.user.username,
          isActive: e.user.isActive,
          leaveTotal: e._count.leaveRequests,
          leaveApproved,
          leaveRejected,
          salaryTotal: e._count.salaryRequests,
          tasksAssigned: e._count.assignedTasks,
          tasksCompleted,
          tasksOverdue,
        };
      })
    );

    successResponse(res, { items: detailed });
  })
);

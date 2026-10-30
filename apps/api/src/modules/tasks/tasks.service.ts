import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/errors.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';
import { writeAudit } from '../../services/audit.service.js';
import { notifyUsers } from '../../services/notification-dispatch.service.js';

export class TasksService {
  async list(query: Record<string, unknown>, actor: { id: string; permissions: string[] }) {
    const { page, limit, skip } = parsePagination(query);
    const canManage = actor.permissions.includes('tasks.create') || actor.permissions.includes('tasks.edit');
    const employee = await prisma.employee.findUnique({ where: { userId: actor.id } });

    const where = {
      ...(query.status ? { status: String(query.status) as any } : {}),
      ...(query.assigneeId ? { assigneeId: String(query.assigneeId) } : {}),
      ...(!canManage && employee ? { assigneeId: employee.id } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true } },
          creator: { select: { id: true, username: true } },
        },
      }),
      prisma.task.count({ where }),
    ]);
    return { items, pagination: paginationMeta(page, limit, total) };
  }

  async create(
    data: {
      title: string;
      description?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      dueAt?: string;
      assigneeId: string;
      scheduleKind?: 'ONCE' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    },
    actorId: string
  ) {
    const assignee = await prisma.employee.findUnique({
      where: { id: data.assigneeId },
      include: { user: true },
    });
    if (!assignee) throw new AppError(404, 'مسئول یافت نشد');

    const task = await prisma.task.create({
      data: {
        title: data.title.trim(),
        description: data.description || null,
        priority: data.priority || 'MEDIUM',
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        assigneeId: data.assigneeId,
        creatorId: actorId,
        scheduleKind: data.scheduleKind || 'ONCE',
        history: {
          create: {
            fromEmployee: null,
            toEmployee: data.assigneeId,
            changedById: actorId,
            note: 'ایجاد وظیفه',
          },
        },
      },
      include: { assignee: true },
    });

    await writeAudit({
      actorId,
      action: 'create',
      module: 'tasks',
      entityType: 'Task',
      entityId: task.id,
      after: task,
    });

    await notifyUsers({
      userIds: [assignee.userId],
      title: 'وظیفه جدید',
      body: `وظیفه «${task.title}» به شما واگذار شد.`,
      eventType: 'task.assigned',
      entityType: 'Task',
      entityId: task.id,
    });

    return task;
  }

  async assign(id: string, assigneeId: string, actorId: string) {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) throw new AppError(404, 'وظیفه یافت نشد');
    const assignee = await prisma.employee.findUnique({ where: { id: assigneeId } });
    if (!assignee) throw new AppError(404, 'مسئول یافت نشد');

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.task.update({
        where: { id },
        data: { assigneeId },
      });
      await tx.taskAssignmentHistory.create({
        data: {
          taskId: id,
          fromEmployee: task.assigneeId,
          toEmployee: assigneeId,
          changedById: actorId,
          note: 'انتقال مسئولیت',
        },
      });
      return row;
    });

    await writeAudit({
      actorId,
      action: 'assign',
      module: 'tasks',
      entityType: 'Task',
      entityId: id,
      before: { assigneeId: task.assigneeId },
      after: { assigneeId },
    });

    await notifyUsers({
      userIds: [assignee.userId],
      title: 'واگذاری وظیفه',
      body: `وظیفه «${task.title}» به شما منتقل شد.`,
      eventType: 'task.reassigned',
      entityType: 'Task',
      entityId: id,
    });

    return updated;
  }

  async complete(id: string, actorId: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignee: true },
    });
    if (!task) throw new AppError(404, 'وظیفه یافت نشد');

    const updated = await prisma.task.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await writeAudit({
      actorId,
      action: 'complete',
      module: 'tasks',
      entityType: 'Task',
      entityId: id,
    });

    await notifyUsers({
      userIds: [task.creatorId],
      title: 'تکمیل وظیفه',
      body: `وظیفه «${task.title}» تکمیل شد.`,
      eventType: 'task.completed',
      entityType: 'Task',
      entityId: id,
    });

    return updated;
  }

  async delayReminder(id: string, minutes: number, actorId: string) {
    const mins = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) throw new AppError(404, 'وظیفه یافت نشد');

    const updated = await prisma.task.update({
      where: { id },
      data: { nextReminderAt: new Date(Date.now() + mins * 60_000) },
    });

    await writeAudit({
      actorId,
      action: 'delay_reminder',
      module: 'tasks',
      entityType: 'Task',
      entityId: id,
      after: { minutes: mins, nextReminderAt: updated.nextReminderAt },
    });

    return updated;
  }

  async setScheduleActive(id: string, active: boolean, actorId: string) {
    const updated = await prisma.task.update({
      where: { id },
      data: { scheduleActive: active },
    });
    await writeAudit({
      actorId,
      action: active ? 'schedule_resume' : 'schedule_pause',
      module: 'tasks',
      entityType: 'Task',
      entityId: id,
    });
    return updated;
  }
}

export const tasksService = new TasksService();

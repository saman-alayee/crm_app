import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/errors.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';
import { writeAudit } from '../../services/audit.service.js';
import { notifyUsers, usersWithPermission } from '../../services/notification-dispatch.service.js';

export class LeaveService {
  async list(query: Record<string, unknown>, actor: { id: string; permissions: string[] }) {
    const { page, limit, skip } = parsePagination(query);
    const canViewAll = actor.permissions.includes('leave.view') && (
      actor.permissions.includes('leave.approve') || actor.permissions.includes('leave.reject')
    );

    const employee = await prisma.employee.findUnique({ where: { userId: actor.id } });
    const where = {
      ...(query.status ? { status: String(query.status) as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
      ...(query.employeeId ? { employeeId: String(query.employeeId) } : {}),
      ...(!canViewAll && employee ? { employeeId: employee.id } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          reviewedBy: { select: { id: true, username: true } },
        },
      }),
      prisma.leaveRequest.count({ where }),
    ]);
    return { items, pagination: paginationMeta(page, limit, total) };
  }

  async create(
    data: {
      type: 'HOURLY' | 'DAILY';
      leaveDate: string;
      startTime?: string;
      endTime?: string;
      reason?: string;
      employeeId?: string;
    },
    actorId: string
  ) {
    const actorEmployee = await prisma.employee.findUnique({ where: { userId: actorId } });
    const employeeId = data.employeeId || actorEmployee?.id;
    if (!employeeId) throw new AppError(400, 'پروفایل کارمند یافت نشد');

    if (data.type === 'HOURLY' && (!data.startTime || !data.endTime)) {
      throw new AppError(400, 'برای مرخصی ساعتی، ساعت شروع و پایان الزامی است');
    }

    const created = await prisma.leaveRequest.create({
      data: {
        employeeId,
        type: data.type,
        leaveDate: new Date(data.leaveDate),
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        reason: data.reason || null,
        status: 'PENDING',
      },
      include: { employee: true },
    });

    await writeAudit({
      actorId,
      action: 'create',
      module: 'leave',
      entityType: 'LeaveRequest',
      entityId: created.id,
      after: created,
    });

    const managers = await usersWithPermission('leave.approve');
    await notifyUsers({
      userIds: managers,
      title: 'درخواست مرخصی جدید',
      body: `${created.employee.firstName} ${created.employee.lastName} درخواست مرخصی ثبت کرد.`,
      eventType: 'leave.created',
      entityType: 'LeaveRequest',
      entityId: created.id,
    });

    return created;
  }

  async decide(id: string, approve: boolean, actorId: string, rejectionReason?: string) {
    const row = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: { include: { user: true } } },
    });
    if (!row) throw new AppError(404, 'درخواست یافت نشد');
    if (row.status !== 'PENDING') throw new AppError(400, 'این درخواست قبلاً بررسی شده است');
    if (!approve && !rejectionReason?.trim()) throw new AppError(400, 'دلیل رد الزامی است');

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        rejectionReason: approve ? null : rejectionReason!.trim(),
        reviewedById: actorId,
        reviewedAt: new Date(),
      },
    });

    await writeAudit({
      actorId,
      action: approve ? 'approve' : 'reject',
      module: 'leave',
      entityType: 'LeaveRequest',
      entityId: id,
      before: { status: row.status },
      after: updated,
    });

    await notifyUsers({
      userIds: [row.employee.userId],
      title: approve ? 'تأیید مرخصی' : 'رد مرخصی',
      body: approve
        ? 'درخواست مرخصی شما تأیید شد.'
        : `درخواست مرخصی شما رد شد. دلیل: ${rejectionReason}`,
      eventType: approve ? 'leave.approved' : 'leave.rejected',
      entityType: 'LeaveRequest',
      entityId: id,
    });

    return updated;
  }
}

export const leaveService = new LeaveService();

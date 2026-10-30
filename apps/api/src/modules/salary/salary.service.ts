import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/errors.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';
import { writeAudit } from '../../services/audit.service.js';
import { notifyUsers, usersWithPermission } from '../../services/notification-dispatch.service.js';

function maskAmount(amount: unknown, canSee: boolean) {
  if (canSee) return amount;
  return '***';
}

export class SalaryService {
  async list(query: Record<string, unknown>, actor: { id: string; permissions: string[] }) {
    const { page, limit, skip } = parsePagination(query);
    const canManage =
      actor.permissions.includes('salary.approve') || actor.permissions.includes('salary.reject');
    const canSensitive = actor.permissions.includes('salary.view_sensitive');
    const employee = await prisma.employee.findUnique({ where: { userId: actor.id } });

    const where = {
      ...(query.status ? { status: String(query.status) as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
      ...(query.employeeId ? { employeeId: String(query.employeeId) } : {}),
      ...(!canManage && employee ? { employeeId: employee.id } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.salaryRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
          reviewedBy: { select: { id: true, username: true } },
        },
      }),
      prisma.salaryRequest.count({ where }),
    ]);

    const items = rows.map((r) => ({
      ...r,
      amount: maskAmount(r.amount, canSensitive || r.employeeId === employee?.id),
    }));

    return { items, pagination: paginationMeta(page, limit, total) };
  }

  async create(
    data: { type: 'SALARY' | 'ADVANCE'; amount: number; description?: string },
    actorId: string
  ) {
    const employee = await prisma.employee.findUnique({ where: { userId: actorId } });
    if (!employee) throw new AppError(400, 'پروفایل کارمند یافت نشد');
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new AppError(400, 'مبلغ نامعتبر است');
    }

    const created = await prisma.salaryRequest.create({
      data: {
        employeeId: employee.id,
        type: data.type,
        amount: data.amount,
        description: data.description || null,
      },
      include: { employee: true },
    });

    await writeAudit({
      actorId,
      action: 'create',
      module: 'salary',
      entityType: 'SalaryRequest',
      entityId: created.id,
      after: { type: data.type, amount: data.amount },
    });

    const managers = await usersWithPermission('salary.approve');
    await notifyUsers({
      userIds: managers,
      title: 'درخواست مالی جدید',
      body: `${created.employee.firstName} ${created.employee.lastName} درخواست ${data.type === 'SALARY' ? 'حقوق' : 'مساعده'} ثبت کرد.`,
      eventType: 'salary.created',
      entityType: 'SalaryRequest',
      entityId: created.id,
    });

    return created;
  }

  async decide(id: string, approve: boolean, actorId: string, rejectionReason?: string) {
    const row = await prisma.salaryRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!row) throw new AppError(404, 'درخواست یافت نشد');
    if (row.status !== 'PENDING') throw new AppError(400, 'این درخواست قبلاً بررسی شده است');
    if (!approve && !rejectionReason?.trim()) throw new AppError(400, 'دلیل رد الزامی است');

    const updated = await prisma.salaryRequest.update({
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
      module: 'salary',
      entityType: 'SalaryRequest',
      entityId: id,
      before: { status: row.status },
      after: updated,
    });

    await notifyUsers({
      userIds: [row.employee.userId],
      title: approve ? 'تأیید درخواست مالی' : 'رد درخواست مالی',
      body: approve
        ? 'درخواست مالی شما تأیید شد.'
        : `درخواست مالی شما رد شد. دلیل: ${rejectionReason}`,
      eventType: approve ? 'salary.approved' : 'salary.rejected',
      entityType: 'SalaryRequest',
      entityId: id,
    });

    return updated;
  }
}

export const salaryService = new SalaryService();

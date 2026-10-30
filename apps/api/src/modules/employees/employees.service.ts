import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/errors.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';
import { writeAudit } from '../../services/audit.service.js';
import { notifyUsers } from '../../services/notification-dispatch.service.js';

function searchTokenClause(token: string) {
  const t = token.trim();
  if (!t) return null;
  const variants = [...new Set([t, t.toLowerCase(), t.toUpperCase()])];
  const fields = (value: string) => [
    { firstName: { contains: value } },
    { lastName: { contains: value } },
    { employeeCode: { contains: value } },
    { phone: { contains: value } },
    { jobTitle: { contains: value } },
    { department: { contains: value } },
    { user: { username: { contains: value } } },
    { user: { email: { contains: value } } },
  ];
  return {
    OR: variants.flatMap((v) => fields(v)),
  };
}

export class EmployeesService {
  async list(query: Record<string, unknown>) {
    const { page, limit, skip } = parsePagination(query);
    const search = String(query.search || '').trim();
    const isActive =
      query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined;
    const department = String(query.department || '').trim();
    const jobTitle = String(query.jobTitle || '').trim();
    const roleId = String(query.roleId || '').trim();
    const hasTelegram =
      query.hasTelegram === 'true' ? true : query.hasTelegram === 'false' ? false : undefined;
    const sort = String(query.sort || 'createdAt');
    const order = String(query.order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const and: Record<string, unknown>[] = [];

    if (isActive !== undefined) {
      and.push({ user: { isActive } });
    }
    if (department) {
      and.push({ department: { contains: department } });
    }
    if (jobTitle) {
      and.push({ jobTitle: { contains: jobTitle } });
    }
    if (roleId) {
      and.push({ user: { userRoles: { some: { roleId } } } });
    }
    if (hasTelegram === true) {
      and.push({ telegramUserId: { not: null } });
    } else if (hasTelegram === false) {
      and.push({ telegramUserId: null });
    }

    if (search) {
      const tokens = search.split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        const clause = searchTokenClause(token);
        if (clause) and.push(clause);
      }
    }

    const where = and.length ? { AND: and } : {};

    const orderBy =
      sort === 'name'
        ? [{ lastName: order as 'asc' | 'desc' }, { firstName: order as 'asc' | 'desc' }]
        : sort === 'department'
          ? [{ department: order as 'asc' | 'desc' }, { lastName: 'asc' as const }]
          : sort === 'jobTitle'
            ? [{ jobTitle: order as 'asc' | 'desc' }, { lastName: 'asc' as const }]
            : [{ createdAt: order as 'asc' | 'desc' }];

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              isActive: true,
              userRoles: { include: { role: { select: { id: true, name: true, slug: true } } } },
            },
          },
        },
      }),
      prisma.employee.count({ where }),
    ]);

    return { items, pagination: paginationMeta(page, limit, total) };
  }

  async get(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            isActive: true,
            lastLoginAt: true,
            userRoles: { include: { role: { select: { id: true, name: true, slug: true } } } },
          },
        },
        leaveRequests: { orderBy: { createdAt: 'desc' }, take: 10 },
        salaryRequests: { orderBy: { createdAt: 'desc' }, take: 10 },
        assignedTasks: { orderBy: { createdAt: 'desc' }, take: 10 },
        bankAccounts: { where: { isActive: true }, take: 1 },
        notes: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            author: {
              select: {
                username: true,
                employee: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
    if (!employee) throw new AppError(404, 'کارمند یافت نشد', 'NOT_FOUND');
    return employee;
  }

  async create(
    data: {
      username: string;
      password: string;
      email?: string;
      firstName: string;
      lastName: string;
      phone?: string;
      department?: string;
      jobTitle?: string;
      employeeCode?: string;
      telegramUserId?: string;
      roleIds?: string[];
    },
    actorId: string
  ) {
    const username = data.username.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) throw new AppError(400, 'نام کاربری تکراری است');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const employeeRole = await prisma.role.findUnique({ where: { slug: 'employee' } });

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          email: data.email || null,
          passwordHash,
          isActive: true,
          employee: {
            create: {
              firstName: data.firstName.trim(),
              lastName: data.lastName.trim(),
              phone: data.phone || null,
              department: data.department || null,
              jobTitle: data.jobTitle || null,
              employeeCode: data.employeeCode || null,
              telegramUserId: data.telegramUserId || null,
            },
          },
        },
        include: { employee: true },
      });

      const roleIds = data.roleIds?.length
        ? data.roleIds
        : employeeRole
          ? [employeeRole.id]
          : [];
      for (const roleId of roleIds) {
        await tx.userRole.create({ data: { userId: user.id, roleId, assignedBy: actorId } });
      }
      return user;
    });

    await writeAudit({
      actorId,
      action: 'create',
      module: 'employees',
      entityType: 'Employee',
      entityId: created.employee!.id,
      after: { username, firstName: data.firstName, lastName: data.lastName },
    });

    return this.get(created.employee!.id);
  }

  async update(
    id: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      phone: string | null;
      department: string | null;
      jobTitle: string | null;
      employeeCode: string | null;
      telegramUserId: string | null;
      email: string | null;
    }>,
    actorId: string
  ) {
    const existing = await this.get(id);
    const updated = await prisma.employee.update({
      where: { id },
      data: {
        firstName: data.firstName ?? undefined,
        lastName: data.lastName ?? undefined,
        phone: data.phone === undefined ? undefined : data.phone,
        department: data.department === undefined ? undefined : data.department,
        jobTitle: data.jobTitle === undefined ? undefined : data.jobTitle,
        employeeCode: data.employeeCode === undefined ? undefined : data.employeeCode,
        telegramUserId: data.telegramUserId === undefined ? undefined : data.telegramUserId,
        user:
          data.email !== undefined
            ? { update: { email: data.email } }
            : undefined,
      },
    });

    await writeAudit({
      actorId,
      action: 'update',
      module: 'employees',
      entityType: 'Employee',
      entityId: id,
      before: existing,
      after: updated,
    });

    return this.get(id);
  }

  async setActive(id: string, isActive: boolean, actorId: string) {
    const employee = await this.get(id);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: employee.userId },
        data: {
          isActive,
          ...(isActive ? {} : { tokenVersion: { increment: 1 } }),
        },
      }),
      ...(isActive
        ? []
        : [
            prisma.refreshToken.updateMany({
              where: { userId: employee.userId, revokedAt: null },
              data: { revokedAt: new Date() },
            }),
          ]),
    ]);

    const { invalidateAuthUserCache } = await import('../../services/auth-user-cache.js');
    const { invalidateUserPermissions } = await import('../../services/rbac.service.js');
    invalidateAuthUserCache(employee.userId);
    invalidateUserPermissions(employee.userId);

    await writeAudit({
      actorId,
      action: isActive ? 'activate' : 'deactivate',
      module: 'employees',
      entityType: 'Employee',
      entityId: id,
      after: { isActive },
    });

    await notifyUsers({
      userIds: [employee.userId],
      title: isActive ? 'فعال‌سازی حساب' : 'غیرفعال‌سازی حساب',
      body: isActive
        ? 'حساب کاربری شما فعال شد.'
        : 'حساب کاربری شما غیرفعال شد و دسترسی قطع گردید.',
      eventType: isActive ? 'employee.activated' : 'employee.deactivated',
      entityType: 'Employee',
      entityId: id,
    });

    return this.get(id);
  }
}

export const employeesService = new EmployeesService();

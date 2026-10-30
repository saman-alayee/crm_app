import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/errors.js';
import { writeAudit } from '../../services/audit.service.js';
import { ALL_PERMISSION_KEYS, FULL_ACCESS_ROLE_SLUGS } from '../../shared/index.js';
import { invalidateAuthUserCache } from '../../services/auth-user-cache.js';
import {
  invalidateAllPermissions,
  invalidateUserPermissions,
  userIsOwner,
} from '../../services/rbac.service.js';

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06ff-]/gi, '')
    .slice(0, 60);
}

export class RolesService {
  async list() {
    return prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { userRoles: true } },
        rolePermissions: { include: { permission: true } },
      },
    });
  }

  async listPermissions() {
    return prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
  }

  async create(data: { name: string; description?: string; permissionKeys?: string[] }, actorId: string) {
    const name = data.name.trim();
    if (name.length < 2) throw new AppError(400, 'نام نقش کوتاه است');
    const slug = slugify(name) || `role-${Date.now()}`;
    if (FULL_ACCESS_ROLE_SLUGS.has(slug) || slug === 'owner' || slug === 'admin') {
      throw new AppError(400, 'این نام نقش رزرو شده است');
    }
    const exists = await prisma.role.findFirst({ where: { OR: [{ name }, { slug }] } });
    if (exists) throw new AppError(400, 'نقش تکراری است');

    const role = await prisma.role.create({
      data: { name, slug, description: data.description || null, isSystem: false },
    });

    if (data.permissionKeys?.length) {
      await this.setPermissions(role.id, data.permissionKeys, actorId);
    }

    await writeAudit({
      actorId,
      action: 'create',
      module: 'roles',
      entityType: 'Role',
      entityId: role.id,
      after: role,
    });

    return this.get(role.id);
  }

  async get(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: { include: { permission: true } },
        userRoles: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                employee: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
    if (!role) throw new AppError(404, 'نقش یافت نشد');
    return role;
  }

  async update(id: string, data: { name?: string; description?: string | null }, actorId: string) {
    const role = await this.get(id);
    if (role.isSystem && data.name && data.name !== role.name) {
      throw new AppError(400, 'نام نقش سیستمی قابل تغییر نیست');
    }
    const updated = await prisma.role.update({
      where: { id },
      data: {
        name: data.name?.trim() || undefined,
        description: data.description === undefined ? undefined : data.description,
      },
    });
    await writeAudit({
      actorId,
      action: 'update',
      module: 'roles',
      entityType: 'Role',
      entityId: id,
      before: role,
      after: updated,
    });
    return this.get(id);
  }

  async remove(id: string, actorId: string) {
    const role = await this.get(id);
    if (role.isSystem) throw new AppError(400, 'نقش سیستمی قابل حذف نیست');
    if (role.userRoles.length) throw new AppError(400, 'ابتدا کاربران این نقش را منتقل کنید');
    await prisma.role.delete({ where: { id } });
    await writeAudit({
      actorId,
      action: 'delete',
      module: 'roles',
      entityType: 'Role',
      entityId: id,
      before: { name: role.name },
    });
  }

  async setPermissions(id: string, permissionKeys: string[], actorId: string) {
    const role = await this.get(id);

    // Owner / Admin always keep the full catalog — cannot be reduced from UI
    if (FULL_ACCESS_ROLE_SLUGS.has(role.slug)) {
      permissionKeys = [...ALL_PERMISSION_KEYS];
    }

    // Only an Owner may edit the Admin role permission set (still forced to full)
    if (role.slug === 'admin' && !(await userIsOwner(actorId))) {
      throw new AppError(403, 'فقط مالک می‌تواند نقش ادمین را تغییر دهد');
    }

    const allowed = new Set(ALL_PERMISSION_KEYS as string[]);
    const keys = [...new Set(permissionKeys.filter((k) => allowed.has(k)))];
    const perms = await prisma.permission.findMany({ where: { key: { in: keys } } });

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (perms.length) {
        await tx.rolePermission.createMany({
          data: perms.map((p) => ({ roleId: id, permissionId: p.id })),
        });
      }
    });

    await writeAudit({
      actorId,
      action: 'set_permissions',
      module: 'roles',
      entityType: 'Role',
      entityId: id,
      after: { permissionKeys: keys },
    });

    invalidateAllPermissions();
    invalidateAuthUserCache();
    return this.get(id);
  }

  async assignUserRoles(userId: string, roleIds: string[], actorId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'کاربر یافت نشد');

    const roles = await prisma.role.findMany({ where: { id: { in: roleIds } } });
    if (roles.length !== roleIds.length) throw new AppError(400, 'یک یا چند نقش نامعتبر است');

    const actorIsOwner = await userIsOwner(actorId);
    const targetIsOwner = await userIsOwner(userId);
    const assigningOwner = roles.some((r) => r.slug === 'owner');
    const assigningAdmin = roles.some((r) => r.slug === 'admin');

    if (assigningOwner && !actorIsOwner) {
      throw new AppError(403, 'فقط مالک می‌تواند نقش مالک را واگذار کند');
    }
    if (assigningAdmin && !actorIsOwner) {
      throw new AppError(403, 'فقط مالک می‌تواند نقش ادمین را واگذار کند');
    }

    // Prevent removing the last owner
    if (targetIsOwner && !assigningOwner) {
      const ownerCount = await prisma.userRole.count({
        where: { role: { slug: 'owner', isSystem: true } },
      });
      if (ownerCount <= 1) {
        throw new AppError(400, 'نمی‌توان آخرین مالک سیستم را بدون نقش مالک گذاشت');
      }
    }

    // Actor cannot strip their own owner role
    if (actorId === userId && targetIsOwner && !assigningOwner) {
      throw new AppError(400, 'نمی‌توانید نقش مالک را از خودتان حذف کنید');
    }

    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      for (const roleId of roleIds) {
        await tx.userRole.create({ data: { userId, roleId, assignedBy: actorId } });
      }
      await tx.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });
    });

    await writeAudit({
      actorId,
      action: 'assign_roles',
      module: 'roles',
      entityType: 'User',
      entityId: userId,
      after: { roleIds, roleSlugs: roles.map((r) => r.slug) },
    });

    invalidateUserPermissions(userId);
    invalidateAuthUserCache(userId);

    return prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } }, employee: true },
    });
  }
}

export const rolesService = new RolesService();

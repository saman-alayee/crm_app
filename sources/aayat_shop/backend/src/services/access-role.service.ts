import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { parsePermissionList, PANEL_PERMISSIONS } from '../utils/permissions';

export class AccessRoleService {
  async getAll() {
    return prisma.accessRole.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true } } },
    });
  }

  async create(data: { name: string; description?: string | null; permissions: unknown }) {
    const name = data.name.trim();
    if (name.length < 2) throw new AppError(400, 'نام نقش باید حداقل ۲ حرف باشد');
    const permissions = parsePermissionList(data.permissions).filter((key) => key !== 'users');
    if (!permissions.includes('dashboard')) permissions.unshift('dashboard');
    if (permissions.length <= 1) {
      throw new AppError(400, 'حداقل یک بخش غیر از داشبورد را انتخاب کنید');
    }

    return prisma.accessRole.create({
      data: {
        name,
        description: data.description?.trim() || null,
        permissions,
      },
    });
  }

  async update(
    id: string,
    data: { name?: string; description?: string | null; permissions?: unknown }
  ) {
    const existing = await prisma.accessRole.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'نقش یافت نشد');

    const updateData: { name?: string; description?: string | null; permissions?: string[] } = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (name.length < 2) throw new AppError(400, 'نام نقش باید حداقل ۲ حرف باشد');
      updateData.name = name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.permissions !== undefined) {
      const permissions = parsePermissionList(data.permissions).filter((key) => key !== 'users');
      if (!permissions.includes('dashboard')) permissions.unshift('dashboard');
      if (permissions.length <= 1) {
        throw new AppError(400, 'حداقل یک بخش غیر از داشبورد را انتخاب کنید');
      }
      updateData.permissions = permissions;
    }

    return prisma.accessRole.update({ where: { id }, data: updateData });
  }

  async delete(id: string) {
    const existing = await prisma.accessRole.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) throw new AppError(404, 'نقش یافت نشد');
    if (existing._count.users > 0) {
      throw new AppError(400, 'ابتدا کاربران این نقش را به نقش دیگری منتقل کنید');
    }
    await prisma.accessRole.delete({ where: { id } });
  }
}

export const accessRoleService = new AccessRoleService();
export { PANEL_PERMISSIONS };

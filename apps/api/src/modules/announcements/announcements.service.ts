import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/errors.js';
import { writeAudit } from '../../services/audit.service.js';
import { notifyUsers } from '../../services/notification-dispatch.service.js';

export class AnnouncementsService {
  async listActive() {
    const now = new Date();
    return prisma.announcement.findMany({
      where: {
        publishAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ isPinned: 'desc' }, { publishAt: 'desc' }],
      include: {
        createdBy: {
          select: {
            username: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async listAll() {
    return prisma.announcement.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        createdBy: {
          select: {
            username: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async create(
    data: {
      title: string;
      body: string;
      audience?: 'ALL' | 'ROLE' | 'ACTIVE_EMPLOYEES';
      roleId?: string;
      isPinned?: boolean;
      expiresAt?: string | null;
      sendNotification?: boolean;
    },
    actorId: string
  ) {
    const announcement = await prisma.announcement.create({
      data: {
        title: data.title.trim(),
        body: data.body.trim(),
        audience: data.audience || 'ALL',
        roleId: data.roleId || null,
        isPinned: !!data.isPinned,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdById: actorId,
      },
    });

    if (data.sendNotification !== false) {
      const userIds = await this.resolveAudience(data.audience || 'ALL', data.roleId);
      await notifyUsers({
        userIds,
        title: `اطلاعیه: ${announcement.title}`,
        body: announcement.body.slice(0, 280),
        eventType: 'announcement.published',
        entityType: 'Announcement',
        entityId: announcement.id,
      });
    }

    await writeAudit({
      actorId,
      action: 'create',
      module: 'announcements',
      entityType: 'Announcement',
      entityId: announcement.id,
      after: { title: announcement.title, audience: announcement.audience },
    });

    return announcement;
  }

  async remove(id: string, actorId: string) {
    const row = await prisma.announcement.findUnique({ where: { id } });
    if (!row) throw new AppError(404, 'اطلاعیه یافت نشد');
    await prisma.announcement.delete({ where: { id } });
    await writeAudit({
      actorId,
      action: 'delete',
      module: 'announcements',
      entityType: 'Announcement',
      entityId: id,
      before: { title: row.title },
    });
  }

  private async resolveAudience(audience: string, roleId?: string) {
    if (audience === 'ROLE' && roleId) {
      const links = await prisma.userRole.findMany({
        where: { roleId, user: { isActive: true } },
        select: { userId: true },
      });
      return links.map((l) => l.userId);
    }
    const users = await prisma.user.findMany({
      where: { isActive: true, employee: { isNot: null } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
}

export const announcementsService = new AnnouncementsService();

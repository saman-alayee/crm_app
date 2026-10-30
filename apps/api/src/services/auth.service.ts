import bcrypt from 'bcryptjs';
import type { PermissionKey } from '../shared/index.js';
import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/errors.js';
import {
  hashToken,
  newRefreshTokenRaw,
  refreshExpiryDate,
  signAccessToken,
} from '../utils/jwt.js';
import { resolveUserPermissions } from './rbac.service.js';
import { assertPanelAccess } from './panel-lock.service.js';

function publicUser(user: {
  id: string;
  username: string;
  email: string | null;
  isActive: boolean;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    telegramUserId: string | null;
    jobTitle: string | null;
    department: string | null;
  } | null;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isActive: user.isActive,
    employee: user.employee,
  };
}

async function loadAuthUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          telegramUserId: true,
          jobTitle: true,
          department: true,
        },
      },
      userRoles: { include: { role: { select: { id: true, name: true, slug: true } } } },
    },
  });
}

export class AuthService {
  async login(username: string, password: string, meta?: { userAgent?: string; ip?: string }) {
    const user = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            telegramUserId: true,
            jobTitle: true,
            department: true,
          },
        },
        userRoles: { include: { role: { select: { id: true, name: true, slug: true } } } },
      },
    });

    if (!user) {
      throw new AppError(401, 'نام کاربری یافت نشد', 'USER_NOT_FOUND');
    }
    if (!user.isActive) {
      throw new AppError(403, 'حساب کاربری غیرفعال است', 'ACCOUNT_DISABLED');
    }

    if (!password?.length) {
      throw new AppError(400, 'رمز عبور را وارد کنید', 'PASSWORD_REQUIRED');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new AppError(401, 'رمز عبور نادرست است', 'INVALID_PASSWORD');
    }

    await assertPanelAccess(user.id);

    const permissions = await resolveUserPermissions(user.id, user.tokenVersion);
    const tokens = await this.issueTokens(user.id, user.username, user.tokenVersion, meta);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      ...tokens,
      user: publicUser(user),
      roles: user.userRoles.map((ur) => ur.role),
      permissions,
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppError(401, 'نشست منقضی شده است', 'INVALID_REFRESH');
    }

    const user = await loadAuthUser(stored.userId);
    if (!user || !user.isActive) {
      throw new AppError(403, 'حساب کاربری غیرفعال است', 'FORBIDDEN');
    }

    await assertPanelAccess(user.id);

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const permissions = await resolveUserPermissions(user.id, user.tokenVersion);
    const tokens = await this.issueTokens(user.id, user.username, user.tokenVersion);

    return {
      ...tokens,
      user: publicUser(user),
      roles: user.userRoles.map((ur) => ur.role),
      permissions,
    };
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string) {
    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
  }

  async me(userId: string): Promise<{
    user: ReturnType<typeof publicUser>;
    roles: { id: string; name: string; slug: string }[];
    permissions: PermissionKey[];
  }> {
    const user = await loadAuthUser(userId);
    if (!user || !user.isActive) {
      throw new AppError(403, 'حساب کاربری غیرفعال است', 'FORBIDDEN');
    }
    const permissions = await resolveUserPermissions(user.id, user.tokenVersion);
    return {
      user: publicUser(user),
      roles: user.userRoles.map((ur) => ur.role),
      permissions,
    };
  }

  private async issueTokens(
    userId: string,
    username: string,
    tokenVersion: number,
    meta?: { userAgent?: string; ip?: string }
  ) {
    const accessToken = signAccessToken({ sub: userId, username, tokenVersion });
    const refreshToken = newRefreshTokenRaw();
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiryDate(),
        userAgent: meta?.userAgent?.slice(0, 255),
        ip: meta?.ip?.slice(0, 64),
      },
    });
    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();

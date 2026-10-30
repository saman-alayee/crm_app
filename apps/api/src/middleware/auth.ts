import type { NextFunction, Request, Response } from 'express';
import type { PermissionKey } from '../shared/index.js';
import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { hasPermission, resolveUserPermissions } from '../services/rbac.service.js';
import { assertPanelAccess } from '../services/panel-lock.service.js';
import {
  getCachedAuthUser,
  invalidateAuthUserCache,
  setCachedAuthUser,
} from '../services/auth-user-cache.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        tokenVersion: number;
        permissions: PermissionKey[];
      };
    }
  }
}

export { invalidateAuthUserCache };

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'لطفاً وارد حساب کاربری شوید', 'UNAUTHORIZED'));
  }

  let payload: { sub: string; tokenVersion: number };
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch {
    return next(new AppError(401, 'توکن نامعتبر است', 'INVALID_TOKEN'));
  }

  try {
    let dbUser = getCachedAuthUser(payload.sub, payload.tokenVersion);
    if (!dbUser) {
      const row = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, isActive: true, tokenVersion: true },
      });
      if (!row) {
        return next(new AppError(403, 'حساب کاربری غیرفعال است', 'FORBIDDEN'));
      }
      setCachedAuthUser(row);
      dbUser = getCachedAuthUser(row.id, row.tokenVersion) || {
        ...row,
        exp: Date.now(),
      };
    }

    if (!dbUser.isActive) {
      return next(new AppError(403, 'حساب کاربری غیرفعال است', 'FORBIDDEN'));
    }
    if (dbUser.tokenVersion !== payload.tokenVersion) {
      invalidateAuthUserCache(dbUser.id);
      return next(new AppError(401, 'نشست باطل شده است', 'TOKEN_REVOKED'));
    }

    const [, permissions] = await Promise.all([
      assertPanelAccess(dbUser.id),
      resolveUserPermissions(dbUser.id, dbUser.tokenVersion),
    ]);
    req.user = {
      id: dbUser.id,
      username: dbUser.username,
      tokenVersion: dbUser.tokenVersion,
      permissions,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(...keys: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'لطفاً وارد حساب کاربری شوید', 'UNAUTHORIZED'));
    }
    if (!hasPermission(req.user.permissions, keys)) {
      return next(new AppError(403, 'سطح دسترسی کافی نیست', 'FORBIDDEN'));
    }
    next();
  };
}

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { verifyToken, JwtPayload, isPanelRole, type UserRole } from '../utils/helpers';
import { AppError } from '../utils/errors';
import { hasPermission, permissionsForRole, type PanelPermission } from '../utils/permissions';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      sessionId?: string;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError(401, 'لطفاً وارد حساب کاربری شوید', 'UNAUTHORIZED'));
  }

  try {
    const token = authHeader.split(' ')[1];
    req.user = verifyToken(token);
    next();
  } catch {
    next(new AppError(401, 'توکن نامعتبر است', 'INVALID_TOKEN'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      req.user = verifyToken(token);
    } catch {
      // Ignore invalid token for optional auth
    }
  }
  next();
}

/** Reload role + permissions from DB so access follows the latest assignment. */
async function syncRoleFromDb(req: Request): Promise<UserRole> {
  if (!req.user) {
    throw new AppError(401, 'لطفاً وارد حساب کاربری شوید', 'UNAUTHORIZED');
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      role: true,
      isActive: true,
      accessRoleId: true,
      accessRole: { select: { permissions: true } },
    },
  });

  if (!dbUser || !dbUser.isActive) {
    throw new AppError(403, 'حساب کاربری غیرفعال است یا یافت نشد', 'FORBIDDEN');
  }

  req.user.role = dbUser.role as UserRole;
  req.user.accessRoleId = dbUser.accessRoleId;
  req.user.permissions = permissionsForRole(
    dbUser.role,
    dbUser.accessRoleId ? dbUser.accessRole?.permissions : undefined
  );
  return req.user.role;
}

/** Any panel role: ADMIN | SUPERVISOR | STAFF — uses live DB role */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const role = await syncRoleFromDb(req);
    if (!isPanelRole(role)) {
      return next(new AppError(403, 'دسترسی غیرمجاز', 'FORBIDDEN'));
    }
    next();
  } catch (error) {
    next(error);
  }
}

/** Must run after requireAdmin so req.user.role/permissions are synced */
export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'لطفاً وارد حساب کاربری شوید', 'UNAUTHORIZED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'سطح دسترسی شما برای این بخش کافی نیست', 'FORBIDDEN'));
    }
    next();
  };
}

/** Section-level check (ADMIN always passes). Custom roles use their permission list. */
export function requirePermission(...keys: PanelPermission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'لطفاً وارد حساب کاربری شوید', 'UNAUTHORIZED'));
    }
    if (req.user.role === 'ADMIN') {
      return next();
    }
    if (keys.some((key) => hasPermission(req.user?.permissions, key))) {
      return next();
    }
    next(new AppError(403, 'سطح دسترسی شما برای این بخش کافی نیست', 'FORBIDDEN'));
  };
}

export function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  const sessionId = req.headers['x-session-id'] as string;
  if (sessionId) {
    req.sessionId = sessionId;
  }
  next();
}

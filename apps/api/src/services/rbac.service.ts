import {
  ALL_PERMISSION_KEYS,
  FULL_ACCESS_ROLE_SLUGS,
  type PermissionKey,
} from '../shared/index.js';
import { prisma } from '../db/prisma.js';

type CacheEntry = { perms: PermissionKey[]; exp: number };
const permCache = new Map<string, CacheEntry>();
const PERM_TTL_MS = 45_000;
const MAX_CACHE = 500;

function cacheGet(key: string) {
  const hit = permCache.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) {
    permCache.delete(key);
    return null;
  }
  return hit.perms;
}

function cacheSet(key: string, perms: PermissionKey[]) {
  if (permCache.size > MAX_CACHE) {
    const first = permCache.keys().next().value;
    if (first) permCache.delete(first);
  }
  permCache.set(key, { perms, exp: Date.now() + PERM_TTL_MS });
}

export function invalidateUserPermissions(userId: string) {
  for (const key of permCache.keys()) {
    if (key.startsWith(`${userId}:`)) permCache.delete(key);
  }
}

export function invalidateAllPermissions() {
  permCache.clear();
}

/**
 * Resolve effective permissions for a user.
 * Cached briefly by userId + tokenVersion (invalidated when roles change).
 */
export async function resolveUserPermissions(
  userId: string,
  tokenVersion = 0
): Promise<PermissionKey[]> {
  const cacheKey = `${userId}:${tokenVersion}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // Fast path: only check full-access roles first (cheap query)
  const roleRows = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: { select: { slug: true, isSystem: true, id: true } },
    },
  });

  const hasFullAccess = roleRows.some(
    (ur) => ur.role.isSystem && FULL_ACCESS_ROLE_SLUGS.has(ur.role.slug)
  );
  if (hasFullAccess) {
    const all = [...ALL_PERMISSION_KEYS];
    cacheSet(cacheKey, all);
    return all;
  }

  if (!roleRows.length) {
    const userOverrides = await prisma.userPermission.findMany({
      where: { userId },
      include: { permission: { select: { key: true } } },
    });
    const granted = new Set<string>();
    for (const up of userOverrides) {
      if (up.effect === 'GRANT') granted.add(up.permission.key);
      if (up.effect === 'DENY') granted.delete(up.permission.key);
    }
    const perms = [...granted].filter((k): k is PermissionKey =>
      (ALL_PERMISSION_KEYS as string[]).includes(k)
    );
    cacheSet(cacheKey, perms);
    return perms;
  }

  const roleIds = roleRows.map((r) => r.role.id);
  const [rolePerms, userOverrides] = await Promise.all([
    prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      select: { permission: { select: { key: true } } },
    }),
    prisma.userPermission.findMany({
      where: { userId },
      include: { permission: { select: { key: true } } },
    }),
  ]);

  const granted = new Set<string>();
  for (const rp of rolePerms) granted.add(rp.permission.key);
  for (const up of userOverrides) {
    if (up.effect === 'GRANT') granted.add(up.permission.key);
    if (up.effect === 'DENY') granted.delete(up.permission.key);
  }

  const perms = [...granted].filter((k): k is PermissionKey =>
    (ALL_PERMISSION_KEYS as string[]).includes(k)
  );
  cacheSet(cacheKey, perms);
  return perms;
}

/** True if user has every listed permission (AND). */
export function hasPermission(
  permissions: PermissionKey[] | undefined,
  required: PermissionKey | PermissionKey[]
): boolean {
  if (!permissions?.length) return false;
  const need = Array.isArray(required) ? required : [required];
  return need.every((k) => permissions.includes(k));
}

/** True if user has at least one listed permission (OR). */
export function hasAnyPermission(
  permissions: PermissionKey[] | undefined,
  required: PermissionKey | PermissionKey[]
): boolean {
  if (!permissions?.length) return false;
  const need = Array.isArray(required) ? required : [required];
  return need.some((k) => permissions.includes(k));
}

export async function userHasFullAccess(userId: string): Promise<boolean> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { slug: true, isSystem: true } } },
  });
  return rows.some((ur) => ur.role.isSystem && FULL_ACCESS_ROLE_SLUGS.has(ur.role.slug));
}

export async function userIsOwner(userId: string): Promise<boolean> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { slug: true, isSystem: true } } },
  });
  return rows.some((ur) => ur.role.isSystem && ur.role.slug === 'owner');
}

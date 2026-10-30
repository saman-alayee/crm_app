import type { UserRole } from '~/types';

export interface JwtPayload {
  userId?: string;
  phone?: string;
  role?: UserRole;
}

export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;

    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join('')
    );

    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function getRoleFromToken(token: string | null | undefined): JwtPayload['role'] | null {
  if (!token) return null;
  return parseJwtPayload(token)?.role ?? null;
}

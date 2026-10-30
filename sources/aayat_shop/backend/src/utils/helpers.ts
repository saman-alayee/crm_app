import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config';

export type UserRole = 'CUSTOMER' | 'ADMIN' | 'SUPERVISOR' | 'STAFF';

export const PANEL_ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR', 'STAFF'];

export function isPanelRole(role: string | undefined | null): boolean {
  return !!role && PANEL_ROLES.includes(role as UserRole);
}

export interface JwtPayload {
  userId: string;
  phone: string;
  role: UserRole;
  permissions?: string[];
  accessRoleId?: string | null;
}

export function generateToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwt.secret, options);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}

export function generatePasswordResetToken(userId: string, phone: string): string {
  return jwt.sign({ userId, phone, purpose: 'password-reset' }, config.jwt.secret, { expiresIn: '10m' });
}

export function verifyPasswordResetToken(token: string): { userId: string; phone: string } {
  const payload = jwt.verify(token, config.jwt.secret) as {
    userId?: string;
    phone?: string;
    purpose?: string;
  };
  if (payload.purpose !== 'password-reset' || !payload.userId || !payload.phone) {
    throw new Error('INVALID_RESET_TOKEN');
  }
  return { userId: payload.userId, phone: payload.phone };
}

export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `HM-${dateStr}-${random}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function toPersianDigits(num: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/\d/g, (d) => persianDigits[parseInt(d)]);
}

export function formatPrice(price: number | string): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (Number.isNaN(num)) return '۰';
  return Math.round(num).toLocaleString('fa-IR');
}

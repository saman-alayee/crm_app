import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  tokenVersion: number;
  typ: 'access';
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'typ'>): string {
  const options: SignOptions = { expiresIn: config.jwt.accessExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign({ ...payload, typ: 'access' }, config.jwt.accessSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
  if (payload.typ !== 'access') throw new Error('Invalid token type');
  return payload;
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function newRefreshTokenRaw(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function refreshExpiryDate(): Date {
  const match = /^(\d+)([dhms])$/i.exec(config.jwt.refreshExpiresIn);
  const now = Date.now();
  if (!match) return new Date(now + 7 * 24 * 60 * 60 * 1000);
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const ms =
    unit === 'd' ? n * 86400000 : unit === 'h' ? n * 3600000 : unit === 'm' ? n * 60000 : n * 1000;
  return new Date(now + ms);
}

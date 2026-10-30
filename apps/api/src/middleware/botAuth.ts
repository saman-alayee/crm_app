import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/index.js';
import { AppError } from '../utils/errors.js';

/** Internal calls from Telegram bot process */
export function requireBotKey(req: Request, _res: Response, next: NextFunction) {
  const key = req.headers['x-bot-key'] || req.headers['x-api-key'];
  if (!key || key !== config.botInternalApiKey) {
    return next(new AppError(401, 'کلید بات نامعتبر است', 'BOT_UNAUTHORIZED'));
  }
  next();
}

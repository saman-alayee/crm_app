import type { Request, Response } from 'express';
import { authService } from '../../services/auth.service.js';
import { successResponse } from '../../utils/errors.js';
import { getPanelLockStatus } from '../../services/panel-lock.service.js';

export async function login(req: Request, res: Response) {
  const data = await authService.login(req.body.username, req.body.password, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  successResponse(res, data, 'ورود موفق');
}

export async function refresh(req: Request, res: Response) {
  const data = await authService.refresh(req.body.refreshToken);
  successResponse(res, data, 'توکن تمدید شد');
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body.refreshToken);
  successResponse(res, { ok: true }, 'خروج انجام شد');
}

export async function logoutAll(req: Request, res: Response) {
  await authService.logoutAll(req.user!.id);
  successResponse(res, { ok: true }, 'همه نشست‌ها باطل شد');
}

export async function me(req: Request, res: Response) {
  const data = await authService.me(req.user!.id);
  successResponse(res, data);
}

export async function panelStatus(_req: Request, res: Response) {
  successResponse(res, await getPanelLockStatus());
}

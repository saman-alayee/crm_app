import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody } from '../../utils/errors.js';
import { prisma } from '../../db/prisma.js';
import { writeAudit } from '../../services/audit.service.js';
import {
  getPanelLockStatus,
  lockPanel,
  unlockPanel,
} from '../../services/panel-lock.service.js';

export const settingsRouter = Router();
settingsRouter.use(authenticate);

const DEFAULTS = {
  companyName: 'فروشگاه سامی',
  timezone: 'Asia/Tehran',
  leaveNotifyManagers: true,
  salaryNotifyManagers: true,
  themePrimary: '#0b6e99',
  themeAccent: '#7ebfd6',
  darkModeDefault: false,
};

settingsRouter.get(
  '/',
  requirePermission('settings.view'),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.systemSetting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    successResponse(res, {
      ...DEFAULTS,
      ...map,
      themePrimary: (map.themePrimary as string) || DEFAULTS.themePrimary,
      themeAccent: (map.themeAccent as string) || DEFAULTS.themeAccent,
      darkModeDefault: map.darkModeDefault === true,
      companyName: (map.companyName as string) || DEFAULTS.companyName,
    });
  })
);

/** Public-ish theme endpoint for logged-in users (even without settings.edit) */
settingsRouter.get(
  '/theme',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ['themePrimary', 'themeAccent', 'darkModeDefault', 'companyName'] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    successResponse(res, {
      themePrimary: (map.themePrimary as string) || DEFAULTS.themePrimary,
      themeAccent: (map.themeAccent as string) || DEFAULTS.themeAccent,
      darkModeDefault: map.darkModeDefault === true,
      companyName: (map.companyName as string) || DEFAULTS.companyName,
    });
  })
);

settingsRouter.patch(
  '/',
  requirePermission('settings.edit'),
  validateBody(
    z.object({
      companyName: z.string().optional(),
      timezone: z.string().optional(),
      leaveNotifyManagers: z.boolean().optional(),
      salaryNotifyManagers: z.boolean().optional(),
      themePrimary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      themeAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      darkModeDefault: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    for (const [key, value] of Object.entries(req.body)) {
      if (value === undefined) continue;
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value, updatedBy: req.user!.id },
        update: { value, updatedBy: req.user!.id },
      });
    }
    await writeAudit({
      actorId: req.user!.id,
      action: 'update',
      module: 'settings',
      entityType: 'SystemSetting',
      after: req.body,
    });
    successResponse(res, req.body, 'تنظیمات ذخیره شد');
  })
);

settingsRouter.get(
  '/panel-lock',
  requirePermission('settings.view'),
  asyncHandler(async (_req, res) => {
    successResponse(res, await getPanelLockStatus());
  })
);

settingsRouter.post(
  '/panel-lock',
  requirePermission('settings.edit'),
  validateBody(
    z.object({
      message: z.string().max(300).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    successResponse(res, await lockPanel(req.user!.id, req.body.message), 'پنل قفل شد');
  })
);

settingsRouter.post(
  '/panel-unlock',
  requirePermission('settings.edit'),
  asyncHandler(async (req, res) => {
    successResponse(res, await unlockPanel(req.user!.id), 'قفل پنل برداشته شد');
  })
);

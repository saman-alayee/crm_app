import { Router } from 'express';
import { settingsService } from '../services/settings.service';
import { asyncHandler, successResponse } from '../utils/errors';

const router = Router();

router.get(
  '/announcement',
  asyncHandler(async (_req, res) => {
    const settings = await settingsService.getAnnouncement();
    res.setHeader('Cache-Control', 'no-store');
    successResponse(res, settings);
  })
);

router.get(
  '/shipping',
  asyncHandler(async (_req, res) => {
    const settings = await settingsService.getShipping();
    res.setHeader('Cache-Control', 'no-store');
    successResponse(res, settings);
  })
);

router.get(
  '/maintenance',
  asyncHandler(async (_req, res) => {
    const settings = await settingsService.getMaintenance();
    res.setHeader('Cache-Control', 'no-store');
    successResponse(res, settings);
  })
);

export default router;

import { Router } from 'express';
import type { SliderPlacement } from '@prisma/client';
import { sliderService } from '../services/slider.service';
import { asyncHandler, successResponse } from '../utils/errors';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const placement = req.query.placement as SliderPlacement | undefined;
    const sliders = await sliderService.getPublic(placement);
    successResponse(res, sliders);
  })
);

export default router;

import { Router } from 'express';
import { contentService } from '../services/content.service';
import { asyncHandler, successResponse } from '../utils/errors';
import { paramId } from '../utils/params';

const router = Router();

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const page = await contentService.getPublishedBySlug(paramId(req.params.slug));
    successResponse(res, page);
  })
);

export default router;

import { Router } from 'express';
import { categoryService } from '../services/category.service';
import { asyncHandler, successResponse } from '../utils/errors';
import { paramId } from '../utils/params';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const lite = req.query.lite === '1' || req.query.lite === 'true';
    const categories = await categoryService.getAll(false, lite);
    successResponse(res, categories);
  })
);

router.get(
  '/:slug/tags',
  asyncHandler(async (req, res) => {
    const { tagService } = await import('../services/tag.service');
    const result = await tagService.getByCategorySlug(paramId(req.params.slug));
    successResponse(res, result.tags);
  })
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const category = await categoryService.getBySlug(paramId(req.params.slug));
    successResponse(res, category);
  })
);

export default router;

import { Router } from 'express';
import { tagService } from '../services/tag.service';
import { asyncHandler, successResponse } from '../utils/errors';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const categoryId = req.query.categoryId as string | undefined;
    const tags = await tagService.getAll(categoryId);
    successResponse(res, tags);
  })
);

export default router;

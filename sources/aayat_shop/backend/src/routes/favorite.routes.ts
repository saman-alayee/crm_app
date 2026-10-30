import { Router } from 'express';
import { z } from 'zod';
import { favoriteService } from '../services/favorite.service';
import { asyncHandler, successResponse, validate } from '../utils/errors';
import { authenticate } from '../middleware/auth';
import { paramId } from '../utils/params';

const router = Router();

const toggleSchema = z.object({
  productId: z.string().min(1),
});

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const favorites = await favoriteService.list(req.user!.userId);
    successResponse(res, favorites);
  })
);

router.post(
  '/',
  authenticate,
  validate(toggleSchema),
  asyncHandler(async (req, res) => {
    const result = await favoriteService.toggle(req.user!.userId, req.body.productId);
    successResponse(res, result);
  })
);

router.post(
  '/sync',
  authenticate,
  validate(z.object({ productIds: z.array(z.string().min(1)).max(100) })),
  asyncHandler(async (req, res) => {
    const favorites = await favoriteService.sync(req.user!.userId, req.body.productIds);
    successResponse(res, favorites);
  })
);

router.delete(
  '/:productId',
  authenticate,
  asyncHandler(async (req, res) => {
    const productId = paramId(req.params.productId);
    await favoriteService.remove(req.user!.userId, productId);
    successResponse(res, null, 'از علاقه‌مندی‌ها حذف شد');
  })
);

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { couponService } from '../services/coupon.service';
import { asyncHandler, successResponse, validate } from '../utils/errors';
import { optionalAuth } from '../middleware/auth';

const router = Router();

const validateSchema = z.object({
  code: z.string().min(2),
  subtotal: z.number().int().positive(),
  customerPhone: z.string().min(10).optional(),
});

router.post(
  '/validate',
  optionalAuth,
  validate(validateSchema),
  asyncHandler(async (req, res) => {
    const result = await couponService.validate(req.body.code, req.body.subtotal, {
      userId: req.user?.userId,
      customerPhone: req.body.customerPhone,
    });
    successResponse(res, result, 'کد تخفیف معتبر است');
  })
);

export default router;

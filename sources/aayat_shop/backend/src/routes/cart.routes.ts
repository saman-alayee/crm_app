import { Router } from 'express';
import { z } from 'zod';
import { cartService } from '../services/cart.service';
import { asyncHandler, successResponse, validate } from '../utils/errors';
import { optionalAuth, sessionMiddleware } from '../middleware/auth';
import { paramId } from '../utils/params';

const router = Router();

router.use(sessionMiddleware);
router.use(optionalAuth);

const addItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1).default(1),
});

const updateItemSchema = z.object({
  quantity: z.number().int().min(0),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await cartService.getCart(req.user?.userId, req.sessionId);
    successResponse(res, cart);
  })
);

router.post(
  '/items',
  validate(addItemSchema),
  asyncHandler(async (req, res) => {
    const cart = await cartService.addItem(
      req.user?.userId,
      req.sessionId,
      req.body.productId,
      req.body.quantity
    );
    successResponse(res, cart, 'محصول به سبد اضافه شد');
  })
);

router.put(
  '/items/:productId',
  validate(updateItemSchema),
  asyncHandler(async (req, res) => {
    const cart = await cartService.updateItem(
      req.user?.userId,
      req.sessionId,
      paramId(req.params.productId),
      req.body.quantity
    );
    successResponse(res, cart);
  })
);

router.delete(
  '/items/:productId',
  asyncHandler(async (req, res) => {
    const cart = await cartService.removeItem(
      req.user?.userId,
      req.sessionId,
      paramId(req.params.productId)
    );
    successResponse(res, cart, 'محصول از سبد حذف شد');
  })
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await cartService.clearCart(req.user?.userId, req.sessionId);
    successResponse(res, cart, 'سبد خرید خالی شد');
  })
);

export default router;

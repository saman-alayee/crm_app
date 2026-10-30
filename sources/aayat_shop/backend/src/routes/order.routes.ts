import { Router } from 'express';
import { z } from 'zod';
import { orderService } from '../services/order.service';
import { asyncHandler, successResponse, validate } from '../utils/errors';
import { authenticate, sessionMiddleware } from '../middleware/auth';
import { paramId } from '../utils/params';
import { normalizeDigits } from '../utils/normalize';

const router = Router();

const postalCodeSchema = z
  .string()
  .transform((v) => normalizeDigits(v).replace(/\D/g, ''))
  .pipe(z.string().regex(/^\d{10}$/, 'کدپستی باید ۱۰ رقم باشد'));

const createOrderSchema = z
  .object({
    customerName: z.string().min(3, 'نام و نام خانوادگی الزامی است'),
    customerPhone: z.string().min(10, 'شماره موبایل الزامی است'),
    deliveryAddress: z.string().min(5).optional(),
    address: z.string().min(5).optional(),
    street: z.string().min(3).optional(),
    plaque: z.string().optional(),
    unit: z.string().optional(),
    province: z.string().min(2, 'استان الزامی است').optional(),
    city: z.string().min(2, 'شهر الزامی است').optional(),
    postalCode: postalCodeSchema.optional(),
    addressId: z.string().optional(),
    addressTitle: z.string().optional(),
    notes: z.string().optional(),
    couponCode: z.string().optional(),
    deliveryMethod: z.enum(['PICKUP', 'NATIONWIDE']),
    paymentMethod: z.literal('ZIBAL').optional(),
  })
  .refine(
    (data) =>
      Boolean(data.addressId) ||
      (Boolean(data.province?.trim()) &&
        Boolean(data.city?.trim()) &&
        Boolean(data.postalCode?.trim()) &&
        (Boolean(data.deliveryAddress?.trim()) || Boolean(data.address?.trim()) || Boolean(data.street?.trim()))),
    { message: 'استان، شهر، کدپستی و آدرس ارسال الزامی است' }
  );

router.use(sessionMiddleware);

router.post(
  '/',
  authenticate,
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await orderService.createOrder(
      req.body,
      req.user!.userId,
      req.sessionId
    );
    successResponse(res, order, 'سفارش با موفقیت ثبت شد', 201);
  })
);

router.get(
  '/track/:orderNumber',
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrderByNumber(paramId(req.params.orderNumber));
    successResponse(res, order);
  })
);

router.get(
  '/held',
  authenticate,
  asyncHandler(async (req, res) => {
    const orders = await orderService.listHeldOrders(req.user!.userId);
    successResponse(res, orders);
  })
);

router.post(
  '/request-shipment',
  authenticate,
  validate(
    z.object({
      shipDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'تاریخ نامعتبر است')
        .optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const result = await orderService.requestShipment(req.user!.userId, req.body.shipDate);
    successResponse(res, result, 'درخواست ارسال برای شما ثبت شد');
  })
);

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const orders = await orderService.getUserOrders(req.user!.userId, page);
    successResponse(res, orders);
  })
);

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrderById(paramId(req.params.id), req.user!.userId);
    successResponse(res, order);
  })
);

export default router;

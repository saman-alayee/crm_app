import { Router } from 'express';
import { z } from 'zod';
import { addressService } from '../services/user.service';
import { asyncHandler, successResponse, validate } from '../utils/errors';
import { authenticate } from '../middleware/auth';
import { paramId } from '../utils/params';
import { normalizeDigits } from '../utils/normalize';

const router = Router();

router.use(authenticate);

const postalCodeSchema = z
  .string()
  .transform((v) => normalizeDigits(v).replace(/\D/g, ''))
  .pipe(z.string().regex(/^\d{10}$/, 'کدپستی باید ۱۰ رقم باشد'));

const addressBodySchema = z.object({
  title: z.string().optional(),
  address: z.string().min(5, 'آدرس باید حداقل ۵ کاراکتر باشد'),
  plaque: z.string().min(1, 'پلاک الزامی است'),
  unit: z.string().min(1, 'واحد الزامی است'),
  province: z.string().min(2, 'استان الزامی است'),
  city: z.string().min(2, 'شهر الزامی است'),
  postalCode: postalCodeSchema,
  isDefault: z.boolean().optional(),
});

const addressUpdateSchema = z.object({
  title: z.string().optional(),
  address: z.string().min(5, 'آدرس باید حداقل ۵ کاراکتر باشد').optional(),
  plaque: z.string().min(1, 'پلاک الزامی است').optional(),
  unit: z.string().min(1, 'واحد الزامی است').optional(),
  province: z.string().min(2, 'استان الزامی است').optional(),
  city: z.string().min(2, 'شهر الزامی است').optional(),
  postalCode: postalCodeSchema.optional(),
  isDefault: z.boolean().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const addresses = await addressService.getUserAddresses(req.user!.userId);
    successResponse(res, addresses);
  })
);

router.post(
  '/',
  validate(addressBodySchema),
  asyncHandler(async (req, res) => {
    const address = await addressService.create(req.user!.userId, req.body);
    successResponse(res, address, 'آدرس اضافه شد', 201);
  })
);

router.put(
  '/:id',
  validate(addressUpdateSchema),
  asyncHandler(async (req, res) => {
    const address = await addressService.update(req.user!.userId, paramId(req.params.id), req.body);
    successResponse(res, address, 'آدرس به‌روزرسانی شد');
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await addressService.delete(req.user!.userId, paramId(req.params.id));
    successResponse(res, null, 'آدرس حذف شد');
  })
);

export default router;

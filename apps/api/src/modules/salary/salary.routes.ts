import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody } from '../../utils/errors.js';
import { salaryService } from './salary.service.js';

export const salaryRouter = Router();
salaryRouter.use(authenticate);

salaryRouter.get(
  '/',
  requirePermission('salary.view'),
  asyncHandler(async (req, res) => {
    successResponse(
      res,
      await salaryService.list(req.query as Record<string, unknown>, {
        id: req.user!.id,
        permissions: req.user!.permissions,
      })
    );
  })
);

salaryRouter.post(
  '/',
  requirePermission('salary.create'),
  validateBody(
    z.object({
      type: z.enum(['SALARY', 'ADVANCE']),
      amount: z.number().positive(),
      description: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    successResponse(res, await salaryService.create(req.body, req.user!.id), 'درخواست ثبت شد', 201);
  })
);

salaryRouter.post(
  '/:id/approve',
  requirePermission('salary.approve'),
  asyncHandler(async (req, res) => {
    successResponse(res, await salaryService.decide(req.params.id, true, req.user!.id), 'تأیید شد');
  })
);

salaryRouter.post(
  '/:id/reject',
  requirePermission('salary.reject'),
  validateBody(z.object({ reason: z.string().min(2) })),
  asyncHandler(async (req, res) => {
    successResponse(
      res,
      await salaryService.decide(req.params.id, false, req.user!.id, req.body.reason),
      'رد شد'
    );
  })
);

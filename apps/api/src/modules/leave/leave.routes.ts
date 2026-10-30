import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody } from '../../utils/errors.js';
import { leaveService } from './leave.service.js';

export const leaveRouter = Router();
leaveRouter.use(authenticate);

leaveRouter.get(
  '/',
  requirePermission('leave.view'),
  asyncHandler(async (req, res) => {
    successResponse(
      res,
      await leaveService.list(req.query as Record<string, unknown>, {
        id: req.user!.id,
        permissions: req.user!.permissions,
      })
    );
  })
);

leaveRouter.post(
  '/',
  requirePermission('leave.create'),
  validateBody(
    z.object({
      type: z.enum(['HOURLY', 'DAILY']),
      leaveDate: z.string().min(8),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      reason: z.string().optional(),
      employeeId: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    successResponse(res, await leaveService.create(req.body, req.user!.id), 'درخواست ثبت شد', 201);
  })
);

leaveRouter.post(
  '/:id/approve',
  requirePermission('leave.approve'),
  asyncHandler(async (req, res) => {
    successResponse(res, await leaveService.decide(req.params.id, true, req.user!.id), 'تأیید شد');
  })
);

leaveRouter.post(
  '/:id/reject',
  requirePermission('leave.reject'),
  validateBody(z.object({ reason: z.string().min(2) })),
  asyncHandler(async (req, res) => {
    successResponse(
      res,
      await leaveService.decide(req.params.id, false, req.user!.id, req.body.reason),
      'رد شد'
    );
  })
);

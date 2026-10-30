import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody } from '../../utils/errors.js';
import { tasksService } from './tasks.service.js';

export const tasksRouter = Router();
tasksRouter.use(authenticate);

tasksRouter.get(
  '/',
  requirePermission('tasks.view'),
  asyncHandler(async (req, res) => {
    successResponse(
      res,
      await tasksService.list(req.query as Record<string, unknown>, {
        id: req.user!.id,
        permissions: req.user!.permissions,
      })
    );
  })
);

tasksRouter.post(
  '/',
  requirePermission('tasks.create'),
  validateBody(
    z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
      dueAt: z.string().optional(),
      assigneeId: z.string().min(1),
      scheduleKind: z.enum(['ONCE', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY']).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    successResponse(res, await tasksService.create(req.body, req.user!.id), 'وظیفه ایجاد شد', 201);
  })
);

tasksRouter.post(
  '/:id/assign',
  requirePermission('tasks.edit'),
  validateBody(z.object({ assigneeId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    successResponse(
      res,
      await tasksService.assign(req.params.id, req.body.assigneeId, req.user!.id),
      'مسئول تغییر کرد'
    );
  })
);

tasksRouter.post(
  '/:id/complete',
  requirePermission('tasks.view'),
  asyncHandler(async (req, res) => {
    successResponse(res, await tasksService.complete(req.params.id, req.user!.id), 'تکمیل شد');
  })
);

tasksRouter.post(
  '/:id/delay-reminder',
  requirePermission('tasks.view'),
  validateBody(z.object({ minutes: z.number().optional() })),
  asyncHandler(async (req, res) => {
    successResponse(
      res,
      await tasksService.delayReminder(req.params.id, req.body.minutes ?? 60, req.user!.id),
      'یادآوری تنظیم شد'
    );
  })
);

tasksRouter.post(
  '/:id/schedule/pause',
  requirePermission('tasks.edit'),
  asyncHandler(async (req, res) => {
    successResponse(res, await tasksService.setScheduleActive(req.params.id, false, req.user!.id));
  })
);

tasksRouter.post(
  '/:id/schedule/resume',
  requirePermission('tasks.edit'),
  asyncHandler(async (req, res) => {
    successResponse(res, await tasksService.setScheduleActive(req.params.id, true, req.user!.id));
  })
);

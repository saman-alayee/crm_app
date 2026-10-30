import { Router } from 'express';
import { notificationService } from '../services/notification.service';
import { asyncHandler, successResponse } from '../utils/errors';
import { authenticate } from '../middleware/auth';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const result = await notificationService.getUserNotifications(req.user!.userId, page);
    successResponse(res, result);
  })
);

router.put(
  '/read-all',
  asyncHandler(async (req, res) => {
    await notificationService.markAllAsRead(req.user!.userId);
    successResponse(res, null, 'همه اعلان‌ها خوانده شد');
  })
);

router.put(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await notificationService.markAsRead(
      req.user!.userId,
      paramId(req.params.id)
    );
    successResponse(res, notification);
  })
);

export default router;

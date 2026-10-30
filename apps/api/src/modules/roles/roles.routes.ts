import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler, successResponse, validateBody } from '../../utils/errors.js';
import { rolesService } from './roles.service.js';

export const rolesRouter = Router();
rolesRouter.use(authenticate);

rolesRouter.get(
  '/',
  requirePermission('roles.view'),
  asyncHandler(async (_req, res) => {
    successResponse(res, await rolesService.list());
  })
);

rolesRouter.get(
  '/permissions',
  requirePermission('roles.view'),
  asyncHandler(async (_req, res) => {
    successResponse(res, await rolesService.listPermissions());
  })
);

rolesRouter.get(
  '/:id',
  requirePermission('roles.view'),
  asyncHandler(async (req, res) => {
    successResponse(res, await rolesService.get(req.params.id));
  })
);

rolesRouter.post(
  '/',
  requirePermission('roles.create'),
  validateBody(
    z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      permissionKeys: z.array(z.string()).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    successResponse(res, await rolesService.create(req.body, req.user!.id), 'نقش ایجاد شد', 201);
  })
);

rolesRouter.patch(
  '/:id',
  requirePermission('roles.edit'),
  validateBody(
    z.object({
      name: z.string().min(2).optional(),
      description: z.string().nullable().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    successResponse(res, await rolesService.update(req.params.id, req.body, req.user!.id));
  })
);

rolesRouter.delete(
  '/:id',
  requirePermission('roles.delete'),
  asyncHandler(async (req, res) => {
    await rolesService.remove(req.params.id, req.user!.id);
    successResponse(res, { ok: true }, 'نقش حذف شد');
  })
);

rolesRouter.put(
  '/:id/permissions',
  requirePermission('roles.manage_permissions'),
  validateBody(z.object({ permissionKeys: z.array(z.string()) })),
  asyncHandler(async (req, res) => {
    successResponse(
      res,
      await rolesService.setPermissions(req.params.id, req.body.permissionKeys, req.user!.id),
      'مجوزها ذخیره شد'
    );
  })
);

rolesRouter.put(
  '/users/:userId',
  requirePermission('roles.manage_permissions'),
  validateBody(z.object({ roleIds: z.array(z.string()) })),
  asyncHandler(async (req, res) => {
    successResponse(
      res,
      await rolesService.assignUserRoles(req.params.userId, req.body.roleIds, req.user!.id),
      'نقش‌های کاربر به‌روز شد'
    );
  })
);

import { Router } from 'express';
import { asyncHandler, validateBody } from '../../utils/errors.js';
import { authenticate } from '../../middleware/auth.js';
import { loginSchema, refreshSchema } from './auth.validators.js';
import * as ctrl from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/login', validateBody(loginSchema), asyncHandler(ctrl.login));
authRouter.post('/refresh', validateBody(refreshSchema), asyncHandler(ctrl.refresh));
authRouter.post('/logout', validateBody(refreshSchema), asyncHandler(ctrl.logout));
authRouter.post('/logout-all', authenticate, asyncHandler(ctrl.logoutAll));
authRouter.get('/me', authenticate, asyncHandler(ctrl.me));
authRouter.get('/panel-status', asyncHandler(ctrl.panelStatus));

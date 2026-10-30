import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/errors.js';
import { writeAudit } from '../../services/audit.service.js';
import { backupService } from './backup.service.js';

export const backupRouter = Router();

backupRouter.get(
  '/database',
  authenticate,
  requirePermission('backup.export'),
  asyncHandler(async (req, res) => {
    const result = await backupService.streamDatabaseBackup(res);
    await writeAudit({
      actorId: req.user!.id,
      action: 'export',
      module: 'backup',
      entityType: 'Database',
      after: result,
    });
  })
);

import { prisma } from '../db/prisma.js';

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  ip?: string;
  userAgent?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId || null,
      action: input.action,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before as object | undefined,
      after: input.after as object | undefined,
      metadata: input.metadata as object | undefined,
      ip: input.ip,
      userAgent: input.userAgent?.slice(0, 255),
    },
  });
}

export { purgeOldAuditLogs, startAuditRetentionJob } from './audit-retention.service.js';

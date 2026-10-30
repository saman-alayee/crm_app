import { prisma } from '../db/prisma.js';
import { buildDiffText } from '../shared/shop.js';
import { notifyUsers, usersWithPermission } from './notification-dispatch.service.js';

export async function recordEditHistory(input: {
  entityType: string;
  entityId: string;
  editedById: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  labels: Record<string, string>;
  sensitive?: boolean;
  title?: string;
}) {
  const diffText = buildDiffText(input.before, input.after, input.labels);
  if (diffText === 'بدون تغییر معنادار') return null;

  const row = await prisma.requestEditHistory.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      editedById: input.editedById,
      before: input.before as object,
      after: input.after as object,
      diffText,
      sensitive: !!input.sensitive,
    },
  });

  const managers = await usersWithPermission('trades.approve');
  await notifyUsers({
    userIds: managers.filter((id) => id !== input.editedById),
    title: input.title || 'ویرایش درخواست',
    body: diffText.slice(0, 280),
    eventType: 'edit.diff',
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: { historyId: row.id, sensitive: !!input.sensitive },
  });

  return row;
}

import { prisma } from '../db/prisma.js';
import {
  formatSpecsLabel,
  scoreSpecs,
  specsRecord,
  type Specs,
} from '../shared/shop.js';
import { notifyUsers, usersWithPermission } from './notification-dispatch.service.js';

async function upsertMatch(input: {
  dedupeKey: string;
  kind: 'BUY_SELL' | 'BUY_INVENTORY';
  score: 'EXACT' | 'SIMILAR';
  buyRequestId?: string;
  sellRequestId?: string;
  inventoryItemId?: string;
  title: string;
  body: string;
}) {
  const existing = await prisma.matchSuggestion.findUnique({
    where: { dedupeKey: input.dedupeKey },
  });
  if (existing?.dismissedAt) return existing;

  const row =
    existing ||
    (await prisma.matchSuggestion.create({
      data: {
        dedupeKey: input.dedupeKey,
        kind: input.kind,
        score: input.score,
        buyRequestId: input.buyRequestId,
        sellRequestId: input.sellRequestId,
        inventoryItemId: input.inventoryItemId,
      },
    }));

  if (!row.notifiedAt) {
    const recipients = await usersWithPermission('trades.view');
    await notifyUsers({
      userIds: recipients,
      title: input.title,
      body: input.body,
      eventType: `match.${input.kind.toLowerCase()}`,
      entityType: 'MatchSuggestion',
      entityId: row.id,
      metadata: { score: input.score, kind: input.kind },
    });
    await prisma.matchSuggestion.update({
      where: { id: row.id },
      data: { notifiedAt: new Date() },
    });
  }
  return row;
}

export async function runTradeMatching(tradeId: string) {
  const trade = await prisma.tradeRequest.findUnique({ where: { id: tradeId } });
  if (!trade || trade.status === 'CLOSED' || trade.status === 'CANCELLED') return;

  const specs = specsRecord(trade.specs);
  const oppositeSide = trade.side === 'BUY' ? 'SELL' : 'BUY';

  const opposites = await prisma.tradeRequest.findMany({
    where: {
      side: oppositeSide,
      productKind: trade.productKind,
      status: { in: ['OPEN', 'MATCHED'] },
      id: { not: trade.id },
    },
    take: 200,
  });

  for (const other of opposites) {
    const score = scoreSpecs(trade.productKind, specs, specsRecord(other.specs));
    if (!score) continue;
    const buy = trade.side === 'BUY' ? trade : other;
    const sell = trade.side === 'SELL' ? trade : other;
    const label = formatSpecsLabel(trade.productKind, specs);
    await upsertMatch({
      dedupeKey: `buy_sell:${buy.id}:${sell.id}`,
      kind: 'BUY_SELL',
      score,
      buyRequestId: buy.id,
      sellRequestId: sell.id,
      title: score === 'EXACT' ? 'تطبیق دقیق خرید/فروش' : 'تطبیق مشابه خرید/فروش',
      body: `${label} — یک درخواست خرید و فروش هم‌خوان پیدا شد.`,
    });
  }

  if (trade.side === 'BUY') {
    await matchBuyAgainstInventory(trade.id, trade.productKind, specs);
  }
}

async function matchBuyAgainstInventory(
  buyRequestId: string,
  productKind: 'PHONE' | 'SIM',
  specs: Specs
) {
  const items = await prisma.inventoryItem.findMany({
    where: { productKind, isActive: true, quantity: { gt: 0 } },
    take: 300,
  });
  for (const item of items) {
    const score = scoreSpecs(productKind, specs, specsRecord(item.specs));
    if (!score) continue;
    const label = formatSpecsLabel(productKind, specsRecord(item.specs));
    await upsertMatch({
      dedupeKey: `buy_inv:${buyRequestId}:${item.id}`,
      kind: 'BUY_INVENTORY',
      score,
      buyRequestId,
      inventoryItemId: item.id,
      title: score === 'EXACT' ? 'موجودی منطبق با خرید' : 'موجودی مشابه خرید',
      body: `${label} در انبار موجود است (تعداد: ${item.quantity}).`,
    });
  }
}

export async function runInventoryMatching(inventoryItemId: string) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!item || !item.isActive || item.quantity <= 0) return;
  const specs = specsRecord(item.specs);
  const buys = await prisma.tradeRequest.findMany({
    where: {
      side: 'BUY',
      productKind: item.productKind,
      status: { in: ['OPEN', 'MATCHED'] },
    },
    take: 200,
  });
  for (const buy of buys) {
    const score = scoreSpecs(item.productKind, specsRecord(buy.specs), specs);
    if (!score) continue;
    const label = formatSpecsLabel(item.productKind, specs);
    await upsertMatch({
      dedupeKey: `buy_inv:${buy.id}:${item.id}`,
      kind: 'BUY_INVENTORY',
      score,
      buyRequestId: buy.id,
      inventoryItemId: item.id,
      title: score === 'EXACT' ? 'موجودی منطبق با خرید' : 'موجودی مشابه خرید',
      body: `${label} برای یک درخواست خرید باز موجود شد.`,
    });
  }
}

import prisma from '../config/database';
import { AppError } from '../utils/errors';

const PUBLIC_PAGE = 8;
const ADMIN_PAGE = 20;

function displayName(user: { firstName: string | null; lastName: string | null }) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || 'مشتری';
}

function roundAvg(value: number) {
  return Math.round(value * 10) / 10;
}

export class ReviewService {
  private async productBySlug(slug: string) {
    const product = await prisma.product.findFirst({
      where: { slug, isActive: true },
      select: { id: true, ratingAvg: true, ratingCount: true },
    });
    if (!product) throw new AppError(404, 'محصول یافت نشد');
    return product;
  }

  private async refreshSummary(
    productId: string,
    tx: Pick<typeof prisma, 'productReview' | 'product'> = prisma,
  ) {
    const agg = await tx.productReview.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const ratingCount = agg._count._all;
    const ratingAvg = ratingCount ? roundAvg(agg._avg.rating ?? 0) : 0;
    await tx.product.update({
      where: { id: productId },
      data: { ratingAvg, ratingCount },
    });
    return { ratingAvg, ratingCount };
  }

  async list(slug: string, page = 1) {
    const product = await this.productBySlug(slug);
    const current = Math.max(page, 1);
    const skip = (current - 1) * PUBLIC_PAGE;
    const where = { productId: product.id };
    const [rows, total] = await Promise.all([
      prisma.productReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: PUBLIC_PAGE,
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
      prisma.productReview.count({ where }),
    ]);

    return {
      summary: {
        ratingAvg: roundAvg(product.ratingAvg),
        ratingCount: product.ratingCount,
      },
      reviews: rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        body: row.body,
        createdAt: row.createdAt,
        authorName: displayName(row.user),
      })),
      pagination: {
        page: current,
        limit: PUBLIC_PAGE,
        total,
        pages: Math.max(1, Math.ceil(total / PUBLIC_PAGE)),
      },
    };
  }

  async mine(slug: string, userId: string) {
    const product = await this.productBySlug(slug);
    const row = await prisma.productReview.findUnique({
      where: { productId_userId: { productId: product.id, userId } },
    });
    if (!row) return null;
    return {
      id: row.id,
      rating: row.rating,
      body: row.body,
      createdAt: row.createdAt,
    };
  }

  async save(slug: string, userId: string, rating: number, body: string) {
    const product = await this.productBySlug(slug);
    const clean = body.trim().slice(0, 500);
    return prisma.$transaction(async (tx) => {
      const row = await tx.productReview.upsert({
        where: { productId_userId: { productId: product.id, userId } },
        create: { productId: product.id, userId, rating, body: clean },
        update: { rating, body: clean },
      });
      const summary = await this.refreshSummary(product.id, tx);
      return {
        review: {
          id: row.id,
          rating: row.rating,
          body: row.body,
          createdAt: row.createdAt,
        },
        summary,
      };
    });
  }

  async removeMine(slug: string, userId: string) {
    const product = await this.productBySlug(slug);
    return prisma.$transaction(async (tx) => {
      const existing = await tx.productReview.findUnique({
        where: { productId_userId: { productId: product.id, userId } },
      });
      if (!existing) throw new AppError(404, 'نظری برای حذف نیست');
      await tx.productReview.delete({ where: { id: existing.id } });
      return this.refreshSummary(product.id, tx);
    });
  }

  async adminList(page = 1) {
    const current = Math.max(page, 1);
    const skip = (current - 1) * ADMIN_PAGE;
    const [rows, total] = await Promise.all([
      prisma.productReview.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: ADMIN_PAGE,
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } },
          product: { select: { name: true, slug: true } },
        },
      }),
      prisma.productReview.count(),
    ]);

    return {
      reviews: rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        body: row.body,
        createdAt: row.createdAt,
        authorName: displayName(row.user),
        phone: row.user.phone,
        productName: row.product.name,
        productSlug: row.product.slug,
      })),
      pagination: {
        page: current,
        limit: ADMIN_PAGE,
        total,
        pages: Math.max(1, Math.ceil(total / ADMIN_PAGE)),
      },
    };
  }

  async adminRemove(id: string) {
    const row = await prisma.productReview.findUnique({ where: { id } });
    if (!row) throw new AppError(404, 'نظر یافت نشد');
    await prisma.$transaction(async (tx) => {
      await tx.productReview.delete({ where: { id } });
      await this.refreshSummary(row.productId, tx);
    });
  }
}

export const reviewService = new ReviewService();

import prisma from '../config/database';
import { AppError } from '../utils/errors';

export class ContentService {
  async getAll() {
    return prisma.contentPage.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async getPublishedBySlug(slug: string) {
    const page = await prisma.contentPage.findFirst({
      where: { slug, isPublished: true },
    });
    if (!page) throw new AppError(404, 'صفحه یافت نشد');
    return page;
  }

  async getBySlug(slug: string) {
    const page = await prisma.contentPage.findUnique({ where: { slug } });
    if (!page) throw new AppError(404, 'صفحه یافت نشد');
    return page;
  }

  async upsert(data: { slug: string; title: string; body: string; isPublished?: boolean }) {
    return prisma.contentPage.upsert({
      where: { slug: data.slug },
      update: {
        title: data.title,
        body: data.body,
        isPublished: data.isPublished ?? true,
      },
      create: {
        slug: data.slug,
        title: data.title,
        body: data.body,
        isPublished: data.isPublished ?? true,
      },
    });
  }

  async delete(slug: string) {
    await this.getBySlug(slug);
    await prisma.contentPage.delete({ where: { slug } });
  }
}

export const contentService = new ContentService();

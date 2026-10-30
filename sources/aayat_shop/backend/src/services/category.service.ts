import prisma from '../config/database';
import { cacheGet, cacheSet, cacheDel } from '../config/redis';
import { AppError } from '../utils/errors';
import { slugify } from '../utils/helpers';

export class CategoryService {
  async getAll(includeInactive = false, lite = false) {
    const cacheKey = `categories:${includeInactive}:${lite ? 'lite' : 'full'}`;
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return cached;

    const categories = await prisma.category.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
      ...(lite
        ? {}
        : { include: { _count: { select: { products: { where: { isActive: true } } } } } }),
    });

    await cacheSet(cacheKey, categories, 600);
    return categories;
  }

  async getBySlug(slug: string) {
    const category = await prisma.category.findUnique({
      where: { slug, isActive: true },
    });
    if (!category) throw new AppError(404, 'دسته‌بندی یافت نشد');
    return category;
  }

  async create(data: { name: string; image?: string; sortOrder?: number }) {
    const slug = slugify(data.name);
    const category = await prisma.category.create({
      data: { ...data, slug },
    });
    await cacheDel('categories:*');
    return category;
  }

  async update(id: string, data: Record<string, unknown>) {
    const category = await prisma.category.update({ where: { id }, data });
    await cacheDel('categories:*');
    return category;
  }

  async delete(id: string) {
    const [primaryCount, linkedCount] = await Promise.all([
      prisma.product.count({ where: { categoryId: id } }),
      prisma.productCategory.count({ where: { categoryId: id } }),
    ]);
    if (primaryCount > 0 || linkedCount > 0) {
      throw new AppError(400, 'این دسته‌بندی دارای محصول است و قابل حذف نیست');
    }
    await prisma.category.delete({ where: { id } });
    await cacheDel('categories:*');
  }

  async reorder(items: { id: string; sortOrder: number }[]) {
    await prisma.$transaction(
      items.map((item) =>
        prisma.category.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
    await cacheDel('categories:*');
  }
}

export const categoryService = new CategoryService();

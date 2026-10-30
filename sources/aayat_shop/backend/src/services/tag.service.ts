import prisma from '../config/database';
import { cacheDel, cacheGet, cacheSet } from '../config/redis';
import { AppError } from '../utils/errors';
import { slugify } from '../utils/helpers';

export class TagService {
  async getAll(categoryId?: string) {
    const cacheKey = `tags:${categoryId ?? 'all'}`;
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return cached;

    const tags = await prisma.tag.findMany({
      where: categoryId ? { categoryId } : {},
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });

    await cacheSet(cacheKey, tags, 600);
    return tags;
  }

  async getByCategorySlug(categorySlug: string) {
    const cacheKey = `tags-by-category:${categorySlug}`;
    const cached = await cacheGet<{ category: unknown; tags: unknown[] }>(cacheKey);
    if (cached) return cached;

    const category = await prisma.category.findUnique({
      where: { slug: categorySlug, isActive: true },
    });
    if (!category) throw new AppError(404, 'دسته‌بندی یافت نشد');

    const tags = await prisma.tag.findMany({
      where: { categoryId: category.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });

    const result = { category, tags };
    await cacheSet(cacheKey, result, 600);
    return result;
  }

  async getById(id: string) {
    const tag = await prisma.tag.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!tag) throw new AppError(404, 'برچسب یافت نشد');
    return tag;
  }

  async create(data: {
    categoryId: string;
    name: string;
    icon?: string;
    sortOrder?: number;
  }) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new AppError(404, 'دسته‌بندی یافت نشد');

    const slug = slugify(data.name);
    const tag = await prisma.tag.create({
      data: { ...data, slug },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });

    await cacheDel('tags:*');
    await cacheDel('tags-by-category:*');
    await cacheDel('category-tag-groups:*');
    return tag;
  }

  async update(
    id: string,
    data: { name?: string; icon?: string | null; sortOrder?: number; categoryId?: string }
  ) {
    const updateData: Record<string, unknown> = { ...data };
    if (data.name) updateData.slug = slugify(data.name);

    const tag = await prisma.tag.update({
      where: { id },
      data: updateData,
      include: { category: { select: { id: true, name: true, slug: true } } },
    });

    await cacheDel('tags:*');
    await cacheDel('tags-by-category:*');
    await cacheDel('category-tag-groups:*');
    return tag;
  }

  async delete(id: string) {
    await prisma.productTag.deleteMany({ where: { tagId: id } });
    await prisma.product.updateMany({ where: { tagId: id }, data: { tagId: null } });
    await prisma.tag.delete({ where: { id } });
    await cacheDel('tags:*');
    await cacheDel('tags-by-category:*');
    await cacheDel('category-tag-groups:*');
  }
}

export const tagService = new TagService();

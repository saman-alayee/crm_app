import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { cacheDel, cacheGet, cacheSet } from '../config/redis';

type SliderPlacement = 'HOME_TOP' | 'HOME_MID';

type SliderBase = {
  id: string;
  title: string;
  image: string;
  mobileImage: string | null;
  linkUrl: string | null;
  sortOrder: number;
  placement: SliderPlacement;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SliderWithCategory = SliderBase & {
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
};

function normalizeSliderInput(data: {
  title?: string;
  image?: string;
  mobileImage?: string | null;
  linkUrl?: string | null;
  sortOrder?: number;
  placement?: SliderPlacement;
  categoryId?: string | null;
  isActive?: boolean;
}) {
  const placement = data.placement;
  const categoryId = data.categoryId === '' ? null : data.categoryId ?? null;

  if (placement === 'HOME_MID' && categoryId === null && data.categoryId !== undefined) {
    throw new AppError(400, 'برای اسلایدر میانی، انتخاب دسته الزامی است');
  }

  if (placement === 'HOME_TOP') {
    return { ...data, categoryId: null };
  }

  return { ...data, categoryId };
}

async function setSliderCategoryId(sliderId: string, categoryId: string | null) {
  await prisma.$executeRaw`
    UPDATE sliders SET categoryId = ${categoryId} WHERE id = ${sliderId}
  `;
}

async function enrichSliders(sliders: SliderBase[]): Promise<SliderWithCategory[]> {
  if (!sliders.length) return [];

  const ids = sliders.map((slider) => slider.id);
  const links = await prisma.$queryRaw<Array<{ id: string; categoryId: string | null }>>(
    Prisma.sql`SELECT id, categoryId FROM sliders WHERE id IN (${Prisma.join(ids)})`
  );
  const categoryIdBySlider = new Map(links.map((row) => [row.id, row.categoryId]));

  const categoryIds = [...new Set(links.map((row) => row.categoryId).filter(Boolean))] as string[];
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return sliders.map((slider) => {
    const categoryId = categoryIdBySlider.get(slider.id) ?? null;
    return {
      ...slider,
      categoryId,
      category: categoryId ? categoryById.get(categoryId) ?? null : null,
    };
  });
}

export class SliderService {
  async getPublic(placement?: SliderPlacement) {
    const cacheKey = `sliders:${placement || 'all'}`;
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return cached;

    const sliders = await prisma.slider.findMany({
      where: {
        isActive: true,
        ...(placement ? { placement } : {}),
      },
      orderBy: { sortOrder: 'asc' },
      take: 20,
    });

    const result = await enrichSliders(sliders);
    await cacheSet(cacheKey, result, 300);
    return result;
  }

  async getAll() {
    const sliders = await prisma.slider.findMany({
      orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }],
    });
    return enrichSliders(sliders);
  }

  async getById(id: string) {
    const slider = await prisma.slider.findUnique({ where: { id } });
    if (!slider) throw new AppError(404, 'اسلایدر یافت نشد');
    const [enriched] = await enrichSliders([slider]);
    return enriched;
  }

  async create(data: {
    title: string;
    image: string;
    mobileImage?: string | null;
    linkUrl?: string | null;
    sortOrder?: number;
    placement?: SliderPlacement;
    categoryId?: string | null;
    isActive?: boolean;
  }) {
    const normalized = normalizeSliderInput(data);
    if (normalized.placement === 'HOME_MID' && !normalized.categoryId) {
      throw new AppError(400, 'برای اسلایدر میانی، انتخاب دسته الزامی است');
    }

    const { categoryId } = normalized;
    const slider = await prisma.slider.create({
      data: {
        title: data.title,
        image: data.image,
        mobileImage: data.mobileImage || null,
        linkUrl: data.linkUrl ?? null,
        sortOrder: data.sortOrder ?? 0,
        placement: data.placement ?? 'HOME_TOP',
        isActive: data.isActive ?? true,
      },
    });
    await setSliderCategoryId(slider.id, categoryId ?? null);
    await cacheDel('sliders:*');
    return this.getById(slider.id);
  }

  async update(id: string, data: Record<string, unknown>) {
    const existing = await this.getById(id);
    const merged = {
      title: (data.title as string | undefined) ?? existing.title,
      image: (data.image as string | undefined) ?? existing.image,
      mobileImage:
        data.mobileImage !== undefined ? ((data.mobileImage as string | null) || null) : existing.mobileImage,
      linkUrl: data.linkUrl !== undefined ? (data.linkUrl as string | null) : existing.linkUrl,
      sortOrder: (data.sortOrder as number | undefined) ?? existing.sortOrder,
      placement: (data.placement as SliderPlacement | undefined) ?? existing.placement,
      categoryId:
        data.categoryId !== undefined ? (data.categoryId as string | null) : existing.categoryId,
      isActive: (data.isActive as boolean | undefined) ?? existing.isActive,
    };
    const normalized = normalizeSliderInput(merged);
    if (normalized.placement === 'HOME_MID' && !normalized.categoryId) {
      throw new AppError(400, 'برای اسلایدر میانی، انتخاب دسته الزامی است');
    }

    const { categoryId, ...updateData } = normalized;
    await prisma.slider.update({
      where: { id },
      data: updateData,
    });
    await setSliderCategoryId(id, categoryId ?? null);
    await cacheDel('sliders:*');
    return this.getById(id);
  }

  async delete(id: string) {
    await prisma.slider.delete({ where: { id } });
    await cacheDel('sliders:*');
  }
}

export const sliderService = new SliderService();

import prisma from '../config/database';
import { Prisma, CategoryFeedSortMode } from '@prisma/client';
import { cacheGet, cacheSet, cacheDel } from '../config/redis';
import { AppError } from '../utils/errors';
import { slugify } from '../utils/helpers';
import { searchTermVariants } from '../utils/normalize';

interface ProductFilters {
  categoryId?: string;
  categorySlug?: string;
  tagId?: string;
  ids?: string[];
  search?: string;
  barcode?: string;
  expiringBefore?: string;
  expiringAfter?: string;
  featured?: boolean;
  discounted?: boolean;
  homeDeal?: boolean;
  homeFeatured?: boolean;
  isNew?: boolean;
  /** When true, only products with stock > 0. */
  inStock?: boolean;
  /** Storefront listing bucket: discounted, newest slice, or the rest. */
  listing?: 'discount' | 'new' | 'other';
  /** newest | discount | bestsellers */
  sort?: string;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
  /** When set, overrides includeInactive and returns only this status. */
  isActive?: boolean;
}

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  tag: { select: { id: true, name: true, slug: true, icon: true } },
  productCategories: {
    include: { category: { select: { id: true, name: true, slug: true } } },
  },
  productTags: {
    include: {
      tag: { select: { id: true, name: true, slug: true, icon: true, categoryId: true } },
    },
  },
  images: { orderBy: { sortOrder: 'asc' as const } },
};

/** لیست‌ها / فید — بدون بار اضافه برای پنل و جزئیات کامل. */
const productListInclude = {
  category: { select: { id: true, name: true, slug: true } },
  tag: { select: { id: true, name: true, slug: true, icon: true } },
  images: { orderBy: { sortOrder: 'asc' as const }, take: 2 },
};

function uniqueIds(ids?: Array<string | null | undefined>) {
  return [...new Set((ids ?? []).map((id) => id?.trim()).filter(Boolean))] as string[];
}

function categoryFilter(categoryId: string) {
  return {
    OR: [{ categoryId }, { productCategories: { some: { categoryId } } }],
  };
}

function tagFilter(tagId: string) {
  return {
    OR: [{ tagId }, { productTags: { some: { tagId } } }],
  };
}

function textContains(value: string) {
  return { contains: value };
}

function buildSearchClause(search: string) {
  const terms = search
    .trim()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 1);

  if (!terms.length) return null;

  // Every word must match somewhere (AND of ORs). Previously all words were OR'd
  // together, so "ماست میهن" returned almost anything containing either word.
  return {
    AND: terms.map((term) => {
      const variants = searchTermVariants(term);
      return {
        OR: variants.flatMap((variant) => [
          { name: textContains(variant) },
          { description: textContains(variant) },
          { slug: textContains(variant) },
          { barcode: textContains(variant) },
          { category: { name: textContains(variant) } },
          { tag: { name: textContains(variant) } },
          { productCategories: { some: { category: { name: textContains(variant) } } } },
          { productTags: { some: { tag: { name: textContains(variant) } } } },
        ]),
      };
    }),
  };
}

function normalizeImages(images?: string[], image?: string | null): string[] {
  const list = (images?.length ? images : image ? [image] : [])
    .map((url) => url.trim())
    .filter(Boolean);
  return [...new Set(list)];
}

export class ProductService {
  async getAll(filters: ProductFilters = {}) {
    const {
      categoryId,
      categorySlug,
      tagId,
      ids,
      search,
      barcode,
      expiringBefore,
      expiringAfter,
      featured,
      discounted,
      homeDeal,
      homeFeatured,
      isNew,
      inStock,
      listing,
      sort,
      page = 1,
      limit = 20,
      includeInactive = false,
      isActive,
    } = filters;

    const where: Record<string, unknown> = {};
    const andFilters: Record<string, unknown>[] = [];

    if (typeof isActive === 'boolean') where.isActive = isActive;
    else if (!includeInactive) where.isActive = true;
    if (categoryId) andFilters.push(categoryFilter(categoryId));
    if (tagId) andFilters.push(tagFilter(tagId));
    if (ids?.length) where.id = { in: ids };
    if (categorySlug) {
      andFilters.push({
        OR: [
          { category: { slug: categorySlug } },
          { productCategories: { some: { category: { slug: categorySlug } } } },
        ],
      });
    }
    if (featured) where.isFeatured = true;
    if (isNew) where.isNew = true;
    if (inStock) where.stock = { gt: 0 };
    if (discounted || listing === 'discount') where.discountPrice = { not: null };
    if (homeDeal) where.isHomeDeal = true;
    if (homeFeatured) where.isHomeFeatured = true;
    if (barcode?.trim()) {
      const barcodeVariants = searchTermVariants(barcode.trim());
      andFilters.push({
        OR: barcodeVariants.map((variant) => ({ barcode: textContains(variant) })),
      });
    }
    if (expiringBefore || expiringAfter) {
      where.expiryDate = {
        ...(expiringAfter ? { gte: new Date(expiringAfter) } : {}),
        ...(expiringBefore ? { lte: new Date(`${expiringBefore}T23:59:59.999Z`) } : {}),
      };
    }
    if (search) {
      const searchClause = buildSearchClause(search);
      if (searchClause) andFilters.push(searchClause);
    }
    if (andFilters.length) where.AND = andFilters;

    const sortMode = this.normalizeSort(sort);
    const listingBucket = listing === 'new' || listing === 'other';
    const skipCache = Boolean(
      search || includeInactive || barcode || inStock || sortMode !== 'newest' || listingBucket
    );
    const cacheKey = `products:${JSON.stringify(filters)}`;
    if (!skipCache) {
      const cached = await cacheGet<unknown>(cacheKey);
      if (cached) return cached;
    }

    const curatedList = Boolean(homeDeal || homeFeatured || featured);
    const needsCustomSort = sortMode === 'discount' || sortMode === 'bestsellers' || listingBucket;

    if (needsCustomSort) {
      const allProducts = await prisma.product.findMany({
        where,
        include: productListInclude,
        orderBy: { createdAt: 'desc' },
      });
      const bucketed = listingBucket ? this.applyListingBucket(allProducts, listing) : allProducts;
      const ordered = sortMode === 'newest'
        ? bucketed
        : await this.applyCustomSort(bucketed, sortMode);
      const total = ordered.length;
      const pageItems = ordered.slice((page - 1) * limit, page * limit);
      return {
        products: pageItems.map((product) => this.formatProduct(product)),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      };
    }

    const orderBy = homeDeal
      ? [{ homeDealSort: 'asc' as const }, { createdAt: 'desc' as const }]
      : homeFeatured
        ? [{ homeFeaturedSort: 'asc' as const }, { createdAt: 'desc' as const }]
        : featured
          ? [{ homeFeaturedSort: 'asc' as const }, { createdAt: 'desc' as const }]
          : { createdAt: 'desc' as const };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: productListInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const formatted = products.map((product) => this.formatProduct(product));
    // Keep DB order for search/curated lists; discount-sort only for casual browsing.
    const result = {
      products: curatedList || search ? formatted : this.sortByDiscountPercent(formatted),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    if (!skipCache) {
      await cacheSet(cacheKey, result, 300);
    }
    return result;
  }

  private applyListingBucket<T extends { id: string; discountPrice: unknown | null }>(
    products: T[],
    listing: 'new' | 'other'
  ) {
    const freshCount = Math.max(1, Math.round(products.length * 0.2));
    const freshIds = new Set(products.slice(0, freshCount).map((product) => product.id));
    if (listing === 'new') return products.filter((product) => freshIds.has(product.id));
    return products.filter((product) => !freshIds.has(product.id) && product.discountPrice == null);
  }

  private normalizeSort(sort?: string): 'newest' | 'discount' | 'bestsellers' {
    if (sort === 'discount' || sort === 'bestsellers') return sort;
    return 'newest';
  }

  private async applyCustomSort<T extends { id: string; price: unknown; discountPrice: unknown | null; createdAt: Date }>(
    products: T[],
    sortMode: 'discount' | 'bestsellers'
  ): Promise<T[]> {
    if (sortMode === 'discount') {
      return [...products].sort((a, b) => {
        const aPct = this.rawDiscountPercent(a.price, a.discountPrice);
        const bPct = this.rawDiscountPercent(b.price, b.discountPrice);
        if (bPct !== aPct) return bPct - aPct;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    }

    const sales = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: products.map((product) => product.id) },
        order: { status: { notIn: ['CANCELLED'] } },
      },
      _sum: { quantity: true },
    });
    const soldById = new Map(sales.map((row) => [row.productId, row._sum.quantity ?? 0]));

    return [...products].sort((a, b) => {
      const soldDiff = (soldById.get(b.id) ?? 0) - (soldById.get(a.id) ?? 0);
      if (soldDiff !== 0) return soldDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  private rawDiscountPercent(price: unknown, discountPrice: unknown | null) {
    const p = Number(price);
    const d = discountPrice != null ? Number(discountPrice) : null;
    if (!d || !p || d >= p) return 0;
    return Math.round(((p - d) / p) * 100);
  }

  async getBySlug(slug: string) {
    const product = await prisma.product.findUnique({
      where: { slug, isActive: true },
      include: {
        ...productInclude,
        discounts: { where: { isActive: true } },
      },
    });
    if (!product) throw new AppError(404, 'محصول یافت نشد');
    return this.formatProduct(product);
  }

  async getById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) throw new AppError(404, 'محصول یافت نشد');
    return product;
  }

  async create(data: {
    name: string;
    description?: string;
    barcode?: string | null;
    productionDate?: string | Date | null;
    expiryDate?: string | Date | null;
    price: number;
    discountPrice?: number;
    stock: number;
    image?: string | null;
    images?: string[];
    unit?: string;
    categoryId?: string;
    categoryIds?: string[];
    tagId?: string | null;
    tagIds?: string[];
    isFeatured?: boolean;
    isNew?: boolean;
    isOldPrice?: boolean;
    isHomeDeal?: boolean;
    isHomeFeatured?: boolean;
  }) {
    const { images, image, productionDate, expiryDate, barcode, categoryIds, tagIds, ...rest } = data;
    const imageList = normalizeImages(images, image);
    const slug = slugify(data.name) + '-' + Date.now().toString(36);
    const resolvedCategoryIds = this.resolveCategoryIds(categoryIds, rest.categoryId);
    const resolvedTagIds = this.resolveTagIds(tagIds, rest.tagId);

    const product = await prisma.product.create({
      data: {
        ...rest,
        categoryId: resolvedCategoryIds[0],
        tagId: resolvedTagIds[0] ?? null,
        barcode: barcode?.trim() || null,
        productionDate: productionDate ? new Date(productionDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        slug,
        image: imageList[0] ?? null,
        images: {
          create: imageList.map((url, index) => ({ url, sortOrder: index })),
        },
      },
      include: productInclude,
    });

    await this.syncProductAssociations(product.id, resolvedCategoryIds, resolvedTagIds);

    await cacheDel('products:*');
    await cacheDel('home:*');
    return this.formatProduct(
      await prisma.product.findUniqueOrThrow({ where: { id: product.id }, include: productInclude })
    );
  }

  async update(id: string, data: Record<string, unknown>) {
    const { images, image, productionDate, expiryDate, barcode, categoryIds, tagIds, ...rest } = data;
    const updateData: Record<string, unknown> = { ...rest };

    const hasCategoryIds = categoryIds !== undefined || rest.categoryId !== undefined;
    const hasTagIds = tagIds !== undefined || rest.tagId !== undefined;
    const resolvedCategoryIds = hasCategoryIds
      ? this.resolveCategoryIds(categoryIds as string[] | undefined, rest.categoryId as string | undefined)
      : undefined;
    const resolvedTagIds = hasTagIds
      ? this.resolveTagIds(tagIds as string[] | undefined, rest.tagId as string | null | undefined)
      : undefined;

    if (resolvedCategoryIds !== undefined) {
      updateData.categoryId = resolvedCategoryIds[0];
    }
    if (resolvedTagIds !== undefined) {
      updateData.tagId = resolvedTagIds[0] ?? null;
    }

    if (barcode !== undefined) {
      updateData.barcode = typeof barcode === 'string' && barcode.trim() ? barcode.trim() : null;
    }
    if (productionDate !== undefined) {
      updateData.productionDate = productionDate ? new Date(String(productionDate)) : null;
    }
    if (expiryDate !== undefined) {
      updateData.expiryDate = expiryDate ? new Date(String(expiryDate)) : null;
    }

    if (images !== undefined || image !== undefined) {
      const imageList = normalizeImages(
        images as string[] | undefined,
        image as string | null | undefined
      );

      await prisma.productImage.deleteMany({ where: { productId: id } });
      if (imageList.length) {
        await prisma.productImage.createMany({
          data: imageList.map((url, index) => ({ productId: id, url, sortOrder: index })),
        });
      }

      updateData.image = imageList[0] ?? null;
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: productInclude,
    });

    if (resolvedCategoryIds !== undefined || resolvedTagIds !== undefined) {
      await this.syncProductAssociations(
        id,
        resolvedCategoryIds ?? (await this.getProductCategoryIds(id)),
        resolvedTagIds ?? (await this.getProductTagIds(id))
      );
    }

    await cacheDel('products:*');
    await cacheDel('home:*');
    return this.formatProduct(
      await prisma.product.findUniqueOrThrow({ where: { id }, include: productInclude })
    );
  }

  async delete(id: string) {
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    await cacheDel('products:*');
    await cacheDel('home:*');
  }

  async getHomePicks() {
    const [discounted, featured] = await Promise.all([
      prisma.product.findMany({
        where: { isHomeDeal: true },
        include: productListInclude,
        orderBy: [{ homeDealSort: 'asc' }, { createdAt: 'desc' }],
        take: 10,
      }),
      prisma.product.findMany({
        where: { isHomeFeatured: true },
        include: productListInclude,
        orderBy: [{ homeFeaturedSort: 'asc' }, { createdAt: 'desc' }],
        take: 10,
      }),
    ]);

    return {
      discounted: discounted.map((product) => this.formatProduct(product)),
      featured: featured.map((product) => this.formatProduct(product)),
    };
  }

  async setHomePicks(data: { discountedIds?: string[]; featuredIds?: string[] }) {
    const updateDiscounted = data.discountedIds !== undefined;
    const updateFeatured = data.featuredIds !== undefined;
    const discountedIds = updateDiscounted ? this.normalizeHomePickIds(data.discountedIds) : [];
    const featuredIds = updateFeatured ? this.normalizeHomePickIds(data.featuredIds) : [];

    await this.assertProductsExist([...new Set([...discountedIds, ...featuredIds])]);

    const operations = [
      ...(updateDiscounted
        ? [
            prisma.product.updateMany({
              where: { isHomeDeal: true },
              data: { isHomeDeal: false, homeDealSort: 0 },
            }),
            ...discountedIds.map((id, index) =>
              prisma.product.update({
                where: { id },
                data: { isHomeDeal: true, homeDealSort: index },
              })
            ),
          ]
        : []),
      ...(updateFeatured
        ? [
            prisma.product.updateMany({
              where: { isHomeFeatured: true },
              data: { isHomeFeatured: false, homeFeaturedSort: 0 },
            }),
            ...featuredIds.map((id, index) =>
              prisma.product.update({
                where: { id },
                data: { isHomeFeatured: true, homeFeaturedSort: index },
              })
            ),
          ]
        : []),
    ];

    if (operations.length) {
      await prisma.$transaction(operations);
    }

    await cacheDel('products:*');
    await cacheDel('home:*');
    return this.getHomePicks();
  }

  async getCategoryFeedPicks(categoryId: string) {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new AppError(404, 'دسته‌بندی یافت نشد');

    const picks = await prisma.categoryFeedProduct.findMany({
      where: { categoryId },
      orderBy: { sortOrder: 'asc' },
      include: { product: { include: productInclude } },
    });

    return {
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
      },
      feedSortMode: category.feedSortMode,
      products: picks
        .filter((row) => row.product.isActive)
        .map((row) => this.formatProduct(row.product)),
    };
  }

  async setCategoryFeedPicks(
    categoryId: string,
    data: { feedSortMode?: CategoryFeedSortMode; productIds?: string[] }
  ) {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new AppError(404, 'دسته‌بندی یافت نشد');

    const productIds =
      data.productIds !== undefined ? this.normalizeHomePickIds(data.productIds) : undefined;

    if (productIds !== undefined) {
      await this.assertProductsInCategory(categoryId, productIds);
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [];

    if (data.feedSortMode !== undefined) {
      operations.push(
        prisma.category.update({
          where: { id: categoryId },
          data: { feedSortMode: data.feedSortMode },
        })
      );
    }

    if (productIds !== undefined) {
      operations.push(prisma.categoryFeedProduct.deleteMany({ where: { categoryId } }));
      productIds.forEach((productId, index) => {
        operations.push(
          prisma.categoryFeedProduct.create({
            data: { categoryId, productId, sortOrder: index },
          })
        );
      });
    }

    if (operations.length) {
      await prisma.$transaction(operations);
    }

    await cacheDel('home:*');
    await cacheDel('categories:*');
    return this.getCategoryFeedPicks(categoryId);
  }

  private async assertProductsInCategory(categoryId: string, productIds: string[]) {
    if (!productIds.length) return;
    const count = await prisma.product.count({
      where: {
        id: { in: productIds },
        isActive: true,
        ...categoryFilter(categoryId),
      },
    });
    if (count !== productIds.length) {
      throw new AppError(400, 'برخی محصولات به این دسته‌بندی تعلق ندارند');
    }
  }

  private normalizeHomePickIds(ids?: string[]) {
    const unique = [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
    if (unique.length > 10) {
      throw new AppError(400, 'حداکثر ۱۰ محصول برای صفحه اول می‌توانید انتخاب کنید');
    }
    return unique;
  }

  private async assertProductsExist(ids: string[]) {
    if (!ids.length) return;
    const count = await prisma.product.count({ where: { id: { in: ids } } });
    if (count !== ids.length) {
      throw new AppError(400, 'یکی از محصولات انتخاب‌شده پیدا نشد');
    }
  }

  async getHomeSections() {
    const cacheKey = 'home:sections';
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return cached;

    const [featured, discounted, newProducts, homeDeals, homeFeatured] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, isFeatured: true },
        include: productListInclude,
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.findMany({
        where: { isActive: true, discountPrice: { not: null } },
        include: productListInclude,
        take: 8,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.product.findMany({
        where: { isActive: true, isNew: true },
        include: productListInclude,
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.findMany({
        where: { isActive: true, isHomeDeal: true },
        include: productListInclude,
        take: 10,
        orderBy: [{ homeDealSort: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.product.findMany({
        where: { isActive: true, isHomeFeatured: true },
        include: productListInclude,
        take: 10,
        orderBy: [{ homeFeaturedSort: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    const result = {
      featured: featured.map((product) => this.formatProduct(product)),
      discounted: discounted.map((product) => this.formatProduct(product)),
      newProducts: newProducts.map((product) => this.formatProduct(product)),
      homeDeals: homeDeals.map((product) => this.formatProduct(product)),
      homeFeatured: homeFeatured.map((product) => this.formatProduct(product)),
    };

    await cacheSet(cacheKey, result, 300);
    return result;
  }

  async getHomeFeed() {
    const cacheKey = 'home:feed';
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return cached;

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const categoryIds = categories.map((category) => category.id);
    if (categoryIds.length === 0) {
      await cacheSet(cacheKey, [], 300);
      return [];
    }

    const feedPickRows = await prisma.categoryFeedProduct.findMany({
      where: { categoryId: { in: categoryIds } },
      orderBy: { sortOrder: 'asc' },
      select: { categoryId: true, productId: true, sortOrder: true },
    });

    const rankedRows = await prisma.$queryRaw<Array<{ id: string; categoryId: string }>>(Prisma.sql`
      SELECT id, categoryId FROM (
        SELECT p.id, link.categoryId,
          ROW_NUMBER() OVER (PARTITION BY link.categoryId ORDER BY p.createdAt DESC) AS rn
        FROM products p
        INNER JOIN (
          SELECT id AS productId, categoryId FROM products WHERE categoryId IN (${Prisma.join(categoryIds)})
          UNION
          SELECT productId, categoryId FROM product_categories WHERE categoryId IN (${Prisma.join(categoryIds)})
        ) link ON link.productId = p.id
        WHERE p.isActive = true
      ) ranked
      WHERE rn <= 10
    `);

    const productIds = [
      ...new Set([...rankedRows.map((row) => row.id), ...feedPickRows.map((row) => row.productId)]),
    ];
    if (productIds.length === 0) {
      await cacheSet(cacheKey, [], 300);
      return [];
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: productListInclude,
    });

    const productById = new Map(products.map((product) => [product.id, product]));
    const productsByCategory = new Map<string, ReturnType<typeof this.formatProduct>[]>();
    const pickIdsByCategory = new Map<string, string[]>();

    for (const row of feedPickRows) {
      const list = pickIdsByCategory.get(row.categoryId) ?? [];
      list.push(row.productId);
      pickIdsByCategory.set(row.categoryId, list);
    }

    for (const row of rankedRows) {
      const product = productById.get(row.id);
      if (!product) continue;
      const list = productsByCategory.get(row.categoryId) ?? [];
      list.push(this.formatProduct(product));
      productsByCategory.set(row.categoryId, list);
    }

    const feed = categories
      .map((category) => {
        const pool = productsByCategory.get(category.id) ?? [];
        const products = this.orderCategoryFeedProducts(
          category.feedSortMode,
          pool,
          pickIdsByCategory.get(category.id) ?? [],
          productById
        );
        return {
          category: {
            id: category.id,
            name: category.name,
            slug: category.slug,
            image: category.image,
          },
          products,
        };
      })
      .filter((section) => section.products.length > 0);

    await cacheSet(cacheKey, feed, 300);
    return feed;
  }

  async getRelatedByTag(productSlug: string, limit = 8) {
    const product = await prisma.product.findUnique({
      where: { slug: productSlug, isActive: true },
      select: { id: true, tagId: true, categoryId: true },
    });
    if (!product) throw new AppError(404, 'محصول یافت نشد');

    const where: Record<string, unknown> = {
      isActive: true,
      id: { not: product.id },
    };

    if (product.tagId) {
      where.OR = [
        { tagId: product.tagId },
        { productTags: { some: { tagId: product.tagId } } },
      ];
    } else {
      Object.assign(where, categoryFilter(product.categoryId));
    }

    const related = await prisma.product.findMany({
      where,
      include: productListInclude,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return this.sortByDiscountPercent(related.map((p) => this.formatProduct(p)));
  }

  private orderCategoryFeedProducts(
    mode: CategoryFeedSortMode,
    pool: ReturnType<typeof this.formatProduct>[],
    pickIds: string[],
    productById: Map<string, Parameters<ProductService['formatProduct']>[0]>
  ) {
    const limit = 10;

    if (mode === CategoryFeedSortMode.MANUAL && pickIds.length > 0) {
      const picked = pickIds
        .map((id) => productById.get(id))
        .filter(Boolean)
        .map((product) => this.formatProduct(product!));
      const pickedSet = new Set(picked.map((product) => product.id));
      const fill = pool.filter((product) => !pickedSet.has(product.id));
      return [...picked, ...fill].slice(0, limit);
    }

    if (mode === CategoryFeedSortMode.NEWEST) {
      return pool.slice(0, limit);
    }

    return this.sortByDiscountPercent(pool).slice(0, limit);
  }

  private sortByDiscountPercent<T extends { discountPercent?: number; effectivePrice?: number }>(
    products: T[]
  ): T[] {
    return [...products].sort((a, b) => {
      const diff = (b.discountPercent ?? 0) - (a.discountPercent ?? 0);
      if (diff !== 0) return diff;
      return (a.effectivePrice ?? 0) - (b.effectivePrice ?? 0);
    });
  }

  formatProductPublic(product: Parameters<ProductService['formatProduct']>[0]) {
    return this.formatProduct(product);
  }

  private resolveCategoryIds(categoryIds?: string[], categoryId?: string) {
    const resolved = uniqueIds(categoryIds?.length ? categoryIds : categoryId ? [categoryId] : []);
    if (!resolved.length) {
      throw new AppError(400, 'حداقل یک دسته‌بندی لازم است');
    }
    return resolved;
  }

  private resolveTagIds(tagIds?: string[], tagId?: string | null) {
    return uniqueIds(tagIds?.length ? tagIds : tagId ? [tagId] : []);
  }

  private async getProductCategoryIds(productId: string) {
    const rows = await prisma.productCategory.findMany({
      where: { productId },
      select: { categoryId: true },
    });
    return rows.map((row) => row.categoryId);
  }

  private async getProductTagIds(productId: string) {
    const rows = await prisma.productTag.findMany({
      where: { productId },
      select: { tagId: true },
    });
    return rows.map((row) => row.tagId);
  }

  private async syncProductAssociations(
    productId: string,
    categoryIds: string[],
    tagIds: string[]
  ) {
    const uniqueCategoryIds = uniqueIds(categoryIds);
    const uniqueTagIds = uniqueIds(tagIds);

    if (!uniqueCategoryIds.length) {
      throw new AppError(400, 'حداقل یک دسته‌بندی لازم است');
    }

    await prisma.$transaction([
      prisma.productCategory.deleteMany({ where: { productId } }),
      prisma.productTag.deleteMany({ where: { productId } }),
      prisma.productCategory.createMany({
        data: uniqueCategoryIds.map((categoryId) => ({ productId, categoryId })),
      }),
      ...(uniqueTagIds.length
        ? [
            prisma.productTag.createMany({
              data: uniqueTagIds.map((tagId) => ({ productId, tagId })),
            }),
          ]
        : []),
      prisma.product.update({
        where: { id: productId },
        data: {
          categoryId: uniqueCategoryIds[0],
          tagId: uniqueTagIds[0] ?? null,
        },
      }),
    ]);
  }

  private formatProduct(product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    barcode?: string | null;
    productionDate?: Date | null;
    expiryDate?: Date | null;
    price: unknown;
    discountPrice: unknown | null;
    stock: number;
    image: string | null;
    unit: string | null;
    isActive: boolean;
    isFeatured: boolean;
    isNew: boolean;
    isOldPrice: boolean;
    isHomeDeal?: boolean;
    homeDealSort?: number;
    isHomeFeatured?: boolean;
    homeFeaturedSort?: number;
    categoryId: string;
    tagId?: string | null;
    category?: { id: string; name: string; slug: string };
    tag?: { id: string; name: string; slug: string; icon: string | null } | null;
    productCategories?: Array<{ category: { id: string; name: string; slug: string } }>;
    productTags?: Array<{
      tag: { id: string; name: string; slug: string; icon: string | null; categoryId: string };
    }>;
    images?: { url: string; sortOrder: number }[];
    createdAt: Date;
    updatedAt: Date;
    ratingAvg?: number | null;
    ratingCount?: number | null;
  }) {
    const price = Number(product.price);
    const discountPrice = product.discountPrice ? Number(product.discountPrice) : null;
    const effectivePrice = discountPrice ?? price;
    const discountPercent =
      discountPrice && price > 0 ? Math.round(((price - discountPrice) / price) * 100) : 0;
    const imageUrls = product.images?.map((item) => item.url) ?? [];
    const images = imageUrls.length ? imageUrls : product.image ? [product.image] : [];
    const primaryImage = images[0] ?? null;
    const categories =
      product.productCategories?.map((item) => item.category) ??
      (product.category ? [product.category] : []);
    const tags =
      product.productTags?.map((item) => item.tag) ??
      (product.tag ? [product.tag] : []);
    const categoryIds = categories.map((item) => item.id);
    const tagIds = tags.map((item) => item.id);
    const primaryCategory = categories[0] ?? product.category ?? null;
    const primaryTag = tags[0] ?? product.tag ?? null;

    const { productCategories, productTags, category, tag, ...restProduct } = product;

    return {
      ...restProduct,
      image: primaryImage,
      images,
      price,
      discountPrice,
      effectivePrice,
      discountPercent,
      inStock: product.stock > 0,
      ratingAvg: Math.round(Number(product.ratingAvg ?? 0) * 10) / 10,
      ratingCount: Number(product.ratingCount ?? 0),
      categories,
      tags,
      categoryIds,
      tagIds,
      category: primaryCategory,
      tag: primaryTag,
      categoryId: primaryCategory?.id ?? product.categoryId,
      tagId: primaryTag?.id ?? product.tagId ?? null,
    };
  }
}

export const productService = new ProductService();

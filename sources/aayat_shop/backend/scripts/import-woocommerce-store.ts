/**
 * Import WooCommerce catalog from aaytay.ir (read-only GET — WordPress is not modified).
 *
 * Usage:
 *   npx tsx scripts/import-woocommerce-store.ts
 *   npx tsx scripts/import-woocommerce-store.ts --remove-demo
 *
 * Env:
 *   WP_STORE_BASE_URL=https://aaytay.ir  (optional)
 */
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WP_BASE = (process.env.WP_STORE_BASE_URL ?? 'https://aaytay.ir').replace(/\/$/, '');
const PER_PAGE = 100;
const REMOVE_DEMO = process.argv.includes('--remove-demo');
const KEEP_REMOTE_URLS = process.argv.includes('--keep-remote-urls');
const DOWNLOAD_ONLY = process.argv.includes('--download-only');

const UPLOAD_ROOT = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
const WC_MEDIA_DIR = path.join(UPLOAD_ROOT, 'wc');
const DOWNLOAD_IMAGES = !KEEP_REMOTE_URLS;

const remoteToLocal = new Map<string, string>();

const DEMO_CATEGORY_SLUGS = new Set(['zanane', 'mardane', 'dokhtarane', 'pesarane']);

type WpProductCategory = {
  id: number;
  name: string;
  slug: string;
  parent: number;
  menu_order: number;
  count: number;
};

type StorePrices = {
  price: string;
  regular_price: string;
  sale_price: string;
};

type StoreProduct = {
  id: number;
  name: string;
  slug: string;
  type: string;
  description: string;
  short_description: string;
  on_sale: boolean;
  prices: StorePrices;
  images: Array<{ src: string; thumbnail?: string }>;
  categories: Array<{ id: number; name: string; slug: string }>;
  is_in_stock: boolean;
  low_stock_remaining: number | null;
};

async function fetchJson<T>(url: string): Promise<{ data: T; total: number; totalPages: number }> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'aayat-shop-import/1.0' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${url}\n${body.slice(0, 400)}`);
  }
  const total = Number(res.headers.get('X-WP-Total') ?? '0');
  const totalPages = Number(res.headers.get('X-WP-TotalPages') ?? '1');
  const data = (await res.json()) as T;
  return { data, total, totalPages };
}

async function fetchAllPages<T>(buildUrl: (page: number) => string): Promise<T[]> {
  const first = await fetchJson<T[]>(buildUrl(1));
  const rows = Array.isArray(first.data) ? [...first.data] : [];
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await fetchJson<T[]>(buildUrl(page));
    if (Array.isArray(next.data)) rows.push(...next.data);
  }
  return rows;
}

function parsePriceToman(raw: string | undefined): number {
  const n = parseInt(String(raw ?? '0').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function pickStock(p: StoreProduct): number {
  if (typeof p.low_stock_remaining === 'number' && p.low_stock_remaining > 0) {
    return p.low_stock_remaining;
  }
  return p.is_in_stock ? 10 : 0;
}

function primaryDescription(p: StoreProduct): string | null {
  const html = (p.description || p.short_description || '').trim();
  return html || null;
}

function safeBasename(url: string): string {
  try {
    const base = path.basename(new URL(url).pathname);
    return base.replace(/[^a-zA-Z0-9._-]/g, '_') || 'image';
  } catch {
    return 'image';
  }
}

async function downloadProductImage(remoteUrl: string): Promise<string> {
  if (!remoteUrl.startsWith('http')) return remoteUrl;

  const cached = remoteToLocal.get(remoteUrl);
  if (cached) return cached;

  const hash = crypto.createHash('sha1').update(remoteUrl).digest('hex').slice(0, 12);
  const ext = path.extname(safeBasename(remoteUrl)) || '.webp';
  const filename = `${hash}-${safeBasename(remoteUrl)}`.slice(0, 180);
  const rel = `/uploads/wc/${filename}`;
  const abs = path.join(WC_MEDIA_DIR, filename);

  if (fs.existsSync(abs)) {
    remoteToLocal.set(remoteUrl, rel);
    return rel;
  }

  fs.mkdirSync(WC_MEDIA_DIR, { recursive: true });

  const res = await fetch(remoteUrl, {
    headers: { 'User-Agent': 'aayat-shop-import/1.0', Accept: 'image/*' },
  });
  if (!res.ok) {
    console.warn(`Image download failed ${res.status}: ${remoteUrl}`);
    return remoteUrl;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 32) {
    console.warn(`Image too small, skip: ${remoteUrl}`);
    return remoteUrl;
  }

  fs.writeFileSync(abs, buf);
  remoteToLocal.set(remoteUrl, rel);
  return rel;
}

async function localizeImageUrls(urls: string[]): Promise<string[]> {
  if (!DOWNLOAD_IMAGES) return urls;
  const out: string[] = [];
  for (const url of urls) {
    out.push(await downloadProductImage(url));
  }
  return out;
}

async function localizeExistingCatalogImages() {
  const products = await prisma.product.findMany({
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  });

  let files = 0;
  for (const p of products) {
    let main = p.image;
    if (main?.startsWith('http')) {
      main = await downloadProductImage(main);
      files += 1;
    }

    for (const img of p.images) {
      if (!img.url.startsWith('http')) continue;
      const local = await downloadProductImage(img.url);
      if (local !== img.url) {
        await prisma.productImage.update({ where: { id: img.id }, data: { url: local } });
        files += 1;
      }
    }

    if (main !== p.image) {
      await prisma.product.update({ where: { id: p.id }, data: { image: main } });
    }
  }

  console.log(`Localized images for ${products.length} products (downloads/cache hits: ${files})`);
}

async function assignCategoryCoverImages() {
  const categories = await prisma.category.findMany();
  let updated = 0;

  for (const cat of categories) {
    if (cat.image?.startsWith('/uploads/')) continue;

    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        image: { not: null },
        OR: [{ categoryId: cat.id }, { productCategories: { some: { categoryId: cat.id } } }],
      },
      orderBy: { updatedAt: 'desc' },
      select: { image: true },
    });

    if (product?.image) {
      await prisma.category.update({ where: { id: cat.id }, data: { image: product.image } });
      updated += 1;
    }
  }

  console.log(`Category cover images set: ${updated}/${categories.length}`);
}

async function removeDemoCatalog() {
  const demoProducts = await prisma.product.findMany({
    where: { slug: { startsWith: 'demo-' } },
    select: { id: true },
  });
  const demoIds = demoProducts.map((p) => p.id);
  if (demoIds.length) {
    await prisma.productImage.deleteMany({ where: { productId: { in: demoIds } } });
    await prisma.productCategory.deleteMany({ where: { productId: { in: demoIds } } });
    await prisma.productTag.deleteMany({ where: { productId: { in: demoIds } } });
    await prisma.categoryFeedProduct.deleteMany({ where: { productId: { in: demoIds } } });
    await prisma.product.deleteMany({ where: { id: { in: demoIds } } });
  }

  await prisma.category.deleteMany({
    where: { slug: { in: [...DEMO_CATEGORY_SLUGS] } },
  });

  console.log(`Removed demo products=${demoIds.length} demo categories=${DEMO_CATEGORY_SLUGS.size}`);
}

async function importCategories(): Promise<Map<number, string>> {
  const wpCats = await fetchAllPages<WpProductCategory>((page) =>
    `${WP_BASE}/wp-json/wp/v2/product_cat?per_page=${PER_PAGE}&page=${page}`,
  );

  wpCats.sort((a, b) => a.parent - b.parent || a.menu_order - b.menu_order || a.id - b.id);

  const wpIdToDbId = new Map<number, string>();

  for (const cat of wpCats) {
    const saved = await prisma.category.upsert({
      where: { slug: cat.slug },
      create: {
        name: cat.name,
        slug: cat.slug,
        sortOrder: cat.menu_order || cat.id,
        isActive: cat.count > 0,
      },
      update: {
        name: cat.name,
        sortOrder: cat.menu_order || cat.id,
        isActive: cat.count > 0,
      },
    });
    wpIdToDbId.set(cat.id, saved.id);
  }

  writeCategoryParentMap(wpCats);

  console.log(`Categories upserted: ${wpCats.length}`);
  return wpIdToDbId;
}

function writeCategoryParentMap(wpCats: WpProductCategory[]) {
  const byId = Object.fromEntries(wpCats.map((c) => [c.id, c.slug]));
  const out: Record<string, string | null> = {};
  for (const cat of wpCats) {
    out[cat.slug] = cat.parent ? byId[cat.parent] ?? null : null;
  }
  const dest = path.join(process.cwd(), '../frontend/constants/wpCategoryParents.json');
  fs.writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
}

async function importProducts(categoryByWpId: Map<number, string>) {
  const products = await fetchAllPages<StoreProduct>((page) =>
    `${WP_BASE}/wp-json/wc/store/v1/products?per_page=${PER_PAGE}&page=${page}`,
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of products) {
    const wpCats = p.categories ?? [];
    const primaryWp = wpCats.length ? wpCats[wpCats.length - 1] : null;
    let categoryId = primaryWp ? categoryByWpId.get(primaryWp.id) : undefined;

    if (!categoryId) {
      const fallback = categoryByWpId.get(15);
      if (!fallback) {
        skipped += 1;
        console.warn(`Skip ${p.slug}: no category`);
        continue;
      }
      categoryId = fallback;
    }

    const regular = parsePriceToman(p.prices?.regular_price ?? p.prices?.price);
    const sale = parsePriceToman(p.prices?.sale_price);
    const onSale = Boolean(p.on_sale && sale > 0 && sale < regular);
    const price = regular || parsePriceToman(p.prices?.price);
    const discountPrice = onSale ? sale : null;

    const remoteImages = (p.images ?? []).map((img) => img.src).filter(Boolean);
    const images = await localizeImageUrls(remoteImages);
    const mainImage = images[0] ?? null;

    const existing = await prisma.product.findUnique({ where: { slug: p.slug }, select: { id: true } });

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        name: p.name,
        slug: p.slug,
        description: primaryDescription(p),
        price,
        discountPrice,
        stock: pickStock(p),
        image: mainImage,
        categoryId,
        isActive: true,
        isFeatured: false,
        isNew: true,
      },
      update: {
        name: p.name,
        description: primaryDescription(p),
        price,
        discountPrice,
        stock: pickStock(p),
        image: mainImage,
        categoryId,
        isActive: true,
      },
    });

    if (existing) updated += 1;
    else created += 1;

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    if (images.length) {
      await prisma.productImage.createMany({
        data: images.map((url, sortOrder) => ({
          productId: product.id,
          url,
          sortOrder,
        })),
      });
    }

    await prisma.productCategory.deleteMany({ where: { productId: product.id } });
    const dbCategoryIds = [
      ...new Set(
        wpCats
          .map((c) => categoryByWpId.get(c.id))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (dbCategoryIds.length) {
      await prisma.productCategory.createMany({
        data: dbCategoryIds.map((categoryId) => ({ productId: product.id, categoryId })),
      });
    } else {
      await prisma.productCategory.create({
        data: { productId: product.id, categoryId },
      });
    }
  }

  console.log(
    `Products done: total=${products.length} created=${created} updated=${updated} skipped=${skipped}`,
  );
}

async function main() {
  console.log(
    `Import from ${WP_BASE} (read-only) downloadImages=${DOWNLOAD_IMAGES} downloadOnly=${DOWNLOAD_ONLY}`,
  );

  if (DOWNLOAD_ONLY) {
    await localizeExistingCatalogImages();
    await assignCategoryCoverImages();
    console.log('IMPORT_OK');
    return;
  }

  if (REMOVE_DEMO) await removeDemoCatalog();

  const categoryByWpId = await importCategories();
  await importProducts(categoryByWpId);
  await assignCategoryCoverImages();

  console.log('IMPORT_OK');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

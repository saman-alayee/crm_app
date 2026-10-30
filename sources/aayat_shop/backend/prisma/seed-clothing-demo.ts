/**
 * داده نمایشی پوشاک — بعد از migrate فیلد clothingMeta اجرا کنید:
 * npx tsx prisma/seed-clothing-demo.ts
 */
import { PrismaClient, SliderPlacement } from '@prisma/client';

const prisma = new PrismaClient();

const U = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const categories = [
  { name: 'لباس زنانه', slug: 'zanane', sortOrder: 1, image: U('photo-1515886657613-9f3515b0c78f', 600) },
  { name: 'لباس مردانه', slug: 'mardane', sortOrder: 2, image: U('photo-1617137984095-74e4e900912f', 600) },
  { name: 'لباس دخترانه', slug: 'dokhtarane', sortOrder: 3, image: U('photo-1503454537847-545d3693a9d8', 600) },
  { name: 'لباس پسرانه', slug: 'pesarane', sortOrder: 4, image: U('photo-1503341457803-00acfb2793b7', 600) },
];

type Prod = {
  slug: string;
  name: string;
  categorySlug: string;
  price: number;
  discountPrice?: number;
  stock: number;
  unit: string;
  description: string;
  image: string;
  isFeatured?: boolean;
  isNew?: boolean;
  isHomeDeal?: boolean;
  isHomeFeatured?: boolean;
  clothingMeta?: object;
};

const products: Prod[] = [
  {
    slug: 'demo-kot-zanane-ava',
    name: 'کت کوتاه زنانه مدل آوا',
    categorySlug: 'zanane',
    price: 2890000,
    discountPrice: 2450000,
    stock: 12,
    unit: 'پنبه ۸۰٪',
    description: 'کت کوتاه اسپرت با آستر نرم.',
    image: U('photo-1594633312681-425c7b2ccd40'),
    isFeatured: true,
    isNew: true,
    isHomeDeal: true,
    isHomeFeatured: true,
    clothingMeta: {
      fabric: 'پنبه ۸۰٪',
      sizes: ['S', 'M', 'L', 'XL'],
      colors: [{ name: 'مشکی', hex: '#1a1a1a' }],
    },
  },
  {
    slug: 'demo-jeans-mardane',
    name: 'شلوار جین مردانه اسلیم',
    categorySlug: 'mardane',
    price: 1980000,
    discountPrice: 1750000,
    stock: 18,
    unit: 'دنیم',
    description: 'جین اسلیم فیت.',
    image: U('photo-1542272604-787c683553e0'),
    isHomeDeal: true,
    isHomeFeatured: true,
  },
  {
    slug: 'demo-jogger-pesarane',
    name: 'شلوار جاگر پسرانه',
    categorySlug: 'pesarane',
    price: 920000,
    discountPrice: 790000,
    stock: 16,
    unit: 'پنبه',
    description: 'جاگر راحتی.',
    image: U('photo-1503454537847-545d3693a9d8'),
    isNew: true,
    isHomeDeal: true,
  },
];

async function main() {
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { ...cat, isActive: true },
      create: { ...cat, isActive: true },
    });
  }

  await prisma.slider.deleteMany({});
  await prisma.slider.createMany({
    data: [
      {
        title: 'کالکشن پاییز',
        image: U('photo-1483985988355-763728fa1637', 1600),
        linkUrl: '/categories/zanane',
        sortOrder: 1,
        placement: SliderPlacement.HOME_TOP,
        isActive: true,
      },
      {
        title: 'استایل مردانه',
        image: U('photo-1490481651871-ab68de25d43d', 1600),
        linkUrl: '/categories/mardane',
        sortOrder: 2,
        placement: SliderPlacement.HOME_TOP,
        isActive: true,
      },
      {
        title: 'جدیدترین‌ها',
        image: U('photo-1539109136881-3be0616acf4b', 1600),
        linkUrl: '/search?sort=newest',
        sortOrder: 3,
        placement: SliderPlacement.HOME_TOP,
        isActive: true,
      },
    ],
  });

  for (const prod of products) {
    const category = await prisma.category.findUnique({ where: { slug: prod.categorySlug } });
    if (!category) continue;
    const { categorySlug, clothingMeta, image, ...rest } = prod;
    await prisma.product.upsert({
      where: { slug: prod.slug },
      update: {
        ...rest,
        categoryId: category.id,
        image,
        clothingMeta: clothingMeta ?? undefined,
        isActive: true,
      },
      create: {
        ...rest,
        categoryId: category.id,
        image,
        clothingMeta: clothingMeta ?? undefined,
        isActive: true,
      },
    });
    const saved = await prisma.product.findUnique({ where: { slug: prod.slug }, include: { images: true } });
    if (saved && image && saved.images.length === 0) {
      await prisma.productImage.create({ data: { productId: saved.id, url: image, sortOrder: 0 } });
    }
  }

  console.log('✅ Clothing demo seed done');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

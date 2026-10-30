import type { Category, HomeCategorySection, Product, Slider } from '~/types';
import { demoMediaUrl } from '~/utils/productMedia';

/** تصاویر فیک محلی `/demo-img` — همیشه از Nuxt لود می‌شوند (صفحه اصلی و دمو). */
const D = (key: string, w: number, h: number) => demoMediaUrl(key, w, h);

function productPhotos(baseKey: string) {
  const primary = D(`${baseKey}-primary`, 534, 800);
  const hover = D(`${baseKey}-hover`, 534, 800);
  return { image: primary, images: [primary, hover] };
}

const P = {
  kotAva: productPhotos('demo-kot-zanane-ava'),
  hoodi: productPhotos('demo-hoodi-zanane'),
  topBandi: productPhotos('demo-top-bandi-zanane'),
  jeans: productPhotos('demo-jeans-mardane'),
  shirtOxford: productPhotos('demo-shirt-mardane-oxford'),
  kapson: productPhotos('demo-kapson-mardane'),
  dress: productPhotos('demo-dress-dokhtarane'),
  setSport: productPhotos('demo-set-dokhtarane'),
  jogger: productPhotos('demo-jogger-pesarane'),
  tshirt: productPhotos('demo-tshirt-pesarane'),
  sneakers: productPhotos('demo-sneakers-zanane'),
  headband: productPhotos('demo-headband-zanane'),
} as const;

export const DEMO_SLIDERS: Slider[] = [
  {
    id: 'demo-slider-1',
    title: 'کالکشن پاییز',
    image: D('slider-home-1', 1920, 1080),
    linkUrl: '/categories/zanane',
    sortOrder: 1,
    placement: 'HOME_TOP',
    isActive: true,
  },
  {
    id: 'demo-slider-2',
    title: 'استایل مردانه',
    image: D('slider-home-2', 1920, 1080),
    linkUrl: '/categories/mardane',
    sortOrder: 2,
    placement: 'HOME_TOP',
    isActive: true,
  },
  {
    id: 'demo-slider-3',
    title: 'جدیدترین‌ها',
    image: D('slider-home-3', 1920, 1080),
    linkUrl: '/search?sort=newest',
    sortOrder: 3,
    placement: 'HOME_TOP',
    isActive: true,
  },
];

export const DEMO_CATEGORIES: Category[] = [
  {
    id: 'demo-cat-women',
    name: 'لباس زنانه',
    slug: 'zanane',
    image: D('category-zanane', 800, 800),
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'demo-cat-girls',
    name: 'لباس دخترانه',
    slug: 'dokhtarane',
    image: D('category-dokhtarane', 800, 800),
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 'demo-cat-boys',
    name: 'لباس پسرانه',
    slug: 'pesarane',
    image: D('category-pesarane', 800, 800),
    sortOrder: 3,
    isActive: true,
  },
  {
    id: 'demo-cat-men',
    name: 'لباس مردانه',
    slug: 'mardane',
    image: D('category-mardane', 800, 800),
    sortOrder: 4,
    isActive: true,
  },
];

function p(partial: Product): Product {
  return partial;
}

export const DEMO_PRODUCTS: Product[] = [
  p({
    id: 'demo-p1',
    name: 'کت کوتاه زنانه مدل آوا',
    slug: 'demo-kot-zanane-ava',
    description: 'کت کوتاه اسپرت با آستر نرم، مناسب پاییز و استایل روزمره.',
    price: 2_890_000,
    discountPrice: 2_450_000,
    effectivePrice: 2_450_000,
    discountPercent: 15,
    stock: 12,
    ...P.kotAva,
    unit: 'پنبه ۸۰٪',
    isActive: true,
    isFeatured: true,
    isNew: true,
    isOldPrice: false,
    isHomeDeal: true,
    isHomeFeatured: true,
    categoryId: 'demo-cat-women',
    category: { id: 'demo-cat-women', name: 'لباس زنانه', slug: 'zanane' },
    inStock: true,
    clothingMeta: {
      fabric: 'پنبه ۸۰٪، پلی‌استر ۲۰٪',
      sizes: ['S', 'M', 'L', 'XL'],
      colors: [
        { name: 'مشکی', hex: '#1a1a1a', imageIndex: 0 },
        { name: 'کرم', hex: '#e8dcc8', imageIndex: 1 },
      ],
      sizeGuide: 'S: دور سینه ۸۸ — M: ۹۲ — L: ۹۶ — XL: ۱۰۰ (سانتی‌متر)',
      variants: [
        { color: 'مشکی', size: 'M', stock: 4 },
        { color: 'کرم', size: 'L', stock: 3 },
      ],
    },
  }),
  p({
    id: 'demo-p2',
    name: 'هودی کلاهدار زنانه',
    slug: 'demo-hoodi-zanane',
    description: 'هودی گرم با کلاه دو لایه و جیب کانگورویی.',
    price: 1_650_000,
    discountPrice: null,
    effectivePrice: 1_650_000,
    discountPercent: 0,
    stock: 20,
    ...P.hoodi,
    unit: 'پنبه fleece',
    isActive: true,
    isFeatured: false,
    isNew: true,
    isOldPrice: false,
    isHomeFeatured: true,
    categoryId: 'demo-cat-women',
    category: { id: 'demo-cat-women', name: 'لباس زنانه', slug: 'zanane' },
    inStock: true,
    clothingMeta: { sizes: ['Freesize'], colors: [{ name: 'طوسی', hex: '#9ca3af' }] },
  }),
  p({
    id: 'demo-p3',
    name: 'تاپ بندی زنانه',
    slug: 'demo-top-bandi-zanane',
    description: 'تاپ کوتاه با بند قابل تنظیم.',
    price: 890_000,
    discountPrice: 690_000,
    effectivePrice: 690_000,
    discountPercent: 22,
    stock: 30,
    ...P.topBandi,
    unit: 'نخ و الیاف طبیعی',
    isActive: true,
    isFeatured: true,
    isNew: false,
    isOldPrice: false,
    isHomeDeal: true,
    categoryId: 'demo-cat-women',
    category: { id: 'demo-cat-women', name: 'لباس زنانه', slug: 'zanane' },
    inStock: true,
  }),
  p({
    id: 'demo-p4',
    name: 'شلوار جین مردانه اسلیم',
    slug: 'demo-jeans-mardane',
    description: 'جین اسلیم فیت با کشسانی ملایم.',
    price: 1_980_000,
    discountPrice: 1_750_000,
    effectivePrice: 1_750_000,
    discountPercent: 12,
    stock: 18,
    ...P.jeans,
    unit: 'دنیم',
    isActive: true,
    isFeatured: true,
    isNew: false,
    isOldPrice: false,
    isHomeDeal: true,
    isHomeFeatured: true,
    categoryId: 'demo-cat-men',
    category: { id: 'demo-cat-men', name: 'لباس مردانه', slug: 'mardane' },
    inStock: true,
    clothingMeta: {
      sizes: ['30', '32', '34', '36'],
      colors: [{ name: 'سرمه‌ای', hex: '#374151' }],
    },
  }),
  p({
    id: 'demo-p5',
    name: 'پیراهن مردانه Oxford',
    slug: 'demo-shirt-mardane-oxford',
    description: 'پیراهن رسمی-اسپرت با یقه دکمه‌دار.',
    price: 1_420_000,
    discountPrice: null,
    effectivePrice: 1_420_000,
    discountPercent: 0,
    stock: 25,
    ...P.shirtOxford,
    unit: 'پنبه Oxford',
    isActive: true,
    isFeatured: false,
    isNew: true,
    isOldPrice: false,
    categoryId: 'demo-cat-men',
    category: { id: 'demo-cat-men', name: 'لباس مردانه', slug: 'mardane' },
    inStock: true,
  }),
  p({
    id: 'demo-p6',
    name: 'کاپشن خز مصنوعی مردانه',
    slug: 'demo-kapson-mardane',
    description: 'کاپشن گرم با آستر نرم، مناسب سرما.',
    price: 3_600_000,
    discountPrice: 2_990_000,
    effectivePrice: 2_990_000,
    discountPercent: 17,
    stock: 8,
    ...P.kapson,
    unit: 'خز مصنوعی',
    isActive: true,
    isFeatured: true,
    isNew: false,
    isOldPrice: false,
    isHomeFeatured: true,
    categoryId: 'demo-cat-men',
    category: { id: 'demo-cat-men', name: 'لباس مردانه', slug: 'mardane' },
    inStock: true,
  }),
  p({
    id: 'demo-p7',
    name: 'پیراهن دخترانه گل‌دار',
    slug: 'demo-dress-dokhtarane',
    description: 'پیراهن سبک با طرح گل‌های ظریف.',
    price: 1_250_000,
    discountPrice: 990_000,
    effectivePrice: 990_000,
    discountPercent: 21,
    stock: 14,
    ...P.dress,
    unit: 'پنبه',
    isActive: true,
    isFeatured: false,
    isNew: true,
    isOldPrice: false,
    isHomeDeal: true,
    categoryId: 'demo-cat-girls',
    category: { id: 'demo-cat-girls', name: 'لباس دخترانه', slug: 'dokhtarane' },
    inStock: true,
    clothingMeta: { sizes: ['۴ سال', '۶ سال', '۸ سال'] },
  }),
  p({
    id: 'demo-p8',
    name: 'ست ورزشی دخترانه',
    slug: 'demo-set-dokhtarane',
    description: 'تاپ و شلوارک راحتی برای بازی و مدرسه.',
    price: 780_000,
    discountPrice: null,
    effectivePrice: 780_000,
    discountPercent: 0,
    stock: 22,
    ...P.setSport,
    unit: 'پلی‌استر',
    isActive: true,
    isFeatured: false,
    isNew: false,
    isOldPrice: false,
    categoryId: 'demo-cat-girls',
    category: { id: 'demo-cat-girls', name: 'لباس دخترانه', slug: 'dokhtarane' },
    inStock: true,
  }),
  p({
    id: 'demo-p9',
    name: 'شلوار جاگر پسرانه',
    slug: 'demo-jogger-pesarane',
    description: 'جاگر نرم با کش کمر و مچ.',
    price: 920_000,
    discountPrice: 790_000,
    effectivePrice: 790_000,
    discountPercent: 14,
    stock: 16,
    ...P.jogger,
    unit: 'پنبه',
    isActive: true,
    isFeatured: true,
    isNew: true,
    isOldPrice: false,
    isHomeDeal: true,
    categoryId: 'demo-cat-boys',
    category: { id: 'demo-cat-boys', name: 'لباس پسرانه', slug: 'pesarane' },
    inStock: true,
  }),
  p({
    id: 'demo-p10',
    name: 'تی‌شرت چاپی پسرانه',
    slug: 'demo-tshirt-pesarane',
    description: 'تی‌شرت نخی با چاپ مینیمال.',
    price: 450_000,
    discountPrice: null,
    effectivePrice: 450_000,
    discountPercent: 0,
    stock: 40,
    ...P.tshirt,
    unit: 'پنبه ۱۰۰٪',
    isActive: true,
    isFeatured: false,
    isNew: false,
    isOldPrice: false,
    categoryId: 'demo-cat-boys',
    category: { id: 'demo-cat-boys', name: 'لباس پسرانه', slug: 'pesarane' },
    inStock: true,
  }),
  p({
    id: 'demo-p11',
    name: 'کفش کتانی زنانه',
    slug: 'demo-sneakers-zanane',
    description: 'کتانی روزمره با زیره سبک (نمایشی).',
    price: 2_200_000,
    discountPrice: 1_890_000,
    effectivePrice: 1_890_000,
    discountPercent: 14,
    stock: 10,
    ...P.sneakers,
    unit: 'چرم مصنوعی',
    isActive: true,
    isFeatured: true,
    isNew: false,
    isOldPrice: false,
    isHomeFeatured: true,
    categoryId: 'demo-cat-women',
    category: { id: 'demo-cat-women', name: 'لباس زنانه', slug: 'zanane' },
    inStock: true,
  }),
  p({
    id: 'demo-p12',
    name: 'کش سر زنانه',
    slug: 'demo-headband-zanane',
    description: 'اکسسوری مو با پارچه نرم.',
    price: 320_000,
    discountPrice: 250_000,
    effectivePrice: 250_000,
    discountPercent: 22,
    stock: 50,
    ...P.headband,
    unit: 'ساتن',
    isActive: true,
    isFeatured: false,
    isNew: true,
    isOldPrice: false,
    isHomeDeal: true,
    categoryId: 'demo-cat-women',
    category: { id: 'demo-cat-women', name: 'لباس زنانه', slug: 'zanane' },
    inStock: true,
  }),
];

export function getDemoProductBySlug(slug: string): Product | null {
  return DEMO_PRODUCTS.find((item) => item.slug === slug) ?? null;
}

export function getDemoCategoryBySlug(slug: string): Category | null {
  return DEMO_CATEGORIES.find((item) => item.slug === slug) ?? null;
}

export function getDemoProductsByCategorySlug(slug: string): Product[] {
  const cat = getDemoCategoryBySlug(slug);
  if (!cat) return [];
  return DEMO_PRODUCTS.filter((p) => p.categoryId === cat.id);
}

export function getDemoHomeFeed(): HomeCategorySection[] {
  return DEMO_CATEGORIES.map((category) => ({
    category,
    products: DEMO_PRODUCTS.filter((p) => p.categoryId === category.id).slice(0, 8),
  }));
}

export function getDemoFeaturedProducts(): Product[] {
  return DEMO_PRODUCTS.filter((p) => p.isHomeFeatured || p.isFeatured).slice(0, 10);
}

export function getDemoDiscountedProducts(): Product[] {
  return DEMO_PRODUCTS.filter((p) => (p.discountPrice ?? 0) > 0).slice(0, 10);
}

export function getDemoRelatedProducts(slug: string, limit = 8): Product[] {
  const current = getDemoProductBySlug(slug);
  if (!current) return DEMO_PRODUCTS.slice(0, limit);
  return DEMO_PRODUCTS.filter((p) => p.categoryId === current.categoryId && p.slug !== slug).slice(
    0,
    limit
  );
}

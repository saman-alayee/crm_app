<script setup lang="ts">
import type { Product, Category } from '~/types';
import { SITE_NAME } from '~/constants/site';
import { navCategoryLabel } from '~/constants/categoryNav';
import wpCategoryParents from '~/constants/wpCategoryParents.json';
import { effectiveProductStock, parseClothingMeta } from '~/utils/clothing';

const route = useRoute();
const api = useApi();
const catalogDemo = useCatalogDemo();
const cartStore = useCartStore();
const toast = useToast();
const { formatPrice, getProductImage } = useFormat();
const { isFavorite, toggleFavorite } = useFavorites();

const slug = route.params.slug as string;

const { data: product } = await useAsyncData(`product-${slug}`, async () => {
  if (catalogDemo.forceDemo.value || slug.startsWith('demo-')) {
    const demo = catalogDemo.demoProduct(slug);
    if (demo) {
      catalogDemo.markDemo(true);
      return demo;
    }
  }
  try {
    const { data } = await api.get<Product>(`/products/${slug}`);
    catalogDemo.markDemo(false);
    return data;
  } catch {
    return null;
  }
});

const parentBySlug = wpCategoryParents as Record<string, string | null>;

const { data: navCategories } = await useAsyncData('catalog-nav-categories', async () => {
  try {
    const { data } = await api.get<Category[]>('/categories?lite=1');
    return data ?? [];
  } catch {
    return [] as Category[];
  }
});

const crumbs = computed(() => {
  const current = product.value;
  if (!current) return [] as { label: string; to: string }[];

  const bySlug = new Map<string, { slug: string; name: string }>();
  for (const item of navCategories.value ?? []) bySlug.set(item.slug, item);
  for (const item of current.categories ?? []) bySlug.set(item.slug, item);
  if (current.category) bySlug.set(current.category.slug, current.category);

  function chain(start: string) {
    const items: { label: string; to: string }[] = [];
    const seen = new Set<string>();
    let slug: string | null = start;
    while (slug && !seen.has(slug)) {
      seen.add(slug);
      const category = bySlug.get(slug);
      items.unshift({
        label: category ? navCategoryLabel(category) : slug,
        to: `/categories/${slug}`,
      });
      slug = parentBySlug[slug] ?? null;
    }
    return items;
  }

  const slugs = [
    ...(current.categories ?? []).map((item) => item.slug),
    current.category?.slug,
  ].filter((slug): slug is string => Boolean(slug));
  const trail = [...new Set(slugs)]
    .map((slug) => chain(slug))
    .sort((a, b) => b.length - a.length)[0] ?? [];

  return [
    { label: 'خانه', to: '/' },
    ...trail,
    { label: current.name, to: '' },
  ];
});

const isDemoProduct = computed(
  () => !!product.value && catalogDemo.isDemoProductId(product.value.id)
);

const relatedProducts = ref<Product[]>([]);

const quantity = computed(() => cartStore.getItemQuantity(product.value?.id ?? ''));
const favorited = computed(() => (product.value ? isFavorite(product.value.id) : false));

const galleryImages = computed(() => {
  if (!product.value) return [] as string[];
  if (product.value.images?.length) return product.value.images;
  return product.value.image ? [product.value.image] : [];
});

const activeImageIndex = ref(0);
const clothingMeta = computed(() => (product.value ? parseClothingMeta(product.value) : null));
const selectedColor = ref<string | undefined>();
const selectedSize = ref<string | undefined>();

watch(clothingMeta, (meta) => {
  selectedColor.value = meta?.colors?.[0]?.name;
  selectedSize.value = meta?.sizes?.[0];
});

watch(selectedColor, (color) => {
  const meta = clothingMeta.value;
  const swatch = meta?.colors?.find((c) => c.name === color);
  if (swatch?.imageIndex != null && swatch.imageIndex < galleryImages.value.length) {
    activeImageIndex.value = swatch.imageIndex;
  }
});

const variantStock = computed(() => {
  if (!product.value) return 0;
  return effectiveProductStock(product.value, selectedColor.value, selectedSize.value);
});

const inStockDisplay = computed(() => variantStock.value > 0);
const canPurchase = computed(() => !isDemoProduct.value && inStockDisplay.value);
const addingToCart = ref(false);
const justAdded = ref(false);
let addedTimer: ReturnType<typeof setTimeout> | null = null;

async function addToCart() {
  if (!product.value || !canPurchase.value || addingToCart.value) return;
  addingToCart.value = true;
  justAdded.value = false;
  try {
    await cartStore.addItem(product.value.id);
    justAdded.value = true;
    toast.success('به سبد خرید اضافه شد');
    if (addedTimer) clearTimeout(addedTimer);
    addedTimer = setTimeout(() => {
      justAdded.value = false;
    }, 1600);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'افزودن به سبد انجام نشد');
  } finally {
    addingToCart.value = false;
  }
}

onUnmounted(() => {
  if (addedTimer) clearTimeout(addedTimer);
});

watch(galleryImages, (images) => {
  if (activeImageIndex.value >= images.length) {
    activeImageIndex.value = 0;
  }
});

async function loadRelated() {
  if (!product.value) return;
  if (isDemoProduct.value) {
    relatedProducts.value = catalogDemo.demoRelated(slug, 12);
    return;
  }
  try {
    const { data } = await api.get<Product[]>(`/products/${slug}/related?limit=12`);
    relatedProducts.value = data;
  } catch {
    relatedProducts.value = [];
  }
}

onMounted(async () => {
  await loadRelated();
});

watch(product, loadRelated);

usePageSeo(() => ({
  title: product.value?.name || 'محصول',
  description: product.value?.description?.slice(0, 160) || undefined,
  path: product.value ? `/products/${product.value.slug}` : undefined,
  image: product.value ? getProductImage(product.value.image) : undefined,
  jsonLd: product.value
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.value.name,
        description: product.value.description || undefined,
        image: galleryImages.value.map((img) => getProductImage(img)),
        offers: {
          '@type': 'Offer',
          price: product.value.effectivePrice,
          priceCurrency: 'IRR',
          availability: canPurchase.value
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        },
      }
    : undefined,
}));
</script>

<template>
  <div v-if="!product" class="mx-auto max-w-[1240px] px-4 py-10">
    <EmptyCatalogScene
      variant="products"
      title="این محصول پیدا نشد"
      description="شاید از رگال برداشته شده باشد. کالکشن‌ها را ببینید یا به فروشگاه برگردید."
    >
      <NuxtLink to="/categories" class="btn-primary btn-action text-sm px-6">کالکشن‌ها</NuxtLink>
      <NuxtLink to="/" class="btn-secondary btn-action text-sm px-6">خانه</NuxtLink>
    </EmptyCatalogScene>
  </div>

  <div v-else class="bg-white pb-28 md:pb-12">
    <div v-if="isDemoProduct" class="mx-auto max-w-[1240px] px-4 pt-3">
      <AppAlertBanner variant="info" message="این محصول نمایشی است (تصاویر placeholder) — فقط برای پیش‌نمایش ظاهر فروشگاه." />
    </div>
    <div class="mx-auto max-w-[1240px] px-4 pb-4 pt-8 md:pb-8 md:pt-14">
      <nav
        v-if="crumbs.length"
        aria-label="مسیر صفحه"
        class="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-neutral-500"
      >
        <template v-for="(crumb, index) in crumbs" :key="`${crumb.label}-${index}`">
          <span v-if="index" class="text-neutral-300" aria-hidden="true">/</span>
          <NuxtLink
            v-if="crumb.to"
            :to="crumb.to"
            class="transition-colors hover:text-neutral-950"
          >
            {{ crumb.label }}
          </NuxtLink>
          <span v-else class="text-neutral-900" aria-current="page">{{ crumb.label }}</span>
        </template>
      </nav>
      <div class="md:grid md:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] md:items-start md:gap-8 lg:gap-12">
        <ProductDetailGallery
          :images="galleryImages"
          :active-index="activeImageIndex"
          :product-name="product.name"
          :favorited="favorited"
          @update:active-index="activeImageIndex = $event"
          @toggle-favorite="toggleFavorite(product.id)"
        />

        <ProductDetailSpecs
          :product="product"
          :clothing-meta="clothingMeta"
          v-model:selected-color="selectedColor"
          v-model:selected-size="selectedSize"
          :is-demo-product="isDemoProduct"
          :in-stock-display="inStockDisplay"
          :can-purchase="canPurchase"
          :quantity="quantity"
          :adding="addingToCart"
          :just-added="justAdded"
          @add-to-cart="addToCart"
          @decrease-qty="cartStore.updateQuantity(product.id, quantity - 1)"
          @increase-qty="cartStore.updateQuantity(product.id, quantity + 1)"
          @remove-from-cart="cartStore.removeItem(product.id)"
        />
      </div>
    </div>

    <ProductReviews v-if="product" :slug="product.slug" />

    <section v-if="relatedProducts.length" class="mx-auto mt-6 max-w-[1240px] border-t border-gray-100 px-4 pb-6 pt-8">
      <h2 class="mb-4 text-base font-bold text-[#3c322b]">محصولات مشابه</h2>
      <ProductCardList :products="relatedProducts" layout="strip" />
    </section>

    <div class="fixed inset-x-0 bottom-16 z-[55] border-t border-gray-100 bg-white px-4 py-3 md:hidden">
      <div class="mx-auto flex max-w-lg items-center gap-3">
        <button
          v-if="quantity === 0 || justAdded || addingToCart"
          type="button"
          class="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-300"
          :class="justAdded ? 'bg-[#1f8a4c]' : 'bg-primary-700'"
          :disabled="!canPurchase || addingToCart"
          @click="addToCart"
        >
          <AppIcon v-if="justAdded" name="lucide:check" size="sm" />
          {{ !canPurchase ? 'ناموجود' : addingToCart ? 'در حال افزودن…' : justAdded ? 'به سبد اضافه شد' : 'افزودن به سبد خرید' }}
        </button>
        <div v-else class="inline-flex h-12 flex-1 items-center justify-between gap-3 rounded-lg bg-[#1f8a4c] px-3 text-white">
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-md bg-white/15"
            aria-label="کم کردن"
            @click="quantity <= 1 ? cartStore.removeItem(product.id) : cartStore.updateQuantity(product.id, quantity - 1)"
          >
            <AppIcon name="lucide:minus" size="sm" />
          </button>
          <span class="text-sm font-bold">{{ quantity }} در سبد</span>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-md bg-white/15"
            aria-label="زیاد کردن"
            @click="cartStore.updateQuantity(product.id, quantity + 1)"
          >
            <AppIcon name="lucide:plus" size="sm" />
          </button>
        </div>
        <p
          v-if="!canPurchase"
          class="shrink-0 rounded bg-[#fde8e6] px-1.5 py-px text-[11px] font-semibold leading-5 text-[#b42318]"
        >
          ناموجود
        </p>
        <p v-else class="shrink-0 text-base font-bold text-[#3c322b]">
          {{ formatPrice(product.effectivePrice) }}
        </p>
      </div>
    </div>
  </div>
</template>

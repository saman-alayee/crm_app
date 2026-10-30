<script setup lang="ts">
import type { Category, Product, Pagination } from '~/types';

const route = useRoute();
const api = useApi();
const catalogDemo = useCatalogDemo();
const slug = computed(() => route.params.slug as string);

const PAGE_SIZE = 24;

type ListingFilter = 'all' | 'instock' | 'discount' | 'new' | 'other';
type SortMode = 'newest' | 'discount' | 'bestsellers';

const filterOptions: { value: ListingFilter; label: string }[] = [
  { value: 'all', label: 'همه' },
  { value: 'instock', label: 'موجود' },
  { value: 'discount', label: 'تخفیف' },
  { value: 'new', label: 'جدید' },
  { value: 'other', label: 'سایر' },
];

const sortOptions: { value: SortMode; label: string }[] = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'discount', label: 'بیشترین تخفیف' },
  { value: 'bestsellers', label: 'پرفروش' },
];

function readFilter(value: unknown, inStockQuery?: unknown): ListingFilter {
  if (value === 'instock' || value === 'discount' || value === 'new' || value === 'other') return value;
  if (inStockQuery === '1' || inStockQuery === 'true') return 'instock';
  return 'all';
}

function readSort(value: unknown): SortMode {
  if (value === 'discount' || value === 'bestsellers') return value;
  return 'newest';
}

const listingFilter = ref<ListingFilter>(readFilter(route.query.filter, route.query.inStock));
const sort = ref<SortMode>(readSort(route.query.sort));

const { data: category } = await useAsyncData(
  () => `category-${slug.value}`,
  async () => {
    if (catalogDemo.forceDemo.value) {
      const demo = catalogDemo.demoCategory(slug.value);
      if (demo) return demo;
    }
    try {
      const { data } = await api.get<Category>(`/categories/${slug.value}`);
      return data;
    } catch {
      return null;
    }
  }
);

const { data: categories } = await useAsyncData('all-categories', async () => {
  const { data } = await api.get<Category[]>('/categories');
  return data;
});

const products = ref<Product[]>([]);
const listPagination = ref<Pagination | null>(null);
const loading = ref(true);
const loadingMore = ref(false);

const hasMore = computed(() => {
  const page = listPagination.value;
  return !!page && page.page < page.totalPages;
});

function applyClientFilter(list: Product[]) {
  let next = list;
  if (listingFilter.value === 'instock') next = next.filter((item) => item.inStock);
  if (listingFilter.value === 'discount') next = next.filter((item) => item.discountPrice != null);
  if (listingFilter.value === 'new') next = next.filter((item) => item.isNew);
  if (listingFilter.value === 'other') {
    next = next.filter((item) => !item.isNew && item.discountPrice == null);
  }
  return next;
}

function syncQuery() {
  navigateTo(
    {
      path: route.path,
      query: {
        ...(listingFilter.value === 'all' ? {} : { filter: listingFilter.value }),
        ...(sort.value !== 'newest' ? { sort: sort.value } : {}),
      },
    },
    { replace: true }
  );
}

async function loadProducts(nextPage = 1, append = false) {
  const demoCat = catalogDemo.demoCategory(slug.value);
  if (catalogDemo.forceDemo.value && demoCat) {
    const demo = applyClientFilter(catalogDemo.demoProductsByCategory(slug.value));
    products.value = demo;
    listPagination.value = { page: 1, limit: PAGE_SIZE, total: demo.length, totalPages: 1 };
    return;
  }

  const params = new URLSearchParams({
    category: slug.value,
    limit: String(PAGE_SIZE),
    page: String(nextPage),
  });
  if (sort.value !== 'newest') params.set('sort', sort.value);
  if (listingFilter.value === 'instock') params.set('inStock', 'true');
  if (listingFilter.value === 'discount') params.set('listing', 'discount');
  if (listingFilter.value === 'new') params.set('listing', 'new');
  if (listingFilter.value === 'other') params.set('listing', 'other');

  const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
    `/products?${params}`
  );
  products.value = append ? [...products.value, ...data.products] : data.products;
  listPagination.value = data.pagination;
}

async function reload() {
  loading.value = true;
  products.value = [];
  listPagination.value = null;
  try {
    await loadProducts(1);
  } finally {
    loading.value = false;
  }
}

function setFilter(value: string | number) {
  const next = readFilter(value);
  if (listingFilter.value === next) return;
  listingFilter.value = next;
  syncQuery();
  void reload();
}

function setSort(value: string | number) {
  const next = readSort(value);
  if (sort.value === next) return;
  sort.value = next;
  syncQuery();
  void reload();
}

async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  try {
    await loadProducts((listPagination.value?.page ?? 1) + 1, true);
  } finally {
    loadingMore.value = false;
  }
}

const { sentinel: loadMoreSentinel } = useInfiniteScroll(loadMore);

watch(slug, () => {
  listingFilter.value = 'all';
  sort.value = 'newest';
  void reload();
});

onMounted(reload);

usePageSeo(() => ({
  title: category.value?.name || 'دسته‌بندی',
  description: category.value?.name
    ? `خرید ${category.value.name} از فروشگاه آیتای، با ارسال سریع و ضمانت اصالت.`
    : undefined,
  path: category.value ? `/categories/${category.value.slug}` : undefined,
  image: category.value?.image || undefined,
}));
</script>

<template>
  <div class="pb-8">
    <div class="sticky top-14 z-30 min-w-0 border-b border-gray-100 bg-white/95 px-4 pb-4 pt-4 backdrop-blur">
      <h1 class="section-title mb-3">{{ category?.name }}</h1>

      <ChipStrip class="mb-3 pb-1">
        <NuxtLink
          to="/categories"
          class="whitespace-nowrap rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600"
          draggable="false"
        >
          همه
        </NuxtLink>
        <NuxtLink
          v-for="item in categories"
          :key="item.id"
          :to="`/categories/${item.slug}`"
          :class="[
            'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            item.slug === slug
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          ]"
          draggable="false"
        >
          {{ item.name }}
        </NuxtLink>
      </ChipStrip>

      <div class="grid grid-cols-2 gap-4">
        <label class="block min-w-0">
          <span class="field-label">فیلتر</span>
          <AppSelect
            :model-value="listingFilter"
            :options="filterOptions"
            @update:model-value="setFilter"
          />
        </label>
        <label class="block min-w-0">
          <span class="field-label">مرتب‌سازی</span>
          <AppSelect
            :model-value="sort"
            :options="sortOptions"
            @update:model-value="setSort"
          />
        </label>
      </div>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="px-4 pt-4">
      <ProductCardList v-if="products.length" :products="products" layout="grid" density="sarak" />
      <EmptyCatalogScene
        v-else
        variant="products"
        title="محصولی با این فیلتر پیدا نشد"
        description="فیلتر را عوض کنید یا همه محصولات این دسته را ببینید."
      >
        <button type="button" class="btn-secondary btn-action text-sm px-5" @click="setFilter('all')">
          نمایش همه
        </button>
        <NuxtLink to="/categories" class="btn-primary btn-action text-sm px-5">کالکشن‌ها</NuxtLink>
      </EmptyCatalogScene>

      <div v-if="hasMore || loadingMore" class="flex flex-col items-center gap-2 py-6">
        <div ref="loadMoreSentinel" class="h-1 w-full" aria-hidden="true" />
        <LoadingSpinner :show="loadingMore" />
      </div>
    </div>
  </div>
</template>

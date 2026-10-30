<script setup lang="ts">
import type { Product, Pagination } from '~/types';
import { DEMO_PRODUCTS } from '~/constants/demoCatalog';

const route = useRoute();
const router = useRouter();
const api = useApi();
const catalogDemo = useCatalogDemo();

function demoProductList(): Product[] {
  let list = [...DEMO_PRODUCTS];
  const term = query.value.trim();
  if (term) {
    list = list.filter((p) => p.name.includes(term));
  }
  if (route.query.discounted === '1' || sort.value === 'discount') {
    list = list.filter((p) => (p.discountPrice ?? 0) > 0);
  } else if (route.query.featured === '1') {
    list = list.filter((p) => p.isFeatured || p.isHomeFeatured);
  }
  if (onlyInStock.value) {
    list = list.filter((p) => p.inStock);
  }
  if (sort.value === 'discount') {
    list.sort((a, b) => b.discountPercent - a.discountPercent);
  }
  return list;
}

const PAGE_SIZE = 24;

type SortMode = 'newest' | 'discount' | 'bestsellers';

const query = ref('');
const sort = ref<SortMode>('newest');
const onlyInStock = ref(false);
const products = ref<Product[]>([]);
const pagination = ref<Pagination | null>(null);
const loading = ref(false);
const loadingMore = ref(false);
const pageTitle = ref('جستجو');

const hasMore = computed(() => {
  const p = pagination.value;
  return !!p && p.page < p.totalPages;
});

const sortOptions: { value: SortMode; label: string }[] = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'discount', label: 'بیشترین تخفیف' },
  { value: 'bestsellers', label: 'پرفروش' },
];

const isBrowseMode = computed(
  () =>
    route.query.discounted === '1' ||
    route.query.featured === '1' ||
    route.query.sort === 'discount' ||
    route.query.sort === 'bestsellers' ||
    Boolean(route.query.q)
);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function syncFromRoute() {
  query.value = (route.query.q as string) || '';
  onlyInStock.value = route.query.inStock === '1' || route.query.inStock === 'true';
  const routeSort = route.query.sort as string;
  if (routeSort === 'discount' || routeSort === 'bestsellers') {
    sort.value = routeSort;
  } else if (route.query.discounted === '1') {
    sort.value = 'discount';
  } else {
    sort.value = 'newest';
  }
}

function buildQuery(overrides: Record<string, string | undefined> = {}) {
  const next: Record<string, string> = {};
  const q = overrides.q !== undefined ? overrides.q : query.value.trim();
  const nextSort = (overrides.sort as SortMode | undefined) ?? sort.value;
  const nextInStock =
    overrides.inStock !== undefined ? overrides.inStock === '1' : onlyInStock.value;

  if (route.query.featured === '1' && overrides.featured !== '0') {
    next.featured = '1';
  }
  if (route.query.discounted === '1' && overrides.discounted !== '0' && nextSort === 'discount') {
    next.discounted = '1';
  }
  if (q) next.q = q;
  if (nextSort && nextSort !== 'newest') next.sort = nextSort;
  if (nextInStock) next.inStock = '1';
  return next;
}

async function fetchProducts(page: number, append: boolean) {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    page: String(page),
  });

  if (sort.value !== 'newest') params.set('sort', sort.value);
  if (onlyInStock.value) params.set('inStock', 'true');

  if (route.query.discounted === '1' || sort.value === 'discount') {
    pageTitle.value = sort.value === 'bestsellers' ? 'پرفروش‌ترین‌ها' : 'بیشترین تخفیف';
    if (route.query.discounted === '1') params.set('discounted', 'true');
  } else if (route.query.featured === '1') {
    pageTitle.value = 'محصولات ویژه';
    params.set('featured', 'true');
  } else if (sort.value === 'bestsellers') {
    pageTitle.value = 'پرفروش‌ترین‌ها';
  } else {
    pageTitle.value = query.value.trim() ? 'جستجو' : 'محصولات';
  }

  const term = query.value.trim();
  if (
    !catalogDemo.forceDemo.value &&
    !route.query.discounted &&
    !route.query.featured &&
    sort.value === 'newest' &&
    !term
  ) {
    products.value = [];
    pagination.value = null;
    return;
  }

  // Browse bestsellers/discount without requiring a search term
  if (term) params.set('search', term);

  if (catalogDemo.forceDemo.value) {
    const all = demoProductList();
    products.value = append ? products.value : all;
    pagination.value = { page: 1, totalPages: 1, total: all.length, limit: PAGE_SIZE };
    return;
  }

  try {
    const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
      `/products?${params}`
    );
    products.value = append ? [...products.value, ...data.products] : data.products;
    pagination.value = data.pagination;
  } catch {
    products.value = append ? products.value : [];
    pagination.value = null;
  }
}

async function loadSearch() {
  loading.value = true;
  try {
    await fetchProducts(1, false);
  } catch {
    products.value = [];
    pagination.value = null;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  try {
    await fetchProducts((pagination.value?.page ?? 1) + 1, true);
  } catch {
    /* keep existing list */
  } finally {
    loadingMore.value = false;
  }
}

const { sentinel: loadMoreSentinel } = useInfiniteScroll(loadMore);

function onQueryInput() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void router.replace({ path: '/search', query: buildQuery({ q: query.value.trim() || undefined }) });
  }, 350);
}

function setSort(next: SortMode) {
  sort.value = next;
  const overrides: Record<string, string | undefined> = { sort: next };
  if (next !== 'discount') overrides.discounted = '0';
  void router.replace({ path: '/search', query: buildQuery(overrides) });
}

function toggleInStock() {
  onlyInStock.value = !onlyInStock.value;
  void router.replace({
    path: '/search',
    query: buildQuery({ inStock: onlyInStock.value ? '1' : '0' }),
  });
}

watch(
  () => [
    route.query.q,
    route.query.discounted,
    route.query.featured,
    route.query.sort,
    route.query.inStock,
  ],
  () => {
    syncFromRoute();
    void loadSearch();
  },
  { immediate: true }
);

usePageSeo(() => ({
  title: pageTitle.value,
  noindex: true,
}));
</script>

<template>
  <div class="px-4 py-4">
    <h1 class="section-title">{{ pageTitle }}</h1>

    <form class="mb-4" @submit.prevent="loadSearch">
      <div class="relative">
        <input
          v-model="query"
          type="search"
          class="input-field pe-12"
          placeholder="نام محصول را جستجو کنید..."
          @input="onQueryInput"
        />
        <button type="submit" class="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400">
          <AppIcon name="lucide:search" size="md" />
        </button>
      </div>
    </form>

    <div class="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-1">
      <button
        type="button"
        :class="[
          'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors',
          onlyInStock
            ? 'bg-primary-600 text-white border-primary-600'
            : 'bg-white text-gray-600 border-gray-200',
        ]"
        :aria-pressed="onlyInStock"
        @click="toggleInStock"
      >
        <AppIcon name="lucide:package-check" size="sm" />
        فقط موجود
      </button>
      <button
        v-for="option in sortOptions"
        :key="option.value"
        type="button"
        :class="[
          'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors',
          sort === option.value
            ? 'bg-primary-600 text-white border-primary-600'
            : 'bg-white text-gray-600 border-gray-200',
        ]"
        @click="setSort(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <LoadingSpinner :show="loading" />

    <ProductCardList v-if="!loading" :products="products" />

    <div
      v-if="!loading && products.length && (hasMore || loadingMore)"
      class="py-6 flex flex-col items-center gap-2"
    >
      <div ref="loadMoreSentinel" class="h-1 w-full" aria-hidden="true" />
      <LoadingSpinner :show="loadingMore" />
      <p v-if="loadingMore" class="text-xs text-gray-400">در حال بارگذاری محصولات بیشتر…</p>
    </div>

    <EmptyCatalogScene
      v-if="!loading && !products.length"
      :variant="isBrowseMode ? 'products' : 'search'"
      :title="isBrowseMode ? 'محصولی یافت نشد' : undefined"
      :description="
        isBrowseMode
          ? 'با فیلتر یا مرتب‌سازی دیگری امتحان کنید، یا کالکشن‌ها را ببینید.'
          : undefined
      "
      class="mt-4"
    >
      <NuxtLink to="/categories" class="btn-primary btn-action text-sm px-6">دیدن کالکشن‌ها</NuxtLink>
    </EmptyCatalogScene>
  </div>
</template>

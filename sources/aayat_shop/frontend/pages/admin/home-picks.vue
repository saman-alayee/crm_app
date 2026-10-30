<script setup lang="ts">
import type { Product, Pagination } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const HOME_PICK_LIMIT = 10;
const SEARCH_LIMIT = 30;

const api = useApi();
const toast = useToast();
const { formatPrice, getProductImage } = useFormat();

type HomeTab = 'discounted' | 'featured';

const tab = ref<HomeTab>('discounted');
const loading = ref(true);
const saving = ref(false);
const searching = ref(false);
const search = ref('');
const searchResults = ref<Product[]>([]);
const searchError = ref('');
const discounted = ref<Product[]>([]);
const featured = ref<Product[]>([]);
const searchFocused = ref(false);

const selected = computed({
  get: () => (tab.value === 'discounted' ? discounted.value : featured.value),
  set: (value: Product[]) => {
    if (tab.value === 'discounted') discounted.value = value;
    else featured.value = value;
  },
});

const selectedIds = computed(() => new Set(selected.value.map((item) => item.id)));
const remaining = computed(() => Math.max(0, HOME_PICK_LIMIT - selected.value.length));

const tabHint = computed(() =>
  tab.value === 'discounted'
    ? 'همین فهرست در زبانه «تخفیف‌دار» صفحه اول فروشگاه می‌آید — نه آخرین کالاهای بارگذاری‌شده.'
    : 'همین فهرست در زبانه «ویژه» صفحه اول فروشگاه می‌آید، با ترتیبی که این‌جا می‌چینید.'
);

const searchHint = computed(() => {
  if (search.value.trim()) return '';
  return 'برای دیدن پیشنهادها کلیک کنید، یا نام لباس را بنویسید.';
});

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let searchSeq = 0;

onMounted(loadPicks);

watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void runSearch();
  }, 320);
});

watch(tab, () => {
  searchResults.value = [];
  searchError.value = '';
  if (search.value.trim() || searchFocused.value) void runSearch();
});

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

async function loadPicks() {
  loading.value = true;
  try {
    const { data } = await api.get<{ discounted: Product[]; featured: Product[] }>(
      '/admin/products/home-picks'
    );
    discounted.value = data.discounted ?? [];
    featured.value = data.featured ?? [];
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در بارگذاری محصولات صفحه اول');
  } finally {
    loading.value = false;
  }
}

function rankForTab(products: Product[]) {
  const list = products.filter((product) => product.isActive && !selectedIds.value.has(product.id));
  if (tab.value !== 'discounted') return list;
  return [...list].sort((a, b) => {
    const aDisc = a.discountPrice != null ? 1 : 0;
    const bDisc = b.discountPrice != null ? 1 : 0;
    if (bDisc !== aDisc) return bDisc - aDisc;
    return (b.discountPercent ?? 0) - (a.discountPercent ?? 0);
  });
}

async function runSearch() {
  const term = search.value.trim();
  const seq = ++searchSeq;
  searching.value = true;
  searchError.value = '';

  try {
    const params = new URLSearchParams({
      limit: String(SEARCH_LIMIT),
      page: '1',
    });
    if (term) params.set('search', term);

    const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
      `/admin/products?${params}`
    );

    if (seq !== searchSeq) return;

    searchResults.value = rankForTab(data.products ?? []);
  } catch (e: unknown) {
    if (seq !== searchSeq) return;
    searchResults.value = [];
    searchError.value = e instanceof Error ? e.message : 'خطا در جستجو';
    toast.error(searchError.value);
  } finally {
    if (seq === searchSeq) searching.value = false;
  }
}

function onSearchFocus() {
  searchFocused.value = true;
  if (!searchResults.value.length) void runSearch();
}

function clearSearch() {
  search.value = '';
  searchResults.value = [];
  searchError.value = '';
  if (searchFocused.value) void runSearch();
}

function addProduct(product: Product) {
  if (!product.isActive) {
    toast.error('محصول غیرفعال را نمی‌توان به صفحه اول اضافه کرد');
    return;
  }
  if (selectedIds.value.has(product.id)) return;
  if (selected.value.length >= HOME_PICK_LIMIT) {
    toast.error(`حداکثر ${HOME_PICK_LIMIT} محصول می‌توانید انتخاب کنید`);
    return;
  }
  selected.value = [...selected.value, product];
  searchResults.value = searchResults.value.filter((item) => item.id !== product.id);
}

function removeProduct(id: string) {
  selected.value = selected.value.filter((item) => item.id !== id);
  if (searchFocused.value || search.value.trim()) void runSearch();
}

function moveProduct(index: number, direction: -1 | 1) {
  const next = index + direction;
  if (next < 0 || next >= selected.value.length) return;
  const copy = [...selected.value];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  selected.value = copy;
}

async function save() {
  saving.value = true;
  try {
    const { data } = await api.put<{ discounted: Product[]; featured: Product[] }>(
      '/admin/products/home-picks',
      {
        discountedIds: discounted.value.map((item) => item.id),
        featuredIds: featured.value.map((item) => item.id),
      }
    );
    discounted.value = data.discounted ?? [];
    featured.value = data.featured ?? [];
    toast.success('محصولات صفحه اول ذخیره شد');
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ذخیره');
  } finally {
    saving.value = false;
  }
}

useHead({ title: 'محصولات صفحه اول - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-gray-800">محصولات ویژه صفحه اول</h1>
        <p class="text-sm text-gray-500 mt-1 max-w-2xl">
          لباس‌هایی که این‌جا می‌چینید، در صفحهٔ اول فروشگاه دیده می‌شوند. حداکثر ۱۰ لباس در هر فهرست. ترتیب را با بالا و پایین بردن عوض کنید و در آخر «ذخیره انتخاب‌ها» را بزنید.
        </p>
      </div>
      <button class="btn-primary text-sm py-2 shrink-0" :disabled="saving" @click="save">
        {{ saving ? 'در حال ذخیره...' : 'ذخیره انتخاب‌ها' }}
      </button>
    </div>

    <div class="flex gap-2 mb-4 p-1 rounded-xl border border-gray-200 bg-white w-fit">
      <button
        type="button"
        :class="[
          'admin-tab-btn px-4 py-2 text-sm font-semibold rounded-lg',
          tab === 'discounted' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-600 hover:bg-red-50',
        ]"
        @click="tab = 'discounted'"
      >
        تخفیف‌دار
        <span class="opacity-80">({{ discounted.length }})</span>
      </button>
      <button
        type="button"
        :class="[
          'admin-tab-btn px-4 py-2 text-sm font-semibold rounded-lg',
          tab === 'featured' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:bg-primary-50',
        ]"
        @click="tab = 'featured'"
      >
        ویژه
        <span class="opacity-80">({{ featured.length }})</span>
      </button>
    </div>

    <Transition name="admin-tab" mode="out-in">
    <div :key="tab" class="admin-tab-panel">
    <p class="text-sm text-gray-500 mb-4">{{ tabHint }}</p>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="grid gap-6 lg:grid-cols-2">
      <section class="card p-4">
        <h2 class="font-bold text-gray-800 mb-1">جستجو و افزودن</h2>
        <p class="text-xs text-gray-500 mb-3">
          {{ remaining ? `${remaining} جای خالی مانده` : 'ظرفیت این فهرست پر است' }}
        </p>
        <div class="relative mb-2">
          <input
            v-model="search"
            type="search"
            class="input-field pe-10"
            placeholder="نام محصول، بارکد یا بخشی از نام…"
            autocomplete="off"
            @focus="onSearchFocus"
          />
          <button
            v-if="search"
            type="button"
            class="absolute end-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm px-1"
            aria-label="پاک کردن جستجو"
            @click="clearSearch"
          >
            ✕
          </button>
        </div>
        <p v-if="searchHint" class="text-xs text-gray-400 mb-3">{{ searchHint }}</p>
        <LoadingSpinner :show="searching" />
        <ul
          v-if="!searching && searchResults.length"
          class="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto"
        >
          <li
            v-for="product in searchResults"
            :key="product.id"
            class="flex items-center gap-3 py-2.5"
          >
            <img
              :src="getProductImage(product.image)"
              :alt="product.name"
              class="w-11 h-11 rounded-lg object-cover bg-gray-100 shrink-0"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-800 truncate">{{ product.name }}</p>
              <p class="text-xs text-gray-500">
                <span v-if="product.category?.name">{{ product.category.name }} · </span>
                {{ formatPrice(product.effectivePrice) }}
                <span v-if="product.discountPercent" class="text-red-500 ms-1">
                  {{ product.discountPercent }}٪
                </span>
              </p>
            </div>
            <button
              type="button"
              class="text-sm font-medium text-primary-600 shrink-0 disabled:text-gray-300"
              :disabled="remaining === 0"
              @click="addProduct(product)"
            >
              افزودن
            </button>
          </li>
        </ul>
        <p
          v-else-if="!searching && (search.trim() || searchFocused) && !searchError"
          class="text-sm text-gray-400 py-4"
        >
          {{ search.trim() ? 'محصولی با این عبارت پیدا نشد. املا یا کلمهٔ کوتاه‌تری امتحان کنید.' : 'محصول فعالی برای پیشنهاد نیست.' }}
        </p>
      </section>

      <section class="card p-4">
        <h2 class="font-bold text-gray-800 mb-3">
          انتخاب‌شده‌ها
          <span class="text-sm font-normal text-gray-400">({{ selected.length }} از ۱۰)</span>
        </h2>
        <ul v-if="selected.length" class="space-y-2">
          <li
            v-for="(product, index) in selected"
            :key="product.id"
            class="flex items-center gap-2 rounded-xl border border-gray-100 p-2"
          >
            <span class="w-6 text-center text-xs font-bold text-gray-400">{{ index + 1 }}</span>
            <img
              :src="getProductImage(product.image)"
              :alt="product.name"
              class="w-11 h-11 rounded-lg object-cover bg-gray-100 shrink-0"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-800 truncate">{{ product.name }}</p>
              <p class="text-xs text-gray-500">{{ formatPrice(product.effectivePrice) }}</p>
            </div>
            <div class="flex flex-col shrink-0">
              <button
                type="button"
                class="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                :disabled="index === 0"
                aria-label="بالاتر"
                @click="moveProduct(index, -1)"
              >
                <AppIcon name="lucide:chevron-up" size="sm" />
              </button>
              <button
                type="button"
                class="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                :disabled="index === selected.length - 1"
                aria-label="پایین‌تر"
                @click="moveProduct(index, 1)"
              >
                <AppIcon name="lucide:chevron-down" size="sm" />
              </button>
            </div>
            <button
              type="button"
              class="text-red-500 text-sm shrink-0 px-1"
              @click="removeProduct(product.id)"
            >
              حذف
            </button>
          </li>
        </ul>
        <p v-else class="text-sm text-gray-400 py-6 text-center">
          هنوز محصولی انتخاب نشده. از جستجو اضافه کنید.
        </p>
      </section>
    </div>
    </div>
    </Transition>
  </div>
</template>

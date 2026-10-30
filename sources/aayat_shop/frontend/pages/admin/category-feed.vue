<script setup lang="ts">
import type { Category, CategoryFeedSortMode, Product, Pagination } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const FEED_PICK_LIMIT = 10;

const api = useApi();
const toast = useToast();
const { formatPrice, getProductImage } = useFormat();

const categories = ref<Category[]>([]);
const categoryId = ref('');
const feedSortMode = ref<CategoryFeedSortMode>('DISCOUNT');
const selected = ref<Product[]>([]);
const loadingCategories = ref(true);
const loadingPicks = ref(false);
const saving = ref(false);
const searching = ref(false);
const search = ref('');
const searchResults = ref<Product[]>([]);

const selectedCategory = computed(() => categories.value.find((item) => item.id === categoryId.value));
const selectedIds = computed(() => new Set(selected.value.map((item) => item.id)));
const remaining = computed(() => Math.max(0, FEED_PICK_LIMIT - selected.value.length));

const sortModeHint = computed(() => {
  if (feedSortMode.value === 'MANUAL') {
    return 'محصولات انتخاب‌شده به همین ترتیب در نوار افقی این دسته نمایش داده می‌شوند.';
  }
  if (feedSortMode.value === 'DISCOUNT') {
    return 'سیستم بین ۱۰ محصول جدید این دسته، آن‌هایی با بیشترین تخفیف را اول نشان می‌دهد.';
  }
  return 'سیستم ۱۰ محصول جدید این دسته را به ترتیب تاریخ اضافه‌شدن نشان می‌دهد.';
});

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let searchSeq = 0;

onMounted(async () => {
  loadingCategories.value = true;
  try {
    const { data } = await api.get<Category[]>('/admin/categories');
    categories.value = (data ?? []).filter((item) => item.isActive);
    if (categories.value.length) {
      categoryId.value = categories.value[0].id;
      await loadPicks();
    }
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در بارگذاری دسته‌بندی‌ها');
  } finally {
    loadingCategories.value = false;
  }
});

watch(categoryId, () => {
  search.value = '';
  searchResults.value = [];
  void loadPicks();
});

watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void runSearch();
  }, 280);
});

async function loadPicks() {
  if (!categoryId.value) return;
  loadingPicks.value = true;
  try {
    const { data } = await api.get<{
      feedSortMode: CategoryFeedSortMode;
      products: Product[];
    }>(`/admin/categories/${categoryId.value}/feed-picks`);
    feedSortMode.value = data.feedSortMode ?? 'DISCOUNT';
    selected.value = data.products ?? [];
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در بارگذاری محصولات دسته');
  } finally {
    loadingPicks.value = false;
  }
}

async function runSearch() {
  const term = search.value.trim();
  if (!categoryId.value || term.length < 1) {
    searchResults.value = [];
    return;
  }
  const seq = ++searchSeq;
  searching.value = true;
  try {
    const params = new URLSearchParams({
      search: term,
      categoryId: categoryId.value,
      limit: '30',
      page: '1',
    });
    const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
      `/admin/products?${params}`
    );
    if (seq !== searchSeq) return;
    searchResults.value = (data.products ?? []).filter(
      (product) => product.isActive && !selectedIds.value.has(product.id)
    );
  } catch (e: unknown) {
    if (seq !== searchSeq) return;
    toast.error(e instanceof Error ? e.message : 'خطا در جستجو');
  } finally {
    if (seq === searchSeq) searching.value = false;
  }
}

function addProduct(product: Product) {
  if (selectedIds.value.has(product.id)) return;
  if (selected.value.length >= FEED_PICK_LIMIT) {
    toast.error(`حداکثر ${FEED_PICK_LIMIT} محصول می‌توانید انتخاب کنید`);
    return;
  }
  selected.value = [...selected.value, product];
  searchResults.value = searchResults.value.filter((item) => item.id !== product.id);
}

function removeProduct(id: string) {
  selected.value = selected.value.filter((item) => item.id !== id);
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
  if (!categoryId.value) return;
  if (feedSortMode.value === 'MANUAL' && selected.value.length === 0) {
    toast.error('در حالت انتخاب دستی حداقل یک محصول انتخاب کنید');
    return;
  }
  saving.value = true;
  try {
    const { data } = await api.put<{
      feedSortMode: CategoryFeedSortMode;
      products: Product[];
    }>(`/admin/categories/${categoryId.value}/feed-picks`, {
      feedSortMode: feedSortMode.value,
      productIds: feedSortMode.value === 'MANUAL' ? selected.value.map((item) => item.id) : [],
    });
    feedSortMode.value = data.feedSortMode ?? feedSortMode.value;
    selected.value = data.products ?? [];
    toast.success('تنظیمات نمایش دسته ذخیره شد');
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ذخیره');
  } finally {
    saving.value = false;
  }
}

useHead({ title: 'محصولات هر دسته - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-gray-800">محصولات اول هر دسته</h1>
        <p class="text-sm text-gray-500 mt-1 max-w-2xl">
          مشخص کنید در صفحه اول و صفحه دسته‌بندی‌ها، مشتری کدام محصولات هر دسته را اول ببیند.
        </p>
      </div>
      <button class="btn-primary text-sm py-2 shrink-0" :disabled="saving || !categoryId" @click="save">
        {{ saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات' }}
      </button>
    </div>

    <LoadingSpinner :show="loadingCategories" />

    <div v-if="!loadingCategories && categories.length" class="space-y-4">
      <section class="card p-4">
        <label class="block text-sm font-semibold text-gray-700 mb-2">دسته‌بندی</label>
        <select v-model="categoryId" class="input-field max-w-md">
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
        <p v-if="selectedCategory" class="text-xs text-gray-500 mt-2">
          {{ selectedCategory._count?.products ?? 0 }} محصول فعال در این دسته
        </p>
      </section>

      <LoadingSpinner :show="loadingPicks" />

      <div v-if="!loadingPicks" class="space-y-4">
        <section class="card p-4">
          <h2 class="font-bold text-gray-800 mb-3">روش نمایش</h2>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :class="[
                'admin-tab-btn px-4 py-2 text-sm font-semibold rounded-lg',
                feedSortMode === 'MANUAL'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-primary-50',
              ]"
              @click="feedSortMode = 'MANUAL'"
            >
              انتخاب دستی
            </button>
            <button
              type="button"
              :class="[
                'admin-tab-btn px-4 py-2 text-sm font-semibold rounded-lg',
                feedSortMode === 'DISCOUNT'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-red-50',
              ]"
              @click="feedSortMode = 'DISCOUNT'"
            >
              بیشترین تخفیف
            </button>
            <button
              type="button"
              :class="[
                'admin-tab-btn px-4 py-2 text-sm font-semibold rounded-lg',
                feedSortMode === 'NEWEST'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-emerald-50',
              ]"
              @click="feedSortMode = 'NEWEST'"
            >
              جدیدترین
            </button>
          </div>
          <p class="text-sm text-gray-500 mt-3">{{ sortModeHint }}</p>
        </section>

        <Transition name="admin-tab" mode="out-in">
        <div :key="feedSortMode" class="admin-tab-panel">
        <div v-if="feedSortMode === 'MANUAL'" class="grid gap-6 lg:grid-cols-2">
          <section class="card p-4">
            <h2 class="font-bold text-gray-800 mb-1">جستجو و افزودن</h2>
            <p class="text-xs text-gray-500 mb-3">
              {{ remaining ? `${remaining} جای خالی مانده` : 'ظرفیت این فهرست پر است' }}
            </p>
            <input
              v-model="search"
              type="search"
              class="input-field mb-3"
              placeholder="نام لباس این دسته..."
            />
            <LoadingSpinner :show="searching" />
            <ul v-if="!searching && searchResults.length" class="divide-y divide-gray-100">
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
            <p v-else-if="!searching && search.trim()" class="text-sm text-gray-400 py-4">
              محصولی در این دسته پیدا نشد.
            </p>
          </section>

          <section class="card p-4">
            <h2 class="font-bold text-gray-800 mb-3">
              ترتیب نمایش
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
    </div>

    <p v-else-if="!loadingCategories" class="text-sm text-gray-400">دسته‌بندی فعالی وجود ندارد.</p>
  </div>
</template>

<script setup lang="ts">
import type { Product, Category, Pagination } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();
const { formatPrice, resolveMediaUrl, formatNumber } = useFormat();

const PAGE_SIZE = 20;

const products = ref<Product[]>([]);
const pagination = ref<Pagination | null>(null);
const page = ref(1);
const categories = ref<Category[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editingId = ref<string | null>(null);
const search = ref('');
const categoryFilter = ref('');
const sortFilter = ref<'newest' | 'discount' | 'bestsellers'>('newest');
const statusFilter = ref<'active' | 'inactive' | 'all'>('active');

const form = reactive({
  name: '',
  description: '',
  price: 0,
  discountPrice: null as number | null,
  stock: 0,
  unit: '',
  categoryIds: [] as string[],
  image: null as string | null,
  images: [] as string[],
  isFeatured: false,
  isNew: false,
  isOldPrice: false,
  isHomeDeal: false,
  isHomeFeatured: false,
  isActive: true,
  clothingMetaJson: '',
});

const categoryOptions = computed(() =>
  categories.value.map((cat) => ({
    value: cat.id,
    label: cat.name,
    icon: 'lucide:folder',
  }))
);

onMounted(loadData);

function resetToFirstPageAndLoad() {
  page.value = 1;
  void loadData();
}

async function loadData() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(page.value),
    });
    if (search.value.trim()) params.set('search', search.value.trim());
    if (categoryFilter.value) params.set('categoryId', categoryFilter.value);
    if (sortFilter.value && sortFilter.value !== 'newest') params.set('sort', sortFilter.value);
    if (statusFilter.value !== 'all') params.set('status', statusFilter.value);

    const [prodRes, catRes] = await Promise.all([
      api.get<{ products: Product[]; pagination: Pagination }>(`/admin/products?${params}`),
      categories.value.length
        ? Promise.resolve({ data: categories.value })
        : api.get<Category[]>('/admin/categories'),
    ]);
    products.value = prodRes.data.products;
    pagination.value = prodRes.data.pagination;
    categories.value = catRes.data;

    if (
      pagination.value &&
      pagination.value.totalPages > 0 &&
      page.value > pagination.value.totalPages
    ) {
      page.value = pagination.value.totalPages;
      await loadData();
    }
  } finally {
    loading.value = false;
  }
}

function goToPage(next: number) {
  page.value = next;
  void loadData();
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openForm(product?: Product) {
  if (product) {
    editingId.value = product.id;
    Object.assign(form, {
      name: product.name,
      description: product.description || '',
      price: product.price,
      discountPrice: product.discountPrice,
      stock: product.stock,
      unit: product.unit || '',
      categoryIds: product.categoryIds?.length
        ? [...product.categoryIds]
        : product.categoryId
          ? [product.categoryId]
          : [],
      image: product.image,
      images: product.images?.length ? [...product.images] : product.image ? [product.image] : [],
      isFeatured: product.isFeatured,
      isNew: product.isNew,
      isOldPrice: product.isOldPrice ?? false,
      isHomeDeal: product.isHomeDeal ?? false,
      isHomeFeatured: product.isHomeFeatured ?? false,
      isActive: product.isActive,
      clothingMetaJson: product.clothingMeta ? JSON.stringify(product.clothingMeta, null, 2) : '',
    });
  } else {
    editingId.value = null;
    Object.assign(form, {
      name: '',
      description: '',
      price: 0,
      discountPrice: null,
      stock: 0,
      unit: '',
      categoryIds: [],
      image: null,
      images: [],
      isFeatured: false,
      isNew: false,
      isOldPrice: false,
      isHomeDeal: false,
      isHomeFeatured: false,
      isActive: true,
      clothingMetaJson: '',
    });
  }
  showForm.value = true;
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function onDiscountPriceInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value.trim();
  form.discountPrice = raw === '' ? null : Number(raw);
}

async function save() {
  if (!form.categoryIds.length) {
    toast.error('حداقل یک دسته‌بندی انتخاب کنید');
    return;
  }

  const price = toOptionalNumber(form.price);
  if (price === null || price <= 0) {
    toast.error('قیمت باید یک عدد معتبر باشد');
    return;
  }

  const discountPrice = toOptionalNumber(form.discountPrice);
  if (discountPrice !== null && discountPrice <= 0) {
    toast.error('قیمت با تخفیف باید خالی باشد یا عددی بزرگ‌تر از صفر');
    return;
  }
  if (discountPrice !== null && discountPrice >= price) {
    toast.error('قیمت با تخفیف باید کمتر از قیمت اصلی باشد');
    return;
  }

  const stock = toOptionalNumber(form.stock) ?? 0;

  let clothingMeta: Record<string, unknown> | null = null;
  if (form.clothingMetaJson.trim()) {
    try {
      clothingMeta = JSON.parse(form.clothingMetaJson) as Record<string, unknown>;
    } catch {
      toast.error('JSON مشخصات پوشاک نامعتبر است');
      return;
    }
  }

  const { clothingMetaJson: _omit, ...formFields } = form;
  const payload = {
    ...formFields,
    price,
    discountPrice,
    stock,
    clothingMeta,
    categoryIds: form.categoryIds,
    categoryId: form.categoryIds[0] ?? null,
    image: form.images[0] ?? form.image,
    images: form.images,
  };

  try {
    if (editingId.value) {
      await api.put(`/admin/products/${editingId.value}`, payload);
      toast.success('محصول به‌روزرسانی شد');
    } else {
      await api.post('/admin/products', payload);
      toast.success('محصول ایجاد شد');
    }
    showForm.value = false;
    await loadData();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ذخیره محصول');
  }
}

async function deactivate(product: Product) {
  if (!product.isActive) {
    toast.info('این محصول از قبل غیرفعال است');
    return;
  }
  if (
    !confirm(
      `محصول «${product.name}» از فروشگاه پنهان می‌شود (غیرفعال).\n\nرکورد در پنل باقی می‌ماند و می‌توانید بعداً دوباره فعالش کنید.`
    )
  ) {
    return;
  }

  try {
    await api.put(`/admin/products/${product.id}`, { isActive: false });
    toast.success('محصول غیرفعال شد');
    await loadData();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در غیرفعال‌سازی محصول');
  }
}

async function activate(product: Product) {
  if (product.isActive) {
    toast.info('این محصول از قبل فعال است');
    return;
  }
  if (!confirm(`محصول «${product.name}» دوباره در فروشگاه نمایش داده شود؟`)) {
    return;
  }

  try {
    await api.put(`/admin/products/${product.id}`, { isActive: true });
    toast.success('محصول فعال شد');
    await loadData();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در فعال‌سازی محصول');
  }
}

useHead({ title: 'محصولات - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 class="text-xl font-bold text-gray-800">مدیریت محصولات</h1>
        <p class="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
          نام، قیمت، موجودی و دسته را اینجا عوض کنید. «قیمت با تخفیف» اگر پر باشد روی کارت محصول خط‌خورده نشان داده می‌شود.
          غیرفعال کردن، لباس را از فروشگاه پنهان می‌کند ولی حذف نمی‌کند.
        </p>
      </div>
      <div class="flex flex-wrap gap-3 text-sm">
        <NuxtLink to="/admin/home-picks" class="font-medium text-primary-600 hover:text-primary-700">
          انتخاب محصولات صفحه اول
        </NuxtLink>
        <NuxtLink to="/admin/category-feed" class="font-medium text-primary-600 hover:text-primary-700">
          ترتیب محصولات هر دسته
        </NuxtLink>
      </div>
    </div>
    <div class="flex flex-col md:flex-row gap-3 mb-4 flex-wrap">
      <input
        v-model="search"
        type="search"
        class="input-field md:max-w-sm"
        placeholder="جستجو نام محصول..."
        @keyup.enter="resetToFirstPageAndLoad"
      />
      <AppSelect
        v-model="categoryFilter"
        :options="[{ value: '', label: 'همه دسته‌ها', icon: 'lucide:layers' }, ...categoryOptions]"
        class="md:max-w-xs"
        @update:model-value="resetToFirstPageAndLoad"
      />
      <select v-model="sortFilter" class="input-field md:w-48" @change="resetToFirstPageAndLoad">
        <option value="newest">جدیدترین</option>
        <option value="discount">بیشترین تخفیف</option>
        <option value="bestsellers">پرفروش‌ترین</option>
      </select>
      <select v-model="statusFilter" class="input-field md:w-44" @change="resetToFirstPageAndLoad">
        <option value="active">فقط فعال</option>
        <option value="inactive">فقط غیرفعال</option>
        <option value="all">همه وضعیت‌ها</option>
      </select>
      <button class="btn-secondary text-sm" @click="resetToFirstPageAndLoad">اعمال فیلتر</button>
    </div>

    <div class="flex justify-between items-center mb-6">
      <p class="text-sm text-gray-500">
        {{ formatNumber(pagination?.total ?? products.length) }} محصول
      </p>
      <button class="btn-primary text-sm py-2" @click="openForm()">+ افزودن محصول</button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="data-table-wrap">
      <table class="data-table min-w-[760px]">
        <thead>
          <tr>
            <th class="w-16">تصویر</th>
            <th>نام</th>
            <th class="hidden md:table-cell">دسته</th>
            <th class="data-num">قیمت</th>
            <th class="data-num hidden md:table-cell">موجودی</th>
            <th>وضعیت</th>
            <th class="data-actions">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id">
            <td>
              <div class="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center ring-1 ring-slate-200/80">
                <img
                  v-if="product.image"
                  :src="resolveMediaUrl(product.image)"
                  :alt="product.name"
                  class="w-full h-full object-cover"
                />
                <AppIcon v-else name="lucide:image-off" size="sm" class="text-slate-300" />
              </div>
            </td>
            <td>
              <p class="font-semibold text-slate-800">{{ product.name }}</p>
            </td>
            <td class="hidden md:table-cell text-slate-500">{{ product.category?.name || '—' }}</td>
            <td class="data-num">
              <div class="inline-flex flex-col items-end gap-0.5">
                <span
                  v-if="product.discountPrice"
                  class="text-xs text-slate-400 line-through"
                >
                  {{ formatPrice(product.price) }}
                </span>
                <span :class="product.discountPrice ? 'text-red-600 font-semibold' : 'font-medium text-slate-800'">
                  {{ formatPrice(product.effectivePrice) }}
                </span>
                <span v-if="product.discountPercent" class="text-[11px] text-red-500">
                  {{ product.discountPercent }}٪ تخفیف
                </span>
              </div>
            </td>
            <td class="data-num hidden md:table-cell">{{ product.stock }}</td>
            <td>
              <span :class="product.isActive ? 'admin-badge-success' : 'admin-badge-danger'">
                {{ product.isActive ? 'فعال' : 'غیرفعال' }}
              </span>
            </td>
            <td class="data-actions">
              <div class="admin-actions">
                <button type="button" class="admin-btn-secondary" @click="openForm(product)">ویرایش</button>
                <button
                  v-if="product.isActive"
                  type="button"
                  class="admin-btn-warn"
                  @click="deactivate(product)"
                >
                  غیرفعال
                </button>
                <button
                  v-else
                  type="button"
                  class="admin-btn-success"
                  @click="activate(product)"
                >
                  فعال‌سازی
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AppPagination :pagination="pagination" compact @update:page="goToPage" />

    <!-- Product form modal -->
    <div v-if="showForm" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" @click.self="showForm = false">
      <div class="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 class="text-lg font-bold mb-4">{{ editingId ? 'ویرایش محصول' : 'افزودن محصول' }}</h2>
        <form class="space-y-4" @submit.prevent="save">
          <AppImagesUpload
            v-model="form.images"
            upload-endpoint="/admin/products/upload"
            label="تصاویر محصول"
            hint="JPEG, PNG, WebP یا GIF — حداکثر ۵ مگابایت"
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">نام محصول</label>
            <input v-model="form.name" required placeholder="مثلاً بلوز بافت زنانه" class="input-field" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
            <textarea
              v-model="form.description"
              placeholder="توضیحات کوتاه محصول"
              rows="3"
              class="input-field resize-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">قیمت (تومان)</label>
              <input v-model.number="form.price" type="number" min="0" required class="input-field" dir="ltr" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">قیمت با تخفیف</label>
              <input
                :value="form.discountPrice ?? ''"
                type="number"
                min="0"
                placeholder="اختیاری — خالی = بدون تخفیف"
                class="input-field"
                dir="ltr"
                @input="onDiscountPriceInput"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">موجودی انبار</label>
              <input v-model.number="form.stock" type="number" min="0" required class="input-field" dir="ltr" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">جنس پارچه</label>
              <input v-model="form.unit" placeholder="مثلاً کتان" class="input-field" />
              <p class="mt-1 text-xs text-gray-400">روی کارت محصول، زیر نام لباس دیده می‌شود.</p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">سایز، رنگ و موجودی هر تنوع</label>
            <textarea
              v-model="form.clothingMetaJson"
              rows="5"
              dir="ltr"
              class="input-field font-mono text-xs"
              placeholder='{"fabric":"کتان","sizes":["S","M","L"],"colors":[{"name":"مشکی","hex":"#111"}],"variants":[{"color":"مشکی","size":"M","stock":3}]}'
            />
            <p class="text-xs leading-5 text-gray-400 mt-1">
              فقط اگر سایز و رنگ جدا دارید پر کنید. sizes فهرست سایز، colors رنگ‌ها و variants موجودی هر ترکیب است. اگر خالی بماند، فقط موجودی کلی بالا استفاده می‌شود.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">دسته‌بندی‌ها</label>
            <AppMultiSelect
              v-model="form.categoryIds"
              :options="categoryOptions"
              placeholder="یک یا چند دسته‌بندی انتخاب کنید"
              searchable
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">وضعیت نمایش</label>
            <div class="flex flex-wrap gap-2">
              <AppToggleChip v-model="form.isNew" label="جدید" icon="lucide:badge-plus" />
              <AppToggleChip v-model="form.isHomeDeal" label="تخفیف‌دار صفحه اول" icon="lucide:percent" />
              <AppToggleChip v-model="form.isHomeFeatured" label="ویژه صفحه اول" icon="lucide:house" />
              <AppToggleChip v-model="form.isActive" label="فعال در فروشگاه" icon="lucide:eye" />
            </div>
            <p class="mt-2 text-xs leading-5 text-gray-400">
              «تخفیف‌دار» و «ویژه صفحه اول» همان فهرست‌هایی هستند که در منوی صفحه اول چیده می‌شوند. «جدید» در فیلتر تازه‌ها می‌آید.
            </p>
          </div>

          <button type="submit" class="btn-primary w-full">ذخیره</button>
        </form>
      </div>
    </div>
  </div>
</template>

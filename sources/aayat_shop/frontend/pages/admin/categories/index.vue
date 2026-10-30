<script setup lang="ts">
import type { Category } from '~/types';
import { isHomeCategorySlug } from '~/constants/homeCategoryTiles';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();
const { resolveMediaUrl } = useFormat();

const categories = ref<Category[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editingId = ref<string | null>(null);
const saving = ref(false);

const form = reactive({ name: '', sortOrder: 0, isActive: true, image: null as string | null });

onMounted(loadData);

async function loadData() {
  loading.value = true;
  try {
    const { data } = await api.get<Category[]>('/admin/categories');
    categories.value = data;
  } finally {
    loading.value = false;
  }
}

function openForm(category?: Category) {
  if (category) {
    editingId.value = category.id;
    form.name = category.name;
    form.sortOrder = category.sortOrder;
    form.isActive = category.isActive;
    form.image = category.image;
  } else {
    editingId.value = null;
    form.name = '';
    form.sortOrder = categories.value.length;
    form.isActive = true;
    form.image = null;
  }
  showForm.value = true;
}

const editingCategory = computed(() =>
  editingId.value ? categories.value.find((item) => item.id === editingId.value) || null : null
);

async function save() {
  saving.value = true;
  try {
    if (editingId.value) {
      await api.put(`/admin/categories/${editingId.value}`, { ...form });
      toast.success('دسته‌بندی به‌روزرسانی شد');
    } else {
      await api.post('/admin/categories', { ...form });
      toast.success('دسته‌بندی ایجاد شد');
    }
    showForm.value = false;
    await loadData();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ذخیره دسته‌بندی');
  } finally {
    saving.value = false;
  }
}

async function remove(id: string) {
  const category = categories.value.find((item) => item.id === id);
  const productCount = category?._count?.products ?? 0;
  if (productCount > 0) {
    toast.error(`این دسته ${productCount} محصول دارد و قابل حذف نیست. ابتدا محصولات را منتقل یا غیرفعال کنید.`);
    return;
  }
  if (!confirm('آیا از حذف این دسته‌بندی مطمئن هستید؟')) return;

  try {
    await api.delete(`/admin/categories/${id}`);
    toast.success('دسته‌بندی حذف شد');
    await loadData();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'خطا در حذف دسته‌بندی';
    toast.error(message.includes('محصول') ? message : 'حذف انجام نشد. ممکن است این دسته هنوز محصول داشته باشد.');
  }
}

useHead({ title: 'دسته‌بندی‌ها - پنل مدیریت' });
</script>

<template>
  <div>
    <h1 class="mb-2 text-xl font-bold text-gray-800">مدیریت دسته‌بندی‌ها</h1>
    <p class="mb-6 max-w-3xl text-sm leading-6 text-gray-500">
      دسته‌ای که نشان «صفحه اول» دارد، همان کارت‌های بالای فروشگاه است. برای عوض کردن عکس، ویرایش را بزنید و «تصویر کارت صفحه اول» را عوض کنید.
      دستهٔ غیرفعال در فروشگاه نشان داده نمی‌شود. دسته‌ای که لباس دارد را نمی‌شود حذف کرد.
    </p>
    <div class="mb-6 flex justify-end">
      <button class="btn-primary py-2 text-sm" @click="openForm()">+ افزودن</button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="data-table-wrap">
      <table class="data-table min-w-[720px]">
        <thead>
          <tr>
            <th class="w-24">تصویر</th>
            <th>نام</th>
            <th class="data-num">ترتیب</th>
            <th class="data-num">محصول</th>
            <th>نشان</th>
            <th class="data-actions">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cat in categories" :key="cat.id">
            <td>
              <div class="flex h-12 w-[4.5rem] items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-[#f7f1e8]">
                <img
                  v-if="cat.image"
                  :src="resolveMediaUrl(cat.image)"
                  :alt="cat.name"
                  class="h-full w-full object-cover"
                />
                <AppIcon v-else name="lucide:image" size="md" class="text-slate-300" />
              </div>
            </td>
            <td class="font-semibold text-slate-800">{{ cat.name }}</td>
            <td class="data-num">{{ cat.sortOrder }}</td>
            <td class="data-num">{{ cat._count?.products || 0 }}</td>
            <td>
              <span v-if="isHomeCategorySlug(cat.slug)" class="admin-badge-info">صفحه اول</span>
              <span v-else class="text-slate-300">—</span>
            </td>
            <td class="data-actions">
              <div class="admin-actions">
                <button type="button" class="admin-btn-secondary" @click="openForm(cat)">ویرایش</button>
                <button
                  type="button"
                  class="admin-btn-danger"
                  :disabled="(cat._count?.products ?? 0) > 0"
                  :title="(cat._count?.products ?? 0) > 0 ? 'ابتدا محصولات این دسته را منتقل یا غیرفعال کنید' : 'حذف دسته‌بندی'"
                  @click="remove(cat.id)"
                >
                  حذف
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showForm = false">
      <div class="w-full max-w-sm rounded-2xl bg-white p-6">
        <h2 class="mb-4 text-lg font-bold">{{ editingId ? 'ویرایش' : 'افزودن' }} دسته‌بندی</h2>
        <form class="space-y-3" @submit.prevent="save">
          <AppImageUpload
            v-model="form.image"
            upload-endpoint="/admin/categories/upload"
            label="تصویر کارت صفحه اول"
            hint="JPEG, PNG یا WebP — این تصویر در گرید دسته‌های صفحه اصلی فروشگاه دیده می‌شود"
            preview-class="w-full aspect-[2/1] max-h-40 object-cover rounded-xl bg-[#f7f1e8]"
          />
          <p
            v-if="editingCategory && isHomeCategorySlug(editingCategory.slug)"
            class="rounded-xl bg-primary-50 px-3 py-2 text-xs text-primary-800"
          >
            این دسته روی صفحه اول نمایش داده می‌شود. بعد از ذخیره، عکس جدید همان‌جا دیده می‌شود.
          </p>
          <input v-model="form.name" required placeholder="نام دسته‌بندی" class="input-field" />
          <input v-model.number="form.sortOrder" type="number" placeholder="ترتیب" class="input-field" />
          <AppSwitch v-model="form.isActive" label="دسته‌بندی فعال" description="در فروشگاه نمایش داده شود" />
          <button type="submit" class="btn-primary w-full" :disabled="saving">
            {{ saving ? 'در حال ذخیره…' : 'ذخیره' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
